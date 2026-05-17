# Development

Fortuna's entire development environment runs in Docker. The only host requirement is a working Docker daemon. Node and pnpm on the host are optional.

## First-time setup

```bash
# Copy every .env.example to a matching .env (root + each app).
./scripts/setup-env.sh

# Bring up Postgres, the workspace shell, the API, the web app, and run migrations.
docker compose up -d
```

The `setup` service runs `pnpm install` against the shared workspace volume before the long-lived containers boot. The `migration` service runs every pending TypeORM migration before the API starts.

Once it's up:

- API: <http://localhost:3000>
- Web: <http://localhost:3001>

## Running commands

Use the `bin/fortuna` helper instead of `docker exec` directly:

```bash
bin/fortuna                                  # opens a shell in the workspace container
bin/fortuna pnpm install                     # any command, run inside workspace
bin/fortuna pnpm turbo test --filter=api     # filtered turbo task
bin/fortuna pnpm turbo check                 # lint + format check across affected workspaces
```

The `workspace` container is a long-lived shell — it does nothing on its own, so commands feel like running locally without the host/container drift.

## Database

Migrations live with the API. See [`apps/api/README.md`](../apps/api/README.md) for the full migration workflow.

Quick reference:

```bash
bin/fortuna db migration:generate <Name>     # generate a migration from the entity diff
bin/fortuna db migration:run                 # apply pending migrations
bin/fortuna db migration:revert              # roll the last migration back
bin/fortuna db migration:show                # show migration status
```

## Tests

Unit and integration tests run inside the workspace container:

```bash
bin/fortuna pnpm turbo test --affected       # all affected workspaces
bin/fortuna pnpm turbo test --filter=api     # one workspace
```

End-to-end tests are not started by `docker compose up`. Each app has its own e2e service under the `e2e` compose profile, which boots the dependencies it needs and then exits with the test result:

```bash
docker compose --profile e2e up --exit-code-from web-e2e web-e2e
```

The Playwright runner uses a prebuilt base image (`ghcr.io/emiliosheinz/fortuna-playwright`) so browsers do not reinstall on every run. See [`apps/web/README.md`](../apps/web/README.md) for what the test suite covers.

## Production parity

`docker-compose.prod.yaml` runs the same services with the `prod` Docker target instead of `dev`. CI uses this file for e2e and migration verification. Locally, it's the easiest way to reproduce a CI failure:

```bash
docker compose -f docker-compose.prod.yaml --profile e2e up --exit-code-from web-e2e web-e2e
```

## Running on the host (optional)

You can run pnpm commands directly on the host if Node 24 and pnpm 11.1.0 are installed. This is supported but not the recommended workflow — the Docker stack is the source of truth. If you hit an env-specific bug, reproduce it inside `bin/fortuna` before reporting it.
