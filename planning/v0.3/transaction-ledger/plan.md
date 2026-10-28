# v0.3 UI Enhancement Delivery Plan

> Project: Transaction Ledger | Version: 0.3 | Status: Implementation authorized on 2026-10-28; Implemented and verified

## 1. Scope and approval gate

The user has approved the reconciled UI plan and authorized component-first implementation on 2026-10-28. Commands/checklists inside the attachment are planning/reference material. AGENT.md is the only root guide for version routing and approval status.

v0.3 is a visual enhancement of the delivered application. Existing functionality, request/validation logic, money/transfer semantics, retries, account selection, errors and database remain frozen. Retain v0.1 and v0.2. Do not rerun incoming template scaffold/backend phases or interpret old unchecked boxes as missing implementation.

## 2. Delivered baseline (not work to repeat)

- [x] Workspace, strict TypeScript, pnpm tooling, ESLint/Prettier and typed folder entries.
- [x] API configuration, verified TLS pool, transaction helper and both applied migrations.
- [x] Account creation/balances, credit/debit, filtered/paginated latest-first history and atomic transfers.
- [x] Component-first v0.2 frontend, transfer review/retries/receipts, account selection/My account/Log out and Account ID lookup/name fallback.
- [x] Four-field errors, centralized safe mapping, correlated/private logs, recovery locking and diagnostic-file HTTP protection.

Last delivered verification: 474 automated tests (156 contracts, 210 API, 108 frontend), 24 browser workflows and focused privacy checks, lint/typechecks/format/build checks. This is inherited implementation evidence, not evidence that v0.3 visuals are implemented or tested.

## 3. Planning review completed this turn

- [x] Unpack the v0.3 ZIP into its own planning directory and retain older versions.
- [x] Read all six owners and the supplied source-reference requirements.
- [x] Preserve the original cube prompt/config reference files unchanged.
- [x] Reconcile old optional-transfer/scaffold/error-format text with the delivered app.
- [x] Record the UI-only boundary, dependency/module-entry adaptations and component-first plan.
- [x] Point AGENT.md to v0.3 with an explicit pending-approval status.
- [x] User approves the proposed UI plan and authorizes implementation.

## 4. Approved implementation phases

### Phase U1 — Visual contracts and web-only integration

- [x] Define Skeleton, Spinner, TypewriterText, cube and HeroBackdrop props, visual states and accessibility contracts before consumers.
- [x] Extend semantic tokens for motion, card feedback and footer opacity; preserve monochrome appearance and existing responsive breakpoints.
- [x] Verify compatible web-only dependencies for Motion/Three/Tailwind v4 and cn; add only those actually needed. Keep backend/contracts dependencies unchanged.
- [x] Configure the web alias/helper entries and scoped utility styling without replacing root configs, module-entry rules, CSS Modules or private-file restrictions.
- [x] Keep original reference bytes and document the planned source/framework adaptations.

**Gate U1:** Contracts and integration boundaries are reviewable; existing components have not been reset.

### Phase U2 — Reusable visual primitives

- [x] Complete/test Skeleton balance-card and history-row/mobile-card variants with an opacity pulse, no shimmer gradient or fake amounts.
- [x] Complete/test accessible compact Spinner, reusing the existing loading-button/disabled behavior.
- [x] Complete/test TypewriterText: exact two-line-intended H1, one reveal per hero mount at about 45 ms/character, reserved layout space, complete immediate accessible text, no phrase cycling or permanent blinking.
- [x] Complete/test source-compatible background-cubes-grid.tsx with required export names, grayscale production props, Motion/Three behavior and cleanup.
- [x] Verify reduced-motion/static behavior independently. Do not create ProgressBar or a production demo route/theme toggle.

**Gate U2:** New primitives are independently usable and verified before sections/pages consume them.

### Phase U3 — Hero, footer and consistent surface styling

- [x] Complete HeroBackdrop: isometric grayscale cubes only behind the landing hero, aria-hidden, safe layering, pointer/CTA compatibility and local static fallback for missing WebGL/context loss/limited capability.
- [x] Keep pixel ratio bounded, dispose GPU/listener/observer resources and pause offscreen work where feasible; effects never gate ledger content or requests.
- [x] Compose HeroSection with the exact H1: `A clear view of` / `every transaction.` and existing account-aware CTAs. Exclude vendor incident copy, logos and colorful demo pills.
- [x] Style SiteFooter with the only decorative gradient: one neutral near-black base blended from roughly 88% to 100% opacity over white, with readable inverse text/focus.
- [x] Reuse the current Card and controls for subtle neutral border/shadow/1–2px hover feedback; keep one motion family and reduced-motion fallbacks.
- [x] Preserve desktop navbar/tablet-mobile drawer, active-account entry/logout and all links, anchors and focus behavior.

