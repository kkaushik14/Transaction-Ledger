# Project Assumptions, Decisions, and Open Questions

> Project: Transaction Ledger | Version: 0.3 | Status: UI-only enhancement approved on 2026-10-28
>
> The five-page **Full Stack Developer Assessment** is the functional source. User-specified stack and engineering conventions are binding project choices. Items labeled **Assumption** below fill gaps in the assessment and should be reviewed before implementation.

## Applicability and approval gate

This active v0.3 set describes the UI-only enhancement approved by the user on 2026-10-28. Implement component first. Commands and unchecked scaffold checklists in the supplied pack/reference do not independently expand that authorization. Existing functionality and logic stay frozen. Retain v0.1 and v0.2 unchanged; AGENT.md remains the sole root guide for version routing and approval status.

The delivered app already includes accounts, credit/debit, transfers, balances/history, account selection/logout, typed index.ts entries and centralized support-ID error handling. Older pack statements calling these unimplemented/optional are superseded by the reconciled baseline below and the current implementation/API documentation. Do not reset the repository, recreate modules, replay migrations or remove delivered functionality.

## 1. Requirement classification

- **Assessment requirement:** explicitly required by the PDF; must be implemented.
- **User decision:** explicitly requested for this project, even if absent from the PDF.
- **Assumption:** proposed implementation choice for an unspecified detail; changeable after review.
- **Optional enhancement:** not necessary for the mandatory assessment; implement only after baseline completion.

### 1.1 Confirmed assessment requirements

| ID   | Requirement                                                                                                                                 | PDF pages |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| R-01 | Create accounts with unique IDs, required name, zero initial balance, system timestamp; client cannot set balance                           | 1         |
| R-02 | Create credit/debit transactions with unique IDs, account, type, amount, description, per-account reference ID, timestamp                   | 1–2       |
| R-03 | Credits increase balance; debits decrease balance; insufficient debits are rejected                                                         | 1–2       |
| R-04 | `reference_id` must be unique within each account; duplicates create no entry and change no balance; same reference allowed across accounts | 2         |
| R-05 | Retrieve account balance and handle missing accounts                                                                                        | 2         |
| R-06 | Retrieve history filtered by type, paginated with metadata, latest-first                                                                    | 2–3       |
| R-07 | Transactions are immutable through the API                                                                                                  | 3         |
| R-08 | Balance equals the net effect of valid ledger transactions; failed operations change nothing                                                | 3         |
| R-09 | Ledger insertion and balance update are atomic                                                                                              | 4         |
| R-10 | Validate requests and return appropriate, consistent HTTP errors                                                                            | 4         |
| R-11 | Optional atomic transfer between two accounts                                                                                               | 4–5       |
| R-12 | Maintainable code, database constraints, local run instructions, source/README/API docs/assumptions submission                              | 5         |

### 1.2 Established project choices and supplied UI proposals

U-01–U-11 describe established choices. U-12–U-16 describe the supplied v0.3 UI proposal; they await review and do not grant implementation approval.

| ID   | Decision                                                                              | Implication                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| U-01 | React + Vite + TypeScript frontend                                                    | Build a small user-facing ledger interface despite frontend not being requested by the PDF                                                         |
| U-02 | Express.js + Node.js + TypeScript backend                                             | Implement a versioned REST API in a separate backend workspace                                                                                     |
| U-03 | Supabase-provisioned PostgreSQL                                                       | Use Supabase to host ordinary PostgreSQL; core operations occur via SQL from Express                                                               |
| U-04 | Readable, customizable folder structure                                               | Use feature modules, isolated layers, centralized configuration, no unnecessary platform coupling                                                  |
| U-05 | Mandatory comments for all newly written/mounted modules and meaningful continuations | Enforce file headers, exported API documentation, router mount comments, and why-oriented business logic comments                                  |
| U-06 | Prettier config and formatting rules are mandatory                                    | Commit `.prettierrc.json` and `.prettierignore` at workspace root                                                                                  |
| U-07 | Documentation must be reviewed before code implementation                             | These six Markdown files constitute the proposed planning baseline, not finished application code                                                  |
| U-08 | UI theme uses black, white and neutral gray                                           | Central semantic design tokens; consistent landing and account styling                                                                             |
| U-09 | Desktop has horizontal navbar; tablet/mobile have collapsible sidebar                 | Responsive header with accessible off-canvas navigation                                                                                            |
| U-10 | Landing page includes header, footer, hero and working CTA sections                   | Implement structured landing content, not only the account forms                                                                                   |
| U-11 | Component-first UI development is mandatory                                           | Finish primitives, layouts and feature/section components before composing pages                                                                   |
| U-12 | Aceternity Background Cubes Grid is selected **for the hero only**                    | Preserve the attached implementation prompt, add the reusable component to React/Vite, and display it behind the landing hero, not dashboard pages |
| U-13 | Hero H1 uses a typewriter/text-generation reveal                                      | Exact text: `A clear view of` / `every transaction.`; one readable semantic H1, never a changing slogan                                            |
| U-14 | Footer has a simple neutral gradient                                                  | Only the footer uses one grayscale base blended by opacity; do not use a multi-hue gradient                                                        |
| U-15 | Skeleton and loader must be contextual; progress is optional                          | Skeleton for content placeholders, spinner for active requests, progress only where real percentage is available                                   |
| U-16 | Remaining animations and cards must be restrained and consistent                      | Reusable card primitive; subtle state/hover transitions; no decorative animation overload                                                          |

