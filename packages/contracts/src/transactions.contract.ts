/** Strict credit/debit contracts; all monetary values stay strings with exact decimal precision. */
import { z } from 'zod';
import { balanceSchema } from './accounts.contract.js';

/** Accepted positive amount within NUMERIC(20,2), normalized without floating-point arithmetic. */
export const transactionAmountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,17})(?:\.\d{1,2})?$/)
  .refine((amount) => !/^0(?:\.0{1,2})?$/.test(amount), 'Amount must be positive')
  .transform((amount) => {
    const [whole, fraction = ''] = amount.split('.');
    return `${whole}.${fraction.padEnd(2, '0')}`;
  });

/** Case-sensitive reference identity is preserved exactly; do not silently trim it. */
export const transactionReferenceSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Reference must not be blank')
  .refine((value) => [...value].length <= 128, 'Reference must be at most 128 characters')
  .refine((value) => !value.includes('\0'), 'Reference must not contain a null character');

/** Description text is optional on input and defaults to the empty string. */
export const transactionDescriptionSchema = z
  .string()
  .refine((value) => [...value].length <= 500, 'Description must be at most 500 characters')
  .refine((value) => !value.includes('\0'), 'Description must not contain a null character');

/** Only these client-owned fields may initiate a credit/debit operation. */
export const createTransactionRequestSchema = z.strictObject({
  type: z.enum(['credit', 'debit']),
  amount: transactionAmountSchema,
  reference_id: transactionReferenceSchema,
  description: transactionDescriptionSchema.default(''),
});

/** Immutable transaction DTO; amount and timestamp are normalized for HTTP consumers. */
export const transactionSchema = z.strictObject({
  id: z.uuid(),
  account_id: z.uuid(),
  type: z.enum(['credit', 'debit']),
  amount: balanceSchema.refine((value) => value !== '0.00'),
  reference_id: transactionReferenceSchema,
  description: transactionDescriptionSchema,
  created_at: z.iso.datetime(),
});

/** Successful credit/debit response includes the resulting committed balance. */
export const createTransactionResponseSchema = z.strictObject({
  data: z.strictObject({ transaction: transactionSchema, account_balance: balanceSchema }),
});

/** Normalized request as consumed by the service. */
export type CreateTransactionRequest = z.infer<typeof createTransactionRequestSchema>;
/** Public immutable ledger entry. */
export type Transaction = z.infer<typeof transactionSchema>;
/** Credit/debit success response. */
export type CreateTransactionResponse = z.infer<typeof createTransactionResponseSchema>;

/** Strict URL integer syntax; values must be safe for numeric metadata and SQL offsets. */
const historyIntegerSchema = z
  .string()
  .regex(/^[1-9]\d{0,15}$/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));

/** Parsed history query; defaults apply only when a parameter is absent, not empty. */
export const transactionHistoryQuerySchema = z
  .strictObject({
    type: z.enum(['credit', 'debit']).optional(),
    page: historyIntegerSchema.default(1),
    limit: historyIntegerSchema.pipe(z.number().max(100)).default(20),
  })
  .refine((query) => Number.isSafeInteger((query.page - 1) * query.limit), {
    message: 'Pagination offset exceeds the safe integer range',
    path: ['page'],
  });

/** Pagination totals count records after the account/type filters and before LIMIT/OFFSET. */
export const transactionHistoryResponseSchema = z.strictObject({
  data: z.array(transactionSchema),
  pagination: z.strictObject({
    page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    limit: z.number().int().min(1).max(100),
    total_records: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    total_pages: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }),
});

/** Normalized server-side history query, with numeric page/limit and optional type. */
export type TransactionHistoryQuery = z.infer<typeof transactionHistoryQuerySchema>;
/** Filtered, latest-first history response including pagination metadata. */
export type TransactionHistoryResponse = z.infer<typeof transactionHistoryResponseSchema>;
