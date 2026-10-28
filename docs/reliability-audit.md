# Transaction Ledger reliability audit

Date: 2026-10-28. Scope: current monolith, APIs, PostgreSQL financial writes, transfers, history, frontend recovery and safe diagnostics. No microservices, new financial features, migration changes or hosted data mutations.

## Outcome and findings

The existing implementation was reviewed before edits. The baseline passed 482 automated tests. Existing tests already covered core funds guards, persistent account/reference uniqueness, real row-lock contention, rollback at each transfer stage, and uncertain browser writes. The audit adds 48 real-PostgreSQL integration cases, one logging privacy regression, two form timeout cases and three browser timeout/reload/retry workflows.

No financial correctness defect was reproduced in the scenarios tested. Two diagnostic privacy gaps and one browser-harness stability gap were confirmed and fixed:

1. **Driver context could leak SQL literals or rejected row contents into serialized logs.** The serializer omitted exact lowercase `query`/`sql` fields but included PostgreSQL `internalQuery`, `detail`, `where` and differently cased payload keys. A new regression failed before the fix and passes afterward. Payload-field omission now ignores case and excludes those driver context fields and query/SQL-text variants. Internal error messages, stacks, codes, constraint identity and causal chains remain available, with existing credential redaction. The original object still reaches the trusted logger; only unsafe serialized payload fields are omitted. Public error contracts are unchanged.
2. **The browser fixture's diagnostic file inherited mode 0644.** New fixture log files now use 0600. The browser test checks filesystem permissions and the existing HTTP 403 protection for the same file. This changes test infrastructure only. The normal development log was verified as 0600.

3. **Development-server reloads could interrupt browser form assertions.** The first complete browser run passed 31/32 cases; its failing trace showed Vite reloads resetting an amount field before any financial POST. The dedicated `e2e` Vite mode now disables hot reload for the browser fixture only. Normal development behavior and all assertions are preserved. The complete rerun passed all 32 workflows after this test-only configuration correction.

Financial services, repositories, transaction/pool helpers, contracts, migrations and frontend business logic remain unchanged. No dependencies were added or unrelated code restructured.

## Isolation and methods

Financial integration cases use `createTestPostgres`: a disposable native PostgreSQL 17 cluster with a random loopback port/password, temporary database directory, real migration chain and a bounded pg pool. The helper never reads `.env` or uses `DATABASE_URL`. Existing account-boundary tests also use a separate disposable PostgreSQL-compatible engine. Browser tests start their own local API/database and public test API URL; they never use the configured Supabase ledger.

Audit accounts are created and funded through the API with known decimal-string balances. Each audit case truncates only its private cluster. Failure triggers exist only there and are removed in `finally`; database/process/temp-directory teardown runs after the suite. A checked-out lock holder and `pg_stat_activity` establish actual concurrent lock waits rather than relying on requests merely being started together.

Assertions inspect **every persisted account, transaction and transfer field**, not just HTTP status. After each of the 48 added financial cases, SQL reconciles every balance using exact NUMERIC credit-minus-debit sums, requires exactly two correctly correlated legs per transfer, and checks that no session remains idle in a transaction. No monetary calculations use JavaScript floating point.

## Prioritized coverage

