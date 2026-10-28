# Development and Delivery Plan

> Project: Transaction Ledger | Version: 0.2 | Status: Account/transfer API and UI implemented; microservices excluded
>
> **Assessment constraint:** the PDF describes a **3–4 hour backend assessment**. The user additionally requested a component-first, monochrome React frontend with a responsive desktop navbar, tablet/mobile collapsible sidebar, complete landing page, and a maintainable TypeScript monorepo. Complete mandatory backend behavior, integrity tests, and documentation **before** spending assessment-critical time on UI polish or optional features.

## Current review and implementation baseline

The user approved the v0.2 UI plan and Account/UUID fallback and explicitly authorized frontend implementation. Follow Phases 7A–7E in order, verifying components before page assembly. The transfer backend is now separately authorized; the transfer UI is now authorized and implemented; microservice work remains excluded.

Existing delivery is preserved: pnpm/TypeScript/ESLint/Prettier tooling, API environment validation, verified-TLS pool, transaction helper, account creation/balance reads, atomic credit/debit writes, and filtered/paginated history are implemented. The initial Supabase migration is applied. The backend baseline has 213 passing tests; frontend verification is recorded below. No backend or database reset was needed for v0.2.

Phases 7A–7E are implemented in the required order: contracts/tokens, independently tested primitives, shell/navigation, landing/domain components, then thin pages and browser QA. Broader release/clean-clone tasks outside these phases remain subject to their own acceptance evidence; no clean-clone or public deployment claim is made.

Verification on 2026-10-28: 213 API/contracts tests and 37 frontend tests pass, plus 13 real-browser tests against an isolated PostgreSQL fixture. Formatting, zero-warning lint, TypeScript checks and production builds pass. Responsive and long-content QA covers all five required widths, along with keyboard navigation, automated accessibility and lost-response retry safety. Final retry cleanup also has a regression test preventing old responses from erasing newer pending intents. See `docs/frontend-components.md` and README for commands and practical limits. Retained v0.1 files and backend/contracts sources are unchanged from the pre-UI baseline.

## 1. Delivery targets

### Completed follow-up — explicit folder module entries

The user approved typed `index.ts` sources for the requested `index.js` entry convention. Implemented folders now expose explicit named/type exports; consumers use folder or feature entries with `.js` specifiers, while implementation siblings keep direct imports. Existing account, transaction, infrastructure and presentation responsibilities remain intact. CLI startup/diagnostics, internal SQL/controller details and test runners are excluded from public export graphs; styles install once at browser bootstrap. ESLint enforces cross-folder entry imports.

Verification: all 250 existing regression tests and 13 browser tests pass after refactoring. Typecheck, formatting, zero-warning lint and production builds pass. The source graph has no runtime cycles or executable exports; emitted API/config/database entries import without launching infrastructure. Eight lint probes confirm deep imports are rejected while valid entries, sibling imports and assets are accepted. Existing implementation/test bodies are unchanged apart from imports. Contracts, migrations and retained v0.1 planning remain unchanged. No microservice extraction, new business behavior or transfers were implemented.

### Target M1 — Repository ready

A cloneable, strict-TypeScript pnpm workspace with working Prettier/ESLint scripts, environment templates, shared contracts, and a reproducible Supabase SQL migration.

### Target M2 — Mandatory backend complete

Four required API capabilities work: create account, post credit/debit, get balance, get filtered/paginated history. Failed, duplicate, and concurrent requests preserve ledger invariants.

### Target M3 — Frontend demonstration complete

A polished black/white React/Vite landing page and account workspace are composed from completed reusable components. Desktop navbar, tablet/mobile collapsible sidebar, hero/CTA sections, footer, and the full ledger workflow are responsive and accessible.

### Target M4 — Submission ready

Source code, README with local startup instructions, API documentation, and documented assumptions are complete. Typecheck, format, lint, unit/integration tests, and manual walkthrough pass.

### Target M5 — Approved transfer backend

