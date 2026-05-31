# Project Overview

Fortuna is a personal finance application structured as a Docker-first pnpm/Turborepo monorepo with two deployable apps (`apps/api`, `apps/web`) and a shared config package (`packages/config`). The API (NestJS + TypeORM + PostgreSQL + Redis) owns all persistence, authentication, sessions, rate limiting, and Prometheus metrics; the web app (Next.js App Router + React 19 + Tailwind v4 + shadcn/ui) is a thin client that consumes the API over HTTP and handles the Google OIDC code exchange on the server. Releases are independent per project, driven by Conventional Commits and `nx release`. The development environment runs entirely inside Docker; host commands are routed through `bin/fortuna` into the long-lived `workspace` container.

# Tech Stack & Environments

- Runtime: Node 24.x (`package.json` `engines.node`)
- Package manager: pnpm 11.1.0 (workspace + catalog)
- Monorepo orchestration: Turborepo 2.9, Nx 22.7 (release only)
- API: NestJS 11.1, TypeORM 0.3, PostgreSQL 17, Redis (ioredis), `jose` for JWT, `prom-client`
- Web: Next.js 16.2 (App Router, `output: "standalone"`), React 19.2, Tailwind CSS 4.3, shadcn/ui (`new-york`/`neutral`), TanStack Query, `openid-client`
- Tooling: Biome 2.4 (lint + format), Jest 30 (unit + integration), Playwright 1.60 (e2e), `testcontainers` (integration), `commitlint` + Conventional Commits, `tsx`
- Infra (dev): Postgres, Redis, Prometheus, Grafana, mock-oauth2-server — all via `docker-compose.yaml`
- CI environments: dev (`.env` from `.env.example`), e2e (fixtures pinned in `docker-compose.e2e.yaml`), CI migration-check (`ci` GitHub Environment, whitelisted by `.env.example`). See `docs/release.md`.
- Host requirements: Docker only. Node/pnpm on host are optional and not the recommended path.

# Core Executable Commands

All compute runs inside the `workspace` container via `bin/fortuna`. Never run `pnpm`/`jest`/`turbo`/`nest` directly on the host.

```bash
# First-time setup
./scripts/setup-env.sh                                 # creates .env from .env.example (-f to overwrite)
docker compose up -d                                   # postgres, redis, migration, api, web, workspace

# Workspace shell + arbitrary commands
bin/fortuna                                            # interactive shell in workspace container
bin/fortuna pnpm install                               # install deps
bin/fortuna pnpm turbo build                           # build all
bin/fortuna pnpm turbo build --filter=api              # build one workspace

# Lint / format / type-check (Biome — single tool)
bin/fortuna pnpm turbo check                           # lint + format check, all workspaces
bin/fortuna pnpm turbo check:fix                       # auto-fix
bin/fortuna pnpm turbo lint --filter=web               # filtered

# Tests
bin/fortuna pnpm turbo test --affected                 # all affected workspaces
bin/fortuna pnpm turbo test --filter=api               # one workspace
bin/fortuna pnpm --filter api test:integration         # API integration suite (testcontainers)
bin/fortuna e2e                                        # full Playwright run (isolated compose project) + teardown

# Database migrations (TypeORM, API-side only)
bin/fortuna db migration:generate <Name>               # generate from entity diff — REVIEW SQL BEFORE COMMIT
bin/fortuna db migration:run                           # apply pending
bin/fortuna db migration:revert                        # revert last
bin/fortuna db migration:show                          # show status

# Production-parity / CI reproduction
docker compose -f docker-compose.prod.yaml up -d       # prod Docker target locally
```

Canonical reference: [`docs/development.md`](./docs/development.md), [`docs/release.md`](./docs/release.md), [`apps/api/README.md`](./apps/api/README.md), [`apps/web/README.md`](./apps/web/README.md).

# Codebase Architecture Map

