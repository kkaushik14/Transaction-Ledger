# System Design and API Contract

> Project: Transaction Ledger | Version: 0.3 | Status: UI enhancement approved on 2026-10-28
>
> The **Full Stack Developer Assessment** defines the mandatory ledger behaviors (pages 1–5). The browser interface and the selected technology stack are user-requested extensions. Endpoint URLs, payload shapes, money representation, and error codes below are explicit project assumptions documented in `assumption.md`.

## Applicability and approval gate

This active v0.3 set describes the UI-only enhancement approved by the user on 2026-10-28. Implement component first. Commands and unchecked scaffold checklists in the supplied pack/reference do not independently expand that authorization. Existing functionality and logic stay frozen. Retain v0.1 and v0.2 unchanged; AGENT.md remains the sole root guide for version routing and approval status.

The delivered app already includes accounts, credit/debit, transfers, balances/history, account selection/logout, typed index.ts entries and centralized support-ID error handling. Older pack statements calling these unimplemented/optional are superseded by the reconciled baseline below and the current implementation/API documentation. Do not reset the repository, recreate modules, replay migrations or remove delivered functionality.

## 1. Objective

Build a clear, extensible full-stack demonstration of a transaction ledger. An account starts at a zero balance; valid credits and debits append immutable ledger entries and atomically change its current balance. Users can retrieve their balance and a latest-first, filtered, paginated history. A React interface exposes these capabilities without connecting directly to the database.

### Success criteria

- Mandatory four assessment API capabilities work correctly.
- The system prevents overdrafts, duplicate same-account references, partial writes, and inconsistent balances.
- Transaction history is immutable through the API.
- API input validation and errors are predictable.
- TypeScript boundaries and modular folders make future changes straightforward.
- A polished, responsive monochrome React/Vite interface supports the full account workflow and a landing page, while keeping mandatory backend scope first.
- A fresh clone can be run locally from README instructions.

## 2. Scope and boundaries

### Mandatory functional scope (assessment)

1. Create Account.
2. Add Transaction (`credit` or `debit`).
3. Get Account Balance.
4. Get Transaction History (filter, pagination, latest-first sorting).
5. Enforce atomicity, validation, duplicate handling, and immutability.

### Project-added scope (user choices)

- React + Vite + TypeScript web UI with a black/white design system, full landing page, desktop navigation, and tablet/mobile collapsible sidebar.
- Component-first UI development: complete reusable components before assembling sections, layouts, and pages.
- Node.js + Express + TypeScript API server.
- Supabase-hosted PostgreSQL database, using server-side `pg` SQL access.
- Shared request/response contracts; extensible feature modules.
- Mandatory code comments and Prettier formatting.

### Bonus / deferred

- Microservices and additional gateway/tokenization infrastructure; these are outside the narrowed transfer UI request.
- Account listing, authentication/roles, exports, analytics, background workers, payment providers, audit/admin console, full production deployment.

## 3. Architecture overview

Folder boundaries use explicit `index.ts` entries and `.js` specifiers; parent folders compose child entries. Consumers use the responsible module/feature entry, while sibling implementation files import directly to keep the graph acyclic. Runtime startup stays separate from reusable factories. This preserves the existing layers and injectable Express application without introducing microservices, new packages or service communication. `structure.md` §3 maps the concrete entries, and `rules.md` §3.1 owns the import convention.

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

| Component                | Responsibility                                                                     | Must not do                                                         |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| React pages/features     | Compose tested reusable components, handle input, loading/error states and display | SQL, secret handling, authoritative balance math                    |
| UI primitives and layout | Token-driven controls, page shell, navigation and responsive behavior              | Data fetching, ledger business rules                                |
| Landing page sections    | Compose primitives into semantic, responsive sections                              | Duplicate existing primitive styling or invent backend capabilities |
| Typed API client         | HTTP calls, URL construction, parse errors                                         | Contain business rules                                              |
| Express routes           | Register endpoints and middleware                                                  | Embed DB operations                                                 |
| Controllers              | Map HTTP input/output, status codes                                                | Start DB transactions or calculate balances                         |
| Request validation       | Parse and validate params/query/body                                               | Mutate persistent data                                              |
| Account service          | Account creation/read policy                                                       | Directly access `req`/`res`                                         |
| Transaction service      | Duplicate checks, credit/debit policy, atomic workflow                             | Call DB outside transaction client for transaction writes           |
| Repositories             | Parameterized SQL and row mapping                                                  | Choose HTTP response codes                                          |
| Database client          | Pool and transaction lifecycle                                                     | Store process-global per-request transaction state                  |
| Shared contracts         | Zod schemas and public TypeScript DTOs                                             | Import Express, React, or database drivers                          |
| Global error handler     | Error-to-status mapping and safe messages                                          | Leak SQL/connection strings                                         |

## 5. Data movement and trust boundaries

1. Browser receives user input and applies ergonomic form validation.
2. Browser calls an API endpoint using `VITE_API_BASE_URL` (a public backend URL only).
3. Express validates inputs again; no browser-supplied balance, ID, or timestamp is trusted.
4. Service obtains one `pg` client; transactional writes run through that client.
5. Database constraints provide defense in depth.
6. Express returns normalized DTOs with decimal-string monetary values.
7. React displays server values and refreshes data after each successful transaction.

Only Express may possess `DATABASE_URL`. Store tables in a private `ledger` schema, not an exposed Supabase Data API schema. No Supabase service-role key is required by this architecture. Authentication is outside the assessment and is not implicitly provided by CORS or Supabase hosting.

## 6. REST API contract (implemented baseline)

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
- For credit, reject a balance above `999999999999999999.99` with `422 BALANCE_LIMIT_EXCEEDED` and no changes.
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

