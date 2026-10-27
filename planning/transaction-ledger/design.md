# System Design and API Contract

> Project: Transaction Ledger | Version: 0.1 (review draft) | Status: Proposed technical design
>
> The **Full Stack Developer Assessment** defines the mandatory ledger behaviors (pages 1–5). The browser interface and the selected technology stack are user-requested extensions. Endpoint URLs, payload shapes, money representation, and error codes below are explicit project assumptions documented in `assumption.md`.

## 1. Objective

Build a clear, extensible full-stack demonstration of a transaction ledger. An account starts at a zero balance; valid credits and debits append immutable ledger entries and atomically change its current balance. Users can retrieve their balance and a latest-first, filtered, paginated history. A React interface exposes these capabilities without connecting directly to the database.

### Success criteria

- Mandatory four assessment API capabilities work correctly.
- The system prevents overdrafts, duplicate same-account references, partial writes, and inconsistent balances.
- Transaction history is immutable through the API.
- API input validation and errors are predictable.
- TypeScript boundaries and modular folders make future changes straightforward.
- A minimal React/Vite UI supports the workflow, subject to mandatory backend scope priority.
- A fresh clone can be run locally from README instructions.

## 2. Scope and boundaries

### Mandatory functional scope (assessment)

1. Create Account.
2. Add Transaction (`credit` or `debit`).
3. Get Account Balance.
4. Get Transaction History (filter, pagination, latest-first sorting).
5. Enforce atomicity, validation, duplicate handling, and immutability.

### Project-added scope (user choices)

- React + Vite + TypeScript web UI.
- Node.js + Express + TypeScript API server.
- Supabase-hosted PostgreSQL database, using server-side `pg` SQL access.
- Shared request/response contracts; extensible feature modules.
- Mandatory code comments and Prettier formatting.

### Bonus / deferred

- Atomic money transfer API.
- Account listing, authentication/roles, exports, analytics, background workers, payment providers, audit/admin console, full production deployment.

## 3. Architecture overview

```text
+-----------------------------+
| React + Vite web application|
| TypeScript, browser UI      |
+--------------+--------------+
               |
               | HTTPS / JSON (typed API contract)
               v
+-----------------------------+
| Express.js API (Node.js TS) |
| Routes -> controllers       |
|        -> services          |
|        -> repositories      |
+--------------+--------------+
               |
               | PostgreSQL driver (`pg`), parameterized SQL
               | One client per atomic transaction
               v
+-----------------------------+
| Supabase-hosted PostgreSQL  |
| private ledger schema       |
| accounts / transactions     |
| constraints + indexes       |
+-----------------------------+
```

**Responsibility boundary:** UI state and presentation remain in React; the Express service is authoritative for validation and ledger rules; PostgreSQL provides atomicity, locking, constraints, and persistent data.

### Why a modular monolith?

There are only two core database entities and four mandatory APIs. Separate deployable services, queues, distributed transactions, or an external ledger product would add complexity without helping the assessment. The monorepo uses modules **inside one API service** to keep the code independently readable and modifiable.

## 4. Component design

| Component | Responsibility | Must not do |
| --- | --- | --- |
| React pages/features | User input, loading/error states, display | SQL, secret handling, authoritative balance math |
| Typed API client | HTTP calls, URL construction, parse errors | Contain business rules |
| Express routes | Register endpoints and middleware | Embed DB operations |
| Controllers | Map HTTP input/output, status codes | Start DB transactions or calculate balances |
| Request validation | Parse and validate params/query/body | Mutate persistent data |
| Account service | Account creation/read policy | Directly access `req`/`res` |
| Transaction service | Duplicate checks, credit/debit policy, atomic workflow | Call DB outside transaction client for transaction writes |
| Repositories | Parameterized SQL and row mapping | Choose HTTP response codes |
| Database client | Pool and transaction lifecycle | Store process-global per-request transaction state |
| Shared contracts | Zod schemas and public TypeScript DTOs | Import Express, React, or database drivers |
| Global error handler | Error-to-status mapping and safe messages | Leak SQL/connection strings |