```
apps/
  api/                                NestJS backend — sole DB owner
    src/
      auth/                           OAuth callback, sessions, rate-limit, fingerprint, sign-in events
      users/                          User-facing endpoints (delete account, etc.)
      database/                       TypeORM datasource + migrations/ (generated, never hand-written)
      metrics/                        /metrics endpoint + Prometheus counters/histograms
      main.ts, app.module.ts          NestJS bootstrap
    test/                             Integration tests (jest-integration.json)
    scripts/generate-migration.sh     Wrapper invoked by `bin/fortuna db migration:generate`
  web/                                Next.js App Router frontend — no DB access
    src/
      app/                            Routes grouped by auth state — (authenticated)/* and (unauthenticated)/*; plus /privacy, /terms, /api/auth/*
      components/                     shadcn (vendored, do not edit) + app components
      lib/auth/                       Auth feature: actions.ts, api-client.ts, cookies.ts, env.ts, oidc.ts
      lib/utils.ts, lib/constants.ts  Shared web utilities only
    e2e-tests/                        Playwright specs
packages/
  config/                             @fortuna/config — shared Biome / TS / Jest configs
docker/                               Auxiliary base images (cli, playwright, grafana, prometheus, mock-oauth2)
docs/
  development.md, release.md          Operational guides
  architecture/decisions/             ADRs 0000–0014 (numbered, MADR-style)
  runbooks/                           On-call procedures (auth-operator.md, secrets-rotation.md)
bin/fortuna                           Docker wrapper — single entry point for ALL pnpm/test/lint/migration calls
scripts/setup-env.sh                  Materializes .env from .env.example
docker-compose.yaml                   Dev stack
docker-compose.prod.yaml              Prod-target stack (CI migration-check + local prod parity)
docker-compose.e2e.yaml               Isolated Playwright stack (project: fortuna-e2e)
```

Deeper architecture rationale lives exclusively in `docs/architecture/decisions/`. Consult ADRs before changing any structural pattern listed below.

# Canonical Documentation Index

Agents MUST consult these before making structural decisions. Do not duplicate or restate their contents elsewhere.

### Architecture & ADRs (`docs/architecture/decisions/`)
- `0000-record-architecture-decisions.md` — ADR process
- `0001-adopt-monorepo-with-pnpm-turborepo-and-nx-release.md` — Monorepo + release model
- `0002-adopt-nestjs-typeorm-and-postgresql-for-the-api.md` — API stack
- `0003-adopt-nextjs-tailwind-and-shadcn-for-the-web-app.md` — Web stack; shadcn vendoring rule
- `0004-standardize-tooling-on-biome-and-jest.md` — Linting/formatting/testing
- `0005-docker-first-development-environment.md` — `bin/fortuna` model
- `0006-conventional-commits-and-nx-driven-release.md` — Commit + release contract
- `0007-split-oauth-between-web-and-api-and-trust-the-google-id-token.md` — OAuth split
- `0008-opaque-session-tokens-with-server-side-state.md` — Session model
- `0009-provider-agnostic-identity-schema.md` — Identity schema
- `0010-hard-delete-on-erasure-anonymize-the-audit-trail.md` — LGPD deletion semantics
- `0011-redis-sliding-window-rate-limiter-that-fails-open.md` — Rate limiter contract
- `0012-self-hosted-prometheus-and-grafana-for-observability.md` — Observability
- `0013-single-root-env-file-materialized-from-ci-with-a-whitelist.md` — Env var policy
- `0014-reserve-e2e-for-playwright-behind-an-isolated-compose-stack.md` — E2E policy

### API Contracts
- No OpenAPI/contract artifact yet. Source of truth is `apps/api/src/**/*.controller.ts` + DTOs in `apps/api/src/**/dto/`. If introducing a contract artifact, write an ADR first.

### Database / Schema
- `apps/api/src/database/connection.ts` — TypeORM datasource
- `apps/api/src/database/migrations/` — Applied migrations (generated only)
- Entities co-located with feature modules (e.g. `apps/api/src/auth/entities/`)

### Deployment / Infra
- `docs/release.md` — Release pipeline, env-var policy, auxiliary images
- `.github/workflows/` — `on-merge-to-main.yml`, `on-tag-publish.yml`, `pull-request-checks.yml`, `build-auxiliary-docker-images.yml`

