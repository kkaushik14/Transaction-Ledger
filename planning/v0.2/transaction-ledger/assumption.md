# Project Assumptions, Decisions, and Open Questions

> Project: Transaction Ledger | Version: 0.2 | Status: UI decisions approved and implemented; optional work remains deferred
>
> The five-page **Full Stack Developer Assessment** is the functional source. User-specified stack and engineering conventions are binding project choices. Items labeled **Assumption** below fill gaps in the assessment and should be reviewed before implementation.

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

### 1.2 Confirmed user decisions

| ID   | Decision                                                                              | Implication                                                                                                       |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| U-01 | React + Vite + TypeScript frontend                                                    | Build a small user-facing ledger interface despite frontend not being requested by the PDF                        |
| U-02 | Express.js + Node.js + TypeScript backend                                             | Implement a versioned REST API in a separate backend workspace                                                    |
| U-03 | Supabase-provisioned PostgreSQL                                                       | Use Supabase to host ordinary PostgreSQL; core operations occur via SQL from Express                              |
| U-04 | Readable, customizable folder structure                                               | Use feature modules, isolated layers, centralized configuration, no unnecessary platform coupling                 |
| U-05 | Mandatory comments for all newly written/mounted modules and meaningful continuations | Enforce file headers, exported API documentation, router mount comments, and why-oriented business logic comments |
| U-06 | Prettier config and formatting rules are mandatory                                    | Commit `.prettierrc.json` and `.prettierignore` at workspace root                                                 |
| U-07 | Documentation must be reviewed before code implementation                             | These six Markdown files constitute the proposed planning baseline, not finished application code                 |
| U-08 | UI theme uses black, white and neutral gray                                           | Central semantic design tokens; consistent landing and account styling                                            |
| U-09 | Desktop has horizontal navbar; tablet/mobile have collapsible sidebar                 | Responsive header with accessible off-canvas navigation                                                           |
| U-10 | Landing page includes header, footer, hero and working CTA sections                   | Implement structured landing content, not only the account forms                                                  |
| U-11 | Component-first UI development is mandatory                                           | Finish primitives, layouts and feature/section components before composing pages                                  |
| U-12 | Review v0.2 UI planning before implementation                                         | Summarize the UI plan and wait for the user's explicit go-ahead before changing frontend code                     |
| U-13 | Transfers are excluded from the current request                                       | Do not add transfer routes, migrations, controls, or navigation                                                   |

## 2. Architecture assumptions

| ID   | Assumption                                                                                                  | Rationale                                                                           | Change impact                                      |
| ---- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| A-01 | Use a `pnpm` workspace monorepo (`apps/api`, `apps/web`, `packages/contracts`, `supabase`)                  | One repository, shared contracts, uncomplicated local commands                      | Package scripts and folder structure               |
| A-02 | Express is a long-lived Node server, not an edge/serverless function                                        | Straightforward pooling and transaction semantics                                   | Database connection mode, deployment               |
| A-03 | Use `pg` (node-postgres) with parameterized SQL instead of a heavyweight ORM                                | Explicit transactions and constraints are easy to inspect and customize             | Repository implementation and migrations           |
| A-04 | Use Supabase CLI timestamped SQL migrations under `supabase/migrations`                                     | Versioned, repeatable schema on Supabase-hosted PostgreSQL                          | Deployment and local setup                         |
| A-05 | Prefer direct PostgreSQL connection where network supports it; otherwise Supabase session pooler            | Compatible with persistent Express service                                          | `DATABASE_URL`, pool sizing                        |
| A-06 | The Express server is the sole HTTP gateway to the database                                                 | Centralized validation, transaction policy, and secrets                             | UI access pattern                                  |
| A-07 | Authentication, multiple user permissions, payments, banking rails, and external transfers are not included | None are required by the assessment                                                 | Public deployment must be reconsidered             |
| A-08 | Frontend is a polished public-facing demo/landing UI, not a production banking portal                       | Deliver the requested UX without implying authentication or live financial services | Visual identity, landing content and security copy |
| A-09 | API version prefix is `/api/v1`                                                                             | Clear contracts and future extensibility                                            | API URLs                                           |
| A-10 | Use `strict` TypeScript and shared Zod request/response contracts where practical                           | Readability and fewer frontend/backend mismatches                                   | Workspace dependencies                             |
| A-11 | Keep tables in a private `ledger` PostgreSQL schema, not Supabase Data API-exposed `public`                 | Avoid accidental direct client access to ledger tables                              | Migration SQL and database permissions             |

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
| H-10 | Invalid input                           | Return `400 Bad Request` with validation details                                                                              |
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

### 5.2 Approved UI implementation decisions

The user approved the v0.2 UI plan, component-first order, breakpoints and Account/UUID fallback before implementation. F-01–F-12 describe the delivered frontend.

