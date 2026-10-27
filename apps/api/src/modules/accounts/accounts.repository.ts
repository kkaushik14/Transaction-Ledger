/** Parameterized account SQL; database defaults remain authoritative for balance, IDs, and time. */
import type { QueryResultRow } from 'pg';

/** Minimal query interface satisfied by pg.Pool and isolated SQL test adapters. */
export interface AccountDatabase {
  query<Row extends QueryResultRow>(text: string, values: unknown[]): Promise<{ rows: Row[] }>;
}
/** PostgreSQL-specific account row; numeric values stay strings and timestamps are Dates. */
export interface AccountRow {
  id: string;
  name: string;
  balance: string;
  created_at: Date;
}
/** PostgreSQL balance projection. */
export interface BalanceRow {
  account_id: string;
  balance: string;
}
/** Account persistence operations; no HTTP or business-rule responsibilities. */
export interface AccountsRepository {
  insert(name: string): Promise<AccountRow>;
  findBalance(accountId: string): Promise<BalanceRow | undefined>;
}

/** Binds account persistence to the process pool or a transaction-scoped query executor. */
export function createAccountsRepository(database: AccountDatabase): AccountsRepository {
  return {
    async insert(name) {
      // Only name is inserted: UUID, creation time, and initial zero balance all
      // come from migration defaults, with no client-controlled balance write.
      const result = await database.query<AccountRow>(
        `INSERT INTO ledger.accounts (name) VALUES ($1)
         RETURNING id, name, balance::text AS balance, created_at`,
        [name],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Account insertion returned no row');
      return row;
    },
    async findBalance(accountId) {
      const result = await database.query<BalanceRow>(
        'SELECT id AS account_id, balance::text AS balance FROM ledger.accounts WHERE id = $1',
        [accountId],
      );
      return result.rows[0];
    },
  };
}
