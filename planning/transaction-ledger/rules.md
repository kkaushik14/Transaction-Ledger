# Engineering Rules and Coding Standards

> Project: Transaction Ledger | Version: 0.1 (review draft) | Status: Proposed engineering rules
>
> Authority: The five-page **Full Stack Developer Assessment** defines mandatory functional behavior. The selected stack, frontend, architecture, naming conventions, and additional quality controls are project decisions. Where they differ, the assessment's functional requirements take precedence.

## 1. Purpose and scope

This file is the implementation rulebook for every contributor and coding agent. Follow it when adding, extending, refactoring, testing, documenting, or reviewing code. Read `assumption.md`, `design.md`, `schema.md`, `structure.md`, and `plan.md` before starting a new feature. Any intentional exception requires an explanation in the pull request or relevant documentation.

### Non-negotiable rules

1. **Do not compromise ledger integrity.** A transaction insert and its balance update must be in the same database transaction. A rejected request must not change either one.
2. **Use the agreed stack.** Frontend: React + Vite + TypeScript. Backend: Node.js + Express + TypeScript. Database: Supabase-hosted PostgreSQL.
3. **Keep code modular and understandable.** Separate routing, validation, controllers, domain services, repositories, and presentation components. Avoid massive files and hidden cross-module dependencies.
4. **Comments are mandatory.** Every new source file, new module, registered/mounted route, and non-obvious continuation of existing logic must contain useful, clear comments, as detailed below.
5. **Prettier is mandatory.** Maintain root `.prettierrc.json` and `.prettierignore`; run formatting before committing. ESLint and TypeScript checks must pass independently.
6. **No direct database access from the browser.** Only the Express backend may use PostgreSQL credentials. The React app communicates with the backend HTTP API.
7. **Do not use JavaScript floating-point calculations for money.** Use validated decimal strings at HTTP boundaries and PostgreSQL `NUMERIC(20,2)` arithmetic in the database.
8. **Do not introduce mutable transaction endpoints.** Never expose transaction update or delete routes.
9. **Validate untrusted inputs on the server** even if the browser also validates them.
10. **No secrets in source control.** Commit `.env.example` files with placeholder values, not real credentials.
11. **Tests are part of a finished feature.** Critical business rules need automated positive, negative, and concurrency tests.
12. **Build the required backend first.** The frontend is an additional project choice; it must not displace mandatory assessment features.

## 2. Source-file comment policy — mandatory

### 2.1 Required top-of-file/module documentation

Every hand-authored source file (`.ts`, `.tsx`, `.js`, `.css`, and SQL migrations where applicable) must start with a brief, **accurate, maintained** comment explaining:

- The file's responsibility and the module/feature to which it belongs.
- The key assumptions, important invariants, or expected side effects when relevant.
- The location of related logic if separation might otherwise be confusing.

Example for a TypeScript module:

```ts
/**
 * Transaction service.
 * Applies credit/debit rules and persists the ledger entry with the balance
 * update in one PostgreSQL transaction. Never call it outside the service layer.
 */
```

Example for a React component:

```tsx
/**
 * TransactionForm: collects a credit/debit request for the selected account.
 * The backend remains authoritative for validation and account balances.
 */
```

Example for SQL migration:

```sql
-- Creates the immutable API-facing transaction ledger and its account-scoped
-- reference uniqueness constraint. Apply before enabling transaction routes.
```

Exceptions: machine-generated artifacts, lockfiles, JSON configuration (JSON does not support comments), and files whose format cannot safely contain comments. Explain configuration intent in `rules.md` or adjacent documentation, not by inventing invalid JSON syntax.

### 2.2 New functions, classes, and route mounts

- Add a brief TSDoc/JSDoc comment to **each new exported function, class, hook, and nontrivial component**, stating its purpose and notable parameters or failure behavior.
- For **each newly registered or mounted Express router or middleware**, add a comment explaining the mount path and why the middleware runs in that order.
- Add a comment at transaction boundaries, row locks, duplicate handling, precision conversions, retries, and rollback paths. Explain **why** the code is written this way, not merely what the next line does.
- Comment significant SQL queries, especially `SELECT ... FOR UPDATE`, `UNIQUE` constraints, and write statements that must share a transaction client.
- When continuing or changing existing logic, add or update comments wherever new behavior, dependencies, side effects, or non-obvious decisions appear. A modification is **not exempt** because the file or module already exists.
- When extracting or moving code, move/update the relevant comments. Remove outdated comments at the same time as the code change.