Atomic account-to-account transfer with a new migration, strict shared contracts, API and rollback/concurrency tests is implemented under the user’s explicit authorization. The transfer UI was subsequently authorized and implemented. The user separately authorized hosted migration application; it is now applied and verified.

## 2. Priority rules and stage gates

| Priority                    | Scope                                                                                                                 | Gate to proceed                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P0 — Mandatory core         | DB schema; account creation; atomic credit/debit; sufficient balance; duplicate protection                            | Transaction/integrity tests pass                                                |
| P1 — Mandatory completeness | Balance read; history filters/pagination/sort; validation; errors; documentation                                      | All assessment criteria verified                                                |
| P2 — User-added interface   | Monochrome design system, component library, desktop navbar, mobile/tablet drawer, complete landing, ledger workspace | Backend contract stable; components pass isolated gates before page composition |
| P3 — Bonus                  | Transfer API and any extra UI                                                                                         | M4 completed and optional scope approved                                        |

P0/P1 are both assessment requirements; the priority tiers are planning labels, not labels from the PDF. The real project should not treat missing README/API docs as an acceptable submission even when the API functions.

## 3. Phase-by-phase execution checklist

### Phase 0 — Planning baseline and change freeze

**Inputs:** assessment PDF, six planning Markdown files, user stack/coding rules.

- [x] Review `rules.md` and ensure comment rules apply to every new and changed module.
- [x] Review `assumption.md` for money unit, currency, auth, transfer, pagination, and account selection decisions.
- [x] Confirm API names and payloads in `design.md`, with `snake_case` fields and decimal-string money.
- [x] Confirm private `ledger` schema and migrations in `schema.md`.
- [x] Confirm module boundaries and paths in `structure.md`.
- [x] Review the monochrome palette, landing-page route/section map, desktop navbar and tablet/mobile sidebar in `design.md`.
- [x] Receive the user's explicit go-ahead on the summarized component-first UI plan and breakpoint assumptions before frontend implementation.
- [x] Record approved changes in all affected files before starting feature code.

**Exit:** One coherent set of design decisions; open questions are visible, not silently treated as PDF requirements.

### Phase 1 — Repository, scripts, and conventions

**Dependencies:** Phase 0.

- [x] Initialize root Git repository, `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`.
- [x] Create `apps/api`, `apps/web`, `packages/contracts` with their own manifests and strict TS configs.
- [x] Install/configure local Prettier; keep the supplied root `.prettierrc.json` and `.prettierignore`.
- [x] Add `.editorconfig`, `.gitignore`, ESLint config + `eslint-config-prettier`.
- [x] Implement root scripts: `dev`, `dev:api`, `dev:web`, `build`, `format`, `format:check`, `lint`, `typecheck`, `test`.
- [x] Add `.env.example` files for API and web, with explanatory comments and placeholders only.
- [x] Add top-of-file comments and exported-symbol docs to all authored code; comment new router mounts.
- [x] Confirm `pnpm format:check`, lint, and typecheck can run on the scaffold.

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

- [x] Define reusable Zod schemas/types in `packages/contracts` for account creation and account responses.
- [x] Implement `POST /api/v1/accounts` and `GET /api/v1/accounts/:accountId/balance`.
- [x] Validate nonblank account name; reject attempts to set `balance`, `id`, or `created_at`.
- [x] Generate UUID/timestamp in PostgreSQL and initialize balance to `0.00`.
- [x] Implement typed `ACCOUNT_NOT_FOUND` / `VALIDATION_ERROR` handling.
- [x] Add unit/integration tests for create, zero balance, invalid name, malicious balance input, unknown account.
- [x] Add file/module comments, route-mount comments, and documentation for each exported handler/service.

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

### Phase 7 — Component-first React/Vite interface (user-added)

**Dependencies:** Stable backend contract; ideally Phase 6 complete. The landing page and responsive shell are user requirements, not PDF API requirements.

#### Phase 7A — Design tokens and component contracts

