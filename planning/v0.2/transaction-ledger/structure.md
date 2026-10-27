# Repository Structure and Module Ownership

> Project: Transaction Ledger | Version: 0.2 | Status: Component-first frontend implemented
>
> **Structure specification:** The v0.2 frontend ownership and component hierarchy below are implemented. Optional/bonus tree entries remain illustrative and unimplemented. Root `AGENT.md` selects the active planning version and records scope; code, `docs/frontend-components.md` and `docs/api-reference.md` describe delivered behavior. The six active planning documents live together under `planning/v0.2/transaction-ledger/`; retained v0.1 files remain under `planning/transaction-ledger/`. Do not create duplicate root planning files.

## 1. Structural decisions

- One simple **pnpm workspace monorepo**: readable, no Turborepo requirement.
- Frontend in `apps/web` (React + Vite + TypeScript), organized **component-first** into UI primitives, site shell, landing sections, domain features and thin pages.
- One monochrome CSS token system drives desktop, tablet and mobile layouts; the site shell switches between desktop navbar and tablet/mobile collapsible sidebar.
- Backend in `apps/api` (Express + Node.js + TypeScript).
- Reusable API schemas/types in `packages/contracts` (no React or Express imports).
- Supabase CLI database configuration/migrations in `supabase/`.
- Root AGENT.md selects the active planning set; specialized planning documents remain in their versioned directory.
- Each feature owns its routes/controller/service/repository on the backend and its components/hooks on the frontend.

## 2. Repository ownership tree

