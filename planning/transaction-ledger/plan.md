# Development and Delivery Plan

> Project: Transaction Ledger | Version: 0.1 (review draft) | Status: Accounts, credit/debit writes, and history implemented; frontend pending
>
> **Assessment constraint:** the PDF describes a **3–4 hour backend assessment**. The user additionally requested a React frontend and a maintainable TypeScript monorepo. Complete mandatory backend behavior, integrity tests, and documentation **before** spending assessment-critical time on UI polish or optional features.

## 1. Delivery targets

### Target M1 — Repository ready

A cloneable, strict-TypeScript pnpm workspace with working Prettier/ESLint scripts, environment templates, shared contracts, and a reproducible Supabase SQL migration.

### Target M2 — Mandatory backend complete

Four required API capabilities work: create account, post credit/debit, get balance, get filtered/paginated history. Failed, duplicate, and concurrent requests preserve ledger invariants.

### Target M3 — Frontend demonstration complete

A responsive React/Vite interface can create/load an account, submit transactions, view current balance, and browse filtered/paginated history using the Express HTTP API.

### Target M4 — Submission ready

Source code, README with local startup instructions, API documentation, and documented assumptions are complete. Typecheck, format, lint, unit/integration tests, and manual walkthrough pass.

### Target M5 — Optional enhancement

Only if time remains: atomic account-to-account transfer, with its own migration, API, rollback and concurrency tests, and optional UI.

## 2. Priority rules and stage gates

| Priority | Scope | Gate to proceed |
| --- | --- | --- |
| P0 — Mandatory core | DB schema; account creation; atomic credit/debit; sufficient balance; duplicate protection | Transaction/integrity tests pass |
| P1 — Mandatory completeness | Balance read; history filters/pagination/sort; validation; errors; documentation | All assessment criteria verified |
| P2 — User-added interface | React/Vite TypeScript UI, responsive workflow | Backend contract stable |
| P3 — Bonus | Transfer API and any extra UI | M4 completed and optional scope approved |

P0/P1 are both assessment requirements; the priority tiers are planning labels, not labels from the PDF. The real project should not treat missing README/API docs as an acceptable submission even when the API functions.

## 3. Phase-by-phase execution checklist

### Phase 0 — Planning baseline and change freeze

**Inputs:** assessment PDF, six planning Markdown files, user stack/coding rules.

- [ ] Review `rules.md` and ensure comment rules apply to every new and changed module.
- [ ] Review `assumption.md` for money unit, currency, auth, transfer, pagination, and account selection decisions.
- [ ] Confirm API names and payloads in `design.md`, with `snake_case` fields and decimal-string money.
- [ ] Confirm private `ledger` schema and migrations in `schema.md`.
- [ ] Confirm module boundaries and paths in `structure.md`.
- [ ] Record approved changes in all affected files before starting feature code.

**Exit:** One coherent set of design decisions; open questions are visible, not silently treated as PDF requirements.

### Phase 1 — Repository, scripts, and conventions

**Dependencies:** Phase 0.

- [ ] Initialize root Git repository, `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`.
- [ ] Create `apps/api`, `apps/web`, `packages/contracts` with their own manifests and strict TS configs.
- [ ] Install/configure local Prettier; keep the supplied root `.prettierrc.json` and `.prettierignore`.
- [ ] Add `.editorconfig`, `.gitignore`, ESLint config + `eslint-config-prettier`.
- [ ] Implement root scripts: `dev`, `dev:api`, `dev:web`, `build`, `format`, `format:check`, `lint`, `typecheck`, `test`.
- [ ] Add `.env.example` files for API and web, with explanatory comments and placeholders only.
- [ ] Add top-of-file comments and exported-symbol docs to all authored code; comment new router mounts.
- [ ] Confirm `pnpm format:check`, lint, and typecheck can run on the scaffold.

**Exit:** Workspace builds in the documented order; formatting and source-comment requirements are visible and enforceable in review.

### Phase 2 — Supabase PostgreSQL setup and migration

**Dependencies:** Phase 1.

- [ ] Create or choose a **non-production** Supabase PostgreSQL project for development.
- [ ] Install/init Supabase CLI; create timestamped `supabase/migrations/<timestamp>_create_ledger.sql`.
- [ ] Create private `ledger` schema, accounts table, transactions table, constraints, and indexes from `schema.md`.
- [ ] Ensure `ledger` is **not** in Data API exposed schemas and has no anon/authenticated grants.
- [ ] Apply migration to the intended development database and inspect created constraints.
- [ ] Implement `db/pool.ts`, `db/transaction.ts`, and typed `config/env.ts` with comments.
- [ ] Configure a direct or session-pooler Supabase PostgreSQL URI with TLS in backend environment only.
- [ ] Verify DB query, pool release, rollback, and reconnection behavior.
- [ ] Prepare separate test DB configuration; never point destructive tests at production.

