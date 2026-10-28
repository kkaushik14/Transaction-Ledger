# API documentation

The primary API reference is the **OpenAPI v1 specification rendered by Swagger UI**:

- [Swagger UI](http://localhost:3000/api/docs) — locally hosted interactive documentation.
- [Versioned OpenAPI JSON](http://localhost:3000/api/docs/openapi.v1.json) — OpenAPI 3.1, document version `1.0.0`, describing `/api/v1`.

Start the API with `pnpm dev:api` or `pnpm dev`. These links assume the default API port 3000; use your configured API origin when `PORT` differs. `/api/docs` redirects to `/api/docs/` so local assets resolve correctly. The specification uses the relative server URL `/api/v1`, so Swagger requests target the API serving the documentation.

Swagger documents account creation, balance retrieval, credit/debit creation, filtered/paginated history and the bonus atomic transfer API. Every operation includes success/error responses and synthetic examples. It covers duplicate-reference scope/conflicts, exact decimal strings, validation, history defaults/limits/totals/ordering, transfer correlation, rollback and uncertain-response retries. Error examples use the actual shared four-field message/action resolver.

Opening the documentation performs no ledger queries or financial writes. **Try it out → Execute** explicitly sends a request to the current API; ordinary account/transaction/transfer semantics apply. Examples contain synthetic IDs, so replace them with IDs from the intended environment. Account creation is not idempotent. Financial retries must reuse the original complete payload/reference; a timeout/500 may follow a durable commit, and 409 is a conflict rather than a replayed success.

## Maintenance and verification

- [Versioned OpenAPI source](../apps/api/src/docs/openapi.v1.ts) owns endpoint descriptions, status responses, parameters and examples.
- [Schema projection](../apps/api/src/docs/schemas.ts) derives strict request/response JSON Schemas from `packages/contracts`; normalization and relational rules that need prose are documented explicitly. Cross-field transfer correlation and safe derived pagination offsets remain enforced by the shared runtime contracts.
- [Synthetic examples](../apps/api/src/docs/examples.ts) use typed DTOs and the shared error catalog. No environment values or real account data are embedded.
- [Docs router](../apps/api/src/docs/router.ts) serves the versioned JSON and pinned local Swagger UI assets. CDN assets, the online validator and optional install-time analytics are disabled/not used.
- [OpenAPI tests](../apps/api/tests/unit/openapi.test.ts) validate the document, every wire example and custom schema projections against the runtime contracts. [HTTP tests](../apps/api/tests/unit/docs-http.test.ts) verify assets, versioned JSON, safe unknown-path errors and zero database access. Browser tests render all five operations and execute an explicit account creation only against a disposable fixture.

Run `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm build`, `pnpm lint` and `pnpm format:check` after documentation changes. The specification must stay serializable, self-contained and aligned with the implemented `/api/v1` contract; update its document version when publishing a changed reference. Root `AGENT.md` continues to select project planning/scope; OpenAPI is the API documentation owner.

Supporting guides retain operational details rather than parallel endpoint definitions: [database setup](database-setup.md), [support-ID lookup and error handling](error-handling.md), [frontend component contracts](frontend-components.md) and [reliability audit](reliability-audit.md).

Verification: **560 automated tests** (156 contracts, 286 API, 118 frontend), **34 browser workflows**, typechecks/builds/lint/formatting and module checks passed. The 27 documentation-specific automated cases cover schema validity, examples, custom money/name rules, errors/headers, HTTP assets/spec and zero database work; two additional browser workflows cover actual rendering, no external requests and explicit execution against an isolated API/database. Financial services, public contracts and migrations are unchanged.

Projection uses the shared contracts' input/output wire modes ([Zod JSON Schema documentation](https://zod.dev/json-schema)). Swagger's validator is disabled in the local configuration ([Swagger UI configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)); no remote schema validator is called.