- [x] Scaffold Vite React TypeScript app and configure `VITE_API_BASE_URL`; connect only to Express.
- [x] Document component hierarchy in `design.md` and directory ownership in `structure.md`.
- [x] Create CSS token layer in `styles/tokens.css`: white/black/neutral colors, contrast, typography, spacing, radii, button states, breakpoints and content widths.
- [x] Create `styles/global.css` and `styles/layout.css`, including visible focus, skip link, fluid headings, overflow guards and reduced-motion support.
- [x] Define typed props and required visual/interaction variants for each reusable UI component before coding its consumers.
- [x] Ensure every authored TSX/CSS file begins with a precise comment and significant choices are documented at their implementation point.

**Gate A:** Design tokens and contracts are defined; no page-specific components have been rushed into `HomePage.tsx`.

#### Phase 7B — Reusable UI primitives (complete before sections/pages)

- [x] Build `Button`, `IconButton`, `TextField`, `TextAreaField`, `SelectField`, `Card`, `Container` and `SectionHeading`.
- [x] Build `StatusMessage`, `LoadingState` and `Pagination` with coherent monochrome states.
- [x] Verify all controls accept typed props, support keyboard/touch use, and remain readable when disabled, loading or invalid.
- [x] Add focused component tests and verify token-driven styles without duplicated one-off control code.
- [x] Review component documentation and comments, run Prettier, ESLint and TypeScript checks.

**Gate B:** Primitives are independently usable and tested; no landing or account page composition depends on unfinished primitives.

#### Phase 7C — Global shell and responsive navigation

- [x] Build `AppShell` with skip link, semantic `SiteHeader`, main landmark and `SiteFooter`.
- [x] Build `DesktopNav` linking only to implemented routes/anchors; show it at >=1024px.
- [x] Build `ResponsiveSidebar` for <1024px, closed by default, with toggle, close button, overlay and matching links.
- [x] Implement `aria-expanded`, `aria-controls`, accessible sidebar naming, focus containment/restore, Escape, overlay click, close-after-navigation and body scroll lock.
- [x] Close/reset drawer on desktop breakpoint transition; respect reduced motion preferences.
- [x] Test navigation in isolation at desktop, tablet and mobile widths, including keyboard-only use and no simultaneous visible nav modes.

**Gate C:** Header, desktop navbar, collapsible tablet/mobile sidebar and footer work independently before either page is assembled.

#### Phase 7D — Landing and ledger feature components

- [x] Build `HeroSection` (short headline, meaningful subcopy, working primary and secondary CTAs to account entry).
- [x] Build `FeatureGrid` (`#features`) using only actual account/credit/debit/balance/history capabilities.
- [x] Build `HowItWorksSection` (`#how-it-works`), `LedgerPrinciplesSection`, `GetStartedSection` (`#get-started`) and `FinalCtaSection`.
- [x] Create typed `api/client.ts` wrapper plus account and transaction API adapters.
- [x] Build and test `AccountCreateForm`, `AccountLookupForm`, `AccountBalanceCard` and their feature hook(s).
- [x] Build and test `TransactionForm`, `TransactionHistory` and their feature hook(s); preserve new-vs-retry reference ID semantics.
- [x] Provide clear loading, empty, field error, duplicate, insufficient-funds, success and network-error states using words/icons, not color alone.
- [x] Make transaction history an accessible table on wide screens and readable list/card format on narrow screens without losing required fields, filters or pagination.

**Gate D:** Each landing section and domain feature is a tested, self-contained component before being mounted in `HomePage` or `AccountPage`.

#### Phase 7E — Compose pages and verify full UX

