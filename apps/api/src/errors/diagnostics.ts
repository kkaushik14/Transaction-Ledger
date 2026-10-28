/** Private searchable JSON diagnostics preserve causes while redacting credentials and request payloads. */
import { randomUUID } from 'node:crypto';
import type { ErrorCode } from '@ledger/contracts';
export interface ErrorLogRecord {
  supportTicketId: string;
  code: ErrorCode;
  scope: string;
  error: unknown;
}
export type ErrorLogger = (record: ErrorLogRecord) => void;
/** Handles quoted secrets, authorization headers and connection URLs before any text reaches logs. */
function redact(text: string): string {
  return text
    .replace(/\b(?:postgres(?:ql)?|https?):\/\/[^\s'"<>]+/gi, '[redacted URL]')
    .replace(/\bBearer\s+[^\s'",;]+/gi, 'Bearer [redacted]')
    .replace(
      /["']?\b(password|passwd|secret|token|authorization|api[_-]?key)["']?\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi,
      '$1=[redacted]',
    );
}
/** Unknown records, revoked proxies, hostile getters, arrays and circular causal chains cannot break error responses. */
export function serializeDiagnostic(error: unknown, seen = new Set<unknown>(), depth = 0): unknown {
  if (depth > 8) return '[cause depth limited]';
  if (typeof error === 'string') return redact(error);
  if (error === null || typeof error === 'number' || typeof error === 'boolean') return error;
  if (typeof error === 'function') return '[function]';
  if (typeof error !== 'object') return String(error);
  if (seen.has(error)) return '[circular error]';
  seen.add(error);
  try {
    if (Array.isArray(error))
      return error.slice(0, 32).map((item: unknown) => serializeDiagnostic(item, seen, depth + 1));
  } catch {
    return '[unreadable diagnostic object]';
  }
  let ownKeys: string[];
  try {
    ownKeys = Object.getOwnPropertyNames(error).slice(0, 32);
  } catch {
    return '[unreadable diagnostic object]';
  }
  const keys = new Set([
    'name',
    'message',
    'stack',
    'code',
    'constraint',
    'cause',
    'errors',
    'details',
    ...ownKeys,
  ]);
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (/password|passwd|secret|token|authorization|api[_-]?key/i.test(key)) {
      result[key] = '[redacted]';
      continue;
    }
    if (
      [
        // Driver context can embed complete SQL literals or rejected rows. Preserve
        // code/constraint/message/cause, but never serialize those payload carriers.
        'internalquery',
        'querytext',
        'sqltext',
        'detail',
        'where',
        'body',
        'request',
        'response',
        'query',
        'sql',
        'parameters',
        'values',
        'config',
        'connection',
        'client',
      ].includes(key.toLowerCase())
    ) {
      result[key] = '[omitted]';
      continue;
    }
    try {
      const value: unknown = Reflect.get(error, key);
      if (value !== undefined) result[key] = serializeDiagnostic(value, seen, depth + 1);
    } catch {
      result[key] = '[unreadable diagnostic]';
    }
  }
  return result;
}
/** One formatter serves the default private console sink and injectable trusted/file-based log consumers. */
export function createErrorLogger(
  write: (line: string) => void = (line) => console.error(line),
): ErrorLogger {
  return ({ error, ...record }) =>
    write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...record,
        error: serializeDiagnostic(error),
      }),
    );
}
/** Bounded private fallback records keep support IDs traceable if the console sink itself fails. */
const loggingFailures: { record: ErrorLogRecord; timestamp: string; loggingError: unknown }[] = [];
const defaultLogger = createErrorLogger();
export const logError: ErrorLogger = (record) => {
  try {
    defaultLogger(record);
  } catch (loggingError: unknown) {
    loggingFailures.push({ record, timestamp: new Date().toISOString(), loggingError });
    if (loggingFailures.length > 50) loggingFailures.shift();
  }
};
/** Trusted process-local inspection only; raw causes are never exposed over HTTP. */
export function getLoggingFailures(
  supportTicketId?: string,
): readonly { record: ErrorLogRecord; timestamp: string; loggingError: unknown }[] {
  return loggingFailures.filter(
    (item) =>
      !supportTicketId ||
      item.record.supportTicketId.toLowerCase() === supportTicketId.toLowerCase(),
  );
}
/** Handles detached lifecycle/pool errors through the same correlated internal logger. */
export function logInternalError(error: unknown, scope: string): string {
  const supportTicketId = randomUUID();
  logError({ supportTicketId, code: 'INTERNAL_ERROR', scope, error });
  return supportTicketId;
}