## 2. Architecture assumptions

| ID   | Assumption                                                                                                                                                  | Rationale                                                                           | Change impact                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| A-01 | Use a `pnpm` workspace monorepo (`apps/api`, `apps/web`, `packages/contracts`, `supabase`)                                                                  | One repository, shared contracts, uncomplicated local commands                      | Package scripts and folder structure                     |
| A-02 | Express is a long-lived Node server, not an edge/serverless function                                                                                        | Straightforward pooling and transaction semantics                                   | Database connection mode, deployment                     |
| A-03 | Use `pg` (node-postgres) with parameterized SQL instead of a heavyweight ORM                                                                                | Explicit transactions and constraints are easy to inspect and customize             | Repository implementation and migrations                 |
| A-04 | Use Supabase CLI timestamped SQL migrations under `supabase/migrations`                                                                                     | Versioned, repeatable schema on Supabase-hosted PostgreSQL                          | Deployment and local setup                               |
| A-05 | Prefer direct PostgreSQL connection where network supports it; otherwise Supabase session pooler                                                            | Compatible with persistent Express service                                          | `DATABASE_URL`, pool sizing                              |
| A-06 | The Express server is the sole HTTP gateway to the database                                                                                                 | Centralized validation, transaction policy, and secrets                             | UI access pattern                                        |
| A-07 | Authentication, multiple user permissions, payments, banking rails, and external transfers are not included                                                 | None are required by the assessment                                                 | Public deployment must be reconsidered                   |
| A-08 | Frontend is a polished public-facing demo/landing UI, not a production banking portal                                                                       | Deliver the requested UX without implying authentication or live financial services | Visual identity, landing content and security copy       |
| A-09 | API version prefix is `/api/v1`                                                                                                                             | Clear contracts and future extensibility                                            | API URLs                                                 |
| A-10 | Use `strict` TypeScript and shared Zod request/response contracts where practical                                                                           | Readability and fewer frontend/backend mismatches                                   | Workspace dependencies                                   |
| A-11 | Keep tables in a private `ledger` PostgreSQL schema, not Supabase Data API-exposed `public`                                                                 | Avoid accidental direct client access to ledger tables                              | Migration SQL and database permissions                   |
| A-12 | Introduce Tailwind CSS v4 in `apps/web` only for the source-compatible Aceternity component while retaining token-driven CSS Modules for the rest of the UI | The supplied implementation prompt requires Tailwind utilities as written           | Web build configuration, dependency list, CSS entrypoint |
| A-13 | Add Motion, Three.js, Lucide, `clsx` and `tailwind-merge` where required by the source                                                                      | Maintain named exports and dependency behavior of the supplied cube component       | Frontend package dependencies, typed `cn` helper         |
| A-14 | Ship a graceful static background fallback when WebGL or motion is unavailable                                                                              | Hero copy and CTAs must remain usable regardless of graphics support                | Hero backdrop boundary and browser tests                 |

## 3. Data and money assumptions

