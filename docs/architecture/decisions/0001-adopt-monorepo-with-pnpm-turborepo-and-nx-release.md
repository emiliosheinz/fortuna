# 1. Adopt a monorepo with pnpm, Turborepo, and Nx release

Date: 2026-05-17

## Status

Accepted

## Context

Fortuna ships multiple deployables — a NestJS API and a Next.js web app — plus shared configuration that both consume. Coordinating cross-cutting changes (shared lint/format/test config, shared types, contract evolution between API and web) across separate repos would require synchronized PRs, version pinning, and release dances that don't add value for a small codebase.

We need:

- A single source of truth where API and web evolve together.
- A way to keep CI fast as the repo grows.
- Independent versioning per deployable so a web change doesn't bump the API version.

## Decision

- **Workspace manager:** pnpm workspaces, with `apps/*` and `packages/*` as workspace globs. pnpm `catalog` centralizes shared dependency versions (TypeScript, Jest, Biome, `@types/*`) so they cannot drift across workspaces.
- **Task runner:** [Turborepo](https://turborepo.com/) for `build`, `lint`, `format`, `test`, `docker:build`, etc. Tasks declare their dependencies (e.g., `build` depends on `^build`) and we run with `--affected` in CI to skip unchanged projects.
- **Release tooling:** [Nx release](https://nx.dev/recipes/nx-release) for versioning and changelog generation. Projects are versioned independently (`projectsRelationship: "independent"`), conventional commits drive version bumps, and tags follow the `{projectName}@{version}` pattern.

## Consequences

- One install, one lockfile (`pnpm-lock.yaml`), one CI configuration.
- Per-project release cadence: an API patch doesn't drag the web app along.
- Two task runners coexist (Turborepo for everyday builds/checks, Nx for release). This is a deliberate split — each handles what it's best at — but contributors must know which to invoke for which job.
- Catalog versions become the single point of upgrade for shared dependencies, reducing drift.
- Workspace packages can be consumed via `workspace:*` and are injected at install time (`injectWorkspacePackages: true`), keeping local development friction-free.
