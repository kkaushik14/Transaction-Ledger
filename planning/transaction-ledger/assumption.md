# Project Assumptions, Decisions, and Open Questions

> Project: Transaction Ledger | Version: 0.1 (review draft) | Status: Proposed decisions
>
> The five-page **Full Stack Developer Assessment** is the functional source. User-specified stack and engineering conventions are binding project choices. Items labeled **Assumption** below fill gaps in the assessment and should be reviewed before implementation.

## 1. Requirement classification

- **Assessment requirement:** explicitly required by the PDF; must be implemented.
- **User decision:** explicitly requested for this project, even if absent from the PDF.
- **Assumption:** proposed implementation choice for an unspecified detail; changeable after review.
- **Optional enhancement:** not necessary for the mandatory assessment; implement only after baseline completion.

### 1.1 Confirmed assessment requirements

| ID | Requirement | PDF pages |
| --- | --- | --- |
| R-01 | Create accounts with unique IDs, required name, zero initial balance, system timestamp; client cannot set balance | 1 |
| R-02 | Create credit/debit transactions with unique IDs, account, type, amount, description, per-account reference ID, timestamp | 1–2 |
| R-03 | Credits increase balance; debits decrease balance; insufficient debits are rejected | 1–2 |
| R-04 | `reference_id` must be unique within each account; duplicates create no entry and change no balance; same reference allowed across accounts | 2 |
| R-05 | Retrieve account balance and handle missing accounts | 2 |
| R-06 | Retrieve history filtered by type, paginated with metadata, latest-first | 2–3 |
| R-07 | Transactions are immutable through the API | 3 |
| R-08 | Balance equals the net effect of valid ledger transactions; failed operations change nothing | 3 |
| R-09 | Ledger insertion and balance update are atomic | 4 |
| R-10 | Validate requests and return appropriate, consistent HTTP errors | 4 |
| R-11 | Optional atomic transfer between two accounts | 4–5 |
| R-12 | Maintainable code, database constraints, local run instructions, source/README/API docs/assumptions submission | 5 |

### 1.2 Confirmed user decisions

| ID | Decision | Implication |
| --- | --- | --- |
| U-01 | React + Vite + TypeScript frontend | Build a small user-facing ledger interface despite frontend not being requested by the PDF |
| U-02 | Express.js + Node.js + TypeScript backend | Implement a versioned REST API in a separate backend workspace |
| U-03 | Supabase-provisioned PostgreSQL | Use Supabase to host ordinary PostgreSQL; core operations occur via SQL from Express |
| U-04 | Readable, customizable folder structure | Use feature modules, isolated layers, centralized configuration, no unnecessary platform coupling |
| U-05 | Mandatory comments for all newly written/mounted modules and meaningful continuations | Enforce file headers, exported API documentation, router mount comments, and why-oriented business logic comments |
| U-06 | Prettier config and formatting rules are mandatory | Commit `.prettierrc.json` and `.prettierignore` at workspace root |
| U-07 | Documentation must be reviewed before code implementation | These six Markdown files constitute the proposed planning baseline, not finished application code |

## 2. Architecture assumptions

| ID | Assumption | Rationale | Change impact |
| --- | --- | --- | --- |
| A-01 | Use a `pnpm` workspace monorepo (`apps/api`, `apps/web`, `packages/contracts`, `supabase`) | One repository, shared contracts, uncomplicated local commands | Package scripts and folder structure |
| A-02 | Express is a long-lived Node server, not an edge/serverless function | Straightforward pooling and transaction semantics | Database connection mode, deployment |
| A-03 | Use `pg` (node-postgres) with parameterized SQL instead of a heavyweight ORM | Explicit transactions and constraints are easy to inspect and customize | Repository implementation and migrations |
| A-04 | Use Supabase CLI timestamped SQL migrations under `supabase/migrations` | Versioned, repeatable schema on Supabase-hosted PostgreSQL | Deployment and local setup |
| A-05 | Prefer direct PostgreSQL connection where network supports it; otherwise Supabase session pooler | Compatible with persistent Express service | `DATABASE_URL`, pool sizing |
| A-06 | The Express server is the sole HTTP gateway to the database | Centralized validation, transaction policy, and secrets | UI access pattern |
| A-07 | Authentication, multiple user permissions, payments, banking rails, and external transfers are not included | None are required by the assessment | Public deployment must be reconsidered |
| A-08 | Frontend is a functional demo UI, not a production banking portal | Protect the mandatory backend scope | Visual polish and feature breadth |
| A-09 | API version prefix is `/api/v1` | Clear contracts and future extensibility | API URLs |
| A-10 | Use `strict` TypeScript and shared Zod request/response contracts where practical | Readability and fewer frontend/backend mismatches | Workspace dependencies |
| A-11 | Keep tables in a private `ledger` PostgreSQL schema, not Supabase Data API-exposed `public` | Avoid accidental direct client access to ledger tables | Migration SQL and database permissions |

