# Repository Structure and Module Ownership

> Project: Transaction Ledger | Version: 0.1 (review draft) | Status: Proposed file layout
>
> **Structure specification only:** the repository tree below is the intended implementation layout. The documentation pack currently contains the six requested Markdown files and formatting configuration; the application files shown below are not claimed to exist yet.

## 1. Structural decisions

- One simple **pnpm workspace monorepo**: readable, no Turborepo requirement.
- Frontend in `apps/web` (React + Vite + TypeScript).
- Backend in `apps/api` (Express + Node.js + TypeScript).
- Reusable API schemas/types in `packages/contracts` (no React or Express imports).
- Supabase CLI database configuration/migrations in `supabase/`.
- Cross-cutting project rules and planning documents at the root.
- Each feature owns its routes/controller/service/repository on the backend and its components/hooks on the frontend.

## 2. Proposed repository tree

```text
transaction-ledger/
├── rules.md                       # Mandatory coding/comment/formatting rules
├── assumption.md                  # Explicit assumptions and undecided scope
├── design.md                      # Architecture, data flow, API contracts, UX
├── schema.md                      # PostgreSQL schema, migration and integrity plan
├── structure.md                   # This file; module/file ownership
├── plan.md                        # Staged execution, acceptance and checkpoints
├── README.md                      # [IMPLEMENT] Setup, local run, tests, submission
├── package.json                   # [IMPLEMENT] Root workspace scripts/tooling
├── pnpm-workspace.yaml            # [IMPLEMENT] apps/* and packages/* membership
├── pnpm-lock.yaml                 # [GENERATED] Locked dependencies
├── tsconfig.base.json             # [IMPLEMENT] Shared TypeScript options
├── eslint.config.mjs              # [IMPLEMENT] Shared ESLint rules
├── .prettierrc.json               # PROVIDED with documentation: Prettier style
├── .prettierignore                # PROVIDED with documentation: format exclusions
├── .editorconfig                  # PROVIDED with documentation: editor defaults
├── .gitignore                     # [IMPLEMENT] secrets, build, local Supabase state
├── docs/
│   └── api-reference.md           # [IMPLEMENT] API submission documentation
├── apps/
│   ├── api/
│   │   ├── package.json           # Express, pg, Zod, testing dependencies
│   │   ├── tsconfig.json          # Node-targeted strict TypeScript configuration
│   │   ├── .env.example           # DATABASE_URL, PORT, WEB_ORIGIN, NODE_ENV
│   │   ├── src/
│   │   │   ├── main.ts             # Start HTTP server; graceful shutdown
│   │   │   ├── app.ts              # Express factory and commented router mounts
│   │   │   ├── config/
│   │   │   │   └── env.ts          # Validate/process env and fail fast
│   │   │   ├── db/
│   │   │   │   ├── pool.ts         # Single managed PostgreSQL pg.Pool
│   │   │   │   └── transaction.ts  # BEGIN/COMMIT/ROLLBACK helper using one client
│   │   │   ├── errors/
│   │   │   │   └── api-error.ts    # Typed domain errors and error codes
│   │   │   ├── middleware/
│   │   │   │   ├── validate.ts     # Parse strict params/query/body schemas
│   │   │   │   ├── error-handler.ts# Consistent HTTP-safe error mapping
│   │   │   │   └── request-id.ts   # Request correlation (optional)
│   │   │   ├── modules/
│   │   │   │   ├── accounts/
│   │   │   │   │   ├── accounts.routes.ts
│   │   │   │   │   ├── accounts.controller.ts
│   │   │   │   │   ├── accounts.service.ts
│   │   │   │   │   └── accounts.repository.ts
│   │   │   │   ├── transactions/
│   │   │   │   │   ├── transactions.routes.ts
│   │   │   │   │   ├── transactions.controller.ts
│   │   │   │   │   ├── transactions.service.ts
│   │   │   │   │   └── transactions.repository.ts
│   │   │   │   └── transfers/      # [BONUS ONLY, create later]
│   │   │   │       ├── transfers.routes.ts
│   │   │   │       ├── transfers.controller.ts
│   │   │   │       ├── transfers.service.ts
│   │   │   │       └── transfers.repository.ts
│   │   │   └── types/             # Backend-only helper types if necessary
│   │   └── tests/
│   │       ├── integration/
│   │       │   ├── accounts.integration.test.ts
│   │       │   ├── transactions.integration.test.ts
│   │       │   └── concurrency.integration.test.ts
│   │       └── unit/
│   │           └── validation.test.ts
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── .env.example           # VITE_API_BASE_URL only
│       ├── src/
│       │   ├── main.tsx            # React bootstrap
│       │   ├── App.tsx             # Application composition and routing
│       │   ├── app/
│       │   │   └── routes.tsx      # Home/account screens
│       │   ├── api/
│       │   │   ├── client.ts       # Typed fetch + standardized API errors
│       │   │   ├── accounts.api.ts
│       │   │   └── transactions.api.ts
│       │   ├── components/
│       │   │   └── ui/
│       │   │       ├── ErrorNotice.tsx
│       │   │       └── LoadingState.tsx
│       │   ├── features/
│       │   │   ├── accounts/
│       │   │   │   ├── AccountCreateForm.tsx
│       │   │   │   ├── AccountLookupForm.tsx
│       │   │   │   ├── AccountBalanceCard.tsx
│       │   │   │   └── useAccount.ts
│       │   │   └── transactions/
│       │   │       ├── TransactionForm.tsx
│       │   │       ├── TransactionHistory.tsx
│       │   │       └── useTransactions.ts
│       │   ├── pages/
│       │   │   ├── HomePage.tsx
│       │   │   └── AccountPage.tsx
│       │   └── styles/
│       │       ├── tokens.css     # Customizable design tokens
│       │       └── global.css     # Reset, typography, layout
│       └── tests/
│           ├── TransactionForm.test.tsx
│           └── TransactionHistory.test.tsx
├── packages/
│   └── contracts/
│       ├── package.json           # @ledger/contracts package
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # Explicit public exports
│           ├── accounts.contract.ts
│           ├── transactions.contract.ts
│           └── errors.contract.ts
└── supabase/
    ├── config.toml               # [IMPLEMENT] Supabase CLI local config
    ├── migrations/
    │   ├── <timestamp>_create_ledger.sql
    │   └── <timestamp>_add_transfers.sql  # [BONUS ONLY]
    └── seed.sql                  # [OPTIONAL] Non-production dev fixture data
```

