/** Public failures contain exactly support correlation, a stable code, safe copy and a recovery action. */
import { z } from 'zod';
/** Codes emitted by the HTTP boundary; client-only failures never invent HTTP statuses. */
export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'ACCOUNT_NOT_FOUND',
  'DUPLICATE_TRANSACTION',
  'DUPLICATE_TRANSFER',
  'INSUFFICIENT_BALANCE',
  'BALANCE_LIMIT_EXCEEDED',
  'ROUTE_NOT_FOUND',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
]);
/** Browser failures use the same public presentation contract, including local validation. */
export const errorCodeSchema = z.enum([
  ...apiErrorCodeSchema.options,
  'NETWORK_ERROR',
  'INVALID_RESPONSE',
  'CONFIGURATION_ERROR',
  'STORAGE_UNAVAILABLE',
  'INVALID_ACCOUNT_ID',
  'INVALID_ACCOUNT_NAME',
  'INVALID_AMOUNT',
  'INVALID_DESCRIPTION',
  'SELF_TRANSFER',
  'CLIPBOARD_UNAVAILABLE',
  'ACCOUNT_CREATION_UNCONFIRMED',
]);
/** Actions are identifiers, never server-supplied scripts or navigation URLs. */
export const errorActionSchema = z.enum(['retry', 'go_back', 'review', 'fix_input', 'reload']);
const fields = {
  support_ticket_id: z.uuid(),
  code: errorCodeSchema,
  message: z.string().min(1),
  action: errorActionSchema,
};
export const publicFailureSchema = z.strictObject(fields);
export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({ ...fields, code: apiErrorCodeSchema }),
});
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorAction = z.infer<typeof errorActionSchema>;
export type PublicFailure = z.infer<typeof publicFailureSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
