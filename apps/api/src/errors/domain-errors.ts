/** Typed domain failures encode expected business outcomes while retaining their original causes. */
import { ApiError } from './api-error.js';
export class AccountNotFoundError extends ApiError {
  constructor(options?: ErrorOptions) {
    super(404, 'ACCOUNT_NOT_FOUND', 'Account lookup failed', {}, options);
    this.name = 'AccountNotFoundError';
  }
}
export class DuplicateReferenceError extends ApiError {
  constructor(kind: 'transaction' | 'transfer', options?: ErrorOptions) {
    super(
      409,
      kind === 'transfer' ? 'DUPLICATE_TRANSFER' : 'DUPLICATE_TRANSACTION',
      'Reference collision',
      {},
      options,
    );
    this.name = 'DuplicateReferenceError';
  }
}
export class InsufficientBalanceError extends ApiError {
  constructor(options?: ErrorOptions) {
    super(422, 'INSUFFICIENT_BALANCE', 'Balance guard rejected debit', {}, options);
    this.name = 'InsufficientBalanceError';
  }
}
export class BalanceLimitError extends ApiError {
  constructor(options?: ErrorOptions) {
    super(422, 'BALANCE_LIMIT_EXCEEDED', 'Balance guard rejected credit', {}, options);
    this.name = 'BalanceLimitError';
  }
}
export class InputValidationError extends ApiError {
  constructor(details: Record<string, unknown> = {}, options?: ErrorOptions) {
    super(400, 'VALIDATION_ERROR', 'Input validation failed', details, options);
    this.name = 'InputValidationError';
  }
}