```text
transaction-ledger/
├── AGENT.md                       # Sole root guide: active version, scope, document routing
├── planning/
│   ├── transaction-ledger/        # Retained v0.1 planning and delivery notes
│   └── v0.2/transaction-ledger/   # Active six-document planning set and archived configs
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
│   ├── api-reference.md           # API contract documentation
│   ├── database-setup.md          # Migration/TLS verification and local setup
│   └── frontend-components.md     # Component contracts, state boundaries and QA
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
│       ├── vitest.config.ts       # Component tests in jsdom
│       ├── playwright.config.ts   # Isolated browser QA
│       ├── e2e/                   # Browser specs, local API fixture and teardown
│       ├── vite.config.ts
│       ├── index.html
│       ├── .env.example            # VITE_API_BASE_URL only
│       ├── src/
│       │   ├── main.tsx            # React bootstrap
│       │   ├── App.tsx             # Router wiring, not page content
│       │   ├── app/
│       │   │   └── routes.tsx      # Home, account and not-found routes
│       │   ├── api/
│       │   │   ├── client.ts       # Typed fetch and standard API errors
│       │   │   ├── accounts.api.ts
│       │   │   └── transactions.api.ts
│       │   ├── hooks/             # useRemoteResource.ts: cancel/ignore obsolete reads
│       │   ├── components/
│       │   │   ├── ui/             # BUILD FIRST: reusable, domain-agnostic
│       │   │   │   ├── Button.tsx
│       │   │   │   ├── IconButton.tsx
│       │   │   │   ├── TextField.tsx
│       │   │   │   ├── TextAreaField.tsx
│       │   │   │   ├── SelectField.tsx
│       │   │   │   ├── Card.tsx
│       │   │   │   ├── Container.tsx
│       │   │   │   ├── SectionHeading.tsx
│       │   │   │   ├── StatusMessage.tsx
│       │   │   │   ├── LoadingState.tsx
│       │   │   │   └── Pagination.tsx
│       │   │   ├── layout/         # BUILD SECOND: site-wide shell
│       │   │   │   ├── AppShell.tsx
│       │   │   │   ├── SiteHeader.tsx
│       │   │   │   ├── DesktopNav.tsx
│       │   │   │   ├── ResponsiveSidebar.tsx
│       │   │   │   └── SiteFooter.tsx
│       │   │   └── landing/        # BUILD THIRD: composed sections
│       │   │       ├── HeroSection.tsx
│       │   │       ├── FeatureGrid.tsx
│       │   │       ├── HowItWorksSection.tsx
│       │   │       ├── LedgerPrinciplesSection.tsx
│       │   │       ├── GetStartedSection.tsx
│       │   │       └── FinalCtaSection.tsx
│       │   ├── features/           # BUILD THIRD: ledger domain UI
│       │   │   ├── accounts/
│       │   │   │   ├── components/
│       │   │   │   │   ├── AccountCreateForm.tsx
│       │   │   │   │   ├── AccountLookupForm.tsx
│       │   │   │   │   ├── AccountBalanceCard.tsx
│       │   │   │   │   ├── AccountPageHeader.tsx
│       │   │   │   │   └── AccountWorkspace.tsx
│       │   │   │   └── hooks/
│       │   │   │       └── useAccount.ts
│       │   │   └── transactions/
│       │   │       ├── components/
│       │   │       │   ├── TransactionForm.tsx
│       │   │       │   └── TransactionHistory.tsx
│       │   │       └── hooks/
│       │   │           ├── useTransactions.ts
│       │   │           ├── useTransactionIntent.ts
│       │   │           └── transaction-intent.ts
│       │   ├── pages/              # BUILD LAST: composition only
│       │   │   ├── HomePage.tsx
│       │   │   ├── AccountPage.tsx
│       │   │   └── NotFoundPage.tsx
│       │   └── styles/
│       │       ├── tokens.css     # All grayscale/typography/spacing tokens
│       │       ├── global.css     # Reset, type, focus and semantics
│       │       └── layout.css     # Responsive shells and breakpoint rules
│       │       # Component CSS Modules live beside owning .tsx files.
│       └── tests/
│           ├── setup.ts / fixtures.ts
│           ├── primitives.test.tsx
│           ├── navigation.test.tsx
│           ├── account-features.test.tsx
│           ├── transaction-features.test.tsx
│           ├── resource-hooks.test.tsx
│           ├── landing-sections.test.tsx
│           └── pages.test.tsx
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

`[IMPLEMENT]` labels in the original tree describe ownership, not pending work; inspect existing files before creating anything. The approved frontend is implemented; `[BONUS ONLY]` remains excluded. Generated files follow their tool's native format and are exempt from artificial source-file header comments.

Additional implemented frontend modules: `components/ui/Icon.tsx`, `components/layout/navigation.ts`, `features/accounts/components/AccountPageHeader.tsx` and `AccountWorkspace.tsx`, `hooks/useRemoteResource.ts`, and `features/transactions/hooks/useTransactionIntent.ts` plus `transaction-intent.ts`. Component CSS Modules live beside their owners. `tsconfig.test.json` and `vitest.config.ts` configure isolated component tests; `playwright.config.ts` and `e2e/` own browser QA and the disposable local API/database fixture. See `docs/frontend-components.md` for state contracts and verification evidence.

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
  -> `AppShell` and reusable components
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

| File or group                 | Owner responsibility                            | Key comment requirement                         |
| ----------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `main.ts`                     | Initialize server, error reporting, shutdown    | Explain startup/shutdown lifecycle              |
| `app.ts`                      | Mount global middleware and API routers         | Comment each mount path and middleware ordering |
| `config/env.ts`               | Validate env and typed config                   | Explain which variables are secret and required |
| `db/pool.ts`                  | Create only one managed pool                    | Explain session/direct URI, TLS, pool limit     |
| `db/transaction.ts`           | Reuse one client across DB transaction          | Explain rollback and release guarantees         |
| `accounts.routes.ts`          | Create/balance routes                           | Comment route-level validation and URLs         |
| `accounts.controller.ts`      | Request/response adapter                        | Document exported handler behavior              |
| `accounts.service.ts`         | Enforce zero initial balance and account lookup | Explain trusted server-side fields              |
| `accounts.repository.ts`      | Account queries only                            | Describe important SQL constraints              |
| `transactions.routes.ts`      | Add/history routes                              | Explain route params and validation             |
| `transactions.controller.ts`  | HTTP mapping to domain service                  | Document public error results                   |
| `transactions.service.ts`     | Atomic credit/debit algorithm                   | Explain row locking, duplicate check, rollback  |
| `transactions.repository.ts`  | Parameterized ledger SQL and history            | Explain account-scoped uniqueness and ordering  |
| `middleware/error-handler.ts` | Standard error schema                           | Explain intentionally hidden server details     |

**Dependency rule:** Repository modules do not import controllers or UI code. Controllers do not call SQL directly. `transactions.service.ts` may use account and transaction repositories, but must own the single transaction boundary for a credit/debit operation.

## 5. Frontend ownership and component-first workflow

| File or group                             | Responsibility                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `styles/tokens.css`                       | Authoritative grayscale colors, contrast, type, spacing, radius and size tokens                   |
| `styles/global.css`, `styles/layout.css`  | Reset, semantic focus styles, layout primitives and centralized breakpoints                       |
| `components/ui/*`                         | Domain-agnostic buttons, fields, cards, feedback, pagination and layout primitives                |
| `components/layout/AppShell.tsx`          | Shared header/main/footer composition and skip link                                               |
| `components/layout/SiteHeader.tsx`        | Logo/brand mark, desktop nav or tablet/mobile menu trigger, header CTA                            |
| `components/layout/DesktopNav.tsx`        | Horizontal nav rendered only for desktop breakpoint                                               |
| `components/layout/ResponsiveSidebar.tsx` | Accessible collapsible drawer for tablet/mobile, focus management, overlay, Escape and link close |
| `components/layout/SiteFooter.tsx`        | Product identity and real working navigation/footer links                                         |
| `components/landing/*`                    | Hero, feature cards, steps, ledger principles, get-started and final CTA sections                 |
| `features/accounts/components/*`          | Create/lookup forms and balance card; reuse primitives instead of duplicating inputs              |
| `features/accounts/hooks/*`               | Account fetch/mutation state and data refresh                                                     |
| `features/transactions/components/*`      | Credit/debit form and responsive filtered history                                                 |
| `features/transactions/hooks/*`           | Transaction calls, pending/reference lifecycle and history refetch                                |
| `api/client.ts`, `api/*.api.ts`           | Typed HTTP transport; no React view concerns                                                      |
| `pages/*`                                 | Compose completed sections/features inside shell; minimal presentation logic                      |
| `app/routes.tsx`                          | Map `/`, `/accounts/:accountId`, and not-found states                                             |
| `tests/*`                                 | Primitive interactions, drawer accessibility, CTA destinations, forms and page composition        |

### Required component construction sequence

```text
styles/tokens.css + styles/global.css + styles/layout.css
             |
             v
components/ui/*                 (primitives tested independently)
             |
             v
components/layout/*             (desktop navbar + tablet/mobile drawer)
             |
             +------------------------------+
             v                              v
components/landing/*              features/accounts/* and
                                  features/transactions/*
             |                              |
             +------------------------------+
                            |
                            v
                    pages/* + routes.tsx
                            |
                            v
                responsive + end-to-end QA
```

The code must build **complete components before complete pages**. Each new component has a documented typed props contract, clear header/TSDoc comments, token-driven styles, responsive behavior, keyboard semantics, defined states and focused tests for meaningful behavior. Sections may use data arrays for repeated cards; do not duplicate primitive source code or styling in different pages.

### Navigation, CTA and page composition contracts

- `/` assembles a landing page with `HeroSection`, `FeatureGrid` (`#features`), `HowItWorksSection` (`#how-it-works`), `LedgerPrinciplesSection`, `GetStartedSection` (`#get-started`), and `FinalCtaSection`.
- `/accounts/:accountId` composes `AccountBalanceCard`, `TransactionForm` and `TransactionHistory` in `AppShell`; use a readable two-column layout when there is room and a stacked layout when there is not.
- The shared `SiteHeader` displays `DesktopNav` at >=1024px; `ResponsiveSidebar` at <1024px. The two modes must not both be displayed. Close/reset drawer on desktop transition.
- Every CTA and navigation/footer link must point to an implemented section or route. An account can be opened by UUID; do not assume an account-list route exists.
- Provide consistent, useful comments at the top of each authored TSX/CSS module and where transitions, accessibility constraints, retries or API integration would otherwise be confusing.
- Use semantic HTML, readable black/white/gray contrast, focus indication, proper labels and recovery states. Verify 320, 375, 768, 1024 and 1440px.

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

| Script              | Expected operation                                      |
| ------------------- | ------------------------------------------------------- |
| `pnpm dev`          | Launch API and web in development mode                  |
| `pnpm dev:api`      | Launch API only                                         |
| `pnpm dev:web`      | Launch web only                                         |
| `pnpm build`        | Build contracts, API, web in correct dependency order   |
| `pnpm format`       | Run `prettier --write .`                                |
| `pnpm format:check` | Run `prettier --check .`                                |
| `pnpm lint`         | Run ESLint over supported sources                       |
| `pnpm typecheck`    | Strict TypeScript verification                          |
| `pnpm test`         | Unit/integration/component tests using test-safe config |

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

Root `.prettierrc.json` is the **only** Prettier configuration. Root `.editorconfig` provides editor-neutral formatting defaults. The active `rules.md` selected by root `AGENT.md` defines the comment policy.

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

To add a new **backend** feature, first extend a contract, then add its route/controller/service/repository under one feature folder, register it with a commented mount, add tests, and update `design.md` and API docs. For a new **frontend** feature, first define component contracts and update tokens/primitives when needed; add domain feature components/hooks and typed API adapters, verify components in isolation, then compose them in a page rather than placing all logic in `App.tsx`. For landing changes, extend `components/landing` and keep the shared header/footer/navigation in `components/layout`. For a **database** change, create a new versioned migration; never rewrite an already-applied remote migration.

If a module is modified rather than created, update its existing comments and tests. Do not create duplicate `utils.ts` files to avoid thinking about ownership. Keep implementation composable, intentionally minimal, and easy for another engineer to follow.

## 10. Dependency/ownership checklist

- [ ] The correct feature folder owns each new file.
- [ ] TypeScript contracts are shared without leaking server-only dependencies.
- [ ] HTTP handlers contain no inline SQL.
- [ ] DB writes use `pg` on the server, not browser Supabase clients.
- [ ] Source/module/route/continuation comments comply with `rules.md`.
- [ ] UI features use `components/ui`, `components/layout`, `components/landing`, and domain components in that order without repeated control implementations.
- [ ] Responsive navigation, hero CTA, footer, landing anchors and account page compositions match `design.md`.
- [ ] Prettier, ESLint, strict TS, and tests run at the workspace root.
- [ ] Every new migration is timestamped, reviewed, and tested.
- [ ] README and API docs remain synchronized with actual commands and paths.

**Cross-references:** `rules.md`, `assumption.md`, `design.md`, `schema.md`, `plan.md`.