| ID   | Assumption                                                    | Contract                                                                                                            |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D-01 | Money represented in PostgreSQL as `NUMERIC(20,2)`            | Exact decimal database arithmetic, scale 2                                                                          |
| D-02 | HTTP money fields use **strings**                             | `"amount": "50.00"`, `"balance": "150.00"`; never JS floats for money                                               |
| D-03 | Currency is unspecified                                       | Treat all values as one abstract currency/unit; no currency conversions or symbols                                  |
| D-04 | Positive amounts have at most two decimal places              | Accept `"1"`, `"1.5"`, `"1.50"`; normalize output to `"1.00"`, `"1.50"`; reject `"1.234"`                           |
| D-05 | Account and transaction IDs are UUIDs generated by PostgreSQL | `gen_random_uuid()`                                                                                                 |
| D-06 | Creation timestamps are database-generated `TIMESTAMPTZ`      | Respond in UTC ISO 8601 format                                                                                      |
| D-07 | Account name is trimmed and required, max 120 characters      | Preserve original case; names need not be unique                                                                    |
| D-08 | `description` may be omitted in requests                      | Store `''` if absent, max 500 characters; record always contains the field                                          |
| D-09 | `reference_id` must be nonblank and max 128 characters        | Unique together with `account_id`; case-sensitive; do not auto-trim IDs in a way that creates accidental collisions |
| D-10 | Transaction type is lowercase `credit` or `debit` only        | Reject other casing/values unless contract changes                                                                  |
| D-11 | Account balances are denormalized for quick reads             | Must be updated atomically with immutable ledger insertion                                                          |
| D-12 | Deleting an account is not part of the API                    | Foreign key restricts deletion if transactions exist; no deletion routes                                            |
| D-13 | Transaction rows may not be updated/deleted through API       | Append-only HTTP surface; DB role/trigger hardening is an optional extension                                        |
| D-14 | Stable ordering breaks timestamp ties with transaction ID     | `ORDER BY created_at DESC, id DESC`                                                                                 |
| D-15 | Credit balance overflow is rejected                           | Return `422 BALANCE_LIMIT_EXCEEDED` if the resulting balance exceeds `999999999999999999.99`; persist no changes    |

**Implemented input refinement:** Monetary input uses canonical positive decimal strings without leading-zero integers, signs, exponent notation, or surrounding whitespace. Valid amounts normalize to two fractional digits with string operations. These existing backend choices remain in force.

**Precision caveat:** PostgreSQL `NUMERIC(20,2)` may coerce greater-scale direct SQL input. This project rejects amounts with more than two decimals **at the API validation layer** before insertion. The database also enforces positive amounts; direct manual SQL changes are out of application scope.

## 4. HTTP assumptions

| ID   | Assumption                              | Default                                                                                                                       |
| ---- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| H-01 | Account creation                        | `POST /api/v1/accounts`, `201 Created`                                                                                        |
| H-02 | Credit/debit creation                   | `POST /api/v1/accounts/:accountId/transactions`, `201 Created`                                                                |
| H-03 | Account balance                         | `GET /api/v1/accounts/:accountId/balance`, `200 OK`                                                                           |
| H-04 | History                                 | `GET /api/v1/accounts/:accountId/transactions`, `200 OK`                                                                      |
| H-05 | Pagination                              | `page=1`, `limit=20`, max `limit=100`, both positive integers                                                                 |
| H-06 | History beyond last page                | Return `200` with `data: []` and correct totals                                                                               |
| H-07 | No history filter                       | Return both types                                                                                                             |
| H-08 | Duplicate account/reference combination | Return `409 Conflict` with `DUPLICATE_TRANSACTION`; never create another entry                                                |
| H-09 | Insufficient balance                    | Return `422 Unprocessable Entity` with `INSUFFICIENT_BALANCE`                                                                 |
| H-10 | Invalid input                           | Return `400 Bad Request` with mapped instructions and support ID                                                              |
| H-11 | Account does not exist                  | Return `404 Not Found`                                                                                                        |
| H-12 | Unexpected server error                 | Return `500` with generic safe message; detailed server-side log only                                                         |
| H-13 | Unknown request body fields             | Reject in mutation routes rather than silently accepting `balance` or `created_at`                                            |
| H-14 | Response keys                           | Use `snake_case` to match the assessment                                                                                      |
| H-15 | Cross-origin traffic                    | Restrict backend CORS to configured web origin                                                                                |
| H-16 | History snapshot consistency            | Existence, count, and page reads share one read-only REPEATABLE READ transaction                                              |
| H-17 | Strict query integer syntax             | Page/limit use positive canonical decimal digits; reject repeated/unknown fields, unsafe integers, and unsafe derived offsets |

