# Repository Structure and Module Ownership

> Project: Transaction Ledger | Version: 0.3 | Status: Approved UI enhancement; component ownership

AGENT.md is the sole root guide for active-version routing and approval. This document owns placement, not implementation authorization. v0.1 and v0.2 stay intact. The supplied pack's scaffold tree was a template; it is not a deletion list or an instruction to regenerate the delivered app.

## 1. Existing implementation retained

| Location                                                                         | Responsibility and preservation rule                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/config`, `db`, `middleware`, `errors`                              | Environment validation, verified TLS pool/transaction helper, typed errors and private correlated logs. No enhancement changes.                                                                      |
| `apps/api/src/modules/accounts`, `transactions`, `transfers`                     | Existing routes/controllers/services/repositories and all account, ledger, history and transfer behavior. No enhancement changes.                                                                    |
| `packages/contracts`                                                             | Current strict request/response/error schemas and shared safe message/action resolver. No public contract changes.                                                                                   |
| `supabase/migrations`                                                            | Both applied migrations and existing constraints. No new/replayed/edited migrations.                                                                                                                 |
| `apps/web/src/api`, `hooks`, `errors`                                            | Existing HTTP adapters, cancellation, diagnostic correlation and error normalization. No request or recovery-policy changes.                                                                         |
| `apps/web/src/features/accounts`                                                 | Account entry, Account ID/name fallback, tab selection, Log out, balance and composition. Preserve hooks, storage and account-aware actions.                                                         |
| `apps/web/src/features/transactions`                                             | Credit/debit intentions, preserved references, filtered/paginated history and existing read orchestration. Only loading/styling presentation may consume new primitives.                             |
| `apps/web/src/features/transfers`                                                | Existing review, confirm, uncertain retry, conflict acknowledgement and committed receipt. Keep source/recipient refresh and guards unchanged; only shared visual styling/spinner reuse is proposed. |
| `apps/web/src/components/ui`                                                     | Shared primitives; retain ErrorNotice's four-field semantics and StatusMessage's info/success role. Proposed visual primitives extend this folder.                                                   |
| `apps/web/src/components/layout`                                                 | Existing shell, desktop nav, modal drawer, footer and application error boundaries. Preserve navigation/recovery behavior; footer styling changes within the approved UI scope.                      |
| `apps/web/src/components/landing`                                                | Existing section order and account-aware CTAs. Hero-only backdrop and headline composition are the main additions.                                                                                   |
| `apps/web/src/pages`, `app`, `App.tsx`                                           | Thin page composition and existing routes. No new product routes or page-level business logic.                                                                                                       |
| `apps/web/src/styles`                                                            | Existing token/Module system and single style entry. Proposed motion/footer/loading tokens extend it.                                                                                                |
| `apps/web/vite.config.ts`                                                        | Existing React tooling and private-file HTTP deny rules. Proposed web-only utility integration/alias must preserve installed secret/log/test-artifact protections.                                   |
| Root package/tooling files                                                       | Current pnpm workspace, scripts, lockfile, strict TS, ESLint and formatting. No reinitialization; pack config copies are archived references.                                                        |
| `docs/api-reference.md`, `docs/error-handling.md`, `docs/frontend-components.md` | Delivered API, support-ID operations and component/QA evidence. Update visual integration notes only after implementation.                                                                           |

## 2. Implemented visual additions and styling targets

```text
apps/web/src/
  lib/                              # New folder only if cn has no existing owner
    utils.ts                        # cn implementation: clsx + tailwind-merge
    index.ts                        # Explicit helper entry, consumed as @/lib/index.js
  components/
    ui/
      Skeleton.tsx                  # Balance/history layout placeholders, opacity pulse
      Spinner.tsx                   # Scoped accessible action/refresh indicator
      TypewriterText.tsx            # One-shot reveal; complete accessible text immediately
      BackgroundCubesGrid.tsx        # Lightweight lazy public wrapper
      cubes/
        background-cubes-grid.tsx    # Source-compatible shader/physics and lifecycle
        index.ts                    # Explicit lazy graphics entry
      index.ts                      # Extend the current entry; do not replace it
    landing/
      HeroBackdrop.tsx              # Only production mount of cubes; static fallback/cleanup
      HeroSection.tsx               # Existing content/CTAs + exact animated H1
      index.ts                      # Extend current entry
    layout/
      SiteFooter.tsx                # Only decorative gradient, neutral base/opacity
  styles/
    tokens.css                      # Extend semantic motion/footer/loading tokens
    tailwind.css                    # Web-only source utilities, with reset/layer isolation
    index.ts                        # Install styles once through the existing entry