## 3. Data and money assumptions

| ID | Assumption | Contract |
| --- | --- | --- |
| D-01 | Money represented in PostgreSQL as `NUMERIC(20,2)` | Exact decimal database arithmetic, scale 2 |
| D-02 | HTTP money fields use **strings** | `"amount": "50.00"`, `"balance": "150.00"`; never JS floats for money |
| D-03 | Currency is unspecified | Treat all values as one abstract currency/unit; no currency conversions or symbols |
| D-04 | Positive amounts have at most two decimal places | Accept `"1"`, `"1.5"`, `"1.50"`; normalize output to `"1.00"`, `"1.50"`; reject `"1.234"` |
| D-05 | Account and transaction IDs are UUIDs generated by PostgreSQL | `gen_random_uuid()` |
| D-06 | Creation timestamps are database-generated `TIMESTAMPTZ` | Respond in UTC ISO 8601 format |
| D-07 | Account name is trimmed and required, max 120 characters | Preserve original case; names need not be unique |
| D-08 | `description` may be omitted in requests | Store `''` if absent, max 500 characters; record always contains the field |
| D-09 | `reference_id` must be nonblank and max 128 characters | Unique together with `account_id`; case-sensitive; do not auto-trim IDs in a way that creates accidental collisions |
| D-10 | Transaction type is lowercase `credit` or `debit` only | Reject other casing/values unless contract changes |
| D-11 | Account balances are denormalized for quick reads | Must be updated atomically with immutable ledger insertion |
| D-12 | Deleting an account is not part of the API | Foreign key restricts deletion if transactions exist; no deletion routes |
| D-13 | Transaction rows may not be updated/deleted through API | Append-only HTTP surface; DB role/trigger hardening is an optional extension |
| D-14 | Stable ordering breaks timestamp ties with transaction ID | `ORDER BY created_at DESC, id DESC` |
| D-15 | Credit balance overflow is rejected | Return `422 BALANCE_LIMIT_EXCEEDED` if the resulting balance exceeds `999999999999999999.99`; persist no changes |

**Credit/debit input decision:** Accept canonical decimal strings without leading-zero integers, signs, exponent notation, or surrounding whitespace. Normalize valid amounts to two fractional digits with string operations. These are project validation choices.

**Precision caveat:** PostgreSQL `NUMERIC(20,2)` may coerce greater-scale direct SQL input. This project rejects amounts with more than two decimals **at the API validation layer** before insertion. The database also enforces positive amounts; direct manual SQL changes are out of application scope.

## 4. HTTP assumptions

| ID | Assumption | Default |
| --- | --- | --- |
| H-01 | Account creation | `POST /api/v1/accounts`, `201 Created` |
| H-02 | Credit/debit creation | `POST /api/v1/accounts/:accountId/transactions`, `201 Created` |
| H-03 | Account balance | `GET /api/v1/accounts/:accountId/balance`, `200 OK` |
| H-04 | History | `GET /api/v1/accounts/:accountId/transactions`, `200 OK` |
| H-05 | Pagination | `page=1`, `limit=20`, max `limit=100`, both positive integers |
| H-06 | History beyond last page | Return `200` with `data: []` and correct totals |
| H-07 | No history filter | Return both types |
| H-08 | Duplicate account/reference combination | Return `409 Conflict` with `DUPLICATE_TRANSACTION`; never create another entry |
| H-09 | Insufficient balance | Return `422 Unprocessable Entity` with `INSUFFICIENT_BALANCE` |
| H-10 | Invalid input | Return `400 Bad Request` with validation details |
| H-11 | Account does not exist | Return `404 Not Found` |
| H-12 | Unexpected server error | Return `500` with generic safe message; detailed server-side log only |
| H-13 | Unknown request body fields | Reject in mutation routes rather than silently accepting `balance` or `created_at` |
| H-14 | Response keys | Use `snake_case` to match the assessment |
| H-15 | Cross-origin traffic | Restrict backend CORS to configured web origin |
| H-16 | History snapshot consistency | Existence, count, and page reads share one read-only REPEATABLE READ transaction |
| H-17 | Strict query integer syntax | Page/limit use positive canonical decimal digits; reject repeated/unknown fields, unsafe integers, and unsafe derived offsets |