| Name    | Optional? | Default | Validation               |
| ------- | --------- | ------- | ------------------------ |
| `type`  | Yes       | Both    | `credit` or `debit` only |
| `page`  | Yes       | `1`     | Positive integer         |
| `limit` | Yes       | `20`    | Integer `1..100`         |

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

SQL query must apply account and optional type filter, sort by `created_at DESC, id DESC`, then `LIMIT`/`OFFSET`. Count query uses the **same filters** without pagination. The implemented backend reads account existence, count, and page selection on one read-only `REPEATABLE READ` snapshot. Query validation rejects repeated/unknown fields, non-canonical integers, and unsafe integer/offset values. Return `404` for an unknown account; return `[]` for an existing account with no matching rows.

### 6.5 Error contract

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "support_ticket_id": "11111111-1111-4111-8111-111111111111",
    "message": "The account has insufficient balance. Review the current balance and enter a smaller amount.",
    "action": "fix_input"
  }
}
```

| Status | Code                     | Common cause                                                  |
| ------ | ------------------------ | ------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`       | Missing name, invalid body, type, amount, UUID, or pagination |
| `404`  | `ACCOUNT_NOT_FOUND`      | Account ID does not exist                                     |
| `409`  | `DUPLICATE_TRANSACTION`  | Same account and reference ID already used                    |
| `422`  | `INSUFFICIENT_BALANCE`   | Debit would overdraw account                                  |
| `422`  | `BALANCE_LIMIT_EXCEEDED` | Credit would exceed the balance column capacity               |
| `500`  | `INTERNAL_ERROR`         | Unexpected failure; internal detail logged only               |

The implemented HTTP boundary also returns `404 ROUTE_NOT_FOUND`, `413 PAYLOAD_TOO_LARGE`, and `415 UNSUPPORTED_MEDIA_TYPE` as documented in `../../../docs/api-reference.md`; these existing error codes must remain supported by the frontend.

The envelope contains only support_ticket_id, code, message and action. Field validation diagnostics are private; the shared local validation mapper supplies safe feedback. Central middleware maps typed domain errors and recognized PostgreSQL constraints to canonical HTTP statuses and allowlisted copy.

### 6.6 Other routes

- `GET /health`: optional operational liveness endpoint, outside the assessment. Do not expose database credentials or private diagnostics.
- `GET /accounts`: **optional future extension** for account selection; the initial UI must work without it.
- `POST /transfers`: atomic transfer creation, described below.
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

## 8. Frontend design system, UI/UX, and component-first delivery

**Status:** Supplied UI direction under review; implementation awaits the explicit go-ahead. The assessment PDF does not require the landing page or a frontend. This section is the authoritative frontend blueprint for the project; backend functionality stays as specified in Sections 1-7.

### 8.1 Visual identity and design principles

- **Palette:** black, white, and neutral gray only. No bright accent colors, glassmorphism, or random component-specific hex values. **Exception:** one subtle single-base neutral gradient is permitted in the footer only.
- **Default theme:** white/light canvas, near-black typography, strong black primary CTA, white inverse text. Dark/inverted mode is not a release requirement; it can be added later through the same tokens.
- **Visual character:** minimal, professional, high contrast, crisp borders, restrained shadows, deliberate typography, generous whitespace and precise alignment.
- **Consistent components:** one design system for public landing and account workflow; no separate styling language for the dashboard.
- **Semantics first:** color must never be the only indicator of success, warning, insufficient funds, invalid input or transaction type. Combine text, iconography and accessible labels.
- **Behavior before decoration:** prioritize readable amounts, clear form labels, stable navigation, visible error states and reliable submission over animation. The only intentionally distinctive effects are the hero-only cube grid and one-shot typewriter H1.

### 8.2 Design tokens (single source of truth)

Implement semantic tokens in `apps/web/src/styles/tokens.css`; components may use CSS Modules but must read from tokens. Suggested **initial** values, subject to design review:

| Token                           | Default                                          | Purpose                                                  |
| ------------------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| `--color-bg`                    | `#ffffff`                                        | Base page background                                     |
| `--color-surface`               | `#f7f7f7`                                        | Section/card contrast                                    |
| `--color-surface-strong`        | `#eeeeee`                                        | Selected/subtle highlighted surface                      |
| `--color-text`                  | `#111111`                                        | Main copy and headings                                   |
| `--color-muted`                 | `#525252`                                        | Secondary text (check contrast)                          |
| `--color-border`                | `#d4d4d4`                                        | Dividers and standard borders                            |
| `--color-strong`                | `#111111`                                        | Primary buttons, strong boundaries                       |
| `--color-on-strong`             | `#ffffff`                                        | Text/icons on primary buttons                            |
| `--color-focus`                 | `#111111`                                        | Visible keyboard focus ring                              |
| `--font-sans`                   | System sans-serif stack                          | Readable text without remote font dependency             |
| `--content-max-width`           | `1200px`                                         | Main content width                                       |
| `--radius-sm/md/lg`             | `6px / 10px / 16px`                              | Shared control/card corners                              |
| `--space-*`                     | 4px-based scale                                  | Predictable internal and section spacing                 |
| `--color-footer-base`           | `#111111`                                        | Single neutral color underlying the footer-only gradient |
| `--color-footer-text`           | `#ffffff`                                        | Readable text over the dark footer                       |
| `--motion-duration-fast`        | `150ms`                                          | Hover/focus/pressed transitions                          |
| `--motion-duration-surface`     | `220ms`                                          | Drawer and card-state transitions where helpful          |
| `--motion-ease-standard`        | `cubic-bezier(0.2, 0, 0, 1)`                     | Restrained UI easing                                     |
| `--typewriter-ms-per-character` | `45` (configuration value, not a CSS time token) | Default H1 reveal speed, adjustable after review         |
| `--skeleton-pulse-duration`     | `1.3s`                                           | Gentle placeholder pulse; no shimmer gradient            |

