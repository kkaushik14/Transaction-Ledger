/** Public application errors with explicit safe messages and HTTP metadata. */
import type { ApiErrorCode } from '@ledger/contracts';

/** Carries only intentionally public error details; never wrap raw SQL error text here. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
