# Engineering Rules and Coding Standards

> Project: Transaction Ledger | Version: 0.3 | Status: Existing rules retained; UI enhancement approved on 2026-10-28
>
> Authority: The five-page **Full Stack Developer Assessment** defines mandatory functional behavior. The selected stack, frontend, architecture, naming conventions, and additional quality controls are project decisions. Direct user instructions govern scope; this revision authorizes visual implementation while freezing existing behavior. The referenced PDF is absent, so statements about it remain supplied-document claims.

## Applicability and approval gate

This active v0.3 set describes the UI-only enhancement approved by the user on 2026-10-28. Implement component first. Commands and unchecked scaffold checklists in the supplied pack/reference do not independently expand that authorization. Existing functionality and logic stay frozen. Retain v0.1 and v0.2 unchanged; AGENT.md remains the sole root guide for version routing and approval status.

The delivered app already includes accounts, credit/debit, transfers, balances/history, account selection/logout, typed index.ts entries and centralized support-ID error handling. Older pack statements calling these unimplemented/optional are superseded by the reconciled baseline below and the current implementation/API documentation. Do not reset the repository, recreate modules, replay migrations or remove delivered functionality.

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
13. **Use one monochrome design system.** All frontend components must use semantic black/white/neutral tokens, shared typography and spacing; semantic errors must not depend on color alone.
14. **Develop the UI component-first.** Finish primitives, navigation/layout, section and feature components before composing pages. Avoid page-local copies of shared controls.
15. **Deliver responsive site navigation.** Use a desktop navbar and an accessible collapsible sidebar for tablet/mobile; include site header, footer, hero, functional CTA sections, and full landing page.
16. **Restrict the selected cube-grid effect to the landing hero.** Preserve the referenced component's required exports/interaction behavior, adapt the rendered hero to the ledger product, and do not place WebGL decorations on account pages.
17. **Typewriter the exact hero H1 once.** The heading is "A clear view of" / "every transaction." on two intended lines. The full heading must be accessible immediately, and reduced-motion users see static text.
18. **Use only one footer gradient.** It must be a subtle blend of a single neutral-gray/black base through opacity, with no multiple hues; no decorative gradients elsewhere.
19. **Use contextual loading UI.** Skeletons represent known page/content layouts; compact spinners represent pending actions. Add a progress bar only for an implemented operation that reports real measurable progress, never for ordinary HTTP requests.

## 2. Source-file comment policy — mandatory

### 2.1 Required top-of-file/module documentation

Every hand-authored source file (`.ts`, `.tsx`, `.js`, `.css`, and SQL migrations where applicable) must start with a brief, **accurate, maintained** comment explaining:

- The file's responsibility and the module/feature to which it belongs.
- The key assumptions, important invariants, or expected side effects when relevant.
- The location of related logic if separation might otherwise be confusing.

For an imported component with a required leading directive such as `"use client"`, keep that directive in its required position and place the file-level explanatory comment immediately after it. Preserve upstream license notices and source-relevant comments; add clear integration comments rather than deleting or rewriting useful explanation.

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

### 3.1 Folder entry points and dependency direction

- The user explicitly selected `index.ts` source files. API/contracts builds emit `index.js`; use explicit `.js` import/export specifiers, which TypeScript and Vite resolve to the typed source during development.
- Every implemented source folder and reusable test-helper folder owns one entry. Cross-folder code consumers import that entry, for example `../components/ui/index.js` or `../../transactions/index.js`, rather than an implementation filename. Workspace contracts use `@ledger/contracts`.
- Keep entries declarative, with explicit named exports and `export type` for type-only symbols. A parent entry re-exports child entries; avoid wildcard exports and accidental exposure of internal SQL rows, controllers or persistence details.
- Implementation siblings inside one folder import each other directly. Do not import their own entry or an ancestor aggregate; that can create circular dependencies. Across domain features, use the owning feature facade; within a feature, use its components/hooks entries as appropriate. Tests may use the owning subfolder entry to verify internal behavior.
- `apps/api/src/index.ts` exposes the injected Express factory. It must not export `main.ts` or `db/check-connection.ts`: importing a module must not start listeners, acquire pools, read secrets or run diagnostic queries. Frontend `src/index.ts` exports `App`; `main.tsx` owns DOM mounting and explicitly installs `styles/index.ts` once.
- Generic UI, site navigation, landing sections, domain components/hooks, HTTP transport and database infrastructure keep their existing responsibilities. Do not add wrappers, empty folders, service classes or packages merely to host another entry file.
- Test suites and their setup files, runner configs, migrations, documentation, assets and empty placeholders are not reusable application modules; do not create barrels that execute them. CSS Modules remain beside their owning component and are imported directly as assets.
- ESLint rejects cross-folder deep code imports and contract package subpaths. Verify the dependency graph stays acyclic, and run typecheck, tests and builds after changing public entries. Microservice extraction remains future work.