Token values are defaults, **not** invitations to hardcode matching values in dozens of components. Hover, disabled, selected, loading and error appearance must remain legible within the monochrome palette. Use a visible border, label, and icon for semantic states rather than introducing color-only statuses.

Typography proposal: body text 16px minimum on forms, scale through roughly 14/16/18/24/32/48px as context permits. Scale display headings down on small screens using `clamp()` and keep line lengths comfortable (around 60-75 characters for paragraphs). Headings must follow a semantic hierarchy; do not pick heading tags solely for their visual size.

### 8.3 Responsive layout and navigation contract

| Viewport              | Navigation                                                            | Layout behavior                                                        | Primary action                                  |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Mobile (`<640px`)     | Menu button opens a collapsible off-canvas sidebar                    | Single-column sections; forms/history stack; no horizontal overflow    | High-visibility full-width CTA when appropriate |
| Tablet (`640-1023px`) | Same collapsible sidebar, triggered from the header                   | Flexible one/two-column layouts as space allows; touch-sized controls  | Header CTA or inline section CTA                |
| Desktop (`>=1024px`)  | Horizontal navbar visible in site header; sidebar/menu trigger hidden | Constrained wide layout, two-column hero and account area where useful | Persistent, clear header CTA                    |

These breakpoints are project assumptions centralized in CSS, not backend contracts. Test the actual layout at 320, 375, 768, 1024, and 1440 CSS pixels; layouts must also work between test points.

**Site header and desktop navigation**

- `SiteHeader` renders the text/logo mark, `DesktopNav`, primary CTA, and menu trigger as appropriate.
- Desktop navbar includes real, working links for Overview (`/`), Features (`/#features`), How it Works (`/#how-it-works`) and Get Started (`/#get-started`). An account page must still offer a route back home.
- Header may be sticky only if it does not obscure fragment targets; add `scroll-margin-top` to sections and preserve keyboard navigation.
- Desktop navbar should not coexist visibly with the tablet/mobile sidebar.

**Collapsible sidebar for tablets and mobiles**

- `ResponsiveSidebar` is closed by default and toggled by a clearly labeled menu button with `aria-expanded` and `aria-controls`.
- The drawer contains the same primary navigation destinations and clear CTA, not a competing set of pages.
- Opening it moves focus into the drawer and prevents keyboard focus from escaping while modal; closing restores focus to the trigger. Support Escape, overlay click, and link selection to close.
- Provide an accessible name, visible close control, touch-friendly targets, and optional motion that respects `prefers-reduced-motion`.
- Prevent background scrolling while the drawer is open and clean up that effect when it closes/unmounts. On switching to desktop layout, ensure the drawer closes and focus behavior remains coherent.

**Site footer**

- `SiteFooter` appears on the landing page and the account page, with product identity, meaningful navigation links, and concise informational text.
- The footer is **the only gradient surface**. Use one neutral near-black color blended by changing its opacity from approximately 88% to 100% over white. Example (tokenize the base in the implementation):

  ```css
  /* Single neutral base repeated with different alpha values; no second hue. */
  background-color: #ffffff;
  background-image: linear-gradient(180deg, rgb(17 17 17 / 88%) 0%, rgb(17 17 17 / 100%) 100%);
  color: #ffffff;
  ```

- Do not add gradient borders, gradients to feature cards, decorative hero gradients, or skeleton shimmer gradients. Keep footer links legible and focused in the dark surface.
- Do not create dead placeholders for contact, legal or social pages. Add those only when valid content and routes exist.
- Keep the footer stacked on narrow screens, multicolumn only when space allows; make links keyboard/touch accessible.

### 8.4 Route and page map

| Route or anchor        | Composition                      | Purpose                                                                                |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `/`                    | `AppShell` + `HomePage`          | Public landing page and entry to the ledger demo                                       |
| `/#features`           | `FeatureGrid`                    | Discover supported capabilities, no invented features                                  |
| `/#how-it-works`       | `HowItWorksSection`              | Understand create, credit/debit, and read-history flow                                 |
| `/#get-started`        | `GetStartedSection`              | Create an account or open an existing account using its Account ID                     |
| `/accounts/:accountId` | `AppShell` + `AccountPage`       | Existing balance, credit/debit, transfer review/receipt and filtered paginated history |
| Unmatched route        | `NotFoundPage` within `AppShell` | Clear route recovery                                                                   |

The landing page is an interface requested by the user, **not** an authorization boundary, payment service, or promise of production banking security. Use accurate product copy such as "Transaction Ledger demo". Avoid inventing user testimonials, fake metrics, backend APIs, or unsupported financial/security claims.

### 8.5 Landing page section order and content responsibilities

```text
AppShell
  SiteHeader
    DesktopNav (desktop)
    ResponsiveSidebar trigger + drawer (tablet/mobile)
  main
    HeroSection                 [headline, supporting copy, primary/secondary CTA]
    FeatureGrid                 [account, credit/debit, balance, history capabilities]
    HowItWorksSection           [step 1 account; step 2 transact; step 3 review]
    LedgerPrinciplesSection     [atomicity, duplicate prevention, immutable entries]
    GetStartedSection           [AccountCreateForm + AccountLookupForm]
    FinalCtaSection             [returns to #get-started; not a dead-end CTA]
  SiteFooter
```

