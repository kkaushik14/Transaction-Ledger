/** Shared public error envelopes; SQL, credentials, and internal stacks never belong here. */
import { z } from 'zod';

/** Error codes implemented by the current account/credit/debit API and HTTP boundary. */
export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'ACCOUNT_NOT_FOUND',
  'DUPLICATE_TRANSACTION',
  'INSUFFICIENT_BALANCE',
  'BALANCE_LIMIT_EXCEEDED',
  'ROUTE_NOT_FOUND',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
]);
/** Standard error shape shared by browser consumers and the API. */
export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()),
  }),
});
/** Implemented public error code. */
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
/** Standard HTTP error response. */
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
