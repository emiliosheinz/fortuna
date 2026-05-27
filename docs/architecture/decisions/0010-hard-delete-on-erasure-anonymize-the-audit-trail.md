# 10. Hard-delete on erasure; anonymize the audit trail

Date: 2026-05-25

## Status

Accepted

## Context

LGPD grants Brazilian users the right to erasure and requires that right to be operable end-to-end. Authentication also leaves behind a forensic trail — when sign-ins happened, whether they succeeded or failed, and why — that is genuinely useful for support and security investigations.

The naive answers are binary: keep everything (PII liability that grows forever) or drop everything (lose forensic continuity the moment a user deletes their account). Neither serves both obligations.

## Decision

- **Account deletion is an immediate hard delete in a single transaction.** All PII-bearing rows — the user, their identities, every session, every device fingerprint — are removed. No soft-delete column, no tombstone retaining the provider subject.
- **The sign-in audit trail is anonymized in the same transaction.** The user reference is nulled, the IP is cleared, and the user-agent hash is cleared. Timestamp and outcome remain indefinitely so aggregate forensic queries (failure rates over time, abuse patterns) still work.
- **All user-scoped tables in every future feature must declare `ON DELETE CASCADE` against the user, or anonymize like the audit trail with an explicit forensic justification.** This cascade contract is part of every schema review.
- A scheduled retention sweep clears IP and user-agent hash on sign-in audit rows older than 90 days, even for active users. Timestamp and outcome are retained indefinitely.

Rejected alternatives:

- **Soft-delete with `deleted_at`.** PII remains in the database. Defeats the right to erasure.
- **Drop sign-in audit rows entirely on deletion.** Loses the ability to investigate post-deletion abuse patterns and to answer aggregate questions over the historical record.

## Consequences

- Erasure is provable: after the transaction commits, no row identifies the deleted user.
- The forensic record survives without identifiability. Aggregate outcome and timing remain queryable.
- Every downstream schema author has to consciously choose cascade-or-anonymize. Missing this introduces silent retention bugs that violate the contract; reviewer attention is the enforcement mechanism.
- An end-to-end test asserts that the user's rows are gone in every known table after deletion. It must be extended whenever a new user-scoped table lands.
- The retention sweep is part of the operational surface. It needs to run; if it stops running, IP and user-agent data accumulates past its declared retention.