### Runbooks / Operations
- `docs/runbooks/auth-operator.md` — Auth alerts → remediation
- `docs/runbooks/secrets-rotation.md` — Per-secret rotation procedure

### Contributing / Team Conventions
- `CONTRIBUTING.md` — PR rules, commit format
- `.commitlintrc.json` — Allowed Conventional Commit types

# Coding Conventions & Styles

Biome is the single source of truth for formatting and linting (`biome.json` extends `@fortuna/config/biome`). Run `bin/fortuna pnpm turbo check:fix` before claiming a task complete. Rules below are deterministic constraints not captured by Biome.

### General
- Do: prefer self-documenting names; use early returns; throw for impossible states.
- Do: match existing patterns in the touched module before introducing new ones.
- Avoid: comments. Only add for public API docs, non-obvious algorithms, or critical business logic.
- Avoid: helper utilities or abstractions added "for future use." Build for the current requirement.
- Avoid: emojis in code, commits, PRs, and docs.

### Imports & file organization
- Do: organize imports with Biome (`assist.actions.source.organizeImports`). Run check:fix; do not hand-order.
- Do: scope cross-cutting web features under `apps/web/src/lib/<feature>/` (see existing `lib/auth/`). Do not flatten into a single `lib/`.
- Avoid: cross-app imports. `apps/web` must not import from `apps/api`; the only shared code lives in `packages/config`.

### API (NestJS) specifics
- Do: declare entity fields with `declare field: T` (TypeORM-friendly, no constructor side effects). Never use `field!: T`.
- Do: generate migrations via `bin/fortuna db migration:generate <Name>`. Hand-written migration SQL is disallowed.
- Do: use `Logger` from `@nestjs/common` for all diagnostic output. Never `process.stdout.write` or `console.log` in API code.
- Do: place DB writes/reads only in `apps/api`. The web app fetches over HTTP.
- Do: reach for established libraries for standard wire formats (`cookie`, `jose`, `openid-client`) rather than hand-rolled parsers.
- Avoid: empty `catch` blocks. Log via the appropriate logger or rethrow; silent swallows mask regressions.

### Web (Next.js) specifics
- Do: treat `apps/web/src/components/ui/*` (shadcn) as vendored. Customize via wrappers and theming, not by editing the generated component.
- Do: use `console.warn`/`console.error` for diagnostics on the web side (no NestJS Logger here). Never raw `process.stdout.write`.
- Do: pin Tailwind classes; do not edit `globals.css` for one-off styles.
- Do: add new authenticated pages under `apps/web/src/app/(authenticated)/`. The middleware (`apps/web/src/middleware.ts`) plus the route group's `layout.tsx` enforce auth; do not add per-page redirects or `getMe()` calls. New public pages go under `apps/web/src/app/(unauthenticated)/` or alongside `/privacy`, `/terms`.

### Environment variables
- Do: add every new env var to `.env.example` with a sensible dev default.
- Do: reference env vars from `docker-compose*.yaml` as `${VAR:?required}`.
- Do: collapse environment-mode toggles to `NODE_ENV === "production"`. Do not introduce parallel `*_SECURE` / `ALLOW_INSECURE_*` flags.
- See ADR-0013 + `docs/release.md` for the full env policy (whitelist enforced via `.env.example`).

### Testing
- Do: write tests for new behavior. Unit + integration on `apps/api`, unit + Playwright e2e on `apps/web`.
- Do: place API integration tests under `apps/api/test/` (uses `jest-integration.json`, real testcontainers Postgres/Redis).
- Avoid: mocking the database in integration paths. Use `testcontainers`.
- Avoid: coverage-metric-driven tests. Tests must assert meaningful behavior.

### Commits
- Conventional Commits enforced by `commitlint` on every PR. Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Subject: lowercase, no trailing period, imperative mood.
- Commit message determines version bump (see `docs/release.md`).
- Do not add Claude/AI co-authorship. Human authorship only.

# Decision & Execution Protocol