## 5. Data movement and trust boundaries

1. Browser receives user input and applies ergonomic form validation.
2. Browser calls an API endpoint using `VITE_API_BASE_URL` (a public backend URL only).
3. Express validates inputs again; no browser-supplied balance, ID, or timestamp is trusted.
4. Service obtains one `pg` client; transactional writes run through that client.
5. Database constraints provide defense in depth.
6. Express returns normalized DTOs with decimal-string monetary values.
7. React displays server values and refreshes data after each successful transaction.

Only Express may possess `DATABASE_URL`. Store tables in a private `ledger` schema, not an exposed Supabase Data API schema. No Supabase service-role key is required by this architecture. Authentication is outside the assessment and is not implicitly provided by CORS or Supabase hosting.

## 6. REST API contract (proposed)

Base URL: `http://localhost:3000/api/v1` (illustrative; actual host/port are configurable).

All successful payloads are JSON with `data`; history additionally returns `pagination`. API keys match the assessment's `snake_case` fields. All monetary values are strings.

### 6.1 `POST /accounts` — create account

Request:

```json
{
  "name": "Alex Morgan"
}
```

Response — `201 Created`:

```json
{
  "data": {
    "id": "64c7dc4e-509c-460b-9175-c79503c4f4c5",
    "name": "Alex Morgan",
    "balance": "0.00",
    "created_at": "2026-10-28T10:30:00.000Z"
  }
}
```

Rules: trim name; reject blank/overlong names, unknown fields, and any client-provided `balance` or `created_at`. ID and creation time come from the database.

### 6.2 `POST /accounts/:accountId/transactions` — credit/debit

Request:

```json
{
  "type": "credit",
  "amount": "50.00",
  "description": "Opening credit",
  "reference_id": "6a3ed194-a3e0-44f1-bd50-48e1fd591a47"
}
```

Response — `201 Created`:

```json
{
  "data": {
    "transaction": {
      "id": "256db272-a509-4e47-b8de-85e52d23829b",
      "account_id": "64c7dc4e-509c-460b-9175-c79503c4f4c5",
      "type": "credit",
      "amount": "50.00",
      "description": "Opening credit",
      "reference_id": "6a3ed194-a3e0-44f1-bd50-48e1fd591a47",
      "created_at": "2026-10-28T10:31:00.000Z"
    },
    "account_balance": "50.00"
  }
}
```

Rules:

- Accept only `credit` or `debit`; amount must be positive, decimal-string, max two fractional digits, and within column precision.
- `reference_id` is required, nonblank, account-scoped unique, and case-sensitive.
- Repeating the same reference for the **same account** returns `409` with no balance change or new row (even if other request fields differ). The same reference may be used by a different account.
- For debit, reject insufficient balance (`422`) with no changes.
- Write transaction and balance in one database transaction. Never accept user-supplied `id`, `account_id` in the body, or `created_at`.
- If omitted, `description` becomes `""`.

### 6.3 `GET /accounts/:accountId/balance` — account balance

Response — `200 OK`:

```json
{
  "data": {
    "account_id": "64c7dc4e-509c-460b-9175-c79503c4f4c5",
    "balance": "50.00"
  }
}
```

Return `404` if the account does not exist.

### 6.4 `GET /accounts/:accountId/transactions` — history

Query parameters:

| Name | Optional? | Default | Validation |
| --- | --- | --- | --- |
| `type` | Yes | Both | `credit` or `debit` only |
| `page` | Yes | `1` | Positive integer |
| `limit` | Yes | `20` | Integer `1..100` |

Example: `GET /api/v1/accounts/{accountId}/transactions?type=credit&page=1&limit=20`

Response — `200 OK`:

