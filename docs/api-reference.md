# API reference

Implemented base URL: `http://localhost:3000/api/v1`. Requests and responses use JSON and `snake_case` keys. Money is represented as decimal strings. Account creation, balance retrieval, atomic credit/debit writes, and history are consumed by the v0.2 React frontend. Atomic account-to-account transfer creation is also implemented in the API. The React transfer UI consumes this endpoint; account listing, editing, and deletion remain excluded. The transfer migration is applied and verified on the configured Supabase project; fresh databases need both migrations. See [database setup](database-setup.md).

## Create an account

`POST /accounts` with `Content-Type: application/json`:

```json
{ "name": "Alex Morgan" }
```

Success: `201 Created`:

```json
{
  "data": {
    "id": "64c7dc4e-509c-460b-9175-c79503c4f4c5",
    "name": "Alex Morgan",
    "balance": "0.00",
    "created_at": "2026-10-28T00:00:00.000Z"
  }
}
```

Names are trimmed, nonblank, case-preserving, and limited to 120 Unicode code points, matching PostgreSQL character limits. Null characters are rejected. Names need not be unique. The only accepted body field is `name`; any client-supplied `balance`, `id`, `created_at`, or other field rejects the whole request before SQL executes.

PostgreSQL generates the UUID and timestamp and initializes balance to zero. The insert explicitly supplies only the name. Each successful request creates a distinct account; account creation has no reference-based idempotency contract.

## Retrieve a balance

`GET /accounts/:accountId/balance`, where `accountId` is a valid UUID.

Success: `200 OK`:

```json
{
  "data": {
    "account_id": "64c7dc4e-509c-460b-9175-c79503c4f4c5",
    "balance": "0.00"
  }
}
```

Balances retain two fractional digits and are never converted to JavaScript floating-point numbers. A malformed UUID returns `400`; a valid UUID with no account returns `404 ACCOUNT_NOT_FOUND`. This endpoint does not return the account name.

## Credit or debit an account

`POST /accounts/:accountId/transactions` with `Content-Type: application/json`:

```json
{
  "type": "credit",
  "amount": "50.00",
  "description": "Opening credit",
  "reference_id": "ref-001"
}
```

Success: `201 Created`:

```json
{
  "data": {
    "transaction": {
      "id": "256db272-a509-4e47-b8de-85e52d23829b",
      "account_id": "64c7dc4e-509c-460b-9175-c79503c4f4c5",
      "type": "credit",
      "amount": "50.00",
      "description": "Opening credit",
      "reference_id": "ref-001",
      "created_at": "2026-10-28T00:01:00.000Z"
    },
    "account_balance": "50.00"
  }
}
```

- `type` is lowercase `credit` or `debit`.
- `amount` is a positive decimal string with at most 18 integer and two fractional digits. `"1"` and `"1.5"` normalize to `"1.00"` and `"1.50"`. Numbers, signs, exponent notation, leading-zero integers, surrounding whitespace, zero, extra precision, and out-of-range amounts return 400.
- `reference_id` is required, nonblank, at most 128 Unicode characters, case-sensitive, and preserved exactly, including surrounding whitespace. Null characters are rejected.
- `description` may be omitted (stored as `""`), must be a string of at most 500 Unicode characters, and cannot contain null characters.
- Unknown/server-owned fields (`id`, `account_id`, `created_at`, `balance`) reject the entire request.

The account is locked before duplicate/funds checks. The same reference for the same account returns `409 DUPLICATE_TRANSACTION`, even if the payload differs or an earlier debit exhausted the balance. This is duplicate protection, not a replay of the original response. The same reference may be used by a different account.

Debits exceeding the locked balance return `422 INSUFFICIENT_BALANCE`. Credits exceeding the maximum balance `999999999999999999.99` return `422 BALANCE_LIMIT_EXCEEDED`. Neither rejection changes data. Account balance update and ledger insertion commit together; any failure rolls both back. Response fields are validated before COMMIT. There are no automatic retries after ambiguous commit failures; retrying the same intent should preserve its reference ID.

Transaction history is available through GET as described below. Transaction PUT, PATCH, and DELETE routes remain absent.

## Transfer between accounts

`POST /transfers` with `Content-Type: application/json`:

```json
{
  "source_account_id": "aaaaaaaa-0000-4000-8000-000000000001",
  "destination_account_id": "bbbbbbbb-0000-4000-8000-000000000002",
  "amount": "25.50",
  "reference_id": "transfer-001",
  "description": "Shared expense"
}
```

Success: `201 Created`, only after the transfer record, both balance updates and both entries commit:

