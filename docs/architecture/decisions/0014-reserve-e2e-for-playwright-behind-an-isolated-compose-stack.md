# 14. Reserve "e2e" for Playwright behind an isolated compose stack

Date: 2026-05-25

## Status

Accepted

## Context

"End-to-end test" means different things to different people. Without a convention, the term gets reused for API integration tests that boot a real database, for browser tests, and for anything that touches more than one service. Each has a different runner, fixture lifecycle, and failure mode; conflating them produces test reports that are impossible to triage.

Browser tests also need a complete user-facing stack: web, API, database, rate-limit store, and a stand-in for the identity provider, all running together. Sharing the developer's dev stack risks state leaking between interactive use and test runs, and CI cannot rely on a developer-started stack as a contract.

## Decision

- **The term "e2e" is reserved for Playwright browser tests.** API tests that boot the application against a real database are called "integration" tests and live with the API.
- **A dedicated compose file defines the full e2e stack:** API, web, PostgreSQL, the rate-limit store, and a mock OAuth2 provider that stands in for Google. The stack is fully isolated from the dev stack — its own network, volumes, and ports.
- **A helper script orchestrates the lifecycle**: bring up, run, dump compose logs on failure, tear down. Contributors and CI invoke the same path.
- Production parity is a separate, third compose definition. It is unaffected by the e2e stack and continues to be the reference for what runs on the VPS.

Rejected alternatives:

- **A single shared compose stack used for both dev and e2e.** Lifecycle conflicts, state pollution, and ambiguous failure attribution. A failing test could be the user's fault for editing data, or the test's fault, or neither.
- **Playwright against a developer-started dev stack.** Works for one developer; cannot be a CI contract.
- **Hitting the real Google in e2e.** Couples test stability to Google's availability and test-account quotas. The mock provider isolates the test surface to Fortuna's own code.

## Consequences

- "E2E test" unambiguously means a Playwright spec. Anything else needs a different word.
- A failing e2e run dumps compose logs into the CI output so the cause is visible without re-running locally.
- Sign-in is exercised end-to-end without depending on Google. The mock provider issues tokens shaped exactly like Google's, which the API verifies through the same code path it uses in production.
- Three compose files to maintain (dev, e2e, prod). The separation is the point; collapsing any two would re-introduce the problems above.
- Adding a new e2e test does not require any new orchestration code — the helper script and compose file are the contract.
