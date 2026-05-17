# 5. Docker-first development environment

Date: 2026-05-17

## Status

Accepted

## Context

"Works on my machine" is the cheapest bug to prevent and the most expensive to debug. Even for a solo project, host-level differences (Node version, native modules, OpenSSL, Postgres client) cause real friction over time. We want local development, CI, and production to share as much of the runtime surface as possible.

## Decision

All development happens inside Docker containers, orchestrated by `docker-compose.yaml`:

- `postgres` — Postgres 17 with persistent volume.
- `setup` — one-shot service that runs `pnpm install` against the shared workspace volume.
- `workspace` — long-lived container based on `ghcr.io/emiliosheinz/fortuna-cli`. Holds the shell for ad-hoc commands; never exits.
- `migration` — runs TypeORM migrations to completion, then exits. The API waits for it via `service_completed_successfully`.
- `api`, `web` — application services in `dev` Docker target (hot reload).
- `web-e2e` — opt-in Playwright runner under the `e2e` compose profile.

Supporting choices:

- **Auxiliary base images.** `docker/Dockerfile.cli` (Node + pnpm) and `docker/Dockerfile.playwright` (Node + Playwright browsers) are built and pushed to GHCR by CI whenever they change. Local builds pull these pre-warmed images instead of reinstalling browsers each time.
- **Helper script.** `bin/fortuna` proxies arbitrary commands into the `workspace` container (`bin/fortuna pnpm install`), and `bin/fortuna db` runs the TypeORM CLI inside a fresh `migration` container.
- **Production parity.** `docker-compose.prod.yaml` mirrors the prod stack and is what CI uses to run e2e tests and the migration smoke check. The same Dockerfiles produce both `dev` and `prod` targets.

## Consequences

- Contributors install Docker (and only Docker). Node/pnpm on the host become optional convenience.
- CI uses the same compose files as local development, narrowing the local/CI gap to the size of a compose flag.
- Single-shot commands pay a small container-overhead tax. The persistent `workspace` container avoids per-command cold starts for the common case (`bin/fortuna pnpm test`).
- The repo is bind-mounted into containers, so file changes on the host reflect immediately inside.
- Some host workflows (IDE TypeScript server, Node inspector) work best when host Node is also installed — supported but not required.