**Exit:** A documented, repeatable migration creates both tables and required constraints; backend connects securely.

### Phase 3 — Shared contracts and account functionality

**Dependencies:** Phase 2.

- [ ] Define reusable Zod schemas/types in `packages/contracts` for account creation and account responses.
- [ ] Implement `POST /api/v1/accounts` and `GET /api/v1/accounts/:accountId/balance`.
- [ ] Validate nonblank account name; reject attempts to set `balance`, `id`, or `created_at`.
- [ ] Generate UUID/timestamp in PostgreSQL and initialize balance to `0.00`.
- [ ] Implement typed `ACCOUNT_NOT_FOUND` / `VALIDATION_ERROR` handling.
- [ ] Add unit/integration tests for create, zero balance, invalid name, malicious balance input, unknown account.
- [ ] Add file/module comments, route-mount comments, and documentation for each exported handler/service.

**Exit:** Accounts are created with zero initial balance; invalid inputs cannot override server-owned fields.

### Phase 4 — Atomic transaction engine

**Dependencies:** Phase 3. **Highest correctness priority.**

- [x] Add shared transaction request/response schemas (`type`, decimal-string `amount`, optional `description`, required `reference_id`).
- [x] Implement `POST /api/v1/accounts/:accountId/transactions`.
- [x] Acquire one `pg` client and `BEGIN` transaction for each mutation.
- [x] Lock the target account with `SELECT ... FOR UPDATE` **before** duplicate/funds checks.
- [x] Reject missing accounts (`404`), invalid input (`400`), duplicate account/reference (`409`), insufficient funds (`422`).
- [x] Use PostgreSQL numeric arithmetic for credit/debit and insert exactly one ledger entry.
- [x] `COMMIT` only if balance change and insert both succeed; rollback on any failure.
- [x] Enforce `UNIQUE (account_id, reference_id)` in DB regardless of application precheck.
- [x] Do not implement any transaction update/delete routes.
- [x] Add tests for credit, debit, insufficient funds, duplicate same account, same reference different accounts, rollback, invalid precision, and simultaneous conflicting debits.
- [x] Comment why locks, transaction boundaries, and duplicate checks are ordered this way.

**Exit:** A credit/debit is safe under failures and concurrent requests, not merely correct in a serial happy path.

### Phase 5 — History, pagination, and consistent errors

**Dependencies:** Phase 4.

- [x] Implement `GET /api/v1/accounts/:accountId/transactions`.
- [x] Validate `type=credit|debit`, positive `page`, and `limit` range 1–100.
- [x] Use `page=1`, `limit=20` defaults; omit type filter to include both types.
- [x] Return `data` array and `pagination` (`page`, `limit`, `total_records`, `total_pages`).
- [x] Sort `created_at DESC, id DESC`.
- [x] Return `404` for unknown account and empty array for known account without matches.
- [x] Standardize error JSON across all endpoints; hide database exceptions from public responses.
- [x] Verify history count and list use matching filters.
- [x] Test empty history, filtered history, pagination boundaries, ordering, and invalid query parameters.

**Exit:** All four mandatory API capabilities are functional and documented by tests.

### Phase 6 — Mandatory backend verification and API docs

**Dependencies:** Phases 3–5.

- [ ] Run complete account and transaction API integration suite against isolated test DB.
- [ ] Reconcile stored account balances against sum of valid ledger entries; expect zero mismatches.
- [ ] Force an error after balance update and before transaction insert; confirm full rollback.
- [ ] Concurrently submit two debits that cannot both succeed; verify no negative balance.
- [ ] Concurrently submit the same account/reference; confirm one insert and one duplicate response.
- [ ] Confirm no transaction PATCH/PUT/DELETE endpoint exists.
- [ ] Write `docs/api-reference.md` with all requests, success/error bodies, filters, pagination, and status codes.
- [ ] Record supported Node version, exact dependency setup, Supabase setup, env vars, migrations, and tests in `README.md`.
- [ ] Confirm format, lint, TypeScript typecheck, and API tests pass.

**Exit:** Mandatory assessment and submission requirements are demonstrably satisfied. This is the backend-first stopping point if the 3–4 hour assessment window is binding.

### Phase 7 — React/Vite frontend (user-added)

**Dependencies:** Stable API contract, ideally Phase 6 completed.

- [ ] Scaffold Vite React TypeScript app and configure `VITE_API_BASE_URL`.
- [ ] Create typed `api/client.ts` wrapper and account/transaction API adapters.
- [ ] Build Home screen: account creation plus UUID lookup (no account-list endpoint required).
- [ ] Build Account screen: account identity, balance card, transaction form, history and pagination.
- [ ] Add type filtering, clear server-error messages, loading/empty states, and submission lock.
- [ ] Generate a fresh reference UUID for a new transaction intent; reuse the same UUID for a retry of an uncertain request.
- [ ] Refetch balance/history after success; handle `409` by showing duplicate message and refreshing server state.
- [ ] Apply CSS tokens and mobile-first layout; verify keyboard use, labels, visible focus, and error announcements.
- [ ] Write focused component tests for success, invalid input, insufficient funds, and history filters.
- [ ] Meet mandatory file/route/component comment policy and run Prettier.