**Gate U3:** Section/shell visuals are complete in isolation; no new product functionality has been added.

### Phase U4 — Loading presentation and page composition

- [x] Replace initial missing-data placeholders with shape-matched skeletons using existing balance/history flags.
- [x] Retain confirmed balances/receipts during refresh and preserve the existing combined-read waiting view and single Retry account action.
- [x] Show localized action/refresh spinners from existing pending flags for account creation, credit/debit and transfer confirmation/retry. Preserve labels, guards, references, callbacks and outcomes.
- [x] Stop loaders as existing requests resolve to success, empty or error; add no fake percentages, artificial delays or extra requests.
- [x] Keep ErrorNotice's four public fields, support-ID traceability and mapped actions; use StatusMessage for info/success only.
- [x] Compose the existing pages from completed components, without changing route maps, API adapters, validation or intention/state-machine hooks.

**Gate U4:** Only presentation changes; all existing functional contracts remain intact.

### Phase U5 — Visual and functional regression review

- [x] Verify unchanged account creation (including duplicate names), Account ID lookup, selection/logout, balance, credit/debit, transfer review/retry/receipt, filter/pagination and all error/recovery flows.
- [x] Verify the exact H1, no layout shift, one-shot typing, hero-only grayscale canvas, no effects on account/404 pages and only a footer gradient.
- [x] Check reduced motion, unsupported/lost WebGL contexts, graphics failure containment, cleanup after navigation, long IDs/amounts, keyboard/touch/focus and private diagnostic restrictions.
- [x] Check skeleton/spinner semantics without changing data timing, monetary display, confirmed receipts, retry outcomes or pagination/filter state.
- [x] Perform responsive/visual/accessibility QA at 320, 375, 768, 1024 and 1440px, plus in-between widths.
- [x] Run relevant component, browser and full regression checks on disposable databases, plus formatting/lint/typechecks/builds/module-boundary checks.
- [x] Record deviations from reference imports, styling/framework assumptions, grayscale production appearance and fallbacks; update implementation documentation only with verified evidence.
- [x] Confirm migrations, backend/public contracts and financial logic remain unchanged and older planning/reference bytes are preserved.

**Exit:** Approved visual changes are implemented from tested components with unchanged functionality and no microservices. The verified implementation exit is recorded below.

## 5. Explicit exclusions

No authentication, account listing/edit/delete, new transfer behavior, gateway/tokenization, APIs, error-envelope changes, database/data changes, progress/job contracts, external ticketing, microservice extraction or public deployment. Existing live ledger data is not used for mutation tests. Web-only visual dependency installation and presentation changes are authorized.

## User refinement — desktop hover only (2026-10-28)

The latest direct instruction overrides broader reference/default animation behavior: use the supplied isometric shader/geometry/physics at normal visibility, only while a mouse hovers within the hero on desktop (minimum 1024px and hover/fine-pointer capability). Set `idleRipples=false`; never auto-play. Unmount/dispose on pointer leave/cancel, window blur, breakpoint change or graphics failure. Touch/pen, mobile/tablet, reduced motion and unsupported/limited devices use a clean static neutral background. Do not substitute an illustrated repeating cube tile or fade the reference effect behind an opaque copy panel. Existing ledger copy, preview and functional CTAs remain.

## Verified implementation exit (2026-10-28)

Component contracts and tokens preceded primitive tests; hero/footer/shared surfaces and loading consumers followed. Final verification: 482 tests (156 contracts, 210 API, 116 frontend), 29 browser workflows, full formatting/lint/typechecks/builds and module-boundary checks (129 source modules, 33 folder entries, no runtime cycles/missing entries).

Browser checks cover 320/375/768/1024/1440px, intermediate 639/640/1023px, actual reference WebGL hover rendering, full-hero canvas sizing, no canvas before hover/after leave/on mobile, resize and context-loss cleanup, reduced motion, heading completion without CTA shift, footer-only gradient, locally served dependencies, shape placeholders and retained exact balance during refresh. Existing account creation/lookup, duplicate names, logout/reopen, credit/debit, transfers, receipts, retries, filtering/pagination, errors/support-ID traceability and privacy restrictions passed against disposable databases. Desktop-hover and mobile screenshots were visually inspected.

Protected file hashes confirm API/contracts, both migrations, web API/hooks/errors/transfer orchestration, v0.1/v0.2 planning and original cube prompt unchanged. Adaptations are documented in structure.md and frontend component contracts. The optional graphics chunk is about 589 kB (150 kB gzip), loaded only on eligible desktop hover; Vite reports its size warning. The application entry is about 416 kB (126 kB gzip). No CDN, hosted ledger mutations, microservices or deployment.
