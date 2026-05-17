# 1. Adopt a monorepo with pnpm, Turborepo, and Nx release

Date: 2026-05-17

## Status

Accepted

## Context

Fortuna ships multiple deployables — an API and a web app — plus shared configuration that both consume. Coordinating cross-cutting changes (shared lint/format/test config, shared types, contract evolution between API and web) across separate repositories would require synchronized PRs, version pinning, and release dances that don't add value for a small codebase.

We need:

- A single source of truth where API and web evolve together.
- A way to keep CI fast as the repo grows.
- Independent versioning per deployable, so a web change doesn't bump the API version.

## Decision

- **Workspace manager:** pnpm workspaces. A single catalog centralizes shared dependency versions (TypeScript, the test runner, the linter/formatter, shared type packages) so they cannot drift across workspaces.
- **Task runner:** [Turborepo](https://turborepo.com/) for everyday tasks (build, lint, format, test, container builds). Tasks declare their dependencies on each other, and CI only runs tasks for projects affected by a change.
- **Release tooling:** [Nx release](https://nx.dev/recipes/nx-release) for versioning and changelog generation. Projects are versioned independently, conventional commits drive version bumps, and each project gets its own tag.

## Consequences

- One install, one lockfile, one CI configuration.
- Per-project release cadence: an API patch doesn't drag the web app along.
- Two task runners coexist — Turborepo for everyday builds/checks, Nx for release. This is a deliberate split; each handles what it's best at, but contributors must know which to invoke for which job.
- The shared catalog becomes the single point of upgrade for cross-workspace dependencies, reducing drift.
- Workspace packages are consumed locally without publishing, keeping development friction-free.