The hero must have a clear value proposition, restrained visual hierarchy, and **at least one working primary CTA**. The H1 is now **fixed copy supplied for review**, not an example:

```text
A clear view of
every transaction.
```

Display that heading with a one-time generated/typewriter reveal, rendered above the Aceternity cube-grid background. Keep the existing primary CTA: "Create an account" -> `#get-started` when no account is selected, or "My account" -> the selected workspace otherwise. Keep "Open an account" and its current lookup focus behavior. Header/drawer Log out remains unchanged. The hero includes concise ledger-specific supporting copy, not the vendor demo's incident-alerting copy/platform logos. Claims describe actual application capability, not external payment connectivity.

Section order may change after design review, but every section must have a purpose, a meaningful heading, real content and a functional destination for any CTA. Do not add arbitrary marketing sections to make the page appear longer.

### 8.6 Account page composition and adaptive content

```text
AppShell
  SiteHeader + responsive navigation
  main
    AccountPageHeader (available account name or honest fallback, identifier, copy action)
    AccountBalanceCard (server-authoritative decimal balance)
    Account workspace:
      TransactionForm (credit/debit, amount, description, submit)
      TransactionHistory (type filter, latest-first data, pagination)
    ErrorNotice (existing mapped errors/support ID/action)
    StatusMessage (info/success only)
  SiteFooter
```

Desktop may show form and history as adjacent columns when space allows; tablet/mobile should stack them without reducing readable font size or hiding required fields. The history view may use a table at desktop width and a semantic card/list presentation on mobile; preserve all required data and access to filters/pagination. Long UUIDs must wrap or be truncated with a usable copy action, not overflow cards.

No account listing, account login, transaction editing or analytics dashboard is required. Transfer UI is now separately authorized and implemented within the account workspace. The existing UUID lookup is the deliberate navigation path to an account.

**Approved API compatibility:** Creating an account returns its name, while the existing balance read returns only account ID and balance. An account opened by UUID or direct URL with no creation metadata uses "Account" plus the UUID. The user explicitly approved this fallback; it is implemented without a new API. Name display is optional when genuinely known; no local value is authoritative for money.

**Request-state behavior:** Changing the history filter resets pagination to page 1. Cancel or ignore stale reads after account/filter/page changes. New transaction intents receive new references; an uncertain request keeps both its reference and original payload for retry. A duplicate response refreshes server state and explains the reference conflict without claiming that a differing payload succeeded. Present the existing balance-limit error alongside insufficient-funds errors.

**Token contrast note:** Suggested pale border tokens may be used for decoration, but meaningful input boundaries and focus indicators must meet their required contrast. Adjust semantic control-border tokens rather than applying the pale decorative border to every interactive control.

### 8.7 Component inventory and ownership

**Layer 1: Reusable primitives (`components/ui`)**

