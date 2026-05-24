# 6. Conventional Commits and Nx-driven release pipeline

Date: 2026-05-17

## Status

Accepted

## Context

With independently versioned projects in a monorepo, manually picking version numbers and writing changelogs scales poorly even for a small team. We want commit history to drive both, and we want a clear, automatable path from a merged pull request to a published artifact (published packages, container images in a registry).

## Decision

- **Commit style:** [Conventional Commits](https://www.conventionalcommits.org/) for every commit landing on the default branch. Enforced in PR CI with commitlint plus project-specific rules (allowed types, no upper-case subjects, no trailing period).
- **Versioning:** every merge to the default branch triggers a release pass. Nx inspects affected projects, bumps their versions per Conventional Commits semantics, generates per-project changelogs, creates GitHub releases, and pushes per-project tags so each deployable carries its own version.
- **Publishing:** tag pushes trigger publishing.
  - **Shared packages:** published to the package registry (private packages are skipped automatically).
  - **Applications:** built as multi-architecture container images (x86_64 and arm64) on native runners, pushed to the container registry, then stitched together into a single multi-arch manifest.
- **Skip mechanism:** release commits are marked so the release workflow does not loop on itself.

## Consequences

- Commit messages double as a public, machine-readable changelog. Sloppy commits become noisy releases.
- No human picks a version number — the commit type (`feat`, `fix`, breaking change) does.
- Versioning and publishing are decoupled. The release commit and tag are created in one CI run; tag-driven workflows publish in another. Either can be retried in isolation.
- Force-pushing to the default branch would rewrite release commits and dangling tags. It should be disabled at the branch-protection level.
- Multi-arch container builds are slower than single-arch because each platform builds on its own native runner. The trade is worth it: pulls on both Apple Silicon and x86 hosts hit cached layers without emulation.