| ID   | Assumption                                                                                                                                             | Rationale / change impact                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Default theme is a light, white-background/black-text appearance with neutral gray surfaces                                                            | Meets monochrome direction; dark/inverted theme is future work unless explicitly added                                                    |
| F-02 | Mobile is below 640px, tablet 640-1023px, and desktop 1024px or above                                                                                  | Establishes a concrete nav switch; keep breakpoints centralized and test real content widths                                              |
| F-03 | The public landing page is `/`; account workspace is `/accounts/:accountId`; landing CTA sections use `#features`, `#how-it-works`, and `#get-started` | Works without adding backend endpoints or account-list features                                                                           |
| F-04 | Hero primary CTA points to `#get-started` account creation; secondary CTA points to account lookup within the same section                             | Every CTA works without inventing a sign-up/auth feature                                                                                  |
| F-05 | The collapsible sidebar is an off-canvas, modal-style drawer on tablet/mobile                                                                          | Supports focus management, Escape close, overlay and touch use                                                                            |
| F-06 | Landing sections are Hero, Features, How It Works, Ledger Principles, Get Started, Final CTA                                                           | All sections explain implemented ledger behavior; no invented features/testimonials                                                       |
| F-07 | Navigation/footer links point only to implemented routes or page anchors                                                                               | No placeholder contact/social/legal destinations                                                                                          |
| F-08 | Use CSS custom properties in `styles/tokens.css`, CSS Modules for component styles where useful, and local React components                            | Allows theme and layout changes without a vendor UI library                                                                               |
| F-09 | History displays an accessible table on wide screens and a readable list/card representation on narrow screens                                         | Preserve all transaction details and pagination without horizontal overflow                                                               |
| F-10 | Responsive QA covers 320, 375, 768, 1024 and 1440 CSS pixel widths                                                                                     | Checks mobile to desktop and the navigation crossover                                                                                     |
| F-11 | For UUID lookup/direct navigation, show an honest account label and UUID if the name is unavailable; display the name when returned by creation        | Explicitly approved by the user and implemented: the existing balance endpoint returns ID/balance only; no new backend endpoint is needed |
| F-12 | Reset history to page 1 when the type filter changes; ignore or cancel stale requests when account/filter/page changes                                 | Keeps the selected account, filter, rows, and pagination in sync                                                                          |

### 5.3 Functional UX and scope boundaries

- The React app supports account creation, lookup by UUID, balance, credit/debit input, filtered latest-first transaction history, and pagination.
- The browser generates a new `reference_id` for each new transaction intent and preserves it for retries of the **same** intent; the server enforces uniqueness.
- An unresolved write retains its exact payload/reference in session storage before sending and across reload. Retry is explicit; a duplicate refreshes authoritative reads without assuming the earlier payload matched. Accepted writes and duplicates require an explicit new-intent action before another movement.
- Leaving account entry while a creation request is pending does not navigate the user back when it completes. Account creation is not idempotent; an uncertain response warns that retrying may create another account.
- Show loading, invalid-input, empty-history, success, duplicate, insufficient-funds, and unexpected-error states with text/icons, not color alone.
- Client-side form validation helps UX but never replaces API validation. Refresh balance and history after writes; do not infer authoritative money state in React.
- No authentication, account list, admin console, charts, third-party payment processing, or transfer UI in the initial scope. The landing page must not imply that those capabilities exist.
- Public hosting without authentication is **not** approved by this design. The initial implementation is a controlled demonstration until access control is decided.

## 6. Operations and environment assumptions

- Use Node.js current supported LTS line when implementing; record exact runtime and pinned dependency versions in `package.json`/lockfile, rather than freezing versions in planning docs.
- Local development uses `pnpm` workspace scripts, with separate backend and frontend `.env.example` files.
- Backend env: `DATABASE_URL`, `PORT`, `WEB_ORIGIN`, `NODE_ENV`; frontend public setting: `VITE_API_BASE_URL` (defaults to `http://localhost:3000/api/v1` for local development).
- Use a single backend PostgreSQL connection pool with conservative limits. Test `BEGIN`/`COMMIT` and `SELECT ... FOR UPDATE` via one acquired client per transaction.
- Prefer direct/session PostgreSQL connectivity for persistent Express. If deployed as serverless later, reassess transaction pooler limitations and prepared statements.
- Secrets reside in environment variables; no real connection strings or Supabase service keys committed or exposed to the frontend.
- Run integration tests on a local or dedicated test database/Supabase project, not the live hosted application database.
- The published frontend and backend deployment platform is **undecided**; README must explain local execution regardless.

## 7. Bonus transfer assumptions (defer until base product passes)

- A transfer is a single atomic operation between two _different_ existing accounts.
- Require positive amount and sufficient source funds; reject self-transfers.
- Acquire row locks for both accounts in deterministic UUID order to avoid deadlock.
- Write one source debit and one destination credit plus both balance changes in a single PostgreSQL transaction.
- To guarantee request idempotency and traceability, a later migration may introduce a `transfers` table and `transfer_id` fields on ledger entries, described in `schema.md`.
- No transfer UI is required until the optional API is functional and tested.

## 8. Open decisions requiring review

These questions are intentionally not disguised as assessment requirements:

| Question                                                                       | Current proposed choice                                                     | Importance |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------- |
| Should the frontend ship within the assessment's 3–4 hour window?              | Protect backend-first completion; add minimal frontend after mandatory APIs | High       |
| Is the API intended for trusted local demonstration or public internet access? | Trusted demo; authentication not included                                   | High       |
| Should money support multiple currencies?                                      | No; one abstract unit                                                       | Medium     |
| Should a user-supplied description be required?                                | Optional, stored as empty string when absent                                | Low        |
| Should account listing be mandatory for the UI?                                | No; UUID lookup is sufficient for the MVP                                   | Medium     |
| Is the bonus transfer in scope for this version?                               | Explicitly excluded by the user; separate authorization required            | Medium     |
| Does deployment require Docker, CI/CD, or a particular host?                   | Not specified; local-first                                                  | Low        |

## 9. Change control

When an assumption is confirmed or changed:

1. Update this file and state whether it is an **assessment requirement**, **user decision**, or **assumption**.
2. Update the dependent API, database, module ownership, and milestone sections in `design.md`, `schema.md`, `structure.md`, and `plan.md`.
3. Add or change corresponding tests and examples before treating the implementation as finished.
4. Document any backward-incompatible API/schema change and provide a migration plan.

References: Assessment PDF pages 1–5; Supabase connectivity https://supabase.com/docs/guides/database/connecting-to-postgres; Supabase SQL migrations https://supabase.com/docs/guides/local-development/database-migrations.