| Component                                   | Responsibilities / variants                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Button`, `IconButton`                      | Primary, secondary, subtle, disabled, loading; native button semantics                       |
| `TextField`, `TextAreaField`, `SelectField` | Labels, descriptions, validation messages, accessible controls                               |
| `Card`                                      | Shared container, spacing and border variants; subtle optional hover/focus motion only       |
| `Container`, `SectionHeading`               | Width/spacing and semantic heading patterns                                                  |
| `StatusMessage`, `LoadingState`             | Existing info/success and accessible loading presentation; no raw-error rendering            |
| `ErrorNotice`                               | Existing mapped message, code, support ID and recovery action; behavior unchanged            |
| `Skeleton`                                  | Shape-preserving account-card, balance and transaction-history placeholders; pulse only      |
| `Spinner`                                   | Compact indeterminate loading marker for action buttons or localized fetches                 |
| `TypewriterText`                            | Reusable one-shot text generation, exact full accessible label and reduced-motion fallback   |
| `background-cubes-grid.tsx`                 | Source-compatible Aceternity cube grid; reusable exports, Motion/Three, no app-specific copy |
| `ProgressBar` (**conditional**)             | Create only if a real percent-complete operation is implemented; omit from initial UI        |
| `Pagination`                                | Generic page controls with descriptive labels                                                |

**Layer 2: Layout and navigation (`components/layout`)**

`AppShell`, `SiteHeader`, `DesktopNav`, `ResponsiveSidebar` and `SiteFooter` compose and configure primitives. The sidebar owns only presentation/navigation behavior; it does not fetch balances or contain account business logic. `SiteFooter` alone owns the single-base neutral gradient.

**Layer 3: Landing compositions (`components/landing`)**

`HeroBackdrop`, `HeroSection`, `FeatureGrid`, `HowItWorksSection`, `LedgerPrinciplesSection`, `GetStartedSection` and `FinalCtaSection`. `HeroBackdrop` contains the cube-grid integration, fallback and lifecycle concerns; `HeroSection` uses `TypewriterText` for the exact H1. Prefer data-driven repeated content over copy-pasted cards; sections own their own responsive layout while sharing tokens and primitives.

**Layer 4: Domain feature components (`features/accounts` and `features/transactions`)**

`AccountCreateForm`, `AccountLookupForm`, `AccountBalanceCard`, `TransactionForm`, `TransactionHistory` and feature hooks. API modules own HTTP; hooks own orchestration; domain components own form/view behavior. Never put HTTP calls in generic primitives or universal layout.

**Layer 5: Page composition (`pages`)**

`HomePage`, `AccountPage` and `NotFoundPage` should primarily assemble existing sections/feature components. `App.tsx` and route definitions own routing only. Avoid large page components containing copied button markup, database fetch logic, and one-off styling.

### 8.8 Component-first construction rule (mandatory)

**Do not build a page from scattered JSX first and extract components afterward.** Follow this dependency order:

1. Define component contract: purpose, typed props, optional variants, accessibility semantics, responsive behavior, and loading/empty/error states where applicable.
2. Establish shared color, typography, spacing, radii and breakpoint tokens.
3. Implement and verify reusable UI primitives independently, including `Skeleton`, `Spinner`, `TypewriterText` and the source-compatible `BackgroundCubesGrid`; document comments and loading/motion accessibility.
4. Compose and verify navigation/layout components; test desktop navbar and tablet/mobile sidebar behavior before page assembly.
5. Build each landing section and each ledger feature component from the reusable primitives; test the `HeroBackdrop`/H1 and the footer gradient in isolation before page composition.
6. Assemble `HomePage` and `AccountPage` only from completed components; wire typed API hooks and working CTA destinations.
7. Run end-to-end responsive, keyboard, visual consistency and integration checks; revise the underlying component instead of patching every page separately.

**Definition of a complete reusable component:** typed public API, documented purpose, token-driven styling, meaningful state/variant handling, keyboard/screen-reader semantics, mobile/tablet/desktop behavior, no runtime secrets, tests or intentional test coverage, and no duplicated domain logic. A component is considered ready for reuse only after this checklist passes.

### 8.9 Hero motion specification: cubes and typewriter

**Source reference:** [Aceternity UI Background Cubes Grid](https://ui.aceternity.com/components/background-cubes-grid). The unmodified user-provided implementation prompt, including both full source examples, is included at [`references/background-cubes-grid-original-prompt.txt`](references/background-cubes-grid-original-prompt.txt). Preserve that file exactly as supplied. It is reference material, not the production hero's copy or color palette.

**Component integration contract**

- Install only the source-required dependencies in the **React/Vite web workspace**: `motion`, `three`, `lucide-react`, `clsx`, `tailwind-merge`, and Tailwind CSS v4 with its Vite integration. Add TypeScript typing support for Three.js when needed.
- Expose the `@/` path alias to `apps/web/src` in Vite and TypeScript. Provide `lib/utils.ts` with `cn(...inputs)` and expose it through `lib/index.ts` (consumed as `@/lib/index.js`) implemented by `clsx` and `tailwind-merge` as specified in the prompt.
- Implement `apps/web/src/components/ui/background-cubes-grid.tsx` with the named exports `IsometricCubesProps`, `PerspectiveCubesProps`, `BackgroundCubesGridProps`, and `BackgroundCubesGrid`. Retain the reference's Motion timing, easing, reduced-motion support, Three.js simulation and cleanup behavior. Keep required Tailwind utility values in the source-compatible component rather than translating them into new ad-hoc CSS.
- The original two-file demo may be retained **only as a development/reference fixture** for source-fidelity checks. The demo's colorful Discord/Telegram/etc. pills, product marketing, and unrelated actions must **not** appear in the ledger application. The real `HeroSection` is a separate application-specific composition.
- `components/landing/HeroBackdrop.tsx` is the only production wrapper that mounts the cube grid. Set isometric variant as the initial design choice, with neutral values such as `topColor=#fafafa`, `leftColor=#e5e5e5`, `rightColor=#d4d4d4`, and `glowColor=#737373`; expose these through the design layer rather than scattering them across pages. Preserve both component variants for future customization but do not activate the colorful perspective defaults in the app.
- Give the hero a positioned/isolation container; the full-size, `aria-hidden` canvas sits behind the real heading, descriptive text and clickable CTAs. Text stays readable at all breakpoints; link focus and hover work over the canvas. No page outside `/` and no non-hero landing section mounts `BackgroundCubesGrid`.
- Keep source-responsive sizing and WebGL resource disposal. Guard unsupported WebGL/context-loss failures with a static grayscale background; control pixel ratio and fallback/degrade on smaller or lower-power devices. If possible, pause offscreen rendering without changing ledger content. Reduced-motion preference disables idle ripples and nonessential movement.
- In the implementation notes/README, **record any deviations** required by Vite integration, framework differences, monochrome presentation or fallback behavior. The prompt's "looks exactly like the demo" statement is a source-comparison target, not permission to override the user's final product copy/theme.

**Heading contract**

- Exact final heading (including period): **"A clear view of"** on the first intended line and **"every transaction."** on the second.
- `TypewriterText` reveals the complete phrase **once per hero mount** at approximately **45 ms/character**, with no cycling phrases and no permanent blinking cursor. This is an adjustable design assumption, not a prescribed timing from the reference.
- Render one semantic `<h1>` with the **full heading immediately available to screen readers**, e.g. `aria-label="A clear view of every transaction."` and an `aria-hidden` visual animation layer; avoid announcing individual characters.
- Reserve headline space before the reveal so the hero CTA and body text do not shift while characters appear. Make the intentional line break responsive; on narrow devices allow additional wrapping rather than overflow.
- If reduced motion is preferred, initial animation is disabled, JavaScript animation setup fails, or a low-performance fallback is active, show the complete static H1 instantly. The hero must remain useful without any effect.

**Composition**

```text
HeroSection (only on HomePage)
  HeroBackdrop (grayscale, isometric BackgroundCubesGrid or static fallback)
  Hero content layer (readable above canvas)
    TypewriterText -> semantic H1: "A clear view of" / "every transaction."
    Supporting paragraph (real ledger functionality)
    Primary CTA -> #get-started
    Secondary CTA -> #get-started account lookup
```

### 8.10 Contextual loading and progress states

All loading components belong to the reusable component layer and are instantiated by their owning feature, not inside API transport code. **Progress is not automatically part of a complete-looking UI.**