```json
{
  "data": [
    {
      "id": "256db272-a509-4e47-b8de-85e52d23829b",
      "account_id": "64c7dc4e-509c-460b-9175-c79503c4f4c5",
      "type": "credit",
      "amount": "50.00",
      "description": "Opening credit",
      "reference_id": "6a3ed194-a3e0-44f1-bd50-48e1fd591a47",
      "created_at": "2026-10-28T10:31:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_records": 1,
    "total_pages": 1
  }
}
```

SQL query must apply account and optional type filter, sort by `created_at DESC, id DESC`, then `LIMIT`/`OFFSET`. Count query uses the **same filters** without pagination. Return `404` for an unknown account; return `[]` for an existing account with no matching rows.

### 6.5 Error contract

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Account has insufficient balance",
    "details": {}
  }
}
```

| Status | Code | Common cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing name, invalid body, type, amount, UUID, or pagination |
| `404` | `ACCOUNT_NOT_FOUND` | Account ID does not exist |
| `409` | `DUPLICATE_TRANSACTION` | Same account and reference ID already used |
| `422` | `INSUFFICIENT_BALANCE` | Debit would overdraw account |
| `500` | `INTERNAL_ERROR` | Unexpected failure; internal detail logged only |

`details` may carry field-specific validation information but must not reveal secrets. Central middleware maps application errors and PostgreSQL uniqueness violations to these codes.

### 6.6 Other routes

- `GET /health`: optional operational liveness endpoint, outside the assessment. Do not expose database credentials or private diagnostics.
- `GET /accounts`: **optional future extension** for account selection; the initial UI must work without it.
- `POST /transfers`: **bonus only**, described below.
- No `PUT`, `PATCH`, or `DELETE` endpoints for transactions.

## 7. Critical credit/debit write flow

```text
HTTP request
  -> Validate account UUID + strict body schema
  -> Acquire pool client
  -> BEGIN
  -> SELECT account WHERE id = ? FOR UPDATE
       -> If missing: rollback + 404
  -> Check (account_id, reference_id) for existing transaction
       -> If exists: rollback + 409
  -> If debit: verify current locked balance >= requested amount
       -> If insufficient: rollback + 422
  -> UPDATE accounts SET balance = balance (+ or -) amount
  -> INSERT transactions (...)
  -> COMMIT
  -> Return 201 with transaction and new account balance