`[IMPLEMENT]` means create during the engineering phases in `plan.md`; `[BONUS ONLY]` must not be generated in the mandatory baseline. Generated files follow their tool's native format and are exempt from artificial source-file header comments.

## 3. How modules fit together

### Backend request path

```text
HTTP request
  -> `app.ts` router mount
  -> `*.routes.ts` (route-level middleware)
  -> `validate.ts` (contract schema)
  -> `*.controller.ts` (HTTP adapter)
  -> `*.service.ts` (domain rules + transaction boundary)
  -> `*.repository.ts` (parameterized SQL)
  -> `db/pool.ts` or `db/transaction.ts`
  -> Supabase PostgreSQL, private `ledger` schema
```

### Frontend request path

```text
`HomePage` / `AccountPage`
  -> feature component/hook
  -> `api/*.api.ts` (typed endpoints)
  -> `api/client.ts` (fetch and standard errors)
  -> Express `/api/v1/...`
  -> state refresh
  -> view rerender
```

### Shared contracts

`packages/contracts` exports request parsers, public DTOs, pagination metadata, and error shapes. Browser and backend import the **same stable public contract** where possible; only the backend performs authoritative validation and error mapping. The shared package must not import server secrets, `pg`, Express, or React.

## 4. Backend file responsibilities

| File or group | Owner responsibility | Key comment requirement |
| --- | --- | --- |
| `main.ts` | Initialize server, error reporting, shutdown | Explain startup/shutdown lifecycle |
| `app.ts` | Mount global middleware and API routers | Comment each mount path and middleware ordering |
| `config/env.ts` | Validate env and typed config | Explain which variables are secret and required |
| `db/pool.ts` | Create only one managed pool | Explain session/direct URI, TLS, pool limit |
| `db/transaction.ts` | Reuse one client across DB transaction | Explain rollback and release guarantees |
| `accounts.routes.ts` | Create/balance routes | Comment route-level validation and URLs |
| `accounts.controller.ts` | Request/response adapter | Document exported handler behavior |
| `accounts.service.ts` | Enforce zero initial balance and account lookup | Explain trusted server-side fields |
| `accounts.repository.ts` | Account queries only | Describe important SQL constraints |
| `transactions.routes.ts` | Add/history routes | Explain route params and validation |
| `transactions.controller.ts` | HTTP mapping to domain service | Document public error results |
| `transactions.service.ts` | Atomic credit/debit algorithm | Explain row locking, duplicate check, rollback |
| `transactions.repository.ts` | Parameterized ledger SQL and history | Explain account-scoped uniqueness and ordering |
| `middleware/error-handler.ts` | Standard error schema | Explain intentionally hidden server details |

**Dependency rule:** Repository modules do not import controllers or UI code. Controllers do not call SQL directly. `transactions.service.ts` may use account and transaction repositories, but must own the single transaction boundary for a credit/debit operation.

## 5. Frontend file responsibilities

| File or group | Responsibility |
| --- | --- |
| `api/client.ts` | One fetch wrapper, base URL, status/error decoding |
| `api/accounts.api.ts` | Account creation and balance retrieval HTTP calls |
| `api/transactions.api.ts` | New transaction and history HTTP calls |
| `features/accounts/*` | Create/lookup account forms, balance card, account fetch state |
| `features/transactions/*` | Type selection, amount entry, reference lifecycle, filtered history |
| `pages/*` | Page composition and routing, no raw fetch duplication |
| `styles/tokens.css` | Central design settings to make UI customizable |
| `styles/global.css` | Global defaults, resets, responsive utility styling |
| `tests/*` | Component behavior and UI error states |

Use semantic forms, clear labels, accessible error feedback, and a mobile-friendly layout. Do not import database drivers or Supabase credentials into the frontend workspace.

## 6. Workspace/tooling choices

### Package management

Use `pnpm` with workspaces (`apps/*`, `packages/*`). One root lockfile ensures reproducible dependency versions. Package name suggestion: `@ledger/api`, `@ledger/web`, and `@ledger/contracts`.

### TypeScript build rules

- Backend: Node-compatible ESM, strict mode; choose a consistent NodeNext/relative import convention, document it in `tsconfig`, and ensure built server files run with Node.
- Frontend: Vite-compatible TypeScript module resolution and TSX.
- Contracts: no Node-specific implementation APIs; build declarations/JavaScript so both workspaces resolve the same package.
- Root build should build shared contracts before dependent workspaces.
- Avoid adding undocumented aliases. If aliases are needed, configure them in both TypeScript and the runtime/bundler.

### Required root scripts (to implement)

| Script | Expected operation |
| --- | --- |
| `pnpm dev` | Launch API and web in development mode |
| `pnpm dev:api` | Launch API only |
| `pnpm dev:web` | Launch web only |
| `pnpm build` | Build contracts, API, web in correct dependency order |
| `pnpm format` | Run `prettier --write .` |
| `pnpm format:check` | Run `prettier --check .` |
| `pnpm lint` | Run ESLint over supported sources |
| `pnpm typecheck` | Strict TypeScript verification |
| `pnpm test` | Unit/integration/component tests using test-safe config |

Use `tsx` for straightforward API development execution and an explicit production build output. Use `vitest` + `supertest` for backend testing, and React Testing Library for the UI if testing dependencies are added.

## 7. Environment files and ownership

**`apps/api/.env.example`** (illustrative placeholders only):

```dotenv
# PostgreSQL connection string provided by the intended Supabase project.
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require

# Express port and allowed browser origin for development.
PORT=3000
WEB_ORIGIN=http://localhost:5173
NODE_ENV=development
```

**`apps/web/.env.example`:**

```dotenv
# Public Express API URL; never put a database password or secret here.
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

The root `.gitignore` must ignore actual `.env` and `.env.*` secrets while allowing `.env.example`, plus generated output (`node_modules/`, `dist/`, `coverage/`, `.supabase`/local Supabase artifacts as appropriate). The supplied `.prettierignore` separately excludes generated files from formatting. Do not assume the existence of working secrets in the documentation package.

## 8. Prettier and comments placement

Root `.prettierrc.json` is the **only** Prettier configuration. Root `.editorconfig` provides editor-neutral formatting defaults. Root `rules.md` is the authoritative comment policy.

Required source comment pattern:

1. Start each hand-authored source file with a concise `/** ... */` explanation (SQL/CSS use native comments).
2. Comment new route mounts and middleware order in `app.ts` and each feature route file.
3. Document exported functions/classes/components and public failure behavior.
4. Document non-obvious continuation changes in an existing module.
5. Clearly explain locking, uniqueness, exact-money arithmetic, and rollback at the implementation point.
6. Keep comments updated after refactors; avoid redundant or inaccurate boilerplate.

**Example new router mount:**

```ts
// Mount account creation and balance reads under the public API version prefix.
// Request validation lives in the feature router; domain writes live in services.
app.use('/api/v1/accounts', accountsRouter);
```

A tiny DTO/interface may need only the file-level and exported-symbol comments if its intent is obvious; comments should inform readers, not create distracting noise.

## 9. Extending the project without structural erosion

To add a new **backend** feature, first extend a contract, then add its route/controller/service/repository under one feature folder, register it with a commented mount, add tests, and update `design.md` and API docs. For a new **frontend** feature, add a feature folder and typed API adapter, then compose it from a page rather than placing all logic in `App.tsx`. For a **database** change, create a new versioned migration; never rewrite an already-applied remote migration.

If a module is modified rather than created, update its existing comments and tests. Do not create duplicate `utils.ts` files to avoid thinking about ownership. Keep implementation composable, intentionally minimal, and easy for another engineer to follow.

## 10. Dependency/ownership checklist

- [ ] The correct feature folder owns each new file.
- [ ] TypeScript contracts are shared without leaking server-only dependencies.
- [ ] HTTP handlers contain no inline SQL.
- [ ] DB writes use `pg` on the server, not browser Supabase clients.
- [ ] Source/module/route/continuation comments comply with `rules.md`.
- [ ] Prettier, ESLint, strict TS, and tests run at the workspace root.
- [ ] Every new migration is timestamped, reviewed, and tested.
- [ ] README and API docs remain synchronized with actual commands and paths.

**Cross-references:** `rules.md`, `assumption.md`, `design.md`, `schema.md`, `plan.md`.