| Event                                           | Component                                                                                     | Behavioral contract                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| First account/balance fetch                     | `Skeleton` using the actual balance-card proportions                                          | Preserve layout; never print placeholder monetary values or a fictional balance                                   |
| First history fetch or page/filter change       | Row/card `Skeleton` matching desktop/mobile presentation, or compact spinner on brief refresh | Preserve filter controls; show one accessible loading announcement                                                |
| Create account request                          | `Button` loading state with `Spinner`                                                         | Disable same-intent resubmission, announce pending and confirmed result                                           |
| Credit/debit request                            | Inline `Spinner` and "Processing transaction" status                                          | No optimistic success; refresh server balance and history on confirmed result                                     |
| Transfer review/confirm and retry               | Existing reviewed intent with a localized button `Spinner`                                    | Preserve the exact phase, payload/reference, guards and correlated receipt; no new confirmation or automatic send |
| Small independent refresh                       | Compact `Spinner` scoped to the affected region                                               | Do not block the header, footer, unrelated data or all controls                                                   |
| No records or invalid/failing request           | Existing empty state / four-field `ErrorNotice`                                               | Stop loading; preserve mapped actions and support IDs; `StatusMessage` remains info/success only                  |
| Future measurable export/import/background task | `ProgressBar` **only if implemented and receiving real progress data**                        | Use percent only from actual job measurements; otherwise use indeterminate feedback                               |

Use a subtle **opacity pulse** for skeletons, not a shimmer gradient (the footer owns the only decorative gradient). No arbitrary minimum spinner duration, fake percentages, fake completion timers, or repeated page-wide spinners. Status text must not depend only on a spinner icon. Tests cover pending-to-success, pending-to-error, duplicate retries, and errors terminating the loading state.

### 8.11 Secondary interactions and restrained cards

- `Card` remains the single compositional primitive for feature explanations, account summaries, transactions (mobile), and status panels. Choose variants through typed props and semantic tokens, not custom one-off card effects per page.
- Cards may apply a short neutral border/shadow change or 1-2px lift **on genuine hover-enabled devices**; preserve readable focus indications and avoid a bouncing/repeating loop. On touch devices, rely on pressed/selection states instead of hover-only disclosure.
- Buttons may use 120-180 ms neutral background/opacity transitions; drawer open/close may use about 180-240 ms. Keep these values centralized and set duration to 0 for reduced-motion preferences where appropriate.
- Avoid additional visual libraries or animated backgrounds without an approved use case. No parallax, giant counters, animated glowing borders, unrelated particle systems, or loading bars added for appearance.
- Consistency gate: one animation family, one card system, one neutral palette, a hero-specific distinctive effect, and state-driven loaders.

### 8.12 Interaction and UX state matrix

| Interaction                           | Expected user-visible behavior                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Menu open/close                       | Predictable focus, Escape handling, overlay control, active link state                          |
| Primary hero CTA                      | Scroll/navigate to actual `#get-started` controls; no inert button                              |
| Create account                        | Validate, show button spinner/pending status, handle failure, navigate to newly created account |
| Open by UUID                          | Validate ID, navigate to account; show recoverable 404 if missing                               |
| Submit credit/debit                   | Block double-submit, show outcome, refetch authoritative balance and history                    |
| Duplicate `reference_id`              | Explain duplicate without repeating the money movement; refresh state                           |
| Insufficient funds                    | Show clear error, preserve form context, do not claim success                                   |
| History filter/page                   | Reflect filter, current page and totals; show loading/empty/error states                        |
| Route not found                       | Show recovery navigation without blank screens                                                  |
| Hero H1 on standard motion            | Exact two-line typewriter text reveals once; accessible heading exists immediately              |
| Hero H1 on reduced motion             | Full static heading appears immediately, no typing/cursor animation                             |
| Hero background unsupported/offscreen | Static neutral fallback or paused rendering; links remain interactive                           |
| Footer                                | One single-base near-black gradient, white text and readable focus                              |
| Account/history loading               | Layout-matched skeleton or scoped spinner, then real/empty/error content                        |
| Account/transaction submission        | Loading button/spinner until server response; no duplicate action or false completion           |
| Percent progress                      | Absent unless a measurable task has been implemented                                            |
| Reduced-motion preference             | Disable unnecessary slide/fade transitions                                                      |

Use proper labels, semantic landmarks (`header`, `nav`, `main`, `footer`), a skip-to-content link, visible focus states, minimum practical touch targets, meaningful form error associations and live announcements for asynchronous status. Target WCAG 2.2 AA where practical, including at least 4.5:1 contrast for normal text and 3:1 for controls/meaningful UI boundaries. Confirm the actual contrast of each proposed gray token in context.

### 8.13 UI acceptance and responsive QA