### Before implementation
1. Identify which ADR governs the area you are touching (see Canonical Documentation Index). If none, and the change is structural, propose an ADR first.
2. Read the relevant workspace README (`apps/api/README.md`, `apps/web/README.md`, `packages/config/README.md`) for app-local conventions.
3. Confirm whether the change affects env vars, the DB schema, the OAuth surface, or release artifacts — if yes, consult the matching ADR and runbook before coding.
4. Verify the dev stack is up: `docker compose ps` should show `workspace`, `api`, `web`, `postgres`, `redis` running.

### During implementation
- Make the minimum change required. Do not refactor surrounding code unless the touched module already required it.
- Match the existing patterns of the touched directory before introducing new ones.
- Keep `apps/api` as the sole DB owner. Any new persisted state lives in API entities + a generated migration.
- Generate migrations with `bin/fortuna db migration:generate <Name>` and read the produced SQL (both `up` and `down`) before committing.
- Add env vars by editing `.env.example` and compose files together (see env-var policy above).

### Before completion
1. `bin/fortuna pnpm turbo check` (lint + format) — must be clean.
2. `bin/fortuna pnpm turbo test --affected` — must pass.
3. If API changes: `bin/fortuna pnpm --filter api test:integration` if integration coverage is relevant.
4. If web UX/route changes: `bin/fortuna e2e` if a covered flow is touched.
5. If migration generated: confirm `bin/fortuna db migration:show` lists it and `migration:run` is idempotent.
6. Update touched workspace READMEs / `docs/*` only if user-facing behavior or operational steps changed. Do not create new docs unless requested.
7. Compose a Conventional Commit subject; verify scope correctness.

# Operational Boundaries & Guardrails

## Always Do
- Route every command through `bin/fortuna` (or the appropriate `bin/fortuna db` / `bin/fortuna e2e` subcommand).
- Consult the relevant ADR before any structural change.
- Keep DB access confined to `apps/api`. The web app talks to the API over HTTP.
- Treat shadcn components under `apps/web/src/components/ui/` as vendored; customize via wrappers.
- Use TypeORM `declare field: T` syntax in entities.
- Generate migrations via the CLI; review the produced SQL.
- Update `.env.example` + relevant compose files together when adding env vars.
- Use `Logger` (api) / `console.warn|error` (web) for diagnostics.
- Follow Conventional Commits and run `check:fix` before committing.

## Ask First
- Adding any runtime or dev dependency (no exceptions).
- Schema changes that touch existing tables or require data backfill.
- Modifying CI workflows under `.github/workflows/` or the `ci` GitHub Environment.
- Changing release/publish behavior (`nx.json`, `turbo.json` task graph, version policy).
- Altering public API contracts (controller signatures, response shapes, status codes).
- Introducing a new top-level directory or new workspace package.
- Deleting code with unclear callers or tests.
- Touching anything covered by an ADR in a way that contradicts the recorded decision — propose a superseding ADR first.

## Never Do
- Run host-side `pnpm`/`jest`/`turbo`/`nest`/`tsx` instead of `bin/fortuna`.
- Hand-write a TypeORM migration. Always generate from the entity diff.
- Use `field!: T` on TypeORM entities (use `declare field: T`).
- Touch the database from `apps/web` or import server-only DB modules into client code.
- Edit shadcn-generated component source in place.
- Add `process.stdout.write`/`console.log` for diagnostics in API code.
- Leave empty `catch` blocks — always log or rethrow.
- Add `*_SECURE` / `ALLOW_INSECURE_*` env var pairs when `NODE_ENV === "production"` already encodes the intent.
- Hand-roll parsers for cookies, JWTs, or OIDC flows when `cookie` / `jose` / `openid-client` are already available.
- Commit `.env`, credentials, or any file containing real secrets.
- Add Claude or any AI tool as a commit/PR co-author.
- Create README/architecture/onboarding docs without being asked. Default to no new docs.
- Force-push, `git reset --hard`, `git clean`, or rewrite shared history without explicit instruction.
- Bypass `commitlint`, Biome, or pre-commit hooks with `--no-verify`.