## 5. Frontend assumptions

- **Required by project choice, not assessment:** display account creation, lookup by account UUID, balance, credit/debit form, and transaction history with type filter and pagination.
- The basic UI can load a newly created account or an account UUID entered by the user; a full accounts-list API is **not required** for the minimal UI.
- A future `GET /api/v1/accounts` endpoint may be added as an optional UI enhancement with its own pagination/contract.
- Use browser-generated UUID for each newly initiated transaction's `reference_id`. Preserve the same ID when retrying the *same* intent; generate a new one for an intentional new transaction. The server uniqueness rule remains authoritative.
- Show loading, invalid-input, empty-history, success, conflict, and insufficient-funds states.
- No authentication screens, administrative console, analytics, or dashboard charts in the initial scope.
- CSS is locally maintained and token-driven; no mandatory UI component framework.

## 6. Operations and environment assumptions

- Use Node.js current supported LTS line when implementing; record exact runtime and pinned dependency versions in `package.json`/lockfile, rather than freezing versions in planning docs.
- Local development uses `pnpm` workspace scripts, with separate backend and frontend `.env.example` files.
- Backend required env: `DATABASE_URL`, `PORT`, `WEB_ORIGIN`, `NODE_ENV`; frontend required env: `VITE_API_BASE_URL`.
- Use a single backend PostgreSQL connection pool with conservative limits. Test `BEGIN`/`COMMIT` and `SELECT ... FOR UPDATE` via one acquired client per transaction.
- Prefer direct/session PostgreSQL connectivity for persistent Express. If deployed as serverless later, reassess transaction pooler limitations and prepared statements.
- Secrets reside in environment variables; no real connection strings or Supabase service keys committed or exposed to the frontend.
- Run integration tests on a local or dedicated test database/Supabase project, not the live hosted application database.
- The published frontend and backend deployment platform is **undecided**; README must explain local execution regardless.

## 7. Bonus transfer assumptions (defer until base product passes)

- A transfer is a single atomic operation between two *different* existing accounts.
- Require positive amount and sufficient source funds; reject self-transfers.
- Acquire row locks for both accounts in deterministic UUID order to avoid deadlock.
- Write one source debit and one destination credit plus both balance changes in a single PostgreSQL transaction.
- To guarantee request idempotency and traceability, a later migration may introduce a `transfers` table and `transfer_id` fields on ledger entries, described in `schema.md`.
- No transfer UI is required until the optional API is functional and tested.

## 8. Open decisions requiring review

These questions are intentionally not disguised as assessment requirements:

| Question | Current proposed choice | Importance |
| --- | --- | --- |
| Should the frontend ship within the assessment's 3–4 hour window? | Protect backend-first completion; add minimal frontend after mandatory APIs | High |
| Is the API intended for trusted local demonstration or public internet access? | Trusted demo; authentication not included | High |
| Should money support multiple currencies? | No; one abstract unit | Medium |
| Should a user-supplied description be required? | Optional, stored as empty string when absent | Low |
| Should account listing be mandatory for the UI? | No; UUID lookup is sufficient for the MVP | Medium |
| Is the bonus transfer in scope for this version? | After mandatory functions, tests, and docs | Medium |
| Does deployment require Docker, CI/CD, or a particular host? | Not specified; local-first | Low |

## 9. Change control

When an assumption is confirmed or changed:

1. Update this file and state whether it is an **assessment requirement**, **user decision**, or **assumption**.
2. Update the dependent API, database, module ownership, and milestone sections in `design.md`, `schema.md`, `structure.md`, and `plan.md`.
3. Add or change corresponding tests and examples before treating the implementation as finished.
4. Document any backward-incompatible API/schema change and provide a migration plan.

References: Assessment PDF pages 1–5; Supabase connectivity https://supabase.com/docs/guides/database/connecting-to-postgres; Supabase SQL migrations https://supabase.com/docs/guides/local-development/database-migrations.
