# Database Schema, Migrations, and Integrity Model

> Project: Transaction Ledger | Version: 0.2 | Database: Supabase-hosted PostgreSQL; unchanged by the frontend
>
> The PDF specifies account/transaction fields and invariants. SQL types, private schema, constraints, indexes, migration tooling, and bonus transfer persistence are documented engineering decisions. **This is the schema specification; the initial migration `supabase/migrations/20261028000000_create_ledger.sql` is already authored, applied, and verified. Do not replay or edit it for this UI revision.**

> **v0.2 UI revision impact:** The black-and-white landing page, desktop navbar, tablet/mobile sidebar, and component-first frontend structure do not introduce new tables, columns, APIs, migrations, or Supabase access rules. Database design is unchanged from v0.1.

## 1. Database strategy

- **Database engine:** PostgreSQL provisioned and hosted in Supabase.
- **Application driver:** `pg` (node-postgres) from the Node/Express API only.
- **Schema namespace:** `ledger`, a private PostgreSQL schema outside Supabase's default exposed `public` Data API schema.
- **Migration tool:** Supabase CLI with timestamped SQL files in `supabase/migrations/`.
- **Server connection:** direct or session-pooler PostgreSQL URI (`DATABASE_URL`) for the persistent Express process; prefer TLS.
- **No browser DB access:** frontend calls Express REST endpoints, never the Supabase REST Data API or a raw SQL connection.

**Security note:** Do not add `ledger` to Supabase API `Exposed schemas`, and do not grant `anon`/`authenticated` access. The private database schema protects against accidental Data API exposure, but **does not make a publicly accessible Express API authenticated**. Public deployment requires separate access-control work.

## 2. Entity relationship

```text
ledger.accounts (1) ---------- (many) ledger.transactions
  id UUID PK                         id UUID PK
  name VARCHAR(120)                  account_id UUID FK -> accounts.id
  balance NUMERIC(20,2)              type credit|debit
  created_at TIMESTAMPTZ             amount NUMERIC(20,2)
                                     description TEXT
                                     reference_id VARCHAR(128)
                                     created_at TIMESTAMPTZ

Unique key: (transactions.account_id, transactions.reference_id)
```

An account always starts with balance zero. Each accepted transaction adds exactly one ledger entry; only service-controlled inserts change the balance. There is no transaction update/delete HTTP endpoint.

## 3. Account schema

| Column       | PostgreSQL type | Constraint/default                              | Purpose                      |
| ------------ | --------------- | ----------------------------------------------- | ---------------------------- |
| `id`         | `UUID`          | Primary key, `DEFAULT gen_random_uuid()`        | Unique account ID            |
| `name`       | `VARCHAR(120)`  | `NOT NULL`, nonblank check                      | Required account holder name |
| `balance`    | `NUMERIC(20,2)` | `NOT NULL DEFAULT 0.00`, `CHECK (balance >= 0)` | Current materialized balance |
| `created_at` | `TIMESTAMPTZ`   | `NOT NULL DEFAULT now()`                        | System-created time          |

**Important:** An account's initial zero balance is enforced both by strict POST request validation and by the database default. The application must never accept a user-provided initial balance. PostgreSQL column `balance` remains writable by the trusted transaction service only, because credits/debits must change it.

## 4. Transaction schema

| Column         | PostgreSQL type | Constraint/default                               | Purpose                      |
| -------------- | --------------- | ------------------------------------------------ | ---------------------------- |
| `id`           | `UUID`          | Primary key, `DEFAULT gen_random_uuid()`         | Unique transaction ID        |
| `account_id`   | `UUID`          | `NOT NULL` FK, `ON DELETE RESTRICT`              | Related account              |
| `type`         | `TEXT`          | `NOT NULL`, `CHECK (type IN ('credit','debit'))` | Ledger direction             |
| `amount`       | `NUMERIC(20,2)` | `NOT NULL`, `CHECK (amount > 0)`                 | Positive monetary movement   |
| `description`  | `TEXT`          | `NOT NULL DEFAULT ''`, max 500 characters        | User-readable note           |
| `reference_id` | `VARCHAR(128)`  | `NOT NULL`, nonblank; combined unique key        | Account-scoped deduplication |
| `created_at`   | `TIMESTAMPTZ`   | `NOT NULL DEFAULT now()`                         | System-created time          |

### Required unique and read indexes

- `PRIMARY KEY (id)` on both tables.
- `UNIQUE (account_id, reference_id)` on `ledger.transactions`.
- `INDEX (account_id, created_at DESC, id DESC)` on `ledger.transactions` for latest-first account history.
- The unique index already leads with `account_id`, so a second plain `(account_id)` index is generally unnecessary until profiling shows otherwise.

## 5. Proposed initial migration SQL

The following is implementation-ready SQL to place in the **first timestamped Supabase migration**, for example `supabase/migrations/<timestamp>_create_ledger.sql`. Its creation and application are part of the future implementation phase, not an operation already performed.