Any failure before COMMIT -> ROLLBACK -> release client
```

**Concurrency guarantee:** Locking the account before the reference/available-funds checks serializes writes for that account. A database-level `UNIQUE (account_id, reference_id)` constraint remains mandatory and protects against errors in application logic. Run all statements with the same acquired database client.

**Atomicity guarantee:** If either the update or insert fails, the other is rolled back. Validate the behavior with a controlled failure test rather than relying only on manual inspection.

**Read consistency:** The materialized account balance is updated as part of every successful ledger write. For independent verification, compare `accounts.balance` with the sum of credits minus debits across `transactions`.

## 8. Frontend design

### 8.1 Pages and navigation

| View | Route | Required user action |
| --- | --- | --- |
| Home / account entry | `/` | Create an account; load an account by UUID |
| Account details | `/accounts/:accountId` | View balance, submit credit/debit, browse history |
| Not found/error | Route state | Recover from missing account or invalid ID |

### 8.2 Account detail layout

```text
+--------------------------------------------------------+
| Header: Transaction Ledger                             |
+--------------------------------------------------------+
| Account: Alex Morgan            Account ID: [copy]     |
| Current balance: 150.00                                |
+----------------------------+---------------------------+
| New transaction            | History                   |
| Type: Credit / Debit       | Filter: All/Credit/Debit  |
| Amount: [      ]           | Latest-first rows         |
| Description: [     ]       | Date | Type | Amount      |
| [Submit transaction]       | Pagination                |
+----------------------------+---------------------------+
| Status / validation feedback                           |
+--------------------------------------------------------+
```

On narrow screens, stack forms and history vertically; do not use fixed-width elements that overflow the viewport.

### 8.3 Component boundaries

- `AccountCreateForm`: name input and create request.
- `AccountLookupForm`: account UUID input and navigation.
- `AccountBalanceCard`: account identification and authoritative balance.
- `TransactionForm`: credit/debit selector, amount, description, submit, error/retry handling.
- `TransactionHistory`: filter, list/table, page controls, loading/empty/error states.
- `ErrorNotice`, `LoadingState`, and common button/input styles: reusable UI primitives.
- Feature hooks coordinate loading and refetches; typed API modules own HTTP details.

### 8.4 UX and accessibility requirements

- Inline field errors and one clear error message for server rejection.
- Explicit `Submitting...` state and disabled repeat submission during an in-flight operation.
- Generate a reference ID per intended transaction and reuse it for a retry of the same intent; do not accidentally submit an intended retry as a new operation.
- After success, refetch balance and history; do not treat locally calculated balances as authoritative.
- Use labeled inputs, native buttons, focus indicators, accessible error text, and responsive layouts.
- Do not add frontend auth or direct Supabase queries within the initial implementation.

### 8.5 Styling tokens (initial proposal)

The design is neutral and configurable through CSS variables, not scattered hardcoded values. Suggested variables: `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-border`, `--color-primary`, `--color-success`, `--color-danger`, `--radius-sm/md/lg`, and `--space-1..8`. Support mobile-first sizing and a constrained content max-width. Detailed visual identity is not specified in the assessment.

## 9. Error handling, logging, and observability

- Zod-style strict input schemas at the HTTP boundary.
- Centralized Express error handler, including unexpected async errors.
- Structured server log entries with request ID, route, HTTP status, and safe context; redact names/amounts if operational policy requires it.
- No raw SQL errors, credentials, connection URLs, or stack traces in client responses.
- Health endpoint and graceful shutdown of the HTTP server and DB pool are useful operational additions.

## 10. Optional transfer design

**Only after all required APIs and tests pass.** Proposed `POST /api/v1/transfers` accepts `source_account_id`, `destination_account_id`, `amount`, `reference_id`, and optional `description`.

The service must validate both accounts and non-self transfer, lock both account rows in consistent UUID order, reject insufficient funds, update both balances, insert two correlated ledger entries, and commit once. A failure anywhere must roll back all four writes. An optional `transfers` record gives a stable ID and idempotency constraint as specified in `schema.md`. Implement and test transfer-specific duplicate handling rather than reusing an unsafe shortcut.

## 11. Quality attributes and test strategy

| Concern | Design choice | Verification |
| --- | --- | --- |
| Money accuracy | PostgreSQL decimal arithmetic, string transport | Precision and arithmetic tests |
| Atomicity | Single client and one DB transaction | Forced failure/rollback integration test |
| Overspending | Row lock and sufficient-funds rule | Parallel debit test |
| Idempotency | Account-scoped unique reference | Duplicate and cross-account test |
| Immutability | No transaction mutation routes | HTTP route tests |
| History | Stable sort, count + filter + paginate | Ordering/filter/metadata tests |
| Maintainability | Feature modules, contracts, strict TS, comments | Typecheck, lint, code review |
| Usability | Simple React interface, responsive states | Component and manual browser tests |

## 12. Design exclusions and change control

No background job processing is required: credit/debit transactions must complete synchronously to provide a definite outcome. No caching of balances is needed. Do not redesign the ledger around eventual consistency. Any future authentication, multi-currency support, bulk imports, transfers, or account deletion requires corresponding design, database, and test updates.

**Cross-references:** `rules.md` (code standards), `assumption.md` (decisions and open questions), `schema.md` (PostgreSQL and lock design), `structure.md` (ownership), `plan.md` (implementation milestones).
