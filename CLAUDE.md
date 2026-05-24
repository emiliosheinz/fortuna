# Fortuna — Agent Notes

Quick orientation for Claude Code agents. The README is the source of truth for
setup; this file captures conventions that are easy to miss.

## Cascade contract (user-scoped schemas)

Every table that references `users.id` must honor the same hard-delete
contract that the Google Authentication design established:

- **Default — `ON DELETE CASCADE`.** PII or user-owned data must be erased
  when the user is deleted. No soft-delete columns. No tombstones retaining
  PII.
- **Exception — anonymization.** A table with explicit forensic / audit
  justification (today: `sign_in_events`) may use `ON DELETE SET NULL`,
  provided the `DELETE /users/me` transaction explicitly clears every PII
  column on those rows in the same step. Outcome + timestamp are the only
  columns that may survive.

When adding a new user-scoped table, pick one of those two paths — never a
third. The transaction in
`apps/api/src/auth/services/users.service.ts` (`deleteAccount`) and the
integration spec at `apps/api/test/auth.integration-spec.ts` (account
deletion describe block) must stay in sync with whichever you choose.

Full rationale + the audit-anonymization rule live in
[`.specs/google-authentication/TECHNICAL-DESIGN.md`](./.specs/google-authentication/TECHNICAL-DESIGN.md)
(see "Cascade contract" under "Database Changes").

## Database migrations

Migrations are generated from TypeORM entities, never hand-written. Workflow:

1. Edit the entity (`apps/api/src/auth/entities/*.entity.ts` etc.).
2. Run `bin/fortuna db migration:generate <Name>`.
3. Review the generated SQL — both `up` and `down`.

See `README.md` for the full migration commands.