```sql
-- Private ledger schema: do not expose it through Supabase Data API.
CREATE SCHEMA IF NOT EXISTS ledger;
REVOKE ALL ON SCHEMA ledger FROM PUBLIC;
REVOKE ALL ON SCHEMA ledger FROM anon, authenticated;

-- Accounts hold the cached current balance; every new account begins at zero.
CREATE TABLE ledger.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  balance NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT accounts_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT accounts_nonnegative_balance CHECK (balance >= 0)
);

-- A transaction row records one accepted credit or debit and remains immutable
-- through the HTTP API; the account/reference pair enforces deduplication.
CREATE TABLE ledger.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  amount NUMERIC(20, 2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transactions_valid_type CHECK (type IN ('credit', 'debit')),
  CONSTRAINT transactions_positive_amount CHECK (amount > 0),
  CONSTRAINT transactions_description_length CHECK (char_length(description) <= 500),
  CONSTRAINT transactions_reference_not_blank CHECK (length(btrim(reference_id)) > 0),
  CONSTRAINT transactions_account_reference_unique UNIQUE (account_id, reference_id)
);

-- Supports account-specific history with deterministic latest-first ordering.
CREATE INDEX transactions_account_history_idx
  ON ledger.transactions (account_id, created_at DESC, id DESC);

-- No grants to anon/authenticated; PostgreSQL connections are backend-only.
```

### Migration hardening notes

- If a dedicated PostgreSQL application role is provisioned, grant it only schema usage and the necessary **account SELECT/INSERT/limited UPDATE** and **transaction SELECT/INSERT** permissions. Do **not** grant the application role transaction UPDATE/DELETE. Provision secrets separately rather than embedding passwords in migration SQL.
- The initial demo can connect from the backend with Supabase-provided database credentials, but a privileged database account should be replaced by a least-privileged role before broader deployment.
- Use schema-qualified SQL (`ledger.accounts`, `ledger.transactions`) in every repository; do not rely on ambient `search_path`.
- Direct SQL inserted outside the API can circumvent application-only validations. Never manually modify balances or transactions as part of normal use.

## 6. Precision and timestamp rules

### Money

- Store balances and amounts in `NUMERIC(20,2)`.
- HTTP request/response fields use decimal **strings**; `pg` commonly returns PostgreSQL numeric values as strings. Never convert to floating-point `number` for calculations.
- Incoming amount accepts a positive decimal string with no more than two fractional digits, within schema precision. API rejects `0`, negative values, exponent notation, too-large values, and extra fractional digits.
- Use database arithmetic `balance + $amount::numeric` or `balance - $amount::numeric` inside the locked transaction. Do not compute a new floating-point balance in Node.
- JSON responses normalize numeric values to exactly two decimal places (`"0.00"`, `"50.00"`).

### Time

- All `created_at` values come from PostgreSQL; clients cannot set them.
- Return API timestamps as UTC ISO 8601 strings. UI may display local date/time but should not reorder records locally when server already sorts them.
- Break ties by `id DESC` after `created_at DESC`.

## 7. Transactional write algorithm

### 7.1 Credit or debit

**Always use one checked-out client for `BEGIN` → SQL statements → `COMMIT` or `ROLLBACK`.** Example logical sequence:

```text
client = pool.connect()
try:
  BEGIN
  account = SELECT id, balance FROM ledger.accounts WHERE id = $1 FOR UPDATE
  if absent: rollback; return 404

  existing = SELECT id FROM ledger.transactions
             WHERE account_id = $1 AND reference_id = $2
  if existing: rollback; return 409

  if debit and balance < amount: rollback; return 422

  update account balance using exact PostgreSQL NUMERIC arithmetic
  insert new immutable ledger row
  COMMIT
  return created entry and resulting balance
catch:
  ROLLBACK if transaction active
  map known errors or rethrow for centralized handling
finally:
  release client
```

Illustrative account updates (parameters must be bound; no SQL string concatenation):

```sql
-- Credit: exact addition occurs inside the same database transaction.
UPDATE ledger.accounts
SET balance = balance + $2::NUMERIC
WHERE id = $1
RETURNING balance;

-- Debit: WHERE guard provides defense in depth against overdrafts.
UPDATE ledger.accounts
SET balance = balance - $2::NUMERIC
WHERE id = $1 AND balance >= $2::NUMERIC
RETURNING balance;
```

On debit, zero returned rows means insufficient funds (assuming the existing row was locked and found earlier). Uniqueness violations on `transactions_account_reference_unique` map to `409`. If ledger insertion fails after account update, rollback restores the original balance.

### 7.2 Duplicate behavior

`reference_id` is unique **only within a particular account**. Checking first in code is not sufficient; the PostgreSQL unique constraint is required. Two concurrent requests targeting the same account serialize on its locked account row, then one sees the other transaction. The same reference may be accepted for different accounts.

### 7.3 Immutability

- Do not write transaction update/delete repositories or HTTP routes.
- Keep `ledger.transactions` append-only within normal application behavior.
- Database-level trigger rejection of updates/deletes is optional hardening beyond the assessment's explicit **through-the-API** immutability rule.
- If implementing an application database role, deny UPDATE/DELETE privileges on `ledger.transactions`.

## 8. Balance reconciliation and diagnostic SQL

