/** Central safe error mapping for body parsing, application failures, and known SQL constraints. */
import type { ErrorRequestHandler } from 'express';
import type { ApiErrorResponse } from '@ledger/contracts';
import { ApiError } from '../errors/index.js';

/** Reads a named error property without assuming driver or parser error classes. */
function property(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null && key in error
    ? Reflect.get(error, key)
    : undefined;
}

/** Maps expected failures to public errors; all unrecognized failures remain generic 500s. */
function publicError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (
    property(error, 'code') === '23505' &&
    property(error, 'constraint') === 'transfers_source_reference_unique'
  ) {
    // Persistent transfer deduplication remains a backstop to the locked service precheck.
    return new ApiError(
      409,
      'DUPLICATE_TRANSFER',
      'Reference already used for this source account',
    );
  }
  if (error instanceof URIError && property(error, 'status') === 400) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Invalid URL parameter encoding');
  }
  if (
    property(error, 'code') === '23505' &&
    property(error, 'constraint') === 'transactions_account_reference_unique'
  ) {
    // The transaction helper has rolled back before a driver error reaches HTTP.
    return new ApiError(409, 'DUPLICATE_TRANSACTION', 'Reference already used for this account');
  }
  const type = property(error, 'type');
  if (type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  if (type === 'encoding.unsupported' || type === 'charset.unsupported') {
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported request encoding');
  }
  if (
    type === 'entity.parse.failed' ||
    type === 'request.aborted' ||
    type === 'request.size.invalid'
  ) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Invalid JSON request body');
  }
  if (
    property(error, 'code') === '23514' &&
    property(error, 'constraint') === 'accounts_name_not_blank'
  ) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Account name must not be blank');
  }
  return new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

/** Returns one consistent envelope; logs only safe method/route context for unexpected errors. */
export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) {
    // Express must finish error handling once headers were written; do not forward
    // raw driver errors to its fallback logger or response implementation.
    next(new Error('Request failed after response headers were sent'));
    return;
  }
  const mapped = publicError(error);
  if (mapped.status === 500) {
    console.error('Unexpected API failure', {
      method: request.method,
      route: request.route?.path ?? 'unmatched',
    });
  }
  const body: ApiErrorResponse = {
    error: { code: mapped.code, message: mapped.message, details: mapped.details },
  };
  response.status(mapped.status).json(body);
};