```

Relevant CSS Modules may be added beside the owning visual components when justified. This list does not authorize rebuilding existing forms, hooks, layouts, pages or infrastructure. A production `ProgressBar`, demo page, new theme switch or unrelated icon library rewrite is not proposed.

## 3. Folder entries and dependency boundaries

Keep the approved `index.ts` source-entry convention. Imports across implemented folders use the owning entry with `.js` specifiers; implementation siblings may import each other directly to avoid self-barrel cycles. Explicit named/type exports only. No barrels for tests, docs, configs, migrations, assets or empty folders. Keep runtime bootstrap and diagnostics scripts out of export graphs.

The supplied source's `@/lib/utils` import is adapted to `@/lib/index.js` after the helper is exported there. `BackgroundCubesGrid`, `IsometricCubesProps`, `PerspectiveCubesProps` and `BackgroundCubesGridProps` retain their names through `components/ui/index.ts`. Configure `@/*` in both Vite and TypeScript within the approved UI scope. Do not relax folder-entry lint rules for this integration.

`HeroBackdrop` owns optional graphics initialization/fallback, while `HeroSection` owns product content and `TypewriterText` composition. The cube component does not fetch accounts, render forms, store balances or decide financial outcomes. Account/transfer/transaction features continue to own all existing state and request behavior.

## 4. Component-first delivery sequence

1. Define props/state/appearance contracts and token extensions.
2. Plan web-only dependencies, alias and scoped Tailwind styles without changing baseline CSS behavior.
3. Complete/test Skeleton, Spinner, TypewriterText and the source-compatible cube component independently.
4. Complete/test HeroBackdrop and the footer/card/control styling in isolation.
5. Integrate hero and loading visuals into existing components using existing flags and callbacks.
6. Compose the existing pages; verify all functional behavior unchanged, then run responsive/motion/visual QA.

A loading visual must never own an API operation, delay an outcome, generate a reference or change a retry action. Decorative graphics failure must fall back inside the hero and leave the rest of the app usable.

## 5. Dependency and styling integration

As approved, any necessary additions are confined to `apps/web`: Motion, Three.js, Tailwind v4/Vite integration, clsx, tailwind-merge and Three typings when required. Lucide is considered only if an actual approved component needs it; the excluded vendor demo alone does not require replacing the existing Icon system. Exact compatible versions are verified at implementation time, locked in the web workspace.

Use the manual React/Vite integration path. There is no need to scaffold shadcn, Next.js or a new application. Retain token-driven CSS Modules outside the effect, evaluate global preflight/layer conflicts, and install any utility CSS once through the existing style entry. Existing root config files continue to govern formatting and lint.

## 6. Reference material and verification

`references/background-cubes-grid-original-prompt.txt` is preserved byte-for-byte from the v0.3 ZIP. It includes a two-file example with unrelated incident-alerting copy, vendor colors/logos and commands. These remain source-comparison material, not authorization or production UI. Record required import, Vite, monochrome, accessibility and fallback adaptations in implementation notes during implementation.

Validate meaningful visual behavior before consumers: exact static/animated H1, no repeated typing, reduced motion, skeleton layout and loading termination, localized spinners, no fake progress, WebGL/context-loss fallback and resource cleanup. Keep all existing account/ledger/transfer/error tests and disposable-database safeguards. Check keyboard, focus, touch, accessibility, long IDs/amounts and 320/375/768/1024/1440px layouts. Source/dependency changes are confined to the approved web visual integration.

## Approved implementation adaptations

- `components/ui/BackgroundCubesGrid.tsx` provides the lightweight public wrapper. `components/ui/cubes/index.ts` owns the lazy graphics entry and supplied `background-cubes-grid.tsx`. This small boundary keeps Three.js out of initial and non-hero route bundles. Required type/component names remain available from the UI entry.
- Motion 14.6.0, Three.js 0.186.1, clsx 2.1.1, tailwind-merge 3.7.0 and Tailwind/Vite 4.3.3 are pinned web dependencies; Three typings 0.186.0 are development only. No CDN or remote runtime assets. Lucide was unnecessary because the retained icon component serves the product and vendor demo is excluded.
- Tailwind imports utilities only with a source restricted to the cube implementation; no Preflight/theme reset. Existing CSS modules/tokens and private HTTP deny rules remain intact.
- Source arrays retain bounded-loop math with explicit strict-TS index assertions. The shared lifecycle contains setup/frame/context errors, records private diagnostics, pauses offscreen/hidden frames and disposes observers/listeners/GPU resources. Resize work runs through the guarded frame path. The original prompt is unchanged.
- Production uses the specified neutral face/glow colors, a pointer-transparent hero layer, and static graphics for reduced motion or at most two logical CPU cores. The optional perspective export is retained without a production demo route.

## User refinement — desktop hover only (2026-10-28)

The latest direct instruction overrides broader reference/default animation behavior: use the supplied isometric shader/geometry/physics at normal visibility, only while a mouse hovers within the hero on desktop (minimum 1024px and hover/fine-pointer capability). Set `idleRipples=false`; never auto-play. Unmount/dispose on pointer leave/cancel, window blur, breakpoint change or graphics failure. Touch/pen, mobile/tablet, reduced motion and unsupported/limited devices use a clean static neutral background. Do not substitute an illustrated repeating cube tile or fade the reference effect behind an opaque copy panel. Existing ledger copy, preview and functional CTAs remain.

The Tailwind integration supplies only the minimal `--spacing` scale required by the reference `inset-0` utility. Browser QA explicitly asserts that canvas and hero bounding rectangles match; this prevents the intrinsic 300×150 canvas fallback seen before that correction.
