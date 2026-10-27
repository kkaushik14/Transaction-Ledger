# Database setup

The initial migration is `supabase/migrations/20261028000000_create_ledger.sql`. It creates the private `ledger` schema, accounts and transactions, account-scoped reference uniqueness, validation constraints, and the latest-first history index. It was applied on October 28, 2026 to project `rebnstdnwrwdevnfbszi` using Supabase CLI 2.122.0. The API now includes environment validation, a verified TLS connection pool, and a transaction helper. Account creation and balance retrieval now use this pool through the account repository; atomic credit/debit writes now use the transaction helper and checked-out clients. Transaction history now runs on a single read-only REPEATABLE READ snapshot with matching count/page filters.

## Environment template

Copy `apps/api/.env.example` to `apps/api/.env` locally. Set `DATABASE_URL` using the project's **Connect** dialog: choose the direct PostgreSQL connection when reachable, or the session pooler when IPv4 compatibility is needed. Use the exact dashboard hostname and username, the database password, and TLS. URL-encode special characters in the password.

This API architecture connects through `pg`; Supabase publishable/anon keys and service-role keys are not substitutes for the PostgreSQL connection string. Do not add these secrets to the web environment. The web template only needs `VITE_API_BASE_URL`. A CLI login/access token is separate from application database credentials.

`TEST_DATABASE_URL` is an optional placeholder for later tests against a separate disposable database. The API consumes `DATABASE_URL` at startup and verifies the connection before listening. `TEST_DATABASE_URL` is not consumed yet; unit tests use fixtures without reading `.env`. Keep actual `.env` values local; the templates contain no real credentials.

