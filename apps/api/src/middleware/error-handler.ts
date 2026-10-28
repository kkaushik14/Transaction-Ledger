/** Final HTTP boundary maps unknown internal failures to allowlisted, correlated public responses. */
import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler } from 'express';
import {
  apiErrorCodeSchema,
  resolveErrorMessage,
  type ApiErrorCode,
  type ApiErrorResponse,
} from '@ledger/contracts';
import {
  ApiError,
  DuplicateReferenceError,
  InputValidationError,
  logError,
  type ErrorLogger,
} from '../errors/index.js';
/** Status is determined centrally by a trusted code, never by a driver or client-provided property. */
const statuses = {
  VALIDATION_ERROR: 400,
  ACCOUNT_NOT_FOUND: 404,
  DUPLICATE_TRANSACTION: 409,
  DUPLICATE_TRANSFER: 409,
  INSUFFICIENT_BALANCE: 422,
  BALANCE_LIMIT_EXCEEDED: 422,
  ROUTE_NOT_FOUND: 404,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
} satisfies Record<ApiErrorCode, number>;
/** Reads unknown error metadata without trusting accessors. */
function property(error: unknown, key: string): unknown {
  try {
    return typeof error === 'object' && error !== null ? Reflect.get(error, key) : undefined;
  } catch {
    return undefined;
  } // Unreadable metadata follows the safe unknown-error path; original object is logged.
}
/** Driver/parser errors retain their cause; only recognized constraint identities affect public codes. */
function classifyApiError(error: unknown): ApiError {
  if (error instanceof ApiError && apiErrorCodeSchema.safeParse(error.code).success) return error;
  const options = { cause: error };
  if (property(error, 'code') === '23505') {
    if (property(error, 'constraint') === 'transfers_source_reference_unique')
      return new DuplicateReferenceError('transfer', options);
    if (property(error, 'constraint') === 'transactions_account_reference_unique')
      return new DuplicateReferenceError('transaction', options);
  }
  if (error instanceof URIError && property(error, 'status') === 400)
    return new InputValidationError({}, options);
  const type = property(error, 'type');
  if (type === 'entity.too.large')
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Body limit exceeded', {}, options);
  if (type === 'encoding.unsupported' || type === 'charset.unsupported')
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported encoding', {}, options);
  if (
    typeof type === 'string' &&
    ['entity.parse.failed', 'request.aborted', 'request.size.invalid'].includes(type)
  )
    return new InputValidationError({}, options);
  if (
    property(error, 'code') === '23514' &&
    property(error, 'constraint') === 'accounts_name_not_blank'
  )
    return new InputValidationError({}, options);
  return new ApiError(500, 'INTERNAL_ERROR', 'Unexpected request failure', {}, options);
}
/** Broken metadata must fall back to a generic failure, never to Express's HTML/stack response. */
export function toApiError(error: unknown): ApiError {
  try {
    return classifyApiError(error);
  } catch (mappingError: unknown) {
    return new ApiError(
      500,
      'INTERNAL_ERROR',
      'Error inspection failed',
      {},
      {
        cause: new AggregateError([error, mappingError], 'Error inspection failed', {
          cause: error,
        }),
      },
    );
  }
}
/** One diagnostic and one four-field envelope per failed request; no stack/details/body reach browsers. */
export function createErrorHandler(logger: ErrorLogger = logError): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    void _next; // Express recognizes error middleware by its required four-argument arity.
    const mapped = toApiError(error);
    const supportTicketId: string = response.locals.supportTicketId ?? randomUUID();
    const record = {
      supportTicketId,
      code: mapped.code,
      scope: `${request.method} ${response.locals.routePrefix ?? request.baseUrl}${request.route?.path ?? 'unmatched'}`,
      error: mapped,
    };
    try {
      logger(record);
    } catch (loggingError: unknown) {
      logError({
        ...record,
        scope: 'logging.fallback',
        error: new AggregateError([mapped, loggingError], 'Diagnostic sink failed', {
          cause: mapped,
        }),
      });
    }
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const presentation = resolveErrorMessage(mapped.code);
    const body: ApiErrorResponse = {
      error: { support_ticket_id: supportTicketId, code: mapped.code, ...presentation },
    };
    response.setHeader('X-Support-Ticket-ID', supportTicketId);
    response.status(statuses[mapped.code]).json(body);
  };
}
export const errorHandler = createErrorHandler();