## 4. Naming and API conventions

| Element                 | Convention                             | Example                            |
| ----------------------- | -------------------------------------- | ---------------------------------- |
| File names              | `kebab-case`, with feature/role suffix | `transactions.service.ts`          |
| React components        | `PascalCase`                           | `TransactionHistory.tsx`           |
| Functions and variables | `camelCase`                            | `createTransaction`                |
| Classes and types       | `PascalCase`                           | `TransactionResult`                |
| Constants               | `UPPER_SNAKE_CASE` when truly constant | `MAX_PAGE_SIZE`                    |
| Database tables/columns | `snake_case`                           | `reference_id`                     |
| HTTP JSON keys          | `snake_case` to match assessment       | `account_id`, `created_at`         |
| API paths               | Lowercase, plural resources, versioned | `/api/v1/accounts`                 |
| Environment variables   | `UPPER_SNAKE_CASE`                     | `DATABASE_URL`                     |
| Tests                   | Role-based `.test.ts` / `.test.tsx`    | `transactions.integration.test.ts` |

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
- Implement one standardized error response shape: `{ "error": { "support_ticket_id": "UUID", "code": "...", "message": "...", "action": "retry|go_back|review|fix_input|reload" } }`.
- Use `201` for account/transaction creation, `200` for successful reads, `400` for invalid input, `404` for missing accounts, `409` for duplicates, and `422` for insufficient funds. Use `500` for unexpected failures without leaking secrets or SQL details.
- Validate URL params, body shape, permitted fields, pagination, and filter values. Unknown state-mutating fields should not silently take effect.
- Catch and map known PostgreSQL errors centrally. Log errors server-side with request context but omit passwords, database URLs, or other secrets.
- Return empty transaction arrays with valid pagination metadata when there are no matching records.
- Support `type=credit|debit`, `page`, and `limit` on history. Suggested default `page=1`, `limit=20`, maximum `limit=100`.

## 8. Frontend coding, design system, and accessibility rules

### 8.1 UI ownership and dependency order

- Use React function components, hooks, Vite, and strict TypeScript; keep server/database concerns outside React.
- **Component-first is mandatory:** (1) document component contract, (2) implement tokens, (3) complete/test `components/ui` primitives, (4) build/test `components/layout`, (5) build/test `components/landing` and feature components, (6) compose pages, (7) run full responsive/integration QA.
- Pages in `pages/` compose existing, completed components; `App.tsx` and `app/routes.tsx` compose the router only. Pages must not become large collections of duplicated JSX and one-off CSS.
- Generic controls belong in `components/ui`; shared site shell in `components/layout`; landing sections in `components/landing`; account/transaction-specific UI in `features/*`; typed HTTP adapters in `api`.
- A new reusable component requires a clear top-of-file comment, exported-props documentation where nontrivial, correct semantic elements, typed props, planned states/variants, responsive behavior, accessibility checks, and at least focused tests when behavior exists.
- A change to an existing component must update affected comments, tests, consumers, and documentation. Do not copy/paste a shared control into a page to work around a component defect.

### 8.2 Mandatory black-and-white visual language

- Use black, white, and neutral gray for visual identity. All colors, typography, radii, and spacing flow from `styles/tokens.css`. **The footer alone** may apply a subtle one-base-color neutral gradient; do not introduce a decorative gradient elsewhere.
- The default appearance is white/light with near-black text and black primary buttons; optional inverted/dark appearance is deferred unless the scope is expanded.
- Use CSS Modules or clearly scoped component styling where useful; do not use global selectors to silently restyle unrelated feature components.
- **Approved integration exception:** Tailwind CSS v4 utilities are permitted for the supplied Aceternity `background-cubes-grid.tsx` implementation only. Preserve the source's required utilities, Motion behavior and named exports. Configure Tailwind only in `apps/web`, with the `@/` alias and `cn` utility, consumed through the existing folder-entry convention (`@/lib/index.js` for the helper). Other components continue to use shared semantic tokens and modular styling; do not refactor the whole app around copied demo markup.
- The supplied demo's colored platform icons, third-party product copy, and unrelated CTAs are **reference material only**, not approved UI content. The implemented hero uses only ledger-specific copy and monochrome cube colors; any intentional adaptation from the source must be recorded in the implementation README.
- Maintain consistent CTA styles, border weights, spacing, card treatment, headings, control sizes, icon sizes and focus outlines.
- For success/error/warning/credit/debit states, show readable text plus icon/label/structure; **never rely on color alone**. Do not add bright semantic colors merely to mimic generic dashboard templates.
- Keep focus indicators, disabled and hover states visible and high contrast. Use responsive typography and avoid fixed-width layouts that clip on 320px viewports.

