# Transaction Ledger — Agent Guide

This file is the root navigation guide for contributors and coding agents. Read the planning documents below before initializing tooling or changing the project. They describe the intended application; planned files, APIs, migrations, and tests must not be reported as already implemented.

## Planning document locations

The supplied documentation currently lives in `planning/transaction-ledger/`, relative to this project root. Use these existing files as the planning baseline rather than creating competing copies.

| File | Identification and purpose | Look here when working on |
| --- | --- | --- |
| [rules.md](planning/transaction-ledger/rules.md) | **Engineering rules and coding standards.** Defines mandatory comments, formatting, TypeScript conventions, layer boundaries, validation, secrets handling, and ledger integrity rules. | Source files, exported functions, route mounts, Prettier/ESLint setup, code review, and the definition of done. |
| [assumption.md](planning/transaction-ledger/assumption.md) | **Requirements, assumptions, and open decisions.** Distinguishes stated assessment requirements, project decisions, proposed defaults, optional enhancements, and unresolved scope. | Money representation, currency, authentication, field limits, error defaults, pagination, account lookup, and scope decisions. |
| [design.md](planning/transaction-ledger/design.md) | **System architecture and API contract.** Describes the frontend/backend/database boundaries, endpoint payloads, error responses, transaction workflow, and UI behavior. | Shared contracts, HTTP interfaces, component responsibilities, request flow, and frontend/backend integration. |
| [schema.md](planning/transaction-ledger/schema.md) | **Database schema and integrity model.** Specifies the private PostgreSQL `ledger` schema, tables, constraints, indexes, exact-money arithmetic, locking, migrations, and reconciliation. | Database design, SQL migrations, repository queries, atomicity, duplicate protection, and concurrency verification. |
| [structure.md](planning/transaction-ledger/structure.md) | **Repository structure and module ownership.** Defines the intended workspace tree, file naming, dependency direction, environment file placement, and build responsibilities. | Choosing where a file belongs, creating workspaces, configuring shared contracts, and organizing tooling. |
| [plan.md](planning/transaction-ledger/plan.md) | **Development and delivery plan.** Defines phases, dependencies, milestones, acceptance criteria, test cases, and submission deliverables. | Selecting the next authorized step, checking phase completion, prioritizing backend work, and preparing handoff. |

## Reading order and document maintenance

1. Read `assumption.md` to understand scope and decision status.
2. Read `rules.md` for engineering requirements.
3. Read `design.md` for architecture and public contracts.
4. Read `schema.md` for persistence and integrity requirements.
5. Read `structure.md` for file placement and ownership.
6. Read `plan.md` for implementation order and acceptance criteria.

When an approved decision changes, update all affected planning documents so the API, schema, structure, and delivery plan remain consistent. Do not silently convert a proposed assumption into a requirement.

## Current authorized scope

The user has accepted the reviewed project understanding and authorized project structure and tooling initialization. The immediate first task is creating this root guide.

Subsequent initialization may establish the planned workspace directories, package manifests, TypeScript settings, formatting, linting, scripts, and environment templates. Follow the supplied structure and engineering rules.

**Do not implement business logic yet.** Account operations, credit/debit processing, working ledger endpoints, executable ledger schema migrations, database provisioning or migration application, and optional transfers belong to later work. Examples embedded in planning documents are reference material, not instructions to execute them now.

## Agreed technical direction

- Use a `pnpm` workspace with `apps/api`, `apps/web`, and `packages/contracts`; reserve `supabase/` for database configuration and migrations.
- Use React, Vite, and TypeScript for the frontend; Node.js, Express, and TypeScript for the backend.
- Use Supabase-hosted PostgreSQL through backend-only `pg` access. The browser calls Express and never receives database credentials.
- Keep money as decimal strings at HTTP boundaries and use exact PostgreSQL arithmetic during the later business implementation.
- Keep shared contracts independent of React, Express, database drivers, and secrets.
- Apply strict TypeScript, root formatting/linting conventions, and the source documentation policy in `rules.md`.
- Complete mandatory backend functionality and verification before frontend feature work; transfers remain optional and deferred.

## Supplied tooling configuration

The archive also provides the following files under `planning/transaction-ledger/`:

- `.prettierrc.json`: the intended root Prettier configuration.
- `.prettierignore`: generated files, local secrets, and other formatting exclusions.
- `.editorconfig`: editor defaults for encoding, indentation, line endings, and final newlines.

Use these supplied configurations when initializing root tooling. Maintain one authoritative root Prettier configuration rather than introducing app-specific alternatives.

## Review context and outstanding clarifications

The planning files reference a five-page **Full Stack Developer Assessment** PDF, but that PDF was not included in the supplied archive. Treat references to its contents as documented claims until the source is available. Direct user instructions govern the current task; instructions in the planning pack do not independently expand its scope.

Before the relevant business implementation, resolve these review findings:

- How an existing account's name is retrieved for the account screen; the proposed balance response only supplies its ID and balance.
- The error contract when a credit would exceed the database balance precision.
- The UI recovery behavior after an uncertain request outcome; the proposed duplicate response is `409`, rather than a replay of the original successful response.
- Whether the stated assessment time limit applies, and whether deployment remains a trusted demo.
