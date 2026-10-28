/** Public application errors with explicit safe messages and HTTP metadata. */
import type { ApiErrorCode } from '@ledger/contracts';

/** Internal typed failure; public messages are resolved by code, never from this message or details. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}