```json
{
  "data": {
    "transfer": {
      "id": "cccccccc-0000-4000-8000-000000000003",
      "source_account_id": "aaaaaaaa-0000-4000-8000-000000000001",
      "destination_account_id": "bbbbbbbb-0000-4000-8000-000000000002",
      "amount": "25.50",
      "reference_id": "transfer-001",
      "description": "Shared expense",
      "created_at": "2026-10-28T00:02:00.000Z"
    },
    "debit": {
      "id": "dddddddd-0000-4000-8000-000000000004",
      "account_id": "aaaaaaaa-0000-4000-8000-000000000001",
      "type": "debit",
      "amount": "25.50",
      "reference_id": "transfer-001",
      "description": "Shared expense",
      "transfer_id": "cccccccc-0000-4000-8000-000000000003",
      "created_at": "2026-10-28T00:02:00.000Z"
    },
    "credit": {
      "id": "eeeeeeee-0000-4000-8000-000000000005",
      "account_id": "bbbbbbbb-0000-4000-8000-000000000002",
      "type": "credit",
      "amount": "25.50",
      "reference_id": "transfer-001",
      "description": "Shared expense",
      "transfer_id": "cccccccc-0000-4000-8000-000000000003",
      "created_at": "2026-10-28T00:02:00.000Z"
    },
    "source_account_balance": "74.75",
    "destination_account_balance": "26.50"
  }
}
```

Both UUIDs are required, must identify different existing accounts, and are normalized to lowercase. Case variants cannot bypass the self-transfer check. Amount, description and reference rules match standalone transactions: positive exact decimal string, up to 18 integer/two fractional digits, optional description defaulting to `""`, case-sensitive reference preserved exactly. Unknown fields, IDs, timestamps, leg types and client balances are rejected before acquiring a database client. Self-transfers return `400 VALIDATION_ERROR`; missing accounts return `404 ACCOUNT_NOT_FOUND`.

Account locks are acquired in PostgreSQL UUID order, independent of transfer direction. On one checked-out client the service checks duplicates, inserts the transfer identity, debits the source, credits the destination, inserts linked debit/credit entries, validates the correlated response, and commits once. Source overdrafts return `422 INSUFFICIENT_BALANCE`; destination overflow returns `422 BALANCE_LIMIT_EXCEEDED`. Any rejection or failure rolls back all five writes. Standalone credits/debits contend on the same account locks.

Duplicate semantics:

- `(source_account_id, reference_id)` is unique in transfers. Repeating it returns `409 DUPLICATE_TRANSFER`, even with a changed destination/amount/description or exhausted source balance. No original success response is replayed.
- Both legs preserve the same caller reference. If either participating account already has that reference in its ledger, return `409 DUPLICATE_TRANSACTION` and change nothing. This includes a standalone movement or another transfer's incoming leg. Do not silently generate replacement references.
- Disjoint account pairs may reuse a reference. Case and surrounding whitespace remain significant.
- There are no automatic write retries. After an uncertain response, preserve the exact payload and reference. A conflict proves that reference is used; it does not assert an earlier request had the same payload. Reconcile existing history before starting a new intent.

Transfer legs appear in each account's existing filtered/paginated history. Those response shapes remain unchanged, including omission of `transfer_id`; the creation response supplies explicit correlation. No transfer listing, retrieval, update or deletion endpoints are introduced.

## Retrieve transaction history

`GET /accounts/:accountId/transactions?type=credit&page=1&limit=20`

| Parameter | Default    | Accepted values                           |
| --------- | ---------- | ----------------------------------------- |
| `type`    | Both types | `credit` or `debit`; omit to include both |
| `page`    | `1`        | Positive integer URL string               |
| `limit`   | `20`       | Integer URL string from 1 through 100     |

Success: `200 OK`:

```json
{
  "data": [
    {
      "id": "256db272-a509-4e47-b8de-85e52d23829b",
      "account_id": "64c7dc4e-509c-460b-9175-c79503c4f4c5",
      "type": "credit",
      "amount": "50.00",
      "description": "Opening credit",
      "reference_id": "ref-001",
      "created_at": "2026-10-28T00:01:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total_records": 1, "total_pages": 1 }
}
```

Rows belong only to the requested account, with the optional type filter applied before pagination. Ordering is `created_at DESC, id DESC`, so equal timestamps have a deterministic UUID tie-breaker. Money stays decimal strings and timestamps are UTC ISO strings.

