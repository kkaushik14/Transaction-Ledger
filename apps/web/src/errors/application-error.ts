/** Typed browser failures retain original causes internally and carry stable support correlation. */
import type { ErrorCode } from '@ledger/contracts';
export class ApplicationError extends Error {
  readonly supportTicketId: string;
  constructor(
    message: string,
    readonly code: ErrorCode = 'INTERNAL_ERROR',
    readonly status = 0,
    options?: ErrorOptions,
    supportTicketId?: string,
  ) {
    super(message, options);
    this.name = 'ApplicationError';
    this.supportTicketId = supportTicketId ?? crypto.randomUUID();
  }
  get uncertain(): boolean {
    return (
      ['NETWORK_ERROR', 'INVALID_RESPONSE', 'INTERNAL_ERROR'].includes(this.code) ||
      this.status >= 500
    );
  }
}
/** HTTP failures share application recovery semantics without exposing received message text. */
export class ApiClientError extends ApplicationError {
  constructor(
    message: string,
    code: ErrorCode,
    status = 0,
    options?: ErrorOptions,
    supportTicketId?: string,
  ) {
    super(message, code, status, options, supportTicketId);
    this.name = 'ApiClientError';
  }
}
const normalized = new WeakMap<object, ApplicationError>();
/** Narrow unknown thrown values once and preserve the original object as the cause. */
export function asApplicationError(
  error: unknown,
  fallback: ErrorCode = 'INTERNAL_ERROR',
): ApplicationError {
  try {
    if (error instanceof ApplicationError) return error;
  } catch {
    /* Uninspectable thrown values still retain their identity/cause below. */
  }
  if ((typeof error === 'object' && error !== null) || typeof error === 'function') {
    const existing = normalized.get(error);
    if (existing) return existing;
  }
  const failure = new ApplicationError('Unexpected browser failure', fallback, 0, { cause: error });
  if ((typeof error === 'object' && error !== null) || typeof error === 'function')
    normalized.set(error, failure);
  return failure;
}