- [ ] Black/white/neutral theme is consistent between landing and account pages.
- [ ] Background Cubes Grid appears in hero only, using source-compatible exports and neutral props; original prompt remains in the ZIP unchanged.
- [ ] The H1 shows the exact two-line text with one-shot typing, accessible full text, no layout jump and a static reduced-motion fallback.
- [ ] Footer is the only decorative gradient; it blends one near-black neutral base, retains legible links/focus and works across device widths.
- [ ] Skeleton appears only for layout-known content fetches, spinner for in-flight actions, and no progress bar appears without genuine measurable progress.
- [ ] WebGL degradation, missing GPU support, unmount cleanup, mobile performance, reduced motion, and keyboard CTA interaction over the canvas are checked.
- [ ] Card and CTA motion is subtle, consistent and does not hide important transaction state.
- [ ] Header, desktop navbar, footer, hero, feature/explanation sections, working CTAs and account actions are present.
- [ ] Desktop displays horizontal navbar; tablet/mobile displays a functioning collapsible sidebar and no duplicate visible desktop nav.
- [ ] Sidebar works via keyboard/touch, Escape, outside click, focus return, and breakpoint changes.
- [ ] Components are built and tested before their containing sections/pages; no repeated design-system markup across pages.
- [ ] At 320, 375, 768, 1024 and 1440px: no unexpected horizontal scrolling, clipping, unreadable text or unusable controls.
- [ ] Loading, empty, success, invalid input, duplicate and insufficient-funds states are usable without relying on color alone.
- [ ] Both CTAs and all footer/nav links lead to implemented routes/anchors; no dead links.
- [ ] Transaction amounts and balances remain server-authoritative and display without JS floating-point arithmetic.
- [ ] Source comments, Prettier, lint, typecheck, component tests and integration tests pass.

## 9. Error handling, logging and observability — frozen baseline

Public failures contain only support_ticket_id, code, a safely resolved message and an allowed recovery action. Preserve ErrorNotice, API status/code mappings, typed domain errors, unknown-error fallback, causal diagnostics, browser/global/bootstrap recovery and support-ID traceability. Do not change the shared catalog or use graphics integration as a reason to replace mapped messages with raw strings.

Preserve private timestamped API logs (support ID, code, templated route scope and redacted causes), related browser failure metadata, local-ID registration, bounded logging-failure fallback and the private-file HTTP restrictions. Browser-only failures stay in browser diagnostics; no telemetry upload or external ticketing service is introduced. Operational details remain in ../../../docs/error-handling.md.

Loading visuals consume existing states and must not hide a committed receipt, erase an unresolved intention, alter support IDs, duplicate alerts, change action destinations or resubmit a financial operation on read retry. Decorative WebGL setup/context-loss failures use the hero's static fallback without changing financial/recovery semantics.

## 10. Implemented transfer backend

The user explicitly authorized `POST /api/v1/transfers` with `source_account_id`, `destination_account_id`, positive decimal-string `amount`, preserved `reference_id`, and optional `description`. Strict shared validation rejects unknown/server-owned fields and same-account UUID case variants before acquiring a database client. Transfer UI is now separately authorized and implemented using this endpoint; ignore microservice work until requested.

The service uses one checked-out client and transaction: lock both account rows in PostgreSQL UUID order; verify both exist; check source/reference transfer duplication and ledger collisions on either account; insert one transfer record; guard and update source and destination balances; insert linked debit and credit; validate the correlated response; commit once. A failure at any step rolls back every write, including response validation after all inserts. Opposing transfers use the same lock order; standalone transactions share the account locks.

`201` returns `{ data: { transfer, debit, credit, source_account_balance, destination_account_balance } }`; each leg includes `transfer_id`. Existing account/transaction/history response shapes are unchanged, and transfer legs naturally appear in account history without changing its projection. `docs/api-reference.md` owns the full examples.

`400 VALIDATION_ERROR` covers invalid/self transfers, `404 ACCOUNT_NOT_FOUND` missing participants, `409 DUPLICATE_TRANSFER` the same source/reference even for a changed payload, `409 DUPLICATE_TRANSACTION` an existing ledger reference on either participant, `422 INSUFFICIENT_BALANCE` source overdraft, and `422 BALANCE_LIMIT_EXCEEDED` destination overflow. References remain case-sensitive and exact; both legs preserve the caller reference. Disjoint account pairs may reuse it. No automatic retries or original-response replay occur.

`20261028050000_add_transfers.sql` adds private transfer persistence, nullable links on existing transactions, and a partial unique `(transfer_id,type)` index. It is tested locally, including upgrade over populated initial tables, and is now applied to the configured Supabase project under explicit user authorization. Read-only checks verified its schema and matching local/remote migration history, with existing financial data unchanged. The initial migration is unchanged. Exactly two matching legs is a cross-row service invariant verified by rollback/concurrency/reconciliation tests.

## 11. Quality attributes and test strategy

| Concern         | Design choice                                                           | Verification                                               |
| --------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| Money accuracy  | PostgreSQL decimal arithmetic, string transport                         | Precision and arithmetic tests                             |
| Atomicity       | Single client and one DB transaction                                    | Forced failure/rollback integration test                   |
| Overspending    | Row lock and sufficient-funds rule                                      | Parallel debit test                                        |
| Idempotency     | Account-scoped unique reference                                         | Duplicate and cross-account test                           |
| Immutability    | No transaction mutation routes                                          | HTTP route tests                                           |
| History         | Stable sort, count + filter + paginate                                  | Ordering/filter/metadata tests                             |
| Maintainability | Feature modules, contracts, strict TS, comments                         | Typecheck, lint, code review                               |
| Usability       | Monochrome, component-first landing + account UI; responsive navigation | Isolated component, keyboard, breakpoint and browser tests |

## 12. Design exclusions and change control

No background job processing is required: credit/debit transactions must complete synchronously to provide a definite outcome. No caching of balances is needed. Do not redesign the ledger around eventual consistency. Any future authentication, multi-currency support, bulk imports or account deletion requires corresponding design, database, and test updates.

**Cross-references:** `rules.md` (code standards), `assumption.md` (decisions and open questions), `schema.md` (PostgreSQL and lock design), `structure.md` (ownership), `plan.md` (implementation milestones).

## Transfer UI follow-up

