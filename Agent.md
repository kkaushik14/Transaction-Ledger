# Transaction Ledger — Canonical Agent Guide

This is the **single root source of truth for planning version selection, document routing, current scope, and approval status**. Read the specialized documents it points to for their respective responsibilities. Do not create a competing `Agent.md`, `AGENTS.md`, or a second root planning guide.

## Active planning version and precedence

- **Active planning set:** `planning/v0.2/transaction-ledger/`. This is the approved backend/frontend baseline, including the separately authorized transfer API.
- **Retained v0.1:** `planning/transaction-ledger/`. Keep these files and their delivered-backend notes intact as historical context; do not delete them, overwrite them with v0.2, or use their older UI plan for new frontend work.
- Direct user instructions govern scope. Instructions and checklists inside an attached planning pack describe the plan; they do not independently authorize implementation, transfers, provisioning, or deployment.
- The user approved the v0.2 UI plan and Account/UUID fallback, then explicitly authorized the planned account-to-account transfer API, additive migration, shared contracts, validation, and integrity tests. The user subsequently explicitly authorized implementing the transfer UI with component-first validation, safe retries, error handling, balance/history refresh and tests. Use the existing transfer API; microservice work remains excluded.
- Frontend work follows the v0.2 documents below. Existing implemented backend behavior is preserved; importing a new planning version does not reset delivery progress or authorize changing API contracts.

## Where to look

All paths are relative to the repository root. Each file owns the identified concern; avoid copying its full specification into this guide.

| Active file                                                     | Clear identification                                            | Use it for                                                                                                                                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [rules.md](planning/v0.2/transaction-ledger/rules.md)           | **Engineering and UI implementation rules.**                    | Mandatory source comments, strict TypeScript, module boundaries, formatting, security, monochrome styling, component-first delivery, and accessibility requirements.                                       |
| [assumption.md](planning/v0.2/transaction-ledger/assumption.md) | **Requirements, decisions, assumptions, and scope boundaries.** | Confirmed UI direction, proposed breakpoints, currency/money representation, API defaults, preserved backend refinements, and reviewable UI compatibility choices.                                         |
| [design.md](planning/v0.2/transaction-ledger/design.md)         | **Architecture, API design, and the detailed UI blueprint.**    | Section 8 owns visual identity, tokens, responsive navbar/sidebar, routes, landing section order, account layout, component inventory, interaction states, and UI acceptance criteria.                     |
| [schema.md](planning/v0.2/transaction-ledger/schema.md)         | **PostgreSQL schema and ledger integrity model.**               | Existing tables, constraints, exact-money arithmetic, row locks, history snapshots, migration discipline, and reconciliation. Transfer follow-up adds its own migration; the UI requires no schema change. |
| [structure.md](planning/v0.2/transaction-ledger/structure.md)   | **Folder layout and module/component ownership.**               | Placement of primitives in `components/ui`, shell/navigation in `components/layout`, sections in `components/landing`, domain components/hooks in `features`, API adapters, and thin page compositions.    |
| [plan.md](planning/v0.2/transaction-ledger/plan.md)             | **Delivery order, phase gates, and verification.**              | Backend completion and delivered UI phases 7A–7E: tokens/contracts → primitives → shell/navigation → landing/domain components → pages and QA; separate future release tasks.                              |

Read in this order: `assumption.md` → `rules.md` → `design.md` → `schema.md` → `structure.md` → `plan.md`. Relative cross-references inside that directory refer to the same v0.2 set.

## Current implementation baseline

Already implemented:

