# Fortuna — Agent Notes

Quick orientation for Claude Code agents. The README is the source of truth for
setup; this file captures conventions that are easy to miss.

## Cascade contract (user-scoped schemas)

Every table that references `users.id` must honor the same hard-delete
contract that the Google Authentication design established:

- **Default — `ON DELETE CASCADE`.** PII or user-owned data must be erased
  when the user is deleted. No soft-delete columns. No tombstones retaining
  PII.
- **Exception — anonymization.** A table with explicit forensic / audit
  justification (today: `sign_in_events`) may use `ON DELETE SET NULL`,
  provided the `DELETE /users/me` transaction explicitly clears every PII
  column on those rows in the same step. Outcome + timestamp are the only
  columns that may survive.

When adding a new user-scoped table, pick one of those two paths — never a
third. The transaction in
`apps/api/src/auth/services/users.service.ts` (`deleteAccount`) and the
integration spec at `apps/api/test/auth.integration-spec.ts` (account
deletion describe block) must stay in sync with whichever you choose.

Full rationale + the audit-anonymization rule live in
[`.specs/google-authentication/TECHNICAL-DESIGN.md`](./.specs/google-authentication/TECHNICAL-DESIGN.md)
(see "Cascade contract" under "Database Changes").

## Test layering

Three layers, three names, no overlap:

- **Unit** — `*.spec.ts` colocated with source. Pure functions or a single
  class with collaborators stubbed. No I/O, no Nest container. Run on save.
- **Integration** — `apps/api/test/*.integration-spec.ts`. NestJS module
  wired against a real testcontainer Postgres and exercised via Supertest.
  No browser. This is where API endpoints are verified end-to-end on the
  server side. Run via `pnpm --filter api test:integration`.
- **E2E** — `apps/web` Playwright suite only. Browser → web → API → DB.
  Run via `pnpm --filter web test:e2e`. The API package has no `test:e2e`
  script on purpose — anything that isn't a browser-driven flow belongs in
  unit or integration.

### Spec stubs

In unit specs, never use `as unknown as X` or `as never` to fabricate
collaborators. Type stubs as `Pick<X, "methodA" | "methodB">` and inject
them through `Test.createTestingModule().useValue(stub)` — Nest's DI
accepts the structural type, and the spec stays cast-free. The only
exception we tolerate is one documented cast in a helper that builds
Express `Request`/`Response` doubles, since those types have too many
methods to satisfy structurally. See
`apps/api/src/auth/auth.controller.spec.ts` for the pattern.

## HTTP DTOs + validation

Request bodies on `apps/api` are validated by Nest's global
`ValidationPipe`, wired as `APP_PIPE` in `apps/api/src/app.module.ts` (not
in `main.ts`) so the integration test — which boots `AppModule` directly
— picks it up without re-registering. New endpoints should:

- Define the DTO as a class with `class-validator` decorators and the
  `declare field: T` convention (see existing memory note on TypeORM
  entities — same rule applies to DTOs).
- Let `ValidationPipe` throw `BadRequestException` on invalid input; do
  not hand-roll `if (typeof body.x !== "string") …` blocks.

If the endpoint must record a validation failure (e.g. for forensic
audit), apply a route-scoped filter via `@UseFilters(...)`. The reference
implementation is `BadRequestAuditFilter` on `POST /auth/google`: it
catches `BadRequestException`, mints a correlation id, records a
`failure_bad_request` sign-in event, and returns `{ correlationId }` to
the client. Route-scoped — never global — so it doesn't mis-audit other
4xx flows.

## apps/web data fetching

Server-side fetches against the API go through `apiFetch` in
`apps/web/src/lib/auth/api-client.ts`. The helper injects `API_BASE_URL`,
forwards the session cookie, serializes JSON bodies, and converts non-2xx
into thrown errors. The `treatAsNull: [401, 404]` option captures the
"the user is unauthenticated, return null so the route can redirect to
the landing page" pattern — prefer it over try/catching the thrown error.

Function names follow REST verbs (`getMe`, `getSessions`,
`createGoogleSession`, `deleteMe`); two exceptions kept their names
because no clean verb/resource mapping exists (`deleteCurrentSession`,
`deleteSession(id)`).

Client-side fetches use TanStack Query. `QueryClientProvider` is already
wired at `apps/web/src/app/layout.tsx` via `QueryProvider`, with the
devtools mounted only when `NODE_ENV !== "production"`. Reach for
`useQuery` / `useMutation` rather than ad-hoc `useEffect` + `fetch`.

## Dev container: re-run `setup` after dep changes

The `web` and `api` services in `docker-compose.yaml` have no
`pnpm install` step in their entrypoints. The `setup` service does, with
`CI=true` so pnpm doesn't prompt for TTY confirmation. Whenever the
workspace lockfile changes (new dep, version bump), run:

```bash
docker compose run --rm setup
docker compose up -d web   # or api, or both
```

Skipping this manifests as either a Turbopack "couldn't find next
package" error (when the new dep isn't resolvable yet) or
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` on restart.

## Database migrations

Migrations are generated from TypeORM entities, never hand-written. Workflow:

1. Edit the entity (`apps/api/src/auth/entities/*.entity.ts` etc.).
2. Run `bin/fortuna db migration:generate <Name>`.
3. Review the generated SQL — both `up` and `down`.

See `README.md` for the full migration commands.
