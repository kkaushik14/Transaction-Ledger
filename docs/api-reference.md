# API reference

Implemented base URL: `http://localhost:3000/api/v1`. Requests and responses use JSON and `snake_case` keys. Money is represented as decimal strings. Account creation, balance retrieval, atomic credit/debit writes, and transaction history are implemented and consumed by the v0.2 React frontend. Transfers, account listing, editing, and deletion are not implemented.

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

| HTTP status | Code                     | Meaning                                                                                                |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| 400         | `VALIDATION_ERROR`       | Invalid name, transaction input, UUID, history query, malformed JSON, or known name constraint failure |
| 404         | `ACCOUNT_NOT_FOUND`      | No account for a valid UUID                                                                            |
| 404         | `ROUTE_NOT_FOUND`        | Unregistered path or method, including edit/delete endpoints                                           |
| 409         | `DUPLICATE_TRANSACTION`  | Reference already used within the same account                                                         |
| 422         | `INSUFFICIENT_BALANCE`   | Debit would overdraw the account                                                                       |
| 422         | `BALANCE_LIMIT_EXCEEDED` | Credit would exceed NUMERIC(20,2) balance capacity                                                     |
| 413         | `PAYLOAD_TOO_LARGE`      | JSON body exceeds the 16 KiB parser limit                                                              |
| 415         | `UNSUPPORTED_MEDIA_TYPE` | Creation request lacks JSON content type, or request encoding is unsupported                           |
| 500         | `INTERNAL_ERROR`         | Unexpected error; generic public message, no SQL, credentials, or stack traces                         |

Shared schemas and inferred DTOs are exported from `@ledger/contracts`. Response schemas also verify database projections before sending successful responses; unexpected persistence-shape failures return a generic 500 rather than exposing internal validation errors.

CORS allows browser access from the configured `WEB_ORIGIN`, with GET/POST/OPTIONS and Content-Type. This is the planned trusted demo API; CORS does not provide authentication.

## Verification

`pnpm test` runs shared-contract tests, API infrastructure unit tests, and Supertest HTTP-to-SQL account and transaction tests. Account integration tests apply the actual initial migration to a fresh in-memory PGlite database and close it afterward. They do not load `.env` or mutate the hosted Supabase database. Transaction tests use a separate disposable native PostgreSQL 17 cluster with independent `pg` connections. They force balance-update/insert rollback, observe actual account-lock contention for concurrent debits/duplicates, test exact maximum balances, and reconcile balances with ledger totals. History tests use a disposable PostgreSQL 17 cluster to verify filters, totals, page boundaries, timestamp/UUID ordering, invalid input, and snapshot consistency while another session commits a movement. PGlite verifies account SQL/defaults/constraints and the HTTP path; it does not replace hosted PostgreSQL/network/TLS verification, which is covered separately by the database check command and documented connection checks.

Current verification: 86 shared-contract tests and 127 API tests pass (213 total), including actual PostgreSQL row-lock contention, forced insert rollback, duplicate persistence across application instances, maximum-balance handling, and ledger reconciliation. All successful write tests use disposable local databases; hosted ledger data was not changed.