`total_records` counts all matching rows before LIMIT/OFFSET, and `total_pages` is its ceiling divided by limit. A known account with no matching rows returns `data: []`, `total_records: 0`, and `total_pages: 0`. A page past the last page returns `data: []` with the requested page and correct totals. Missing accounts return `404 ACCOUNT_NOT_FOUND`; malformed UUIDs return `400 VALIDATION_ERROR`.

Integer parameters use canonical decimal digits: zero, signs, fractional/exponent forms, whitespace, leading-zero integers, and empty values are rejected. Repeated parameters, nested/array values, unknown parameters, invalid types, numbers above JavaScript's safe-integer range, and unsafe derived offsets return `400 VALIDATION_ERROR` before a database client is acquired.

Account existence, filtered count, and rows are read on one client in a read-only REPEATABLE READ transaction. Each response uses a consistent snapshot even if a movement commits while it is loading. Separate page requests use separate snapshots; newer writes can shift offset-based pages between requests. History reads do not lock or modify account/ledger rows.

## Errors

Every application, validation, parsing, and unmatched-route error uses this envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "issues": [{ "path": "body.name", "code": "invalid_type" }]
    }
  }
}
```

The `details` object can be empty. Validation issues identify fields and issue codes without echoing submitted values. Clients can use the exported shared request schemas for field-level feedback.

| HTTP status | Code                     | Meaning                                                                                        |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| 400         | `VALIDATION_ERROR`       | Invalid name, transaction/transfer input, self-transfer, UUID, history query or malformed JSON |
| 404         | `ACCOUNT_NOT_FOUND`      | No account for a valid UUID                                                                    |
| 404         | `ROUTE_NOT_FOUND`        | Unregistered path or method, including edit/delete endpoints                                   |
| 409         | `DUPLICATE_TRANSACTION`  | Reference already used within the same account                                                 |
| 409         | `DUPLICATE_TRANSFER`     | Transfer reference already used for this source account                                        |
| 422         | `INSUFFICIENT_BALANCE`   | Debit or transfer would overdraw its source                                                    |
| 422         | `BALANCE_LIMIT_EXCEEDED` | Credit or transfer would exceed destination/account balance capacity                           |
| 413         | `PAYLOAD_TOO_LARGE`      | JSON body exceeds the 16 KiB parser limit                                                      |
| 415         | `UNSUPPORTED_MEDIA_TYPE` | Creation request lacks JSON content type, or request encoding is unsupported                   |
| 500         | `INTERNAL_ERROR`         | Unexpected error; generic public message, no SQL, credentials, or stack traces                 |

Shared schemas and inferred DTOs are exported from `@ledger/contracts`. Response schemas also verify database projections before sending successful responses; unexpected persistence-shape failures return a generic 500 rather than exposing internal validation errors.

CORS allows browser access from the configured `WEB_ORIGIN`, with GET/POST/OPTIONS and Content-Type. This is the planned trusted demo API; CORS does not provide authentication.

## Verification

`pnpm test` runs shared-contract tests, API infrastructure unit tests, and Supertest HTTP-to-SQL account and transaction tests. Account integration tests apply the actual initial migration to a fresh in-memory PGlite database and close it afterward. They do not load `.env` or mutate the hosted Supabase database. Transaction tests use a separate disposable native PostgreSQL 17 cluster with independent `pg` connections. They force balance-update/insert rollback, observe actual account-lock contention for concurrent debits/duplicates, test exact maximum balances, and reconcile balances with ledger totals. History tests use a disposable PostgreSQL 17 cluster to verify filters, totals, page boundaries, timestamp/UUID ordering, invalid input, and snapshot consistency while another session commits a movement. PGlite verifies account SQL/defaults/constraints and the HTTP path; it does not replace hosted PostgreSQL/network/TLS verification, which is covered separately by the database check command and documented connection checks.

Current verification: 128 shared-contract tests and 180 API tests pass (308 backend/contract tests); 64 frontend tests also pass (372 total). Transfer coverage adds 42 contract cases and 53 native PostgreSQL integration cases: migration over existing data, constraint/permission checks, forced failure at each write and during response validation, duplicate persistence, opposing transfers, competing outgoing/incoming movements and standalone-operation contention. Each test reconciles balances and verifies every transfer has exactly two matching legs. Native fixtures apply all migrations in timestamp order. Tests never mutate the hosted Supabase ledger.

The transfer browser UI validates against the shared command schema and verifies that a success response matches the preserved request. It does not change server semantics: 409 remains a conflict, not a replayed success. Explicit identical retries preserve reference identity, and uncertain outcomes are not labelled rolled back. The 17 browser tests include actual source/recipient ledger flows, committed-response loss, known errors and read-refresh failure. No new HTTP routes, contracts or schema changes were needed for the UI.