## 5. Frontend decisions and assumptions

### 5.1 Confirmed user-requested UI decisions

- Use a **black-and-white monochrome visual system** across landing and account pages. Neutral gray is allowed for readability, borders and hierarchy; no decorative accent colors are required.
- Provide a complete landing-page composition with **site header, desktop navbar, hero with functional CTA, relevant feature sections, a get-started/account-entry section, final CTA and proper footer**.
- On **desktop**, the navbar is visible within the header. On **tablet and mobile**, replace the desktop navbar with a **collapsible sidebar/drawer** controlled by a menu button.
- Follow **component-first delivery**: specify and build complete, reusable components first, then compose sections/layouts, then pages. Pages must not duplicate primitive styling/behavior.
- Keep all components and page variants responsive for desktop, tablet and mobile, including keyboard and touch interactions.

### 5.2 UI presentation proposal (reviewable; not yet approved)

| ID   | Assumption                                                                                                                                             | Rationale / change impact                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Default theme is a light, white-background/black-text appearance with neutral gray surfaces                                                            | Meets monochrome direction; dark/inverted theme is future work unless explicitly added                                       |
| F-02 | Mobile is below 640px, tablet 640-1023px, and desktop 1024px or above                                                                                  | Establishes a concrete nav switch; keep breakpoints centralized and test real content widths                                 |
| F-03 | The public landing page is `/`; account workspace is `/accounts/:accountId`; landing CTA sections use `#features`, `#how-it-works`, and `#get-started` | Works without adding backend endpoints or account-list features                                                              |
| F-04 | Preserve the account-aware primary CTA (Create an account or My account) and existing account-lookup focus/anchor behavior                             | Every CTA works without inventing a sign-up/auth feature                                                                     |
| F-05 | The collapsible sidebar is an off-canvas, modal-style drawer on tablet/mobile                                                                          | Supports focus management, Escape close, overlay and touch use                                                               |
| F-06 | Landing sections are Hero, Features, How It Works, Ledger Principles, Get Started, Final CTA                                                           | All sections explain implemented ledger behavior; no invented features/testimonials                                          |
| F-07 | Navigation/footer links point only to implemented routes or page anchors                                                                               | No placeholder contact/social/legal destinations                                                                             |
| F-08 | Use CSS custom properties in `styles/tokens.css`, CSS Modules for component styles where useful, and local React components                            | Allows theme and layout changes without a vendor UI library                                                                  |
| F-09 | History displays an accessible table on wide screens and a readable list/card representation on narrow screens                                         | Preserve all transaction details and pagination without horizontal overflow                                                  |
| F-10 | Responsive QA covers 320, 375, 768, 1024 and 1440 CSS pixel widths                                                                                     | Checks mobile to desktop and the navigation crossover                                                                        |
| F-11 | Use the supplied cube grid's **isometric** variant initially, with neutral gray/white props and no colorful vendor demo logos/copy                     | Isometric is the referenced component's default; preserves light-first aesthetic                                             |
| F-12 | Animate the H1 once, character-by-character at approximately 35-55 ms per character, with no repeating cycle                                           | Typewriter style is user-selected but exact timing is an adjustable implementation default                                   |
| F-13 | Preserve intended two-line hero wording using responsive typography, with the full phrase available to assistive technology immediately                | Avoid reading partial text aloud or creating cumulative layout shift                                                         |
| F-14 | Footer gradient is a vertical blend of one near-black neutral base (`#111111`) at roughly 88%-100% opacity over white                                  | A single base tone, no multiple color families, only in the footer                                                           |
| F-15 | Balance/history uses layout-matched pulsing skeleton placeholders; request mutations use compact spinner/loading button states                         | Loading indicators reflect the actual work without inventing values or arbitrary delays                                      |
| F-16 | Do not build/render `ProgressBar` until a real measurable task is specified                                                                            | No assessment-required long-running percent-complete task exists                                                             |
| F-17 | Card/CTA/sidebar motion is limited to short feedback transitions, and reduced-motion settings disable nonessential effects                             | Clean professional UI with performance and accessibility safeguards                                                          |
| F-18 | Preserve the full provided reference prompt verbatim under `references/`; do not publish its unrelated marketing demo content                          | Source instructions and product composition have different roles; user-selected copy/theme takes precedence in production UX |
| F-19 | Fallback for unsupported WebGL, context loss, and low-power devices is static monochrome styling without blocking hero content                         | Avoid blank or unusable landing pages on mobile/tablet                                                                       |