**Exit:** UI completes the ledger flow through Express, with no secrets or direct PostgreSQL access.

### Phase 8 — Final verification and handoff

**Dependencies:** Phases 6–7.

- [ ] Start from a clean clone and follow README exactly: install, env setup, migration, API start, UI start.
- [ ] Create account, submit credit, submit debit, check balance, view filtered/paginated history.
- [ ] Exercise duplicate reference, insufficient funds, invalid type/amount and invalid pagination in UI or API client.
- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [ ] Review every new/modified module for crystal-clear, accurate comments and no stale placeholders.
- [ ] Check `.gitignore` and repo for accidental env secrets or database credentials.
- [ ] Ensure `README.md`, `docs/api-reference.md`, and `assumption.md` match **actual** implementation behavior.
- [ ] Package source, README, API docs and assumptions as required by assessment submission.

**Exit:** Reviewable, maintainable, locally runnable full-stack deliverable.

### Phase 9 — Bonus atomic transfer (conditional)

**Dependencies:** Phase 8 and explicit decision to pursue bonus.

- [ ] Create a new migration for `ledger.transfers` and linked `transactions.transfer_id` from `schema.md`.
- [ ] Implement a strict `POST /api/v1/transfers` contract and dedicated module with comments.
- [ ] Lock both accounts in deterministic UUID order; reject missing accounts, same account, insufficient funds, and duplicates.
- [ ] Atomically insert transfer, debit and credit ledger entries, and update both balances.
- [ ] Verify rollback of **all** transfer changes on any forced error; test concurrent opposing transfers.
- [ ] Update API docs, assumptions, README, UI only if desired, and run full regression suite.

**Exit:** No partial transfer state is possible; every transfer has two correlated immutable entries.

## 4. Requirement-to-delivery traceability

| ID | PDF requirement | Planned implementation | Proof |
| --- | --- | --- | --- |
| R-01 | Create accounts, balance 0 | Phase 3 / accounts module | Account creation tests |
| R-02 | Credit/debit transaction fields | Phase 4 / transactions module | Transaction contract/integration tests |
| R-03 | Credit/debit arithmetic, insufficient funds | Phase 4 / service | Balance and rejection tests |
| R-04 | Account-scoped unique reference | Phases 2 + 4 / unique key + lock | Duplicate and cross-account tests |
| R-05 | Get account balance | Phase 3 / balance route | Balance read and 404 tests |
| R-06 | History filter/page/sort | Phase 5 / history route | Filter/metadata/order tests |
| R-07 | Immutability through API | Phase 4 / no mutation routes | Route tests / code review |
| R-08 | Balance consistency | Phases 4 + 6 / reconciliation | Reconciliation integration query |
| R-09 | Atomicity | Phases 4 + 6 / transaction helper | Forced rollback test |
| R-10 | Validation + HTTP errors | Phases 3–5 / contracts + middleware | Invalid request matrix |
| R-11 | Money transfer **bonus** | Phase 9, conditional | Transfer rollback tests |
| R-12 | Runnable code + source/docs/assumptions | Phases 1, 6, 8 | Clean-clone verification |

## 5. Required test case catalog

### Functional tests

- `ACCT-01`: Valid account creation gives `0.00` and a system UUID/timestamp.
- `ACCT-02`: Missing/blank name is rejected; client balance or timestamp is rejected.
- `TXN-01`: Credit `100.00`, credit `50.00`, debit `30.00`, debit `20.00` yields `100.00`.
- `TXN-02`: Debit over current balance is rejected without a ledger entry or balance update.
- `TXN-03`: Same reference repeated for same account returns `409`, with unchanged total and history count.
- `TXN-04`: Same reference used by two different accounts succeeds independently.
- `TXN-05`: Unknown account, invalid type, negative/zero/overprecision amount, absent reference fail safely.
- `HIST-01`: Unfiltered history includes both transaction types, latest first.
- `HIST-02`: Type filtering matches correct rows and pagination totals.
- `HIST-03`: Invalid paging is rejected; a valid out-of-range page returns empty data with correct totals.
- `IMM-01`: No transaction edit/delete endpoint allows modification.

### Integrity and concurrency tests

- `INT-01`: A controlled SQL insert failure after balance update rolls back the complete write.
- `INT-02`: Two competing debits cannot spend the same funds twice.
- `INT-03`: Concurrent duplicate references create exactly one ledger entry.
- `INT-04`: Reconciliation query reports no stored-versus-computed differences after the test sequence.
- `INT-05`: Reference uniqueness survives process retry or server restart (database-level, not in-memory).

