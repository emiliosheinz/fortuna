# 0. Record architecture decisions

Date: 2026-05-17

## Status

Accepted

## Context

We need a durable record of the technical decisions made on this project — what was chosen, why, and what we expect the trade-offs to be — so that future contributors (or our future selves) can understand the reasoning without re-deriving it from code archaeology.

## Decision

We will use Architecture Decision Records (ADRs), as described by Michael Nygard in [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

- ADRs live in `docs/architecture/decisions/`.
- The `.adr-dir` file at the repo root points to this location so that [adr-tools](https://github.com/npryce/adr-tools) (or any compatible tooling) can manage them.
- Files are named `NNNN-kebab-case-title.md`, numbered sequentially.
- Each ADR is short, focused on a single decision, and immutable once accepted. To revisit a decision, write a new ADR that supersedes the previous one.

## Consequences

- Significant decisions are visible in version control and reviewable in pull requests.
- The cost of revisiting a decision is low: write a new ADR rather than editing history.
- Contributors are expected to add an ADR for any decision that future maintainers would otherwise need to reverse-engineer.