See [Supabase connection documentation](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Applied migration and CLI setup

The connection was verified through `aws-0-ap-south-1.pooler.supabase.com:5432`, database `postgres`, user `postgres.rebnstdnwrwdevnfbszi`. The direct IPv6 endpoint was unreachable from this machine, so the session pooler was used.

Local configuration was generated with `supabase init` and saved as `supabase/config.toml`. Seed loading is disabled because no seed file exists. The local configuration excludes `ledger` from Data API schemas; the hosted dashboard setting was not independently inspected.

The CLI dry run listed only `20261028000000_create_ledger.sql`. It was then applied with `supabase db push --db-url ... --skip-vault --yes`; credentials were read privately from `apps/api/.env`, never printed or committed. The database URL used certificate-verifying TLS options. No project login token or MCP connection was needed. The CLI was installed temporarily outside the repository; use an installed compatible CLI for subsequent migrations.

Migration history now contains version `20261028000000`, name `create_ledger`. Do not replay this file manually or modify it after application. For future migrations, configure a verified TLS connection and run a dry run before `supabase db push`; use `supabase migration list` against the same project to inspect its history.

## TLS certificate

The public Supabase root CA is saved at `supabase/certs/prod-ca-2021.crt`. Its source is [Supabase's HTTPS downloads bucket](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt); it is public certificate material, not a private key.

The one-off Node check used this CA with `rejectUnauthorized: true`, and verified the pooler hostname. The CLI used `sslmode=verify-full` and `sslrootcert` pointing to the CA. The API pool now supplies this CA and `rejectUnauthorized: true` explicitly. No changes to the existing `.env` are required: `DATABASE_SSL_CA_PATH` optionally selects a different CA (relative to `apps/api` or absolute). Invalid, expired, or unreadable CA files fail pool creation. TLS cannot be disabled. The environment parser accepts and removes `sslmode=require`, `verify-ca`, or `verify-full` hints, and rejects other URL query options; explicit driver fields prevent URI options from replacing the TLS configuration.

This verification covers client-to-pooler TLS. The read-only `pg_stat_ssl` check reported `false` for the separate pooler-to-PostgreSQL connection; no hosted SSL-enforcement settings were changed. See [Supabase SSL enforcement documentation](https://supabase.com/docs/guides/platform/ssl-enforcement) for the distinction and project settings.

Keep `ledger` out of the hosted Data API's **Exposed schemas**. The migration revokes schema and table privileges from `PUBLIC`, `anon`, and `authenticated`; it does not change hosted dashboard settings. A dedicated least-privileged backend database role remains future work.

See [Supabase migration workflow](https://supabase.com/docs/guides/local-development/database-migrations).

## Schema behavior and limits

- Accounts receive PostgreSQL-generated UUIDs/timestamps and a default balance of `0.00`. Names are required, nonblank, and at most 120 characters; balances cannot be negative.
- Transactions require an existing account, `credit` or `debit`, and a positive `NUMERIC(20,2)` amount. Descriptions default to an empty string and are limited to 500 characters.
- References are required, nonblank, case-sensitive, and at most 128 characters. Their uniqueness is scoped to an account; different accounts may reuse a reference.
- Foreign keys restrict deleting accounts with transactions. The history index is `(account_id, created_at DESC, id DESC)`.
- PostgreSQL numeric columns can round input beyond two fractional digits. Credit/debit requests now reject invalid precision before SQL and normalize valid amounts as decimal strings. Account creation now rejects client-supplied balances, IDs, and timestamps in shared strict input validation.
- This migration does not automatically update balances on transaction inserts, enforce balance reconciliation, or prevent privileged SQL updates/deletes. The transaction service now enforces atomic account/ledger writes and exposes no ledger edit/delete routes. Optional database role hardening remains future work as documented in the planning pack.

## Verification and recovery

The original migration passed 27 checks in a disposable local PostgreSQL-compatible engine. After hosted application, read-only verification confirmed:

- The migration version and name in `supabase_migrations.schema_migrations`.
- Both tables, database-generated IDs/timestamps, the zero balance default, and `NUMERIC(20,2)` columns.
- Primary keys, foreign key with restricted deletion, check constraints, account-scoped uniqueness, and the history index.
- No schema usage or table read/write permissions for `anon` or `authenticated`.
- Both tables are empty; no test financial data was written to the hosted project.

Ledger rollback/concurrency tests now run against a disposable native PostgreSQL 17 cluster using the same initial migration. Those tests are distinct from hosted schema checks and never use hosted credentials.

The migration creates tables without `IF NOT EXISTS` so schema/history mismatches fail visibly. Let the CLI migration history control application; do not manually replay a completed migration or rewrite it after deployment. If application fails, inspect migration history and the actual schema before retrying. Correct deployed changes with a new migration. Do not drop ledger tables or reset a hosted database to undo a change containing real data.

## API connection lifecycle

`DATABASE_URL`, `PORT`, `WEB_ORIGIN` (an exact HTTP/HTTPS origin), and `NODE_ENV` (`development`, `test`, or `production`) are required. Validation errors name fields without printing supplied values. Optional `DATABASE_POOL_MAX` defaults to 5 and accepts 1–20.

Pool settings: 10-second acquisition/connection timeout, 30-second idle timeout, 15-second server statement timeout, and 30-second idle-in-transaction timeout. PostgreSQL NUMERIC results retain the driver's default string representation. Idle-client error events are handled without printing raw driver messages.

The single API process pool is created at startup; importing the configuration/pool/helper modules does not read credentials or open network connections. `withTransaction` acquires one client, begins a transaction, commits successful work, rolls back failures, and releases in `finally`. Failed BEGIN/COMMIT or rollback failures discard the client; rollback failure preserves both errors in an AggregateError. There are no automatic retries. A COMMIT that returns ROLLBACK is rejected rather than reported as success.

Use `pnpm --filter @ledger/api db:check` for an explicit read-only connection, commit/rollback, and pool-reuse check. The API test suite covers failure paths with fixtures and never runs mutating tests against the hosted ledger. Account HTTP/SQL integration tests use an isolated in-memory PGlite engine with the real migration, without loading `.env`. Credit/debit HTTP and integrity tests now use a disposable native PostgreSQL 17 server with real independent sessions, without reading `.env`.

Runtime verification completed with the configured hosted connection: read-only commit/rollback and subsequent pool reuse succeeded; an unrelated CA was rejected; the built API verified its connection before listening and exited cleanly on SIGTERM. The infrastructure checks remain covered by 40 unit tests, alongside the new account integration and shared-contract tests. No ledger data was written during these checks.

The initial migration is unchanged: its existing account row, numeric columns, constraints, and indexes support atomic credit/debit writes. The service uses `SELECT ... FOR UPDATE` before duplicate checks and guarded SQL arithmetic, followed by ledger insertion on the same client. A credit exceeding column capacity returns `422 BALANCE_LIMIT_EXCEEDED`, avoiding numeric overflow and preserving ledger integrity. The applied migration was not replayed or modified.

History uses the existing `(account_id, created_at DESC, id DESC)` index; no migration change is required. The service checks account existence, counts filtered rows, and selects the page through the same checked-out client. Type filters and LIMIT/OFFSET are bound parameters. Count metadata is checked for safe integer representation; query validation rejects unsafe offsets before SQL. Integration tests use a separate local PostgreSQL 17 cluster and verify a history snapshot remains unchanged while a writer commits on another client. No hosted data is modified by these tests.