- [x] Compose `HomePage` from the prebuilt landing sections and `GetStartedSection`; do not place full section markup in `HomePage.tsx`.
- [x] Compose `AccountPage` from balance/form/history components; do not fetch SQL or duplicate primitive styling in page files.
- [x] Register `/`, `/accounts/:accountId`, and a recoverable not-found route in `app/routes.tsx`.
- [x] Check all hero/header/footer/final CTAs and links point to functioning routes or anchors, with proper scroll position and focus.
- [x] On successful account creation, navigate to account detail; on successful credit/debit, refetch server balance/history.
- [x] Run responsive QA at 320, 375, 768, 1024, and 1440 CSS px; check clipping, overflow, long UUIDs, navigation transitions and touch targets.
- [x] Run component and integrated frontend tests, keyboard navigation tests, a visual consistency review, format, lint, typecheck and build.

**Exit:** A complete monochrome landing page and account UI are assembled from independently verified components. Desktop uses a navbar; tablet/mobile use an accessible collapsible sidebar. All ledger actions run through Express, with no browser DB credentials.

### Phase 8 — Final verification and handoff

**Dependencies:** Phases 6–7.

- [ ] Start from a clean clone and follow README exactly: install, env setup, migration, API start, UI start.
- [ ] Create account, submit credit, submit debit, check balance, view filtered/paginated history.
- [ ] Exercise duplicate reference, insufficient funds, invalid type/amount and invalid pagination in UI or API client.
- [ ] Walk the landing page: header, hero CTA, features, steps, principles, get-started, final CTA and footer; verify links are real.
- [ ] Confirm no visible mobile/tablet desktop navbar and no visible desktop mobile drawer; test menu keyboard behavior and focus restoration.
- [ ] Verify monochrome appearance, contrasts, component reuse and 320/375/768/1024/1440px responsiveness.
- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [ ] Review every new/modified module for crystal-clear, accurate comments and no stale placeholders.
- [ ] Check `.gitignore` and repo for accidental env secrets or database credentials.
- [ ] Ensure `README.md`, `docs/api-reference.md`, and `assumption.md` match **actual** implementation behavior.
- [ ] Package source, README, API docs and assumptions as required by assessment submission.

**Exit:** Reviewable, maintainable, locally runnable full-stack deliverable.

### Phase 9 — Authorized atomic transfer backend

**Authorization:** The user explicitly requested the planned transfer backend and integrity tests. At this backend stage transfer UI was deferred; its authorized follow-up is recorded below. Microservice work remains excluded.

- [x] Create a new migration for `ledger.transfers` and linked `transactions.transfer_id` from `schema.md`.
- [x] Implement a strict `POST /api/v1/transfers` contract and dedicated module with comments.
- [x] Lock both accounts in deterministic UUID order; reject missing accounts, same account, insufficient funds, and duplicates.
- [x] Atomically insert transfer, debit and credit ledger entries, and update both balances.
- [x] Verify rollback of **all** transfer changes on any forced error; test concurrent opposing transfers.
- [x] Update API docs, assumptions and README, preserve the existing frontend, and run full regression checks.

**Exit:** No partial transfer state is possible; every transfer has two correlated immutable entries.

Verification: 42 new transfer contract tests and 53 native PostgreSQL transfer integration tests pass. The full suite passes 345 tests (128 contracts, 180 API, 37 frontend). The new migration upgrades populated initial tables without data changes; it is now applied to the configured Supabase project and verified under the user’s explicit deployment authorization. The initial migration and frontend code are unchanged.

## 4. Requirement-to-delivery traceability