| Priority      | Requirement                               | Verification and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical      | Insufficient balance                      | Exact-balance debit succeeds; overspending returns 422 `INSUFFICIENT_BALANCE` with unchanged balance/ledger. Transfers reject insufficient source funds and roll back transfer identity and all associated writes.                                                                                                                                                                                                                                                           |
| Critical      | Duplicate account/reference               | Identical, changed-payload, exhausted-balance, parallel and fresh-application retries return 409. DB UNIQUE constraints remain the backstop. References retain documented account scope and exact case/whitespace identity.                                                                                                                                                                                                                                                  |
| Critical      | Concurrent overspending                   | Existing real-session debit/debit, transfer/transfer, opposing transfer, capacity and transfer/standalone contention tests remain. New eight-request blocked debit burst accepts exactly three 30.00 debits from 100.00, rejects five, leaves 10.00 and stores rows only for accepted requests.                                                                                                                                                                              |
| Critical      | Transaction rollback                      | Existing forced ledger-insert failures roll back credit/debit balance changes. New initially deferred constraint triggers fail at the actual PostgreSQL COMMIT boundary for credit/debit and preserve every pre-request row. Removing the trigger allows the same failed reference to succeed.                                                                                                                                                                               |
| Critical      | Atomic transfer rollback                  | Existing faults at transfer insertion, source update, destination update, debit, credit and response validation preserve complete snapshots. New deferred COMMIT failure also rolls back both balances, both legs and transfer identity. Reconciliation verifies correlation after every transfer case.                                                                                                                                                                      |
| Critical      | Commit succeeded but acknowledgement lost | New pg-client wrapper executes the real COMMIT successfully, then throws before its acknowledgement reaches the service. Credit, debit and transfer return a safe unconfirmed 500 while complete writes persist once. Two identical retries through a fresh app instance return 409 and leave the committed snapshot unchanged.                                                                                                                                              |
| Critical      | Client timeout/retry and UI uncertainty   | New form cases exercise the actual client AbortController deadline for credit/debit. New browser cases reach the real API's successful commit, withhold HTTP delivery, advance the browser clock through the production 20-second deadline, reload and explicitly retry the exact saved payload/reference. No automatic resend, definite-failure claim or false success is shown; each logical movement persists once. Existing lost-response/transfer-timeout cases remain. |
| High          | Invalid amounts                           | Added 30 snapshot cases cover zero, zero decimals, negative, malformed, exponential, excessive-precision, numeric-JSON and null inputs across credit, debit and transfer. All return 400 `VALIDATION_ERROR` without changing any stored field. Existing contract/API tests cover amount bounds, smallest units, maximum capacity and additional invalid shapes.                                                                                                              |
| High          | Nonexistent accounts                      | Added seven complete-state cases cover balance/history reads, credit/debit and missing source/destination/both transfer accounts. All return 404 `ACCOUNT_NOT_FOUND`, keep safe support correlation and change no data.                                                                                                                                                                                                                                                      |
| High          | API ledger immutability                   | PUT/PATCH/DELETE attempts against account-nested and top-level standalone/transfer-leg paths, transfer identities and transaction collections return 404. Complete row snapshots remain unchanged, including IDs, amounts, descriptions, references and timestamps.                                                                                                                                                                                                          |
| High          | Balance and transfer reconciliation       | SQL checks every materialized balance against all persisted credits/debits and requires two matching legs for each transfer. Checks run after accepted, rejected, concurrent, rolled-back and acknowledgement-loss cases.                                                                                                                                                                                                                                                    |
| Medium        | Pagination/filter/totals/order            | Existing cases verify page limits/bounds, empty filters, account isolation, newest timestamp first, descending UUID tie-breaks and one repeatable-read snapshot for totals/items during a concurrent commit. New cases walk all pages and an out-of-range page for all/credit/debit filters on both sides of a mixed standalone/transfer ledger, with exact totals, expected ordering, no duplicate IDs and unchanged storage.                                               |
| Medium        | Error UI and recovery                     | Existing tests verify four-field notices, mapped known/fallback messages, hostile response copy rejection, support IDs matching headers/body/logs, Go Back navigation, Retry/read recovery, pending-action locking, retained receipts and no false success. New timeout form/browser cases add code/ID/diagnostic assertions and verify identical retry after reload.                                                                                                        |
| Cross-cutting | Failure logs outside rollback             | New deferred-COMMIT tests write diagnostics through the existing serializer to an independent temporary file after financial rollback. The support ID remains traceable, credentials are redacted, the public body is safe, both directory/file are private, and no financial row survives. Existing sink/console-failure tests verify bounded private fallback records with original causes and IDs.                                                                        |

## Important distinctions

A definitive validation/domain rejection and a **known rollback** must leave financial state unchanged. An HTTP 500 or client timeout does **not** prove rollback: a commit can already be durable. The acknowledgement-loss cases therefore assert complete one-time persistence, safe uncertain UI and duplicate protection, rather than requiring an incorrect empty database after every 500.

