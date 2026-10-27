/** Transaction-scoped SQL for history reads, account locking, and exact balance/ledger writes. */
import type { CreateTransactionRequest, TransactionHistoryQuery } from '@ledger/contracts';
import type { PoolClient } from 'pg';

/** Database-specific immutable transaction row; NUMERIC stays a string. */
export interface TransactionRow {
  id: string;
  account_id: string;
  type: 'credit' | 'debit';
  amount: string;
  reference_id: string;
  description: string;
  created_at: Date;
}

/** Required transaction-scoped queries; every method uses the same checked-out client. */
export interface TransactionsRepository {
  lockAccount(accountId: string): Promise<boolean>;
  accountExists(accountId: string): Promise<boolean>;
  countHistory(accountId: string, type: TransactionHistoryQuery['type']): Promise<number>;
  listHistory(accountId: string, query: TransactionHistoryQuery): Promise<TransactionRow[]>;
  hasReference(accountId: string, referenceId: string): Promise<boolean>;
  updateBalance(accountId: string, input: CreateTransactionRequest): Promise<string | undefined>;
  insert(accountId: string, input: CreateTransactionRequest): Promise<TransactionRow>;
}

/** Creates SQL operations bound exclusively to the helper's checked-out client. */
export function createTransactionsRepository(client: PoolClient): TransactionsRepository {
  return {
    async accountExists(accountId: string): Promise<boolean> {
      // A history read checks existence without locking or changing the account.
      const result = await client.query('SELECT id FROM ledger.accounts WHERE id = $1', [
        accountId,
      ]);
      return result.rows.length === 1;
    },
    async countHistory(accountId: string, type: TransactionHistoryQuery['type']): Promise<number> {
      // Use exactly the same filters as listHistory; totals exclude pagination.
      const result = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ledger.transactions
         WHERE account_id = $1 AND ($2::text IS NULL OR type = $2)`,
        [accountId, type ?? null],
      );
      const count = Number(result.rows[0]?.count);
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error('History count exceeds supported metadata range');
      return count;
    },
    async listHistory(
      accountId: string,
      query: TransactionHistoryQuery,
    ): Promise<TransactionRow[]> {
      // The UUID tie-breaker preserves deterministic order for equal timestamps;
      // only fixed SQL and bound values are used for filters and pagination.
      const result = await client.query<TransactionRow>(
        `SELECT id, account_id, type, amount::text AS amount, description, reference_id, created_at
         FROM ledger.transactions WHERE account_id = $1 AND ($2::text IS NULL OR type = $2)
         ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
        [accountId, query.type ?? null, query.limit, (query.page - 1) * query.limit],
      );
      return result.rows;
    },
    async lockAccount(accountId: string): Promise<boolean> {
      // Serialize all movements for this account before checking references/funds.
      const result = await client.query<{ id: string }>(
        'SELECT id FROM ledger.accounts WHERE id = $1 FOR UPDATE',
        [accountId],
      );
      return result.rows.length === 1;
    },
    async hasReference(accountId: string, referenceId: string): Promise<boolean> {
      const result = await client.query<{ id: string }>(
        'SELECT id FROM ledger.transactions WHERE account_id = $1 AND reference_id = $2',
        [accountId, referenceId],
      );
      return result.rows.length !== 0;
    },
    async updateBalance(
      accountId: string,
      input: CreateTransactionRequest,
    ): Promise<string | undefined> {
      // Debit guard prevents overdrafts; credit guard detects NUMERIC(20,2) overflow
      // without letting PostgreSQL coerce or JavaScript calculate monetary values.
      const sql =
        input.type === 'credit'
          ? `UPDATE ledger.accounts SET balance = balance + $2::numeric
           WHERE id = $1 AND balance <= 999999999999999999.99::numeric - $2::numeric
           RETURNING balance::text AS balance`
          : `UPDATE ledger.accounts SET balance = balance - $2::numeric
           WHERE id = $1 AND balance >= $2::numeric RETURNING balance::text AS balance`;
      const result = await client.query<{ balance: string }>(sql, [accountId, input.amount]);
      return result.rows[0]?.balance;
    },
    async insert(accountId: string, input: CreateTransactionRequest): Promise<TransactionRow> {
      // The database UNIQUE(account_id, reference_id) remains the final backstop.
      // This insert and the account update must share the same client/transaction.
      const result = await client.query<TransactionRow>(
        `INSERT INTO ledger.transactions (account_id, type, amount, description, reference_id)
         VALUES ($1, $2, $3::numeric, $4, $5)
         RETURNING id, account_id, type, amount::text AS amount, description, reference_id, created_at`,
        [accountId, input.type, input.amount, input.description, input.reference_id],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Transaction insertion returned no row');
      return row;
    },
  };
}