### 5.3 Delivered behavior that the enhancement must preserve

| ID   | Frozen behavior                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Accounts keep trimmed nonblank names (1–120 characters), duplicate display names, unique server IDs and zero initial balance.                                                                                 |
| C-02 | UI uses Account ID; UUID remains its technical format. Preserve known creation names or the honest Account/ID fallback. No new name lookup endpoint.                                                          |
| C-03 | Preserve tab-scoped selection, My account/Log out and account-aware landing entry. Logout clears selection only, retaining ledger data and unresolved financial intentions; no authentication is added.       |
| C-04 | Preserve atomic credit/debit and transfer behavior, ordered account locks, source/reference and ledger duplicate protection, balance/capacity guards and rollback.                                            |
| C-05 | Preserve canonical decimal-string money, exact database arithmetic, existing validation, 422 capacity rejection, and no optimistic monetary calculation.                                                      |
| C-06 | Preserve filtered latest-first history, safe pagination, repeatable-read snapshots, cancellation and page/filter refresh behavior.                                                                            |
| C-07 | Preserve review/confirm/receipt, exact payload/reference persistence, no automatic resend, unconfirmed outcomes and conflict acknowledgement. Later retry rejection does not settle an earlier unknown write. |
| C-08 | Preserve the four-field error envelope (support_ticket_id/code/message/action), mapped recovery, traced IDs, private redacted diagnostics and log/test-artifact HTTP restrictions.                            |
| C-09 | Preserve confirmed receipts and last-confirmed values on read refresh failure; keep the history panel and one Retry account action for combined failures.                                                     |
| C-10 | Read retry never sends money; skeletons/spinners reflect current flags and do not change financial state transitions, messages, recovery destinations or request timing.                                      |

### 5.4 Presentation boundaries

- Existing functionality is already delivered. New work, after approval, is limited to the hero backdrop/headline animation, footer appearance, reusable loading visuals, card/motion styling and the web-only integration they require.
- Skeletons represent missing content only: no fake balances, new fetching strategy, artificial minimum loading durations, percent progress or disabled controls beyond the current interaction policy.
- Default heading timing is about 45 ms/character (reviewable within 35–55 ms), once per hero mount with no cycling. Do not introduce persistent replay/session keys; reduced-motion/failure states show the full static heading immediately.
- Tailwind/Motion/Three and helper dependencies are proposed for apps/web only. Keep the existing Icon system; Lucide is required only if actually consumed by the approved integration, not solely to reproduce an excluded vendor demo.
- The source's dark/colorful marketing demo is reference-only. The live product remains light-first monochrome; no new theme toggle or unrelated vendor CTA is proposed.
- No progress bar or measurable-job implementation, authentication, payment rails, account list/edit/delete, microservices or public deployment is added.

## 6. Operations and environment assumptions

- Use Node.js current supported LTS line when implementing; record exact runtime and pinned dependency versions in `package.json`/lockfile, rather than freezing versions in planning docs.
- Local development uses `pnpm` workspace scripts, with separate backend and frontend `.env.example` files.
- Backend env: `DATABASE_URL`, `PORT`, `WEB_ORIGIN`, `NODE_ENV`; frontend public setting: `VITE_API_BASE_URL` (defaults to `http://localhost:3000/api/v1` for local development).
- Use a single backend PostgreSQL connection pool with conservative limits. Test `BEGIN`/`COMMIT` and `SELECT ... FOR UPDATE` via one acquired client per transaction.
- Prefer direct/session PostgreSQL connectivity for persistent Express. If deployed as serverless later, reassess transaction pooler limitations and prepared statements.
- Secrets reside in environment variables; no real connection strings or Supabase service keys committed or exposed to the frontend.
- Run integration tests on a local or dedicated test database/Supabase project, not the live hosted application database.
- The published frontend and backend deployment platform is **undecided**; README must explain local execution regardless.

## 7. Approved transfer backend decisions

