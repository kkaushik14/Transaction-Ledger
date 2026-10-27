/** Credit/debit policy and snapshot-consistent history; each operation owns one checked-out client. */
import {
  createTransactionResponseSchema,
  transactionHistoryResponseSchema,
  type TransactionHistoryQuery,
  type TransactionHistoryResponse,
  type CreateTransactionRequest,
  type CreateTransactionResponse,
} from '@ledger/contracts';
import type { Pool } from 'pg';
import { withTransaction } from '../../db/transaction.js';
import { ApiError } from '../../errors/api-error.js';
import { createTransactionsRepository } from './transactions.repository.js';

/** Account-scoped immutable transaction writes and filtered/paginated history reads. */
export interface TransactionsService {
  getHistory(
    accountId: string,
    query: TransactionHistoryQuery,
  ): Promise<TransactionHistoryResponse>;
  create(
    accountId: string,
    input: CreateTransactionRequest,
  ): Promise<CreateTransactionResponse['data']>;
}

/** Binds transaction use cases to the managed pool without exposing HTTP details. */
export function createTransactionsService(pool: Pick<Pool, 'connect'>): TransactionsService {
  return {
    async getHistory(accountId, query) {
      return withTransaction(pool, async (client) => {
        // A single read-only snapshot keeps existence, count, and page consistent
        // if a new movement commits between our separate SELECT statements.
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const repository = createTransactionsRepository(client);
        if (!(await repository.accountExists(accountId))) {
          throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
        }
        const total = await repository.countHistory(accountId, query.type);
        const rows = await repository.listHistory(accountId, query);
        return transactionHistoryResponseSchema.parse({
          data: rows.map((row) => ({ ...row, created_at: row.created_at.toISOString() })),
          pagination: {
            page: query.page,
            limit: query.limit,
            total_records: total,
            total_pages: Math.ceil(total / query.limit),
          },
        });
      });
    },
    async create(accountId, input) {
      return withTransaction(pool, async (client) => {
        const repository = createTransactionsRepository(client);
        if (!(await repository.lockAccount(accountId))) {
          throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
        }
        // Check duplicates first while holding the account lock: a repeated debit
        // must remain a conflict even if the first request exhausted the balance.
        if (await repository.hasReference(accountId, input.reference_id)) {
          throw new ApiError(
            409,
            'DUPLICATE_TRANSACTION',
            'Reference already used for this account',
          );
        }
        const balance = await repository.updateBalance(accountId, input);
        if (balance === undefined) {
          if (input.type === 'debit') {
            throw new ApiError(422, 'INSUFFICIENT_BALANCE', 'Account has insufficient balance');
          }
          throw new ApiError(
            422,
            'BALANCE_LIMIT_EXCEEDED',
            'Credit would exceed the maximum account balance',
          );
        }
        const transaction = await repository.insert(accountId, input);
        // Validate/serialize before COMMIT so any unexpected output failure also
        // rolls back the balance update and insert instead of hiding a committed write.
        return createTransactionResponseSchema.parse({
          data: {
            transaction: { ...transaction, created_at: transaction.created_at.toISOString() },
            account_balance: balance,
          },
        }).data;
      });
    },
  };
}