The core invariant is:

`accounts.balance = SUM(credits.amount) - SUM(debits.amount)` for all valid transactions belonging to the account.

Use a read-only verification query in integration tests or operational diagnostics:

```sql
-- Flags accounts whose materialized balance differs from their ledger total.
SELECT
  a.id AS account_id,
  a.balance AS stored_balance,
  COALESCE(
    SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END),
    0.00
  ) AS calculated_balance
FROM ledger.accounts AS a
LEFT JOIN ledger.transactions AS t ON t.account_id = a.id
GROUP BY a.id, a.balance
HAVING a.balance <> COALESCE(
  SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END),
  0.00
);
```

Expected result is **zero rows**. This query is a diagnostic; do not use it to silently repair inconsistencies without investigating their cause. The assessment's example (`+100 +50 -30 -20`) must finish with balance `100.00`.

## 9. History query design

- Validate account existence first; return `404` for unknown accounts.
- Use `WHERE account_id = $1` and optionally `AND type = $2`.
- Sort `ORDER BY created_at DESC, id DESC`.
- Apply `LIMIT $n OFFSET $m` after filtering/sorting.
- Count total rows with the same account/type filter, excluding limit/offset.
- Response metadata: `page`, `limit`, `total_records`, `total_pages = CEIL(total_records / limit)`.
- An existing account with no records returns `data: []` and `total_pages: 0`.
- History reads now execute account existence, count, and page selection on one client in a read-only `REPEATABLE READ` transaction. This implements the proposed snapshot-consistency refinement so a concurrent commit cannot make totals disagree with page rows within one response. Different page requests still use independent snapshots.

## 10. Bonus transfer schema — separate later migration

**Do not include this in the first migration unless the optional transfer API is approved.** For full traceability and retry protection, introduce:

```sql
-- Optional transfer identity/idempotency table for a later migration.
CREATE TABLE ledger.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
  destination_account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  reference_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transfers_different_accounts CHECK (source_account_id <> destination_account_id),
  CONSTRAINT transfers_reference_not_blank CHECK (length(btrim(reference_id)) > 0),
  CONSTRAINT transfers_description_length CHECK (char_length(description) <= 500),
  CONSTRAINT transfers_source_reference_unique UNIQUE (source_account_id, reference_id)
);

-- Link the two immutable transaction entries to their single transfer.
ALTER TABLE ledger.transactions
  ADD COLUMN transfer_id UUID REFERENCES ledger.transfers(id) ON DELETE RESTRICT;
CREATE INDEX transactions_transfer_id_idx
  ON ledger.transactions (transfer_id)
  WHERE transfer_id IS NOT NULL;
```

Implementation sequence within one DB transaction: lock both accounts in sorted-ID order, verify funds, insert transfer record, update both balances, insert one debit and one credit with their corresponding account IDs, shared `transfer_id`, and matching per-account reference. Commit only when **all** succeed. Add `CHECK`/unique constraints where feasible, but note that guaranteeing exactly two balanced entries is a cross-row invariant enforced by the atomic service and tests unless additional database triggers are introduced.

## 11. Migration and environment workflow

1. Initialize `supabase/` using Supabase CLI; commit `config.toml` and timestamped SQL migrations, not `.temp` or secrets.
2. Author the initial schema in `supabase/migrations/<timestamp>_create_ledger.sql`.
3. Test migration against local Supabase/PostgreSQL or a disposable test project. The local Supabase stack requires Docker.
4. Link to the intended hosted project and review the target project carefully before running `supabase db push`.
5. Apply migrations in timestamp order, under controlled deployment; avoid changing the remote schema manually outside migrations.
6. Configure `DATABASE_URL` privately in `apps/api/.env` and validate connectivity; check TLS settings and pool sizing.
7. Run automated integration and reconciliation tests only against an isolated test database.
8. Store rollback or corrective migration strategy alongside each nontrivial schema change; do not blindly roll back money-related data.

## 12. Database acceptance checklist

- [ ] Private `ledger` schema created; not exposed via Supabase Data API.
- [ ] Account creation uses zero balance and DB-generated UUID/timestamp.
- [ ] Transaction type/amount/account/reference constraints work.
- [ ] Same-account duplicate reference fails; different-account same reference succeeds.
- [ ] Balance write and ledger insertion roll back together on a forced failure.
- [ ] Concurrent debit requests cannot overspend.
- [x] History sorted latest-first with stable tie-break, filters and pagination (verified in isolated PostgreSQL tests).
- [ ] Reconciliation query returns no mismatches after test cases.
- [ ] Production DB credentials are not in source or frontend build.
- [ ] Bonus transfer tables are absent until optional scope is approved.

## 13. References

- Assessment PDF, pages 1–5.
- `design.md` (HTTP contracts and flow), `assumption.md` (money, currency, privacy, and pagination choices), `rules.md` (security/comment rules), `plan.md` (implementation sequence).
- Supabase custom schemas: https://supabase.com/docs/guides/api/using-custom-schemas
- Supabase connection modes: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase migrations: https://supabase.com/docs/guides/local-development/database-migrations
