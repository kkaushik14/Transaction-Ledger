/** Transfer-scoped PostgreSQL operations; every query uses the service's single checked-out client. */
import type { PoolClient } from 'pg';
import type { CreateTransferRequest, Transfer, TransferTransaction } from '@ledger/contracts';

type TransferRow = Omit<Transfer, 'created_at'> & { created_at: Date };
type LegRow = Omit<TransferTransaction, 'created_at'> & { created_at: Date };
/** Persistence operations required by the atomic two-account transfer use case. */
export interface TransfersRepository {
  lockAccounts(input: CreateTransferRequest): Promise<boolean>;
  hasTransfer(input: CreateTransferRequest): Promise<boolean>;
  hasLedgerReference(input: CreateTransferRequest): Promise<boolean>;
  insertTransfer(input: CreateTransferRequest): Promise<TransferRow>;
  updateBalance(
    accountId: string,
    amount: string,
    type: 'credit' | 'debit',
  ): Promise<string | undefined>;
  insertLeg(transfer: TransferRow, type: 'credit' | 'debit'): Promise<LegRow>;
}

/** Binds all transfer SQL to one transaction; it never opens, commits or releases a connection. */
export function createTransfersRepository(client: PoolClient): TransfersRepository {
  return {
    async lockAccounts(input) {
      // PostgreSQL UUID ordering is independent of request direction/casing. ORDER BY
      // precedes row locking, so opposing transfers acquire exactly the same lock order.
      const result = await client.query<{ id: string }>(
        'SELECT id FROM ledger.accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [[input.source_account_id, input.destination_account_id]],
      );
      return result.rows.length === 2;
    },
    async hasTransfer(input) {
      const result = await client.query(
        'SELECT id FROM ledger.transfers WHERE source_account_id=$1 AND reference_id=$2',
        [input.source_account_id, input.reference_id],
      );
      return result.rows.length !== 0;
    },
    async hasLedgerReference(input) {
      // Both legs preserve the caller reference; a collision on either account
      // rejects the entire transfer instead of silently renaming a ledger reference.
      const result = await client.query(
        'SELECT id FROM ledger.transactions WHERE account_id=ANY($1::uuid[]) AND reference_id=$2 LIMIT 1',
        [[input.source_account_id, input.destination_account_id], input.reference_id],
      );
      return result.rows.length !== 0;
    },
    async insertTransfer(input) {
      const result = await client.query<TransferRow>(
        `INSERT INTO ledger.transfers(source_account_id,destination_account_id,amount,description,reference_id)
         VALUES($1,$2,$3::numeric,$4,$5)
         RETURNING id,source_account_id,destination_account_id,amount::text AS amount,description,reference_id,created_at`,
        [
          input.source_account_id,
          input.destination_account_id,
          input.amount,
          input.description,
          input.reference_id,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Transfer insertion returned no row');
      return row;
    },
    async updateBalance(accountId, amount, type) {
      // Exact guarded SQL handles both overdraft and destination capacity; no JS money arithmetic.
      const sql =
        type === 'debit'
          ? `UPDATE ledger.accounts SET balance=balance-$2::numeric
           WHERE id=$1 AND balance >= $2::numeric RETURNING balance::text AS balance`
          : `UPDATE ledger.accounts SET balance=balance+$2::numeric
           WHERE id=$1 AND balance <= 999999999999999999.99::numeric-$2::numeric
           RETURNING balance::text AS balance`;
      const result = await client.query<{ balance: string }>(sql, [accountId, amount]);
      return result.rows[0]?.balance;
    },
    async insertLeg(transfer, type) {
      const accountId =
        type === 'debit' ? transfer.source_account_id : transfer.destination_account_id;
      const result = await client.query<LegRow>(
        `INSERT INTO ledger.transactions(account_id,type,amount,description,reference_id,transfer_id)
         VALUES($1,$2,$3::numeric,$4,$5,$6)
         RETURNING id,account_id,type,amount::text AS amount,description,reference_id,transfer_id,created_at`,
        [
          accountId,
          type,
          transfer.amount,
          transfer.description,
          transfer.reference_id,
          transfer.id,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Transfer entry insertion returned no row');
      return row;
    },
  };
}
