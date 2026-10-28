# Project Assumptions, Decisions, and Open Questions

> Project: Transaction Ledger | Version: 0.2 | Status: Transfer API and UI implemented; microservice work excluded
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
| U-13 | Transfer API, UI and integrity tests are now explicitly authorized                    | API/migration are delivered; implement the component-first UI using existing endpoints, without microservices     |

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
| H-10 | Invalid input                           | Return `400 Bad Request` with mapped instructions and support ID                                                                              |
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

The user approved the v0.2 UI plan, component-first order, breakpoints and Account/UUID fallback before implementation. F-01–F-13 describe the delivered frontend.

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

### 5.3 Account selection clarification (user decision, 2026-10-28)

- Retain D-07: duplicate account names are allowed. Names are display labels; account UUIDs are the unique identity.
- F-13: After successful creation or a verified account read, remember the selected Account ID and optional known creation name in tab session storage. Show **Log out** in the header/drawer, and **My account** instead of creation CTAs on the landing page. Offer creation again after logging out; existing accounts remain openable by ID.
- “Log out” clears only the selected browser workspace and returns home. It does not delete ledger data, revoke Account ID access, cancel a request already sent, or add authentication. Preserve unresolved financial commands/references so reopening the same account can retry safely. No authentication endpoint or schema change is introduced.
- Use **Account ID** in user-facing text. Its underlying format remains a UUID; keep UUID terminology in technical specifications and validation rules. Unknown account names retain the approved “Account” fallback.
- A definitive account-not-found read removes stale balance and mutation controls and clears that selected identity. Network/read failures retain the last confirmed balance with an explicit stale label.
- Credit/debit and transfers must persist retry details before sending. A local configuration failure during a previously uncertain retry cannot discard the original reference. Successful receipts must match their requested account and command; history must match its account, filter and pagination.

### 5.4 Functional UX and scope boundaries

- The React app supports account creation, lookup by UUID, balance, credit/debit input, filtered latest-first transaction history, and pagination.
- The browser generates a new `reference_id` for each new transaction intent and preserves it for retries of the **same** intent; the server enforces uniqueness.
- An unresolved write retains its exact payload/reference in session storage before sending and across reload. Retry is explicit; a duplicate refreshes authoritative reads without assuming the earlier payload matched. Accepted writes and duplicates require an explicit new-intent action before another movement.
- Leaving account entry while a creation request is pending does not navigate the user back when it completes. Account creation is not idempotent; an uncertain response warns that retrying may create another account.
- Show loading, invalid-input, empty-history, success, duplicate, insufficient-funds, and unexpected-error states with text/icons, not color alone.
- Client-side form validation helps UX but never replaces API validation. Refresh balance and history after writes; do not infer authoritative money state in React.
- No authentication, account list, admin console, charts, third-party payment processing, in the initial scope; transfer UI was separately authorized and implemented. The landing page must not imply that those capabilities exist.
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

## 8. Open decisions requiring review

These questions are intentionally not disguised as assessment requirements:

| Question                                                                       | Current proposed choice                                                     | Importance |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------- |
| Should the frontend ship within the assessment's 3–4 hour window?              | Protect backend-first completion; add minimal frontend after mandatory APIs | High       |
| Is the API intended for trusted local demonstration or public internet access? | Trusted demo; authentication not included                                   | High       |
| Should money support multiple currencies?                                      | No; one abstract unit                                                       | Medium     |
| Should a user-supplied description be required?                                | Optional, stored as empty string when absent                                | Low        |
| Should account listing be mandatory for the UI?                                | No; UUID lookup is sufficient for the MVP                                   | Medium     |
| Is the bonus transfer in scope for this version?                               | Transfer backend and component-first UI authorized and implemented          | Medium     |
| Does deployment require Docker, CI/CD, or a particular host?                   | Not specified; local-first                                                  | Low        |

## 9. Change control

Confirmed follow-up decision: use typed `index.ts` folder entries (emitted as `index.js` for Node-targeted builds), explicit public exports and cross-folder entry imports. Keep existing cohesive responsibilities, avoid self-barrel cycles and unnecessary segmentation, and leave microservice extraction for a separately authorized future implementation. No API or database behavior changes are needed.

When an assumption is confirmed or changed:

1. Update this file and state whether it is an **assessment requirement**, **user decision**, or **assumption**.
2. Update the dependent API, database, module ownership, and milestone sections in `design.md`, `schema.md`, `structure.md`, and `plan.md`.
3. Add or change corresponding tests and examples before treating the implementation as finished.
4. Document any backward-incompatible API/schema change and provide a migration plan.

References: Assessment PDF pages 1–5; Supabase connectivity https://supabase.com/docs/guides/database/connecting-to-postgres; Supabase SQL migrations https://supabase.com/docs/guides/local-development/database-migrations.

Transfer UI follow-up: fixed source UUID, destination UUID validation including self-transfer case variants, exact positive amount, optional description, review before confirmation and a receipt only for a correlated committed response. Preserve the exact command/reference before HTTP and across reload; block sending if session persistence fails. Both duplicate codes are conflicts, not successful replays. Keep conflict commands until explicit user acknowledgement before a new intent. Read refreshes are separate from writes; retain a confirmed receipt when reads fail and label retained balances as stale. Source history resets to page 1 while keeping its filter; recipient navigation fetches current data. No backend changes or new migrations are needed.


## Centralized error handling decision (user request, 2026-10-28)

The public failure contract now contains only support_ticket_id, code, mapped message and action. This supersedes the earlier details envelope; API and frontend must be updated together. Support IDs are diagnostic correlation IDs, not automatically opened external support tickets. Server logs preserve redacted originals/causes; browser failures retain private bounded causal records and expose metadata only in console output. No remote ticketing/telemetry service is assumed.

Known errors resolve specific actionable messages; unknown errors resolve safe generic copy. Local validation uses the same error view, with invalid controls associated to one notice and a Review details focus action. Unconfirmed account creation cannot be blindly retried. Financial writes preserve exact retry payload/reference, known duplicates remain conflicts, and read-retry actions never send money. Concurrent balance/history read failures coalesce into one recovery notice, while committed receipts remain visible. Unexpected React/browser/bootstrap/process failures have centralized recovery/logging. This changes no account naming, money, transfer or database semantics and introduces no microservices.

Error review clarification: support IDs identify the failure’s originating diagnostic source; local/browser-only failures are not uploaded to API logs. Every displayed ID, including restored intentions, is logged. Browser metadata links coalesced read failures; a single Retry account action refreshes balance and history without hiding the history panel. API and browser diagnostics are bounded/process-local when their output sink fails, not durable ticket storage. Read docs/error-handling.md for capture/lookup limits. No public contract, migration or financial rule changes are needed.