- A transfer is a single atomic operation between two _different_ existing accounts.
- Require positive amount and sufficient source funds; reject self-transfers.
- Acquire row locks for both accounts in deterministic UUID order to avoid deadlock.
- Write one source debit and one destination credit plus both balance changes in a single PostgreSQL transaction.
- To guarantee request idempotency and traceability, the new additive migration introduces a `transfers` table and nullable `transfer_id` fields on ledger entries, described in `schema.md`.
- The user’s latest clarification explicitly authorizes only the component-first transfer UI using the existing endpoint. Gateway/tokenization/authentication additions are outside this narrowed request; ignore microservice work until explicitly requested.
- Shared transfer contracts normalize UUID case before distinct-account validation, and reuse the existing amount/reference/description validators.
- Transfer references are unique per source account and conflicts return `409 DUPLICATE_TRANSFER`, including changed payloads and exhausted-source retries; successful responses are not replayed.
- Both legs preserve the caller reference. An existing reference on either account rejects the entire transfer with `409 DUPLICATE_TRANSACTION`. The same reference is reusable for disjoint account pairs.
- Both accounts are locked using PostgreSQL UUID ordering before duplicate/funds checks. Destination capacity is guarded just like standalone credits. Every failure rolls back the transfer identity, both balances and both legs.
- The creation response returns transfer metadata, linked debit/credit entries and both committed balances. Existing history/standalone DTOs remain unchanged; history projects the normal leg fields without `transfer_id`.
- After explicit user authorization, the migration was applied to the configured Supabase project and verified using read-only schema/history/permission checks. Existing account and transaction payload fingerprints are unchanged; no hosted financial test writes were made.

## 8. Inherited scope decisions and visual defaults for review

These questions are intentionally not disguised as assessment requirements:

| Question                                                                             | Current proposed choice                                                                                                | Importance |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------- |
| Should the frontend ship within the assessment's 3–4 hour window?                    | Existing backend and frontend are complete; only UI enhancement review is pending                                      | High       |
| Is the API intended for trusted local demonstration or public internet access?       | Trusted demo; authentication not included                                                                              | High       |
| Should money support multiple currencies?                                            | No; one abstract unit                                                                                                  | Medium     |
| Should a user-supplied description be required?                                      | Optional, stored as empty string when absent                                                                           | Low        |
| Should account listing be mandatory for the UI?                                      | No; UUID lookup is sufficient for the MVP                                                                              | Medium     |
| Transfer scope in this revision                                                      | Already implemented and retained unchanged                                                                             | Resolved   |
| Does deployment require Docker, CI/CD, or a particular host?                         | Not specified; local-first                                                                                             | Low        |
| If visual review favors perspective cubes over isometric, should the variant change? | Default to grayscale isometric; perspective remains available as a reusable exported variant but is not used initially | Low        |
| Should the typewriter speed be customized after UX testing?                          | Start at 35-55 ms/character; allow tokenized adjustment, preserving the exact copy                                     | Low        |

## 9. Change control

When an assumption is confirmed or changed:

1. Update this file and state whether it is an **assessment requirement**, **user decision**, or **assumption**.
2. Update the dependent API, database, module ownership, and milestone sections in `design.md`, `schema.md`, `structure.md`, and `plan.md`.
3. Add or change corresponding tests and examples before treating the implementation as finished.
4. Document any backward-incompatible API/schema change and provide a migration plan.

References: Assessment PDF pages 1-5; Supabase connectivity https://supabase.com/docs/guides/database/connecting-to-postgres; Supabase SQL migrations https://supabase.com/docs/guides/local-development/database-migrations; Aceternity component https://ui.aceternity.com/components/background-cubes-grid; full original user prompt `references/background-cubes-grid-original-prompt.txt` (included unchanged in this documentation pack).

The four-field error contract and current operational limits are documented in ../../../docs/api-reference.md and ../../../docs/error-handling.md. A visual plan does not reopen these decisions or permit schema/contract changes.

## User refinement — desktop hover only (2026-10-28)

The latest direct instruction overrides broader reference/default animation behavior: use the supplied isometric shader/geometry/physics at normal visibility, only while a mouse hovers within the hero on desktop (minimum 1024px and hover/fine-pointer capability). Set `idleRipples=false`; never auto-play. Unmount/dispose on pointer leave/cancel, window blur, breakpoint change or graphics failure. Touch/pen, mobile/tablet, reduced motion and unsupported/limited devices use a clean static neutral background. Do not substitute an illustrated repeating cube tile or fade the reference effect behind an opaque copy panel. Existing ledger copy, preview and functional CTAs remain.
