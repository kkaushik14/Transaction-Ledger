/** Browser-safe account request/response schemas; money remains an exact decimal string. */
import { z } from 'zod';

/** Trims names and counts Unicode code points to match PostgreSQL VARCHAR limits. */
export const accountNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .refine((name) => [...name].length <= 120, 'Name must be at most 120 characters')
  .refine((name) => !name.includes('\0'), 'Name must not contain a null character');

/** Only a name may be supplied; IDs, timestamps, balances, and unknown fields are rejected. */
export const createAccountRequestSchema = z.strictObject({ name: accountNameSchema });

/** Validates the UUID path parameter before any SQL is issued. */
export const accountIdParamsSchema = z.strictObject({ accountId: z.uuid() });

/** Normalized nonnegative NUMERIC(20,2) balance; no floating-point conversion is used. */
export const balanceSchema = z.string().regex(/^(?:0|[1-9]\d{0,17})\.\d{2}$/);

/** Public account record with database-generated identity and UTC creation timestamp. */
export const accountSchema = z.strictObject({
  id: z.uuid(),
  name: accountNameSchema,
  balance: balanceSchema,
  created_at: z.iso.datetime(),
});

/** Account creation success envelope. */
export const createAccountResponseSchema = z.strictObject({ data: accountSchema });

/** Current balance success envelope; account identity mirrors the documented HTTP contract. */
export const accountBalanceResponseSchema = z.strictObject({
  data: z.strictObject({ account_id: z.uuid(), balance: balanceSchema }),
});

/** Accepted create-account input after name normalization. */
export type CreateAccountRequest = z.infer<typeof createAccountRequestSchema>;
/** Public account DTO. */
export type Account = z.infer<typeof accountSchema>;
/** Account creation HTTP response. */
export type CreateAccountResponse = z.infer<typeof createAccountResponseSchema>;
/** Account balance HTTP response. */
export type AccountBalanceResponse = z.infer<typeof accountBalanceResponseSchema>;