### Frontend tests

- `UI-01`: Create an account and navigate to its account screen.
- `UI-02`: Submit a credit/debit, then display freshly fetched balance and history.
- `UI-03`: Display validation, duplicate, and insufficient-balance states clearly.
- `UI-04`: Filter and paginate history, including empty/loading states.
- `UI-05`: Form labels, focus behavior, and mobile widths remain usable.

## 6. Example end-to-end acceptance script

1. Create Account A and Account B; both return `0.00`.
2. Credit A `100.00` with reference `ref-a-001` → A becomes `100.00`.
3. Credit A `50.00` with `ref-a-002` → A becomes `150.00`.
4. Debit A `30.00` with `ref-a-003` → A becomes `120.00`.
5. Debit A `20.00` with `ref-a-004` → A becomes `100.00`.
6. Retry `ref-a-004` on A → `409`; A stays `100.00`; no fifth transaction.
7. Credit B with `ref-a-004` → allowed, because references are scoped per account.
8. Debit A `150.00` with a new reference → `422`; A stays `100.00`.
9. Fetch A balance → `100.00`.
10. Fetch A history unfiltered → four rows latest-first; fetch debit filter → two rows; verify pagination metadata.
11. Run reconciliation query → zero mismatches.

These steps directly reflect the PDF's example arithmetic and account-scoped duplicate requirements, with additional implementation checks.

## 7. Risks, decisions, and mitigations

| Risk | Effect | Mitigation |
| --- | --- | --- |
| UI takes time away from backend assessment | Incomplete mandatory deliverable | Complete Phase 6 before Phase 7 |
| Money handled as JS `number` | Precision errors | Decimal-string HTTP + SQL `NUMERIC` |
| Concurrent debits see stale balance | Overspending | `SELECT ... FOR UPDATE`, atomic updates, concurrency tests |
| Duplicate retry not guarded at DB level | Double credit/debit | Unique `(account_id, reference_id)` + lock |
| Mixed DB clients within a transaction | Partial commits | One acquired `pg` client per transaction; rollback tests |
| Supabase `public` Data API exposure | Accidental data exposure | Private `ledger` schema, no anon grants, backend-only access |
| Exposed Express API without auth | Anyone can mutate demo accounts | Treat as private demo; require auth design before public launch |
| Drifting comments and docs | Unmaintainable behavior | Required comment review + documentation update in DoD |
| Missing migration reproducibility | Fresh clone fails | Versioned Supabase CLI SQL migrations |
| Live DB used in integration tests | Data damage | Isolated database/project and test env checks |

## 8. Documentation and submission deliverables

The original assessment's submission list is exactly: **(1) Source Code, (2) README, (3) API Documentation, (4) Assumptions.** The six planning files are additional engineering artifacts.

| Deliverable | Expected path | Checklist |
| --- | --- | --- |
| Source code | `apps/`, `packages/`, `supabase/`, root configs | Builds and runs locally |
| README | `README.md` | Setup, run, env vars, DB migration, tests, examples |
| API documentation | `docs/api-reference.md` | Full route schemas, examples, status codes, pagination |
| Assumptions | `assumption.md` | Confirmed choices + limitations; reflects actual implementation |
| Engineering rules | `rules.md` | Mandatory source comments and Prettier |
| Technical design | `design.md` | Backend and frontend contracts |
| Schema | `schema.md` | Versioned DB and integrity model |
| Structure | `structure.md` | Directory ownership |
| Execution plan | `plan.md` | Phases, acceptance and optional work |

## 9. Final release gate

A feature-complete submission must pass **all** of the following:

- [ ] Required account, credit/debit, balance, and history routes function correctly.
- [ ] Duplicate reference and insufficient-balance paths persist no changes.
- [ ] Atomic rollback and concurrent-debit tests pass.
- [ ] Ledger entries cannot be mutated through public APIs.
- [ ] Input validation and error JSON are consistent.
- [ ] History filtering, sorting, pagination and totals are correct.
- [ ] Prettier format checks, ESLint, strict TypeScript, build, and tests pass.
- [ ] New files/mounted modules and important continuations have accurate comments.
- [ ] Only the backend holds PostgreSQL credentials; private schema is not Data API-exposed.
- [ ] README supports a fresh local run and includes environment/migration instructions.
- [ ] API documentation and assumptions match the code that was actually submitted.

## 10. Review process for these six files

Review in this order to minimize change propagation: **`assumption.md` → `rules.md` → `design.md` → `schema.md` → `structure.md` → `plan.md`**. When an item changes, update every dependent document before coding. Do not claim that a planned module, migration, script, or test is already implemented merely because it is described here.