Example of a useful continuation comment:

```ts
// Lock the account row before the duplicate check so concurrent requests for
// the same account cannot both pass validation and modify the balance.
```

### 2.3 Comment quality standard

Good comments are specific, concise, and factually correct. They should document intent, invariants, constraints, edge cases, and surprising design choices. Avoid comments that restate obvious syntax (for example, `// increment count`), misleading promises, stale TODOs, and commented-out implementation code. Use TODO comments only when they include a concrete next action and tracking reference if one exists.

**Review gate:** A source file lacking required documentation, or containing stale/inaccurate comments, is not ready for merge.

## 3. TypeScript and code organization rules

- Enable strict TypeScript (`strict: true`); prohibit implicit `any` and unchecked type assertions without explanation.
- Keep domain types and API contracts in `packages/contracts`; keep database-specific row types in the backend.
- Prefer explicit function return types for exported services, repositories, and shared utilities.
- Do not mix database queries into Express route handlers or React components.
- Controllers translate HTTP to services; services enforce business rules; repositories execute SQL; UI components render state and issue typed client requests.
- Prefer small, cohesive modules. Split files by responsibility rather than introducing arbitrary abstraction layers.
- Use dependency injection where it improves testability (for example, repositories or a database client passed into services), but do not add a heavyweight DI framework.
- Do not duplicate business-rule logic in the frontend. Browser validation improves usability but is never authoritative.
- Use `async`/`await`, parameterized SQL, and a single error-handling pipeline. Do not swallow exceptions.
- Avoid global mutable state except safe, process-level configuration and a single managed database pool.
- Prefer named exports for services and utilities; React components may use consistent named exports as well.

## 4. Naming and API conventions

| Element | Convention | Example |
| --- | --- | --- |
| File names | `kebab-case`, with feature/role suffix | `transactions.service.ts` |
| React components | `PascalCase` | `TransactionHistory.tsx` |
| Functions and variables | `camelCase` | `createTransaction` |
| Classes and types | `PascalCase` | `TransactionResult` |
| Constants | `UPPER_SNAKE_CASE` when truly constant | `MAX_PAGE_SIZE` |
| Database tables/columns | `snake_case` | `reference_id` |
| HTTP JSON keys | `snake_case` to match assessment | `account_id`, `created_at` |
| API paths | Lowercase, plural resources, versioned | `/api/v1/accounts` |
| Environment variables | `UPPER_SNAKE_CASE` | `DATABASE_URL` |
| Tests | Role-based `.test.ts` / `.test.tsx` | `transactions.integration.test.ts` |

Use `accountId` internally where idiomatic TypeScript, but serialize the API's `account_id` explicitly at its boundary.

## 5. Formatting and linting — enforced

- Use **Prettier at the workspace root**, with the provided `.prettierrc.json` and `.prettierignore`. Never create competing app-level Prettier configs.
- Root package scripts must include: `format`, `format:check`, `lint`, `typecheck`, `test`, and `build`; each script should target relevant workspaces.
- `format` runs `prettier --write .`; `format:check` runs `prettier --check .`.
- Use ESLint for correctness and style rules that Prettier does not handle; use `eslint-config-prettier` to avoid conflicting formatting rules.
- Format TS, TSX, JS, JSX, CSS, JSON, YAML, and Markdown where supported; exclude generated output and secrets with `.prettierignore`.
- All code and Markdown files must use UTF-8, LF line endings, two-space indentation where applicable, and a final newline.
- Do not manually format around Prettier. If formatting hurts legibility, refactor the code rather than inserting blanket ignore directives.
- Add a repository `.editorconfig` so editors agree on indentation, encoding, and line endings.
- Prefer running format checks, lint, typechecks, and tests in CI once CI is introduced.

## 6. Money and ledger correctness

- External monetary values are **decimal strings** (for example, `"50.00"`), not binary floating-point JSON numbers. This is an explicit project assumption, not a PDF-mandated wire format.
- Validate positive amounts and at most two fractional decimal places before reaching SQL.
- PostgreSQL `NUMERIC(20,2)` is the source of arithmetic truth. Treat `pg` numeric results as strings; do not silently convert them to JS `number`.
- Never allow clients to create accounts with a chosen balance; reject a supplied `balance` field.
- Only allow `credit` and `debit`. A debit must verify enough funds while holding the account lock.
- Enforce `UNIQUE (account_id, reference_id)` in PostgreSQL. The same reference is valid for different accounts.
- Return HTTP `409` on duplicate same-account references without creating a new entry or changing money.
- Execute balance update and ledger insertion through the **same acquired `pg` client** inside `BEGIN`/`COMMIT`; use `ROLLBACK` on failure and release the client in `finally`.
- Never call `pool.query()` for a statement that is part of an open per-client transaction.
- Read history sorted by `created_at DESC, id DESC` for a stable latest-first result.
- Keep transaction records append-only at the API layer; no update/delete transaction endpoints.