The existing Express boundary and deployed POST /api/v1/transfers remain unchanged. Within AccountWorkspace, stack the existing transaction card and a transfer card beside history on desktop; retain single-column tablet/mobile composition. Source identity is fixed to the route; use Account/UUID labels when names are unavailable. The independently tested TransferReview, TransferReceipt and TransferForm reuse shared controls/tokens, then compose into the workspace. API adapters and the useTransferIntent hook own HTTP/lifecycle details; all folders expose index.ts entries.

States are editing, reviewing, submitting, uncertain, success and conflict. Review shows the immutable normalized command; confirmation persists it before HTTP. Only 201 with a correlated shared-contract response becomes success. Timeouts/network/5xx/invalid receipts stay uncertain and preserve identical retry; no automatic resend or new reference is generated. A conflict never fabricates success and requires explicit account-review acknowledgement before another intent. Known rejection retains editable fields.

Success/conflicts/balance rejections refresh authoritative source reads; destination navigation loads fresh data. Receipt balance snapshots are labelled after transfer. A read failure retains the receipt and last confirmed balance with explicit stale feedback; read retry cannot invoke the write path. Tests cover storage, timeout, duplicate, late-response, account-switch, refresh and actual local API/database behavior. No gateway, tokenization, authentication, backend, contract or migration changes accompany this UI enhancement.

### Account navigation and end-to-end review follow-up (2026-10-28)

The user's confirmed rule retains nonunique display names. AccountAccessAction presents Create an account when no account is selected and Log out after creation or a verified balance read. ActiveAccountProvider stores only a validated tab-scoped Account ID and optional known name. ActiveAccountCard and landing CTAs offer My account while selected; lookup can still open another account. Log out clears selection and returns home, preserving ledger data and unresolved commands. This is workspace navigation, without authentication or a new backend endpoint. Use Account ID in UI copy; retain the UUID format and Account/name fallback.

Normalize account route identity to lowercase so case variants share the same workspace and retry state. Correlate balance/transaction/history responses with their requests. Persist standalone retry commands before POST, focus invalid descriptions, refresh authoritative reads on rejected balance guards, and never let failed read refreshes reclassify a committed write. A definitive missing-account read removes stale balance/write controls. Unknown network outcomes and retry configuration failures preserve original commands.

Centralized error architecture: shared contracts own the strict failure schema, code/action unions and exhaustive public message resolver. API errors own typed domain classes and private causal logging; final middleware maps unknown errors and SQL/parser failures, generates server support IDs and emits safe envelopes. Browser errors own typed normalization, deduplicated bounded diagnostics, validation mapping and safe sync/async callbacks. ErrorNotice owns the four-field error presentation and action labels. React/global/bootstrap boundaries handle unexpected failures. Feature hooks keep recovery policy for their operation, with exact financial retries and read-only refresh actions. A combined balance/history failure shows one notice with a retry of both reads. See docs/api-reference.md for the coordinated failure-envelope change and diagnostics limits.

Error-handling review: preserve router mount context in response locals before Express unwinds errors. Use the shared API JSON logger formatter for trusted injectable sinks, retaining timestamps, safe validation paths and redacted causal metadata. Keep a bounded private fallback if logging itself fails. Register displayed browser errors in ErrorNotice, link coalesced IDs in private metadata, and disable pending recovery actions. Combined balance/history failures retain the history view in a waiting state and expose one read-only Retry account action. Correlation mismatches retain valid server IDs but stay unconfirmed. See docs/error-handling.md for the operational lookup procedure and real browser/API trace evidence.

## v0.3 reconciliation and UI-only implementation constraints

- This file retains the actual backend/transfer/error contracts and delivered behavior. Existing sections naming optional future operational improvements are contextual, not authorized tasks for this revision. API-reference and error-handling docs remain authoritative implementation evidence.
- The account area still includes transfers and receipts. Preserve Account ID labels, account-aware entry/logout and all states listed in assumption.md C-01–C-10. No new domain hooks, transport endpoints, validation, persistence or financial algorithms are proposed.
- New loading views consume existing flags. Initial content can use shape-matched skeletons; refresh retains confirmed balance/receipt data with the existing stale/waiting/error semantics. Do not replace a retained receipt with a page loader, reset pagination differently or change the single Retry account action.
- Keep the source prompt byte-for-byte, but treat it as reference material. Its CLI/install/copy commands remain unexecuted until approval. Vite/manual integration follows this repository's index.ts entries: cn lives in lib/utils.ts, is exported from lib/index.ts, and source imports adapt to that entry. The cube component/types are exported through components/ui/index.ts; styles/tailwind.css is installed once through styles/index.ts. Record these integration differences later.
- Tailwind utilities are limited to this visual integration; audit reset/layer effects against existing token-driven controls. Do not scaffold shadcn/Next or replace the icon system to import unrelated demo marketing. WebGL failure degrades inside HeroBackdrop instead of replacing the app with a global failure screen. No dark-theme feature or progress bar is added.
- All new visual components and wrappers receive their own props/state/accessibility tests before pages consume them. Verify all existing functionality, exact money formatting and error ID correlation unchanged, then test motion, context loss, cleanup and layouts at the five approved widths.

## User refinement — desktop hover only (2026-10-28)

The latest direct instruction overrides broader reference/default animation behavior: use the supplied isometric shader/geometry/physics at normal visibility, only while a mouse hovers within the hero on desktop (minimum 1024px and hover/fine-pointer capability). Set `idleRipples=false`; never auto-play. Unmount/dispose on pointer leave/cancel, window blur, breakpoint change or graphics failure. Touch/pen, mobile/tablet, reduced motion and unsupported/limited devices use a clean static neutral background. Do not substitute an illustrated repeating cube tile or fade the reference effect behind an opaque copy panel. Existing ledger copy, preview and functional CTAs remain.
