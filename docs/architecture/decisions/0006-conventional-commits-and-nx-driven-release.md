# 6. Conventional Commits and Nx-driven release pipeline

Date: 2026-05-17

## Status

Accepted

## Context

With independently versioned projects in a monorepo, manually picking version numbers and writing changelogs scales poorly even for a small team. We want commit history to drive both, and we want a clear, automatable path from a merged pull request to a published artifact (npm packages, container images on GHCR).

## Decision

- **Commit style:** [Conventional Commits](https://www.conventionalcommits.org/) for every commit on `main`. Enforced in PR CI by `commitlint` with `@commitlint/config-conventional` plus project-specific rules (allowed types, no upper-case subjects, no trailing period).
- **Versioning:** On every push to `main`, the `on-merge-to-main` workflow runs `nx release --skip-publish`. Nx inspects affected projects, bumps their versions per Conventional Commits semantics, generates per-project changelogs, creates GitHub releases, and pushes tags shaped `{projectName}@{version}`.
- **Publishing:** Tag pushes trigger the `on-tag-publish` workflow:
  - **Packages (`packages/*`):** `pnpm publish` to npm (skipped if `private: true`).
  - **Apps (`apps/*`):** multi-arch (`linux/amd64` + `linux/arm64`) Docker images, built on native runners (`ubuntu-latest` and `ubuntu-24.04-arm`), pushed to GHCR with both `{version}` and `latest` tags, then stitched together into a multi-arch manifest.
- **Skip mechanism:** Release commits include `[skip release]` in their message so the release workflow does not loop on itself.

## Consequences

- Commit messages double as a public, machine-readable changelog. Sloppy commits become noisy releases.
- No human picks a version number — the commit type (`feat`, `fix`, breaking change) does.
- Versioning and publishing are decoupled. The release commit and tag are created in one CI run; tag-driven workflows publish in another. Either can be retried in isolation.
- Force-pushing to `main` would rewrite release commits and dangling tags. It should be disabled at the branch-protection level.
- Multi-arch Docker builds are slower than single-arch because each platform builds on its own native runner. The trade is worth it: pulls on both Apple Silicon and x86 hosts hit cached layers without QEMU emulation.
