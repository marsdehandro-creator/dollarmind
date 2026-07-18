# Database migrations

Ordered, versioned schema changes. Filenames are `NNNN_description.sql`
(or the format chosen by the migration tool selected in Phase 6).

- The **canonical model** — both SQLite and PostgreSQL variants — lives in
  [`docs/data-model.md`](../../docs/data-model.md).
- [`db/schema.sql`](../schema.sql) is the human-readable reference for the pilot.
- Migrations are the **executable source of truth** and must be applied in order.

## Rules
1. Never edit a migration that has already been applied/committed — add a new one.
2. Every migration is authored (or generated) for **both** dialects so the
   SQLite → PostgreSQL move stays mechanical (see docs/data-model.md §7).
3. Keep migration version numbers identical across dialects.

## Current
- `0001_init.sql` — initial schema: auth (tenant/user/role/user_role) + salary
  slips (account, document, salary_slip, salary_component, issue_log, audit_log).
  Applied by the runner in `backend/src/db/migrate.ts` against `node:sqlite`.

Later phases add their own migrations (transaction, bank_statement, goal,
category, ...) — never edit an applied migration; add a new one.
