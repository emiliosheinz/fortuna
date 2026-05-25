# Release and deployment

Fortuna ships independently versioned projects from a single repo. Conventional Commits drive everything: version bumps, changelogs, and what gets published.

The full rationale is in [ADR-0006](./architecture/decisions/0006-conventional-commits-and-nx-driven-release.md). This page is the operational reference.

## The pipeline at a glance

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant GH as GitHub (main + tags)
    participant Merge as on-merge-to-main
    participant Pub as on-tag-publish
    participant NPM as npm
    participant GHCR as GHCR

    Dev->>GH: Merge PR to main
    GH->>Merge: Trigger workflow
    activate Merge
    Note right of Merge: nx release (skip-publish)
    Merge->>Merge: Bump versions of affected projects
    Merge->>Merge: Write per-project CHANGELOG.md
    Merge->>GH: Create GitHub releases
    Merge->>GH: Push tags (projectName@version)
    deactivate Merge

    GH->>Pub: Trigger workflow on tag push
    activate Pub
    par packages/*
        Pub->>NPM: pnpm publish
    and apps/*
        Pub->>GHCR: Push multi-arch image (amd64 + arm64 manifest)
    end
    deactivate Pub
```

The release commit itself contains `[skip release]` so the workflow does not loop.

## Commit messages drive everything

Every commit on `main` must follow [Conventional Commits](https://www.conventionalcommits.org/). `commitlint` validates this on every PR. The commit type is what nx-release looks at:

| Type                     | Effect                                  |
|--------------------------|------------------------------------------|
| `feat`                   | minor version bump                       |
| `fix`, `perf`, `refactor`| patch version bump                       |
| `feat!` / `BREAKING CHANGE` | major version bump                    |
| `docs`, `chore`, `ci`, `style`, `test`, `build` | no version bump      |

Scopes (e.g., `feat(api): …`) are encouraged for clarity but don't change behavior.

## Tag and release format

- Tags: `{projectName}@{version}` (for example `api@1.4.0`, `web@0.3.0`, `@fortuna/config@0.2.1`).
- GitHub releases are created per project with rendered changelogs that include authors and commit references.

## Environment variables

Three contexts, three sources of truth — kept deliberately separate so changes to one don't silently leak into the others.

| Context | Source of truth | How values are supplied |
|---------|-----------------|--------------------------|
| Dev (local) | `.env` (gitignored) | `scripts/setup-env.sh` copies `.env.example` once; you edit the secrets you need (Google OAuth client, etc.). Every dev compose service reads it via `${VAR:?required}`. |
| CI (`e2e-tests`) | `docker-compose.e2e.yaml` itself | All values pinned inline as fixtures (`fortuna_e2e`, `e2e-fixed-postgres-password`, `e2e-client-id`, mock-oauth2-server URLs). `.env` is never consulted. `bin/fortuna e2e` runs against any clone with zero setup. |
| CI (`migration-check`) | The workflow step's `env:` block | Distinctive fixtures (`fortuna_ci`, `ci-fixed-postgres-password`) live on the `Run migrations` step. Docker Compose interpolates them from the process environment, no `.env` file written. |

The rule of thumb: **CI never borrows from `.env.example`.** Dev defaults are dev's concern; if they change, CI must not silently pick them up. Each CI job declares exactly the fixture values it depends on, distinctively named so logs make the context obvious.

A future real-deployment job would write `.env` from GitHub secrets — the variable name in GitHub equals the name in `.env` equals the name compose interpolates equals the name the source code reads.

When adding a new env var:

1. Add it to `.env.example` with a sensible dev default.
2. Reference it from the relevant service's `environment:` block in `docker-compose.yaml` / `docker-compose.prod.yaml` via `${VAR:?required}`.
3. If e2e exercises that code path, pin a fixture value inline in `docker-compose.e2e.yaml`.
4. If `migration-check` (or any other CI job) exercises it, add a fixture value to that job's `env:` block in the workflow.
5. For real secrets in real deployments, override in the deployment's `.env`.

## Auxiliary Docker base images

Two base images speed up local and CI builds:

- `ghcr.io/emiliosheinz/fortuna-cli` — Node + pnpm + git + curl. Backs the `workspace` and `setup` compose services.
- `ghcr.io/emiliosheinz/fortuna-playwright` — Node + pre-installed Playwright browsers (chromium, firefox, webkit). Backs the e2e Dockerfiles.

They are rebuilt automatically by `build-auxiliary-docker-images.yml` whenever the corresponding `docker/Dockerfile.*` changes on `main`. Multi-arch (`linux/amd64,linux/arm64`) is published in a single job using QEMU + Buildx.
