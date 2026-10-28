/** Account-to-account transfer contracts reuse exact-money rules and validate correlated immutable legs. */
import { z } from 'zod';
import { balanceSchema } from './accounts.contract.js';
import {
  transactionAmountSchema,
  transactionDescriptionSchema,
  transactionReferenceSchema,
  transactionSchema,
} from './transactions.contract.js';

const accountIdSchema = z.uuid().transform((value) => value.toLowerCase());
/** Accepts only client-owned fields; canonical UUIDs prevent case variants from bypassing self-transfer checks. */
export const createTransferRequestSchema = z
  .strictObject({
    source_account_id: accountIdSchema,
    destination_account_id: accountIdSchema,
    amount: transactionAmountSchema,
    reference_id: transactionReferenceSchema,
    description: transactionDescriptionSchema.default(''),
  })
  .refine((input) => input.source_account_id !== input.destination_account_id, {
    message: 'Source and destination must be different accounts',
    path: ['destination_account_id'],
  });

/** Persisted transfer identity; responses require already-normalized money strings. */
export const transferSchema = z
  .strictObject({
    id: z.uuid(),
    source_account_id: z.uuid(),
    destination_account_id: z.uuid(),
    amount: balanceSchema.refine((value) => value !== '0.00'),
    reference_id: transactionReferenceSchema,
    description: transactionDescriptionSchema,
    created_at: z.iso.datetime(),
  })
  .refine(
    (input) => input.source_account_id.toLowerCase() !== input.destination_account_id.toLowerCase(),
  );

/** Linked legs are exposed on transfer creation without changing existing history/standalone DTOs. */
export const transferTransactionSchema = transactionSchema.extend({ transfer_id: z.uuid() });

/** Validates all correlated identities and amounts before the service can commit its response. */
export const createTransferResponseSchema = z
  .strictObject({
    data: z.strictObject({
      transfer: transferSchema,
      debit: transferTransactionSchema.extend({ type: z.literal('debit') }),
      credit: transferTransactionSchema.extend({ type: z.literal('credit') }),
      source_account_balance: balanceSchema,
      destination_account_balance: balanceSchema,
    }),
  })
  .refine(
    ({ data }) => {
      const { transfer, debit, credit } = data;
      return (
        debit.id !== credit.id &&
        debit.account_id === transfer.source_account_id &&
        credit.account_id === transfer.destination_account_id &&
        [debit, credit].every(
          (leg) =>
            leg.transfer_id === transfer.id &&
            leg.amount === transfer.amount &&
            leg.reference_id === transfer.reference_id &&
            leg.description === transfer.description,
        )
      );
    },
    { message: 'Transfer entries must match their transfer record', path: ['data'] },
  );

/** Normalized transfer command accepted by the service. */
export type CreateTransferRequest = z.infer<typeof createTransferRequestSchema>;
/** Immutable transfer identity DTO. */
export type Transfer = z.infer<typeof transferSchema>;
/** A debit or credit linked to a transfer. */
export type TransferTransaction = z.infer<typeof transferTransactionSchema>;
/** Transfer creation response, returned only after all writes commit. */
export type CreateTransferResponse = z.infer<typeof createTransferResponseSchema>;