### 8.3 Site shell and responsive navigation

- Every public route uses `AppShell` with a semantic `SiteHeader`, `main`, and `SiteFooter`; include a skip-to-main-content link.
- Desktop (`>=1024px`) uses the horizontal `DesktopNav`; tablet and mobile (`<1024px`) use a menu-triggered, **collapsible `ResponsiveSidebar`**, not a squeezed horizontal nav. Store breakpoints centrally.
- The sidebar starts closed; its trigger exposes `aria-expanded` and `aria-controls`; support Escape, overlay click, close button, focus containment, focus restoration, scroll locking and closing after navigation.
- Reduce animations when `prefers-reduced-motion` is set; navigation must remain usable with JavaScript-controlled state, keyboard, pointer and touch input.
- All header/footer links and CTAs must navigate to **implemented routes or anchors**. Never add empty `href`, dead placeholders, or click handlers with no effect.
- Landing page must compose a hero with working CTAs, supported feature explanations, steps, ledger principles, account entry section, final CTA and a proper footer. Do not invent banking features, testimonials or live-user statistics.
- Account page must display a usable balance view, transaction form, and history. Mobile transaction history can switch to cards if data, filters and pagination remain complete.

### 8.4 Data and interaction rules

- All money displayed to the user must come from API decimal strings and retain two fractional digits.
- Provide explicit loading, empty, success, invalid input, duplicate, insufficient-funds, and network-error states; disable transaction submission while an intent is in flight.
- Use a `Skeleton` component only when a data view has a known final layout (balance card, account details, history rows/cards). Match expected dimensions; never display fake monetary values; expose one clear status message to assistive technologies. Prefer an unobtrusive pulse instead of a shimmer gradient.
- Use a `Spinner`/button-loading state for an active request (create account, submit credit/debit, refresh a small control). Keep the submit button disabled for the in-flight intent and do not report success before the server confirms it.
- A `ProgressBar` is **conditional**: implement and render it only after a real, measurable long-running task exists (for example, an export with percent-complete data). Do not fabricate percentage values, add simulated timers, or show progress for simple CRUD calls.
- After successful mutation, refetch balance and history from the server. Do not permanently trust optimistic balance calculations.
- Group UI state and side effects in feature hooks, not generic layout primitives. Browser-side validation is for usability only; Express remains authoritative.
- Use semantic HTML, associated form labels and descriptions, accessible error feedback, visible focus states, meaningful button names, logical headings and page landmarks.
- Test at 320, 375, 768, 1024, and 1440px; check for overflow, clipped UUIDs, keyboard traps, broken CTA anchors and duplicate mobile/desktop navigation.
- Keep Supabase and database secrets out of `VITE_*` variables; only a public backend base URL belongs in the frontend environment.
- The entire frontend and its landing page are **user-added project requirements**; the assessment itself only mandates backend APIs.

### 8.5 Motion, hero rendering, and footer gradient rules

- **Hero background:** Use the Aceternity Background Cubes Grid only within `HeroSection` through a reusable `HeroBackdrop` wrapper. Default to the isometric variant and grayscale colors. It must be decorative (`aria-hidden`) and layered beneath real text, inputs and CTAs without blocking interaction.
- **Reference fidelity:** Keep the exports `IsometricCubesProps`, `PerspectiveCubesProps`, `BackgroundCubesGridProps`, and `BackgroundCubesGrid` in `components/ui/background-cubes-grid.tsx`. Follow the attached prompt for dependencies, Tailwind utilities, the helper `cn`, cleanup and reduced-motion behavior; do not paste the source demo hero into the product.
- **Hero headline:** Render the exact text `A clear view of` followed by `every transaction.` as one semantic H1. Implement a reusable `TypewriterText` component for a single short reveal, without endless loops or permanent blinking. Keep accessible full text and a static/reduced-motion fallback to prevent invisible headings.
- **Footer only:** Use a linear blend of **one** neutral near-black base through opacity (example base `#111111`, top 88% opacity, bottom 100%) over white. Footer links and text must maintain visible focus and sufficient contrast. No other page section should introduce decorative gradients.
- **Cards/controls/navigation:** Restrict extra motion to subtle border/shadow/translate or opacity changes that communicate state. Use short durations and consistent easing; avoid dramatic parallax, persistent blinking, elaborate page transitions and unrelated animated backgrounds.
- Honor `prefers-reduced-motion: reduce` throughout. Render the heading immediately, disable idle cube ripples, avoid unnecessary entrance motion, and provide a non-WebGL fallback if canvas/WebGL cannot initialize. Limit pixel ratio and work on low-capability/mobile devices; stop/render-clean up on unmount and, where feasible, when offscreen.
- Animations must not delay or interfere with API operations, keyboard navigation, focus visibility, text legibility, or the perceived finality of financial transactions.

