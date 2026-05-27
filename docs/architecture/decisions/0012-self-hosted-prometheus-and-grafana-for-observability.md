# 12. Self-hosted Prometheus and Grafana for observability

Date: 2026-05-25

## Status

Accepted

## Context

Authentication is a security-sensitive surface. Sign-in failure rate, rate-limiter blocks, account-deletion rate, and active session counts need real dashboards and alertable signals from day one — not after the first incident. Discovering a brute-force attempt by reading logs after the fact is the wrong shape of feedback loop.

The deployment shape is a single VPS running a small set of containers. Adding a paid SaaS observability dependency does not match that footprint, and the data being instrumented is exactly the data that should not leave the trust boundary by default.

## Decision

- **Self-host Prometheus and Grafana alongside the application services in compose**, in development and in production. The API exposes a metrics endpoint that Prometheus scrapes.
- **Provision Grafana datasources and dashboards from the repository.** Dashboards built locally are the same dashboards on the VPS.
- **Author alert rules as files in the repository.** Critical signals (sign-in failure rate, account-deletion rate, limiter blocks, limiter degraded) page; latency and email-delivery signals warn.
- **Structured JSON logs remain the source of truth for per-request detail.** Metrics aggregate; logs explain.

Rejected alternatives:

- **Logs only.** No aggregate view; ad-hoc grep is not a dashboard; alerts on log patterns are brittle and slow.
- **Managed APM (e.g., Sentry plus a logs SaaS).** Adds a paid dependency, an external trust boundary for security-sensitive data, and a second deployment surface to operate.

## Consequences

- The observability stack is reproducible. The same compose definition runs it everywhere; nothing is hand-clicked in a SaaS console.
- Two more long-lived containers to operate. Their footprint is small relative to the auth surface they observe.
- Authoring a new metric or dashboard is a code change reviewable in a pull request.
- Switching to a managed APM later is possible — the metrics themselves are standard Prometheus and would port without API code changes.
- Retention is bounded by local storage. If long-term retention is needed later, remote-write into managed storage is an additive change.