| ID   | PDF requirement                             | Planned implementation              | Proof                                  |
| ---- | ------------------------------------------- | ----------------------------------- | -------------------------------------- |
| R-01 | Create accounts, balance 0                  | Phase 3 / accounts module           | Account creation tests                 |
| R-02 | Credit/debit transaction fields             | Phase 4 / transactions module       | Transaction contract/integration tests |
| R-03 | Credit/debit arithmetic, insufficient funds | Phase 4 / service                   | Balance and rejection tests            |
| R-04 | Account-scoped unique reference             | Phases 2 + 4 / unique key + lock    | Duplicate and cross-account tests      |
| R-05 | Get account balance                         | Phase 3 / balance route             | Balance read and 404 tests             |
| R-06 | History filter/page/sort                    | Phase 5 / history route             | Filter/metadata/order tests            |
| R-07 | Immutability through API                    | Phase 4 / no mutation routes        | Route tests / code review              |
| R-08 | Balance consistency                         | Phases 4 + 6 / reconciliation       | Reconciliation integration query       |
| R-09 | Atomicity                                   | Phases 4 + 6 / transaction helper   | Forced rollback test                   |
| R-10 | Validation + HTTP errors                    | Phases 3–5 / contracts + middleware | Invalid request matrix                 |
| R-11 | Money transfer **bonus**                    | Phase 9, authorized                 | Transfer rollback/concurrency tests    |
| R-12 | Runnable code + source/docs/assumptions     | Phases 1, 6, 8                      | Clean-clone verification               |

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
- `UI-06`: Landing page includes header, hero, features, how-it-works, principles, account entry, final CTA and footer; all links resolve.
- `UI-07`: Desktop navbar is visible at >=1024px; tablet/mobile collapsible sidebar is used below 1024px with no duplicate visible navbar.
- `UI-08`: Sidebar supports menu toggle, close control, Escape, overlay, focus containment/restore, navigation close and breakpoint reset.
- `UI-09`: Reusable primitives are tested before pages; no repeated control implementations/styles in different pages.
- `UI-10`: At 320/375/768/1024/1440px, navigation, hero, forms and transaction history have no unexpected overflow.
- `UI-11`: Black/white/neutral tokens govern controls and feedback; errors and transaction states do not rely on color alone.
- `UI-12`: Both hero and final CTA lead to working account-entry UI; account creation and lookup flow to the existing account route.

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

| Risk                                                                 | Effect                           | Mitigation                                                             |
| -------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| UI takes time away from backend assessment                           | Incomplete mandatory deliverable | Complete Phase 6 before Phase 7; respect the 3-4 hour assessment limit |
| Page-first JSX produces duplicated styling and inaccessible controls | Difficult to maintain UI         | Enforce Phases 7A-7D gates before Phase 7E page assembly               |
| Drawer/navigation fails on tablet/mobile or for keyboard users       | Broken UX                        | Focus/Escape/scroll-lock tests, breakpoint and device QA               |
| Money handled as JS `number`                                         | Precision errors                 | Decimal-string HTTP + SQL `NUMERIC`                                    |
| Concurrent debits see stale balance                                  | Overspending                     | `SELECT ... FOR UPDATE`, atomic updates, concurrency tests             |
| Duplicate retry not guarded at DB level                              | Double credit/debit              | Unique `(account_id, reference_id)` + lock                             |
| Mixed DB clients within a transaction                                | Partial commits                  | One acquired `pg` client per transaction; rollback tests               |
| Supabase `public` Data API exposure                                  | Accidental data exposure         | Private `ledger` schema, no anon grants, backend-only access           |
| Exposed Express API without auth                                     | Anyone can mutate demo accounts  | Treat as private demo; require auth design before public launch        |
| Drifting comments and docs                                           | Unmaintainable behavior          | Required comment review + documentation update in DoD                  |
| Missing migration reproducibility                                    | Fresh clone fails                | Versioned Supabase CLI SQL migrations                                  |
| Live DB used in integration tests                                    | Data damage                      | Isolated database/project and test env checks                          |

## 8. Documentation and submission deliverables

The original assessment's submission list is exactly: **(1) Source Code, (2) README, (3) API Documentation, (4) Assumptions.** The six planning files are additional engineering artifacts.