### 8.6 Loading and status-feedback rules

| State                                 | Use                                                       | Do not use                                          |
| ------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| Initial account or history data fetch | Layout-matched `Skeleton` card/rows                       | Fake balances, full-screen spinner by default       |
| Create account, credit/debit submit   | Inline `Spinner` or loading button + status text          | Percent-complete bar or optimistic success          |
| History filter/page refresh           | Row-level skeleton (when layout known) or compact spinner | Blocking the entire site shell                      |
| Empty, validation, network failure    | Explicit empty/error/status component                     | Infinite loader or misleading skeleton              |
| Measurable future background task     | `ProgressBar` with actual reported completion             | Manufactured progress or bars for standard requests |

Do not impose arbitrary minimum loading durations. Reuse existing `idle`, `pending`, `success`, `empty`, and `error` transitions from the owning hook/component; change presentation only and announce changes accessibly and avoid layout shift where practical.

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
- [ ] For UI changes: the component is independently complete and its downstream page uses it rather than repeating markup.
- [ ] For UI changes: tokens, monochrome contrast, keyboard behavior, navigation modes and required viewport tests have been checked.
- [ ] Hero cube grid appears only on the landing hero; typewriter shows the exact H1 with a static reduced-motion fallback; source integration deviations are recorded.
- [ ] Footer is the only decorative gradient and uses a single neutral base; contextual skeleton/spinner behavior is correct and no unnecessary progress bar appears.
- [ ] Motion/WebGL fallbacks and component cleanup are tested without hiding real content or blocking account operations.

## 11. References and precedence

1. **Assessment PDF** (pages 1–5): mandatory ledger behaviors, technical flexibility, and submission deliverables.
2. **User project decisions**: React/Vite/TypeScript frontend, Express/Node/TypeScript backend, Supabase PostgreSQL, mandatory comments, maintainable project structure, Prettier, black-and-white responsive UI, desktop navbar, tablet/mobile collapsible sidebar, component-first development, hero-only cube grid, typewriter H1, footer-only neutral gradient, and contextual loading indicators.
3. `assumption.md`: decisions not specified by the PDF.
4. `design.md`: API and architecture design; `schema.md`: database design; `structure.md`: file ownership; `plan.md`: implementation order.

Official implementation references:

- Supabase database connectivity: https://supabase.com/docs/guides/database/connecting-to-postgres
- Prettier configuration: https://prettier.io/docs/configuration
- Prettier installation and checks: https://prettier.io/docs/install

- Aceternity Background Cubes Grid reference: https://ui.aceternity.com/components/background-cubes-grid
- Full user-supplied implementation prompt, preserved byte-for-byte: `references/background-cubes-grid-original-prompt.txt`

## UI-only compatibility rules

- Preserve existing API adapters, hooks, request timing/cancellation, validation, transfer review/confirmation, account selection and retry/persistence state machines. Render skeletons/spinners from existing state; add no requests, waits, timers for financial outcomes, new success inference or progress endpoints.
- Preserve Account ID wording, known-name/Account fallback, account-aware Create/My account/Log out actions, clipboard behavior and all existing routes/anchors.
- Keep ErrorNotice's four public fields, support IDs, mapped actions, private log correlation and pending-action locks. StatusMessage stays reserved for info/success; a new visual style must not reintroduce raw error messages or duplicate alerts.
- Preserve CSS tokens/Modules and all existing folder entries. Scope Tailwind utility/layer integration and review its reset effects; do not apply a new global preflight that silently restyles the rest of the app. Root tooling configs stay active; delivered pack configs remain archival.
- WebGL/decorative failure falls back locally to static monochrome styling, with existing private diagnostics where needed. It must not trigger a financial failure, replace the account workflow or block a CTA. Preserve source cleanup and document visual/framework-only adaptations.
- No new backend, shared public-contract, database, authentication, microservice, deployment, measured-job or ProgressBar work is authorized by this revision. No dependencies are installed before approval.

## User refinement — desktop hover only (2026-10-28)

The latest direct instruction overrides broader reference/default animation behavior: use the supplied isometric shader/geometry/physics at normal visibility, only while a mouse hovers within the hero on desktop (minimum 1024px and hover/fine-pointer capability). Set `idleRipples=false`; never auto-play. Unmount/dispose on pointer leave/cancel, window blur, breakpoint change or graphics failure. Touch/pen, mobile/tablet, reduced motion and unsupported/limited devices use a clean static neutral background. Do not substitute an illustrated repeating cube tile or fade the reference effect behind an opaque copy panel. Existing ledger copy, preview and functional CTAs remain.
