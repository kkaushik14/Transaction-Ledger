/** Searchable, bounded browser diagnostics stay separate from public copy and remote ticket systems. */
import { ApplicationError, asApplicationError } from './application-error.js';
import type { ErrorCode } from '@ledger/contracts';
/** Original causes stay private; console output contains only safe correlation metadata. */
export interface ClientErrorDiagnostic {
  supportTicketId: string;
  timestamp: string;
  code: ErrorCode;
  scope: string;
  error: ApplicationError;
  relatedSupportTicketIds: string[];
  consoleError?: unknown;
}
const records: ClientErrorDiagnostic[] = [];
const logged = new WeakSet<ApplicationError>();
/** Logs each failure once and adds explicit links when one notice represents multiple failed reads. */
export function reportError(
  error: unknown,
  scope: string,
  related: readonly ApplicationError[] = [],
): ApplicationError {
  const failure = asApplicationError(error);
  let record = records.find((item) => item.error === failure);
  const first = !logged.has(failure);
  if (!record) {
    record = {
      supportTicketId: failure.supportTicketId,
      timestamp: new Date().toISOString(),
      code: failure.code,
      scope,
      error: failure,
      relatedSupportTicketIds: [],
    };
    records.push(record);
    if (records.length > 50) records.shift();
  }
  const links = related
    .map((item) => item.supportTicketId)
    .filter((id) => id !== failure.supportTicketId && !record.relatedSupportTicketIds.includes(id));
  record.relatedSupportTicketIds.push(...new Set(links));
  if (first || links.length) {
    logged.add(failure);
    const { error: _privateError, consoleError: _privateLoggingError, ...metadata } = record;
    void _privateError;
    void _privateLoggingError;
    // A broken console must not break the recovery screen; retain the logging failure privately.
    try {
      console.error(JSON.stringify(metadata));
    } catch (consoleError: unknown) {
      record.consoleError = consoleError;
    }
  }
  return failure;
}
/** Finds retained records by visible support ID, including linked/coalesced failures; no UI exposes originals. */
export function getErrorDiagnostics(supportTicketId?: string): readonly ClientErrorDiagnostic[] {
  return records.filter(
    (record) =>
      !supportTicketId ||
      record.supportTicketId.toLowerCase() === supportTicketId.toLowerCase() ||
      record.relatedSupportTicketIds.some(
        (id) => id.toLowerCase() === supportTicketId.toLowerCase(),
      ),
  );
}
/** Detached synchronous/async UI callbacks use one rejection path rather than fire-and-forget promises. */
export function runSafely(operation: () => void | Promise<unknown>, scope: string): void {
  try {
    void Promise.resolve(operation()).catch((error: unknown) => publishError(error, scope));
  } catch (error: unknown) {
    publishError(error, scope);
  }
}
/** Application-level listeners display unexpected failures once, without exposing browser stack text. */
export function publishError(error: unknown, scope: string): void {
  window.dispatchEvent(
    new CustomEvent('ledger:unexpected-error', { detail: reportError(error, scope) }),
  );
}