| Deliverable       | Expected path                                   | Checklist                                                       |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Source code       | `apps/`, `packages/`, `supabase/`, root configs | Builds and runs locally                                         |
| README            | `README.md`                                     | Setup, run, env vars, DB migration, tests, examples             |
| API documentation | `docs/api-reference.md`                         | Full route schemas, examples, status codes, pagination          |
| Assumptions       | `assumption.md`                                 | Confirmed choices + limitations; reflects actual implementation |
| Engineering rules | `rules.md`                                      | Mandatory source comments and Prettier                          |
| Technical design  | `design.md`                                     | Backend and frontend contracts                                  |
| Schema            | `schema.md`                                     | Versioned DB and integrity model                                |
| Structure         | `structure.md`                                  | Directory ownership                                             |
| Execution plan    | `plan.md`                                       | Phases, acceptance and optional work                            |

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
- [ ] UI primitives and layout were completed before page assembly; black/white token system is consistent.
- [ ] Landing sections, functional CTAs, header/footer and tablet/mobile drawer pass responsiveness and accessibility acceptance checks.
- [ ] API documentation and assumptions match the code that was actually submitted.

## 10. Review process for these six files

Review in this order to minimize change propagation: **`assumption.md` → `rules.md` → `design.md` → `schema.md` → `structure.md` → `plan.md`**. When an item changes, update every dependent document before coding. Do not claim that a planned module, migration, script, or test is already implemented merely because it is described here.

## Completed transfer schema deployment

On October 28, 2026, the user authorized applying the transfer migration to the configured Supabase database. Preflight verified the expected session-pooler project and initial history over certificate-verified TLS. The CLI dry run selected only `20261028050000_add_transfers.sql`; the push applied it with vault/seed/role updates excluded. Thirty-one read-only schema checks passed, and SQL plus CLI history now match both local versions (`20261028000000`, `20261028050000`). Existing account and ledger fingerprints are unchanged, including null transfer links on pre-existing standalone rows. No financial test writes occurred. Both migration files, application code and retained v0.1 planning remain unchanged. This deployment did not add UI. The subsequent authorized transfer UI follow-up is recorded below; microservices remain excluded. See `docs/database-setup.md` for verification evidence and recovery.

## Completed component-first transfer UI follow-up

The user clarified the request to implement only the transfer UI using the existing API, without gateway/tokenization/authentication or microservice work. Component contracts were recorded before code, then review/receipt and hook/form passed 24 isolated cases before workspace integration. The delivered form validates source/destination/amount/description, requires review and confirmation, preserves exact retry commands, distinguishes unconfirmed/conflict/known failure/success, and shows a committed receipt. Source balance/history refresh independently from writes; recipient navigation fetches fresh data. Read errors retain confirmed receipts and visibly stale balances.

Verification: 372 regression tests (128 contracts, 180 API, 64 frontend), 17 browser tests, formatting, lint, typechecks and builds. The transfer tests cover actual timeout, storage failure, stale completions and account isolation. Four new browser workflows cover all required widths, keyboard review, accessibility, source/filter/page and recipient refresh, committed response loss, known rejection and failed read retries. Tests use only disposable local databases. Backend source, shared contracts, applied migrations and retained v0.1 planning remain unchanged.

The UI regression pass also corrected an existing disposable-test shutdown race: wait for client end events after pool.end() before stopping local PostgreSQL. This is confined to test infrastructure; production database/transaction behavior is unchanged.


## End-to-end review follow-up (2026-10-28)

- [x] Confirm duplicate names remain allowed under D-07; preserve existing API/schema behavior.
- [x] Add tab-scoped selection, shared Log out action, landing continuation and Account ID wording. Reopening by ID retains all server data and unresolved retries.
- [x] Harden standalone retry persistence, uncertain retry configuration failures, receipt/read correlation, invalid-field focus and rejected-write refreshes.
- [x] Remove stale balance/write controls on authoritative account-not-found, while retaining confirmed balances through temporary read failures.
- [x] Add regression coverage for navigation/reload/logout/reopen, case variants, pending commands and response mismatches. Browser review covers all five widths, accessibility and concurrent balance rejection.

Verification totals and evidence are recorded in the root guide and `docs/frontend-components.md`. No microservices, authentication, API contract changes or database migrations are part of this review.
