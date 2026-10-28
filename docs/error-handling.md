# Error handling and support ID lookup

Public error responses and notices contain only a support ticket ID, error code, mapped message and recovery action. IDs correlate diagnostics; they do not open tickets in an external support platform. The API, browser and existing ledger remain one application; this review adds no microservices or database migration.

## Find an ID

- **HTTP failures:** the response body `error.support_ticket_id`, `X-Support-Ticket-ID`, browser diagnostic metadata and API JSON log use the same ID. Search the literal ID rather than a field name: public JSON uses `support_ticket_id`, while private diagnostic metadata uses `supportTicketId`.
- **Browser-only failures:** validation, network interruption, bootstrap/render failures and restored unresolved intentions receive local IDs. Find these in the browser console (enable **Preserve log** before reloading) or its retained diagnostics. These IDs do not appear in API logs unless an API response supplied them. No browser telemetry upload endpoint is configured.
- A reload may create a new local ID for a restored unconfirmed write. Its financial payload/reference stays unchanged. Its newly displayed ID is logged even though no request is auto-sent.
- Coalesced balance/history failures show one primary ID. Browser metadata links `relatedSupportTicketIds` so the corresponding history failure can also be located without cluttering the error UI.

The normal development servers currently append output to the ignored, private local file `logs/development.log`. Search it from the repository root:

```sh
rg --fixed-strings 'PASTE-SUPPORT-ID-HERE' logs/development.log
```

The API logger writes JSON lines to its process error stream. Outside this development session, capture that stream in a private file or use the host's log collection; logs are not automatically persisted by the application. Never publish diagnostic files as web assets or commit them. Vite explicitly denies log/test-result/report directories over HTTP while preserving its default secret-file restrictions. Browser tests verify that the generated API log is readable by the test process and receives HTTP 403 through the web server.

## Diagnostic fields and retention

API records contain an ISO UTC timestamp, support ID, code, templated method/route scope and serialized internal error/cause chain. Mounted route context is preserved after Express unwinds its routers. Safe validation field paths remain available privately. Credential assignments (including quoted/multiline values), Bearer tokens, connection URLs and credential-valued object keys are redacted. Request bodies, query text and parameter collections are omitted regardless of key casing. PostgreSQL internal query text, rejected-row detail and SQL-containing context are also omitted; message/code/constraint/stack and causal structure remain available privately. Hostile getters/proxies cannot escape into an HTML/stack response.

Browser console output contains correlation metadata only. `getErrorDiagnostics(id)` from the browser errors module filters the bounded private causal buffer by primary or related ID; it is a trusted debugging API, not a UI or HTTP endpoint. The last 50 retained records are process/page-local and reset on restart/reload. If the console fails, its failure is retained privately with the original error instead of breaking recovery UI.

An API logging sink failure falls back to the normal logger with the same support ID. If the console sink also fails, `getLoggingFailures(id)` in the server errors module retains up to 50 private process-local fallback records, including the original causal failure and the logging failure. There is no public diagnostics endpoint. In-memory fallback records are not durable storage.

## Recovery behavior

- All displayed error IDs are registered through the shared notice, including restored/local errors. Raw internal messages, received HTTP copy and stack traces are never rendered.
- One notice represents simultaneous balance/history read failures. **Retry account** refreshes both reads; the history panel stays present with an explicit waiting state, and committed receipts remain visible.
- Unconfirmed financial writes retry the exact preserved command/reference. A later rejection cannot establish the earlier outcome; duplicates remain conflicts, not success receipts.
- Unconfirmed account creation offers **Go Back**, because a blind retry can create another account.
- Recovery actions disable while asynchronous work is pending. A transfer retry-storage failure shows one Retry action rather than a second Confirm button.
- Invalid/mismatched error-envelope IDs do not become a trusted rejection. The client preserves a valid response-header ID (or a valid body ID when no header exists) and treats the result as unconfirmed.

## Verification evidence

The error-handling review passes 474 automated tests (156 contracts, 210 API, 108 frontend) and 24 browser workflows, plus lint, formatting, typechecks, builds and module-boundary checks. Browser tests use disposable local PostgreSQL and match actual displayed IDs with response headers/body, browser console metadata and serialized API log records in ignored `apps/web/test-results/api-errors.jsonl`. They also verify restored-write IDs and duplicate-conflict tracing without a second movement. No hosted financial test writes are made. A focused browser rerun also verifies that diagnostic log downloads receive HTTP 403 after the development-server privacy fix. Error UI is checked at 320, 375, 768, 1024 and 1440px, including automated accessibility checks.

The reliability audit adds a regression for driver context/payload-field privacy and actual deferred-COMMIT tests proving that private diagnostic files retain the same support ID after every financial write rolls back. Browser-fixture log files use mode 0600 and remain blocked over HTTP. See [reliability audit](reliability-audit.md) for the current coverage matrix, final results and operational durability limits.
