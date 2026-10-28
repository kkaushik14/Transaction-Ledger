# Transaction Ledger

Full-stack TypeScript ledger with a monochrome React interface, account creation/UUID lookup, exact balance display, atomic credit/debit processing, and filtered, paginated transaction history. The component-first v0.2 frontend uses the existing Express API and shared contracts. The API validates configuration and checks its certificate-verified PostgreSQL pool before listening. The initial Supabase migration is applied. Atomic transfer creation is implemented in the API; its additive migration is applied to the configured Supabase project and verified. The account workspace includes a component-first transfer form and committed receipt.

## Live deployment

| Resource   | URL                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Site       | [transaction-ledger.duckdns.org](https://transaction-ledger.duckdns.org/)                       |
| Swagger UI | [API documentation](https://transaction-ledger.duckdns.org/api/docs)                            |
| OpenAPI v1 | [Versioned JSON specification](https://transaction-ledger.duckdns.org/api/docs/openapi.v1.json) |

## Requirements

- Node.js 24 LTS (`.nvmrc` records the runtime used for verification).
- pnpm 11.19.0, pinned by the root `packageManager` field.
- A PostgreSQL connection string for API startup, plus the bundled Supabase CA (or an explicit CA override). The web app alone does not require database credentials.

If using nvm, run `nvm install` and `nvm use`. Install the pinned pnpm version using your preferred package-manager setup before proceeding.

## Setup and development

```sh
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
# Configure DATABASE_URL and the baseline values in apps/api/.env.
# Keep an already configured .env; do not overwrite it.
# For a new database, first follow docs/database-setup.md to apply the migration.
pnpm dev
```

Open `http://localhost:5173` for the landing page and account entry forms. The API listens on port 3000; open the primary [Swagger UI documentation](http://localhost:3000/api/docs) for endpoint contracts and examples. Download the [versioned OpenAPI v1 JSON](http://localhost:3000/api/docs/openapi.v1.json); see [documentation maintenance](docs/api-reference.md) for source ownership and checks. The contracts workspace runs a TypeScript watcher during combined development.

```sh
pnpm dev:api
pnpm dev:web
```

These commands start either app independently. Root development commands first build contracts, so a fresh checkout does not depend on pre-existing generated output. `pnpm dev` then watches contracts alongside both apps.

Configure `DATABASE_URL`, `PORT`, `WEB_ORIGIN`, and `NODE_ENV` in `apps/api/.env` or the process environment. Startup fails with variable names only if validation fails. `DATABASE_POOL_MAX` defaults to 5 (range 1–20); `DATABASE_SSL_CA_PATH` defaults to the bundled Supabase CA, and override paths resolve relative to `apps/api`. The existing configured `.env` can be used without changes. `WEB_ORIGIN` restricts CORS to the configured frontend origin; it does not provide authentication. Node loads the API `.env` through the startup scripts; placeholder values must be replaced locally.

The frontend defaults to `http://localhost:3000/api/v1`. To use a different API, copy `apps/web/.env.example` to `apps/web/.env`, set public `VITE_API_BASE_URL`, and restart Vite. Never put Supabase/database keys in `VITE_*` variables. Production hosting must serve `index.html` for client routes such as `/accounts/:accountId`.

## API documentation

The primary API reference is **OpenAPI 3.1 + Swagger UI**, available at the deployed [Swagger UI](https://transaction-ledger.duckdns.org/api/docs). The [versioned specification](https://transaction-ledger.duckdns.org/api/docs/openapi.v1.json) describes `/api/v1` with document version `1.0.0`. For local development, use [Swagger UI](http://localhost:3000/api/docs) and [OpenAPI v1 JSON](http://localhost:3000/api/docs/openapi.v1.json) on the local API origin; adjust the port if `PORT` differs. It covers account creation/balances, credit/debit, history filters/pagination, success/error examples, duplicate references, uncertain retries and the bonus atomic transfer API.

All Swagger assets are installed dependencies served locally; no CDN or online validator is used. Opening docs performs no database work. **Try it out → Execute** sends requests only after explicit action. Financial retries must reuse the original reference/payload; a duplicate returns 409, not a replayed success. See [documentation ownership and verification](docs/api-reference.md). Documentation follow-up verification: 560 automated tests and 34 browser workflows, including schema/example validation, local asset loading and explicit Swagger execution against a disposable API.

## Workspace layout

| Path                               | Responsibility                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/api`                         | Account/transaction API, filtered history, validation, and verified TLS pool          |
| `apps/web`                         | Component-first React UI, typed HTTP adapters, feature hooks, component/browser tests |
| `packages/contracts`               | Browser-safe account, transaction/history, and error schemas with inferred DTOs       |
| `supabase/migrations`              | Applied initial ledger migration, tracked in hosted migration history                 |
| `docs`                             | Implemented API reference and database setup documentation                            |
| `planning/transaction-ledger`      | Original planning files and archived formatting configurations                        |
| `planning/v0.2/transaction-ledger` | Active UI design, decisions, structure, rules, and delivery plan                      |
| `AGENT.md`                         | Planning navigation, engineering boundaries, and unresolved design questions          |

See [frontend component contracts](docs/frontend-components.md) for component responsibilities, state handling, and verification. The API and browser each own a dedicated transfer feature module.

Implemented code folders expose explicit typed `index.ts` entries. Import across folders through `index.js` specifiers, for example `../components/ui/index.js`; TypeScript resolves the source and Node-targeted builds emit the matching JavaScript. Same-folder implementation files import siblings directly, which avoids self-barrel cycles. Public feature facades keep SQL rows, controllers and transaction-intent storage details internal. ESLint rejects cross-folder deep code imports. Startup, diagnostics, test suites, configs, migrations and documentation are not exported through application barrels. See active [structure](planning/v0.2/transaction-ledger/structure.md) and [rules](planning/v0.2/transaction-ledger/rules.md) for ownership and exceptions. Microservice extraction remains future work.

## Tooling commands

| Command                             | Purpose                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm build`                        | Build workspaces in dependency order: contracts before their consumers                   |
| `pnpm typecheck`                    | Build contracts, then check all workspaces without emitting application code             |
| `pnpm lint`                         | Run root ESLint flat configuration with zero warnings allowed                            |
| `pnpm format`                       | Format supported files using the root Prettier configuration                             |
| `pnpm format:check`                 | Verify formatting without writing files                                                  |
| `pnpm test`                         | Run contracts, API infrastructure/HTTP/SQL tests, and frontend component/hook/page tests |
| `pnpm test:e2e`                     | Run Chrome/Chromium UI and accessibility tests against a disposable local database       |
| `pnpm --filter @ledger/api start`   | Run the built account API after `pnpm build`                                             |
| `pnpm --filter @ledger/web preview` | Preview the built frontend after `pnpm build` (requires a separately running API)        |

The [reliability audit](docs/reliability-audit.md) records the 533 automated tests and 32 browser workflows at audit completion, prioritized financial invariants, controlled COMMIT/rollback faults, saved-reference timeout retries and diagnostic privacy checks. Browser fixtures use a dedicated `e2e` mode with HMR disabled so development reloads cannot reset forms during assertions; normal development keeps HMR.

The suite contains shared-contract, API infrastructure, account/transaction HTTP/SQL, and frontend component/hook/page tests. Account integration tests use isolated in-memory PGlite; transaction/history tests use a disposable PostgreSQL 17 cluster and the actual migration. Tests do not read the application's `.env` or mutate hosted Supabase. Every workspace test command fails if no tests exist. Local HTTP/SQL tests need permission to bind loopback ports in sandboxed environments. See the database setup guide for hosted schema and TLS verification status.

For browser QA, stop any server using ports 5173 or 4310, then run `pnpm test:e2e`. Playwright starts its own Vite server and Express API with an isolated PostgreSQL cluster and cleans them up afterward. It uses installed macOS Chrome when available, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; otherwise install its pinned browser with `pnpm --filter @ledger/web exec playwright install chromium`. The suite checks all five required viewport widths, keyboard navigation, automated accessibility, actual account/credit/debit/history flows, and uncertain write retries.

The API and contracts use NodeNext ESM: relative TypeScript imports use the `.js` extension expected by emitted Node code. The web workspace uses Vite-compatible bundler resolution and React JSX. Both apps declare `workspace:*` dependencies on contracts, whose package exports point to compiled JavaScript and declarations. No import aliases or runtime TypeScript loaders are needed for the production API.

Strict TypeScript is shared through `tsconfig.base.json`. ESLint uses TypeScript recommended rules, runtime-specific globals, React Hooks checks, and React Fast Refresh rules. `eslint-config-prettier` disables conflicting formatting rules. Comments remain a required review check under `rules.md`.

The root Prettier and EditorConfig settings originate from the supplied planning pack. The root Prettier ignore file additionally excludes the preserved planning archive and local pnpm store. Original planning Markdown is not reformatted. Dependency versions are saved exactly and the root `pnpm-lock.yaml` must remain committed.

## Frontend behavior and scope

Follow [AGENT.md](AGENT.md) for active v0.2 document routing and scope. The landing page contains working account creation/lookup CTAs, features, steps, principles, account forms, and footer. Desktop uses a navbar; mobile/tablet use a modal drawer. Account pages show a known creation name or the approved Account/UUID fallback, exact server balance, credit/debit form, and type-filtered history with page controls. Narrow screens use history cards with the same details as the table.

Writes never retry automatically. An uncertain transaction retains its exact payload and reference in session storage, including across reload, so “Retry same request” cannot generate a second reference. A duplicate response refreshes balance/history without claiming the original payload succeeded. New transactions require an explicit action after success or conflict. Account creation has no idempotency endpoint; an uncertain creation response warns that retrying may create another account.

Money uses one abstract unit and decimal strings throughout the UI. Account listing and authentication remain outside the implemented feature set. The deployed site and API documentation are linked above. Read-only connection verification is available through [database setup](docs/database-setup.md).

## Database infrastructure

Run `pnpm --filter @ledger/api db:check` to verify connectivity, transaction commit/rollback, and pool reuse using read-only queries. It reads the same API environment and closes its pool afterward. It writes no financial data.

`src/config/env.ts` parses server configuration without import-time secrets. `src/db/pool.ts` builds verified TLS settings and creates the single pool owned by startup. `src/db/transaction.ts` supplies `withTransaction(pool, callback)`: use only its checked-out client for callback queries, await all work, and let the helper own BEGIN/COMMIT/ROLLBACK/release. Do not issue transaction-control SQL, release the client, or use `pool.query` inside the callback. No automatic retries are performed, especially after an uncertain COMMIT.

The API checks `SELECT 1` before opening its HTTP listener, then drains requests and closes the pool on SIGINT/SIGTERM with a 15-second shutdown deadline. Driver errors are logged as generic messages to avoid credential or SQL leakage.

## Account endpoints

The account feature follows routes → validation → controllers → services → repositories. `createApp` receives the database executor and allowed browser origin; startup supplies the single verified pool. Repository SQL is parameterized and only inserts the account name, leaving identity, time, and zero balance to PostgreSQL defaults.

See [API reference](docs/api-reference.md) for requests, responses, and errors. Mutation requests require JSON; malformed/invalid input never reaches persistence. Unknown routes return JSON 404 errors, and unexpected async failures return a sanitized 500. Credit/debit requests use the separate transaction feature with the same validation and error middleware.

## Credit/debit writes and tests

`POST /api/v1/accounts/:accountId/transactions` validates a strict body, then uses one checked-out client for BEGIN → account row lock → duplicate-reference check → exact SQL balance update → immutable ledger insert → response validation → COMMIT. Any failure rolls back. The account row is locked before checking references/funds, and PostgreSQL retains its unique account/reference constraint as a final safeguard. No arithmetic uses JavaScript numbers.

Run `pnpm test` as a non-root user on a supported native platform. The pinned `embedded-postgres` development dependency provides PostgreSQL 17 binaries; its platform-specific postinstall script creates required library symlinks. `pnpm-workspace.yaml` allows only the pinned native packages to run those scripts. If those scripts were previously blocked, run `pnpm --filter @ledger/api rebuild @embedded-postgres/darwin-arm64` on this Mac (use the matching platform package elsewhere). The transaction/transfer suites create a random temporary directory and ephemeral loopback port, starts the cluster, and removes it after closing its pool. It does not need Docker or a Supabase test URL. Sandboxed environments must permit local process execution/listeners. Root execution is intentionally unsupported; the tests never create system users.

Concurrency tests hold an account lock until two independent PostgreSQL sessions are observed waiting, then release both competing HTTP requests. Controlled insert failures verify that preceding balance updates roll back, and reconciliation compares each stored balance with its ledger sum. History tests also verify a read-only snapshot remains stable when a writer commits between the existence check and count/page reads.

## Transaction history

`GET /api/v1/accounts/:accountId/transactions` supports optional `type=credit|debit`, `page` (default 1), and `limit` (default 20, maximum 100). Results sort by creation time descending, then UUID descending, and include filtered pagination totals. Empty matches and out-of-range pages return empty data; unknown accounts return 404. Strict query validation runs before acquiring a client.

History uses a read-only REPEATABLE READ transaction so count and page rows share a snapshot during concurrent writes. Tests cover both filters, account isolation, all pagination boundaries, deterministic timestamp ties, invalid/repeated query fields, no matching rows, and a write committed while the history count is blocked. The frontend preserves server ordering, resets to page 1 on filter changes, cancels obsolete reads, and refetches history after accepted writes. See [API reference](docs/api-reference.md) for the complete contract.

## Account-to-account transfers

`POST /api/v1/transfers` atomically records one transfer, updates both balances, and appends linked debit/credit entries. It validates distinct account UUIDs and exact positive amounts, locks accounts in deterministic UUID order, rejects source/reference duplicates and ledger-reference collisions, and rolls everything back on insufficient funds, destination overflow, or any later failure. See [API reference](docs/api-reference.md) for request/response examples and precise duplicate semantics. Existing credit/debit/history contracts remain unchanged; linked movements already appear in account history.

`supabase/migrations/20261028050000_add_transfers.sql` is applied to the configured Supabase database. Verified-TLS deployment and 31 read-only checks confirmed schema, matching migration history, permissions and preserved existing data. Both applied migration files are untouched. Fresh databases must apply the full migration chain before using the endpoint. See [database setup](docs/database-setup.md) for deployment and recovery. The transfer UI uses this existing endpoint. Ignore microservice work until explicitly requested.

Verification passes 474 tests (156 contracts, 210 API, 108 frontend) and 24 browser tests, including 53 transfer integration tests and 42 new transfer contract tests. Native fixtures apply every migration in timestamp order. Transfer tests cover upgrades over existing rows, SQL constraints, all write-stage rollbacks, response-validation rollback, opposing transfers, duplicate concurrency, shared source funds, destination capacity and contention with standalone transactions. Each transfer test reconciles stored balances and correlated legs. No hosted ledger data is written by tests.

## Transfer UI and safe retry behavior

The account workspace stacks a separate transfer card below credit/debit controls. Its source UUID is fixed to the selected account; enter the destination UUID, amount and optional description, review the normalized details, then explicitly confirm. Reusable review/receipt components and the feature hook were tested before workspace integration. The UI uses shared contracts, existing monochrome controls and the existing API; no gateway/tokenization, authentication or microservice work was added.

The exact normalized command/reference is persisted before sending. An unavailable session store blocks sending, so reload protection is not silently lost. Pending writes cannot be double-submitted; reload restores unresolved commands without auto-sending. Network/timeout/5xx/invalid or mismatched responses remain unconfirmed. Retry preserves the exact command and reference. Both duplicate codes display a conflict rather than a success receipt; the command remains preserved until the user acknowledges reviewing the account before starting a new transfer.

Known rejection retains editable fields. Confirmed success, conflicts and balance-limit/funds errors refetch the source account/history, resetting history to page 1 while retaining its filter. Receipt balances are snapshots after the transfer; opening the destination performs fresh balance/history reads. Failed refreshes retain the completed receipt and mark the source balance as last confirmed. Retry balance/history performs reads only, never another write. Component/browser tests use isolated fixtures and never send test transfers to hosted Supabase.

Account navigation remembers the selected account for this browser tab after creation or verified lookup. Header/drawer show **Log out**, and landing CTAs show **My account** while selected. Log out clears only browser selection; enter the same **Account ID** to return to the saved ledger. It preserves unresolved financial retry commands and adds no authentication. Duplicate account names remain allowed; each account has its own unique ID. See active `assumption.md` §5.3 for the user-confirmed behavior.

Centralized errors use a strict four-field envelope (support_ticket_id, code, mapped message, action), a shared allowlisted catalog, typed domain errors and safe frontend recovery views. Original causes remain private; public responses contain no diagnostic details or stack traces. API and frontend must be updated together because the earlier details field is removed. Support IDs correlate internal diagnostics; they do not open tickets in an external service. See [API reference](docs/api-reference.md#errors) and [component contracts](docs/frontend-components.md#centralized-errors-2026-10-28).

Support-ID lookup, log retention limits and end-to-end review evidence are documented in [error handling](docs/error-handling.md). The current local development output is appended to ignored `logs/development.log`; HTTP failure IDs can be searched there directly. Browser-only IDs remain in browser diagnostics unless the development server forwards their console metadata.