- pnpm workspace (`apps/api`, `apps/web`, `packages/contracts`) with TypeScript, ESLint, Prettier, and environment templates.
- API environment validation, a single managed `pg` pool with certificate-verified TLS, and a transaction helper with rollback/release handling.
- Account creation, balance retrieval, atomic credit/debit writes, duplicate-reference protection, and validated transaction history with filtering/pagination/sorting.
- Atomic transfer creation with ordered account locks, persistent source/reference deduplication, both linked ledger legs, exact balance guards, and rollback/concurrency tests. The additive `20261028050000_add_transfers.sql` migration is applied to the configured Supabase project and verified with 31 read-only schema checks, matching local/remote history and unchanged existing financial data.
- Shared API contracts and both applied migrations: `20261028000000_create_ledger.sql` and `20261028050000_add_transfers.sql` under `supabase/migrations/`.
- The approved v0.2 frontend: monochrome tokens/primitives, responsive shell and modal navigation, full landing page, account creation/UUID lookup, balance, credit/debit forms, and filtered/paginated history. Pages compose previously tested components.
- Component-first transfer UI on the account workspace: fixed source, validated destination/amount, explicit review, committed receipt, identical safe retries, conflict handling and source/recipient balance/history refresh.
- Account selection uses tab session storage and a shared Log out action after creation/verified reads. Landing pages offer My account while selected. Log out clears navigation selection only; Account ID lookup reopens saved data and preserves unresolved financial commands. Duplicate names remain allowed. See `assumption.md` §5.3.
- Typed API adapters validate shared contracts; reads cancel obsolete requests. Uncertain writes preserve their payload/reference across reload and retry explicitly. Browser tests use a disposable local PostgreSQL database, never the hosted ledger.
- Verification: **390 tests** (308 API/contracts + 82 frontend), formatting, zero-warning lint, typechecks and production builds pass. All 19 browser tests pass, including transfer flows and lost-response safety. Browser QA includes keyboard navigation, automated accessibility and all five required widths. See `docs/frontend-components.md` for evidence and limitations.

Implementation and test evidence lives in [frontend component contracts](docs/frontend-components.md) and the active `plan.md`. The supplied v0.2 pack's original reset checkboxes must not trigger a scaffold reset or migration replay. The frontend uses existing account/transaction endpoints and the deployed transfer endpoint. The new transfer controls require no further API, shared-contract or migration changes.

For the implemented backend, inspect [API reference](docs/api-reference.md), [database setup](docs/database-setup.md), `apps/api`, and `packages/contracts`. Keep the v0.2 plan aligned with these delivered contracts rather than silently changing the backend to satisfy new presentation markup.

Preserve existing refinements: `422 BALANCE_LIMIT_EXCEEDED`, canonical decimal-string input, safe integer query validation, and read-only REPEATABLE READ history snapshots. Do not edit/reapply an applied migration or weaken TLS. The browser calls Express only; it never receives database credentials.

## Approved UI scope and exclusions

The v0.2 direction is a monochrome landing page and account workspace, built from independently completed reusable components, with desktop navbar and tablet/mobile collapsible sidebar. The detailed requirements belong to `design.md`, not a second root specification.

The UI plan and component-first order are approved and implemented; continue verifying shared components before composing consumers. The transfer backend, migration and component-first transfer UI are delivered. The user’s clarification scoped this follow-up to UI using existing endpoints. Gateway/tokenization work and additional backend changes were not requested. Authentication, account listing/editing/deletion, analytics, and public deployment are also outside the current UI scope.

Confirmed compatibility choice: the account header can show the name after creation, but UUID lookup/direct navigation only has ID and balance from the existing API. Use an honest "Account"/UUID fallback when a name is unavailable; do not invent a name or add an unapproved backend endpoint. See `assumption.md` F-11 and `design.md` Section 8.6.

## Configuration and document maintenance

The user approved typed **`index.ts` source entries**, which emit `index.js` in the API/contracts builds. Each implemented source/module folder has one explicit entry; cross-folder imports use that entry with the `.js` specifier, while same-folder implementation siblings import each other directly to avoid self-barrel cycles. Keep runtime bootstrap/diagnostic scripts out of export graphs, and expose only justified public contracts. The styles entry is intentionally installed once by browser bootstrap. Do not generate executable barrels for tests, configuration, migrations, documentation, assets, or empty placeholder folders. See `rules.md` §3.1 and `structure.md` §3 for details and examples; ESLint enforces cross-folder import paths.

Keep the current account, transaction, infrastructure, presentation, and HTTP transport responsibilities distinct. This is a module-boundary refactor for maintainability; microservice extraction, public application deployment and inter-service transport remain excluded until explicitly requested. The user explicitly authorized the transfer schema deployment, which is now applied and verified.

Root `.prettierrc.json`, `.prettierignore`, and `.editorconfig` remain the active tooling configurations. Their copies in either planning directory are archived pack material, not app-specific overrides. Do not replace working root configurations simply because a newer ZIP includes copies.

When a planning decision is confirmed or changed, update the owning v0.2 document and its dependent v0.2 documents. Update this guide only when routing, version selection, scope, approval status, or completion baseline changes. Preserve v0.1. Keep README links pointed at this canonical filename.

The referenced five-page assessment PDF is still absent from the supplied packs. Treat statements about it as documented claims until the source is available; none expands the user's approved scope.