Retries use the original reference and payload. Current API semantics return **409 conflict**, not the original success receipt. The UI must not promote that conflict to a confirmed receipt for an earlier unobserved result. Fresh references represent new intents; the system does not deduplicate unrelated requests merely because account/amount/description happen to match.

## Execution results

- Baseline: 482 automated tests passed (156 contracts, 210 API, 116 frontend).
- Updated automated suites: **533 passed** (156 contracts, 259 API, 118 frontend), 26 test files. This includes all 48 added financial cases, the privacy regression and two form timeout cases.
- Focused backend audit: 79 passed across financial reliability and error-unit suites.
- Focused browser timeout/reload/retry audit: 3 passed for credit, debit and transfer.
- Full browser regression: **32 passed**, including the previously interrupted support-ID workflow, all three new timeout cases, and private-file/HTTP-download assertions.
- Full typechecks, builds, lint, formatting and module-boundary checks passed. The source graph has 129 modules and 33 folder entries with no runtime cycles or missing entries.

The build retains the existing lazy optional graphics chunk size warning from v0.3; this audit changes no UI implementation or dependencies.

## Test entry points

- [Financial reliability integration cases](../apps/api/tests/integration/financial-reliability.integration.test.ts)
- [Error serialization and logging regressions](../apps/api/tests/unit/errors.test.ts)
- [Form timeout/retry cases](../apps/web/tests/financial-error-recovery.test.tsx)
- [Real commit/client timeout browser cases](../apps/web/e2e/reliability.spec.ts)
- [Support-ID, action and private-file browser checks](../apps/web/e2e/errors.spec.ts)
- Existing [transaction](../apps/api/tests/integration/transactions.integration.test.ts), [transfer](../apps/api/tests/integration/transfers.integration.test.ts) and [history](../apps/api/tests/integration/transaction-history.integration.test.ts) suites remain part of every full run.

## Reproduction

From the repository root, with the project's pinned Node/pnpm and installed local Chrome/Chromium:

```sh
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm build
pnpm lint
pnpm format:check
```

Focused suites, after building the workspace contracts:

```sh
pnpm --filter @ledger/contracts build
pnpm --filter @ledger/api exec vitest run tests/integration/financial-reliability.integration.test.ts tests/unit/errors.test.ts
pnpm --filter @ledger/web exec vitest run tests/financial-error-recovery.test.tsx
pnpm --filter @ledger/web exec playwright test e2e/reliability.spec.ts e2e/errors.spec.ts
```

Stop the normal development server on port 5173 before browser tests. Do not run builds/tests that regenerate contracts while the browser suite is active, since development HMR can reset forms. Native PostgreSQL/Supertest/browser fixtures need permission to bind local sockets. Capture test output in private local files rather than publishing raw runner dumps; third-party fixture diagnostics may contain disposable connection metadata on unexpected failures.

## Remaining limits

- These tests certify the exercised API/service paths and database constraints. They do not restrict trusted PostgreSQL owners from directly editing rows; API immutability is not a privileged-DB tamper-proof audit log. Exact precision is enforced at the API boundary; arbitrary privileged SQL can invoke PostgreSQL NUMERIC coercion.
- Row-lock tests and the eight-request burst are deterministic contention checks, not sustained load/soak benchmarks. Real power loss, disk exhaustion, OS process kills, physical TCP packet loss and hosted failover were not exercised. Commit-ack loss is injected after a real commit; browser timeouts use the real deadline handler with a controlled clock.
- History totals/items share a snapshot within each request. Offset pagination across separate requests can shift when new entries arrive between pages; no cursor/snapshot-token contract was introduced.
- API errors go to process stderr; production durability/rotation/access controls require the deployment's private log collector. The independent-file rollback tests prove transactional separation, not crash-proof logging. Sink failure fallback is bounded process-local memory, and browser diagnostics reset on reload; no remote ticket/telemetry service exists.
- Hosted Supabase TLS/network/failover behavior, backups and production operational access were not exercised. Existing verified-TLS configuration tests remain; all financial audit mutations were isolated locally.
