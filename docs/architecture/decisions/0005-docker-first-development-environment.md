# 5. Docker-first development environment

Date: 2026-05-17

## Status

Accepted

## Context

"Works on my machine" is the cheapest bug to prevent and the most expensive to debug. Even for a solo project, host-level differences (Node version, native modules, OpenSSL, database client) cause real friction over time. We want local development, CI, and production to share as much of the runtime surface as possible.

## Decision

All development happens inside Docker containers orchestrated by Docker Compose. The local stack provides:

- The database, with persistent storage.
- A one-shot installer that prepares dependencies in a shared workspace volume.
- A long-lived workspace container that holds the shell for ad-hoc commands.
- A one-shot migration runner that applies pending schema changes; application services wait for it to succeed before starting.
- The API and web services in their development mode, with hot reload.
- An opt-in browser test runner, gated behind a separate profile so contributors only pay for it when they need it.

Supporting choices:

- **Auxiliary base images.** Heavy tooling (Node + package manager, Node + browser test binaries) is pre-baked into base images published by CI and pulled by local builds, rather than reinstalled on every build.
- **Helper script.** A thin wrapper proxies arbitrary commands into the long-lived workspace container, and runs the schema CLI inside a fresh migration container.
- **Production parity.** A parallel compose file mirrors the production stack and is what CI uses for end-to-end tests and migration smoke checks. The same Dockerfiles produce both development and production targets.

## Consequences

- Contributors install Docker (and only Docker). Host-side language/package-manager installs become optional convenience.
- CI uses the same compose definitions as local development, narrowing the local/CI gap to the size of a compose flag.
- One-shot commands pay a small container-overhead tax. The long-lived workspace container avoids per-command cold starts for the common case.
- The repo is bind-mounted into containers, so file changes on the host reflect immediately inside.
- Some host workflows (IDE TypeScript server, Node inspector) work best when the host language runtime is also installed — supported, but not required.