## 7. API and error-handling rules

- API prefix: `/api/v1`. Use JSON requests/responses and documented status codes.
- Implement one standardized error response shape: `{ "error": { "code": "...", "message": "...", "details": {} } }`.
- Use `201` for account/transaction creation, `200` for successful reads, `400` for invalid input, `404` for missing accounts, `409` for duplicates, and `422` for insufficient funds. Use `500` for unexpected failures without leaking secrets or SQL details.
- Validate URL params, body shape, permitted fields, pagination, and filter values. Unknown state-mutating fields should not silently take effect.
- Catch and map known PostgreSQL errors centrally. Log errors server-side with request context but omit passwords, database URLs, or other secrets.
- Return empty transaction arrays with valid pagination metadata when there are no matching records.
- Support `type=credit|debit`, `page`, and `limit` on history. Suggested default `page=1`, `limit=20`, maximum `limit=100`.

## 8. Frontend coding and accessibility rules

- Use React function components and hooks, with Vite and TypeScript.
- Group UI logic by feature; place reusable visual primitives in `components/ui` and typed HTTP adapters in `api`.
- All money displayed to the user must come from API decimal strings and should retain two fractional digits.
- Use semantic HTML, associated form labels, keyboard-accessible controls, and visible focus states.
- Provide explicit loading, empty, success, and error states; disable transaction submission while a request is pending.
- After successful mutation, refresh balance and history from the server. Do not permanently trust optimistic balance math.
- Store no database credentials, Supabase service-role keys, or other secrets in `VITE_*` variables. Only the public backend base URL belongs there.
- Frontend pages are an **added project requirement**; the assessment itself mandates backend functionality only.

## 9. Security and environment rules

- Keep the ledger tables in a private, non-Data-API-exposed PostgreSQL `ledger` schema and do not grant `anon`/`authenticated` access.
- Keep `DATABASE_URL` only in the Express server environment. Prefer a Supabase **direct or session-pooler** PostgreSQL connection for a persistent Express process, depending on network/IPv4 availability.
- Require TLS to the database. If full certificate verification is configured, do not disable it for convenience.
- Centralize env validation and crash early for missing required environment variables.
- Limit CORS to the configured frontend origin for development/deployment. CORS does not replace authentication.
- The assessment does not require authentication/authorization. Treat this as a single-user demo unless scope is expanded; do not deploy publicly for arbitrary users without an access-control decision.
- Use parameterized SQL everywhere. Do not expose stack traces or internal errors to browsers.
- Use a separate test database/project; tests that mutate money must never run on production data.

## 10. Definition of done for any module

- [ ] Requirements and assumptions are explicit and reflected in the correct `.md` file.
- [ ] File/module/route comments are present, crystal clear, accurate, and updated for continuations.
- [ ] Business logic and data access live in their prescribed layers.
- [ ] Input validation, expected errors, and boundary conditions are implemented.
- [ ] Appropriate automated tests cover success and failure paths.
- [ ] `format:check`, `lint`, `typecheck`, and relevant tests pass.
- [ ] No secrets, debug logging, or unused commented-out code are committed.
- [ ] API docs and README are updated if behavior or setup changed.

## 11. References and precedence

1. **Assessment PDF** (pages 1–5): mandatory ledger behaviors, technical flexibility, and submission deliverables.
2. **User project decisions**: React/Vite/TypeScript frontend, Express/Node/TypeScript backend, Supabase PostgreSQL, mandatory comments, maintainable project structure, and Prettier.
3. `assumption.md`: decisions not specified by the PDF.
4. `design.md`: API and architecture design; `schema.md`: database design; `structure.md`: file ownership; `plan.md`: implementation order.

Official implementation references:

- Supabase database connectivity: https://supabase.com/docs/guides/database/connecting-to-postgres
- Prettier configuration: https://prettier.io/docs/configuration
- Prettier installation and checks: https://prettier.io/docs/install
