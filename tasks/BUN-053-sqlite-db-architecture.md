# BUN-053: Redbean/Knex Architecture Decision for SQLite

## Objective

Decide whether `uptime-buna` should eventually remove Redbean/Knex from the SQLite path or keep them for cold paths and migrations.

## Context

After BUN-052, the project should know how much value comes from migrating hot paths. Full ORM/migration-stack removal may be expensive and risky.

## Scope

- Compare:
  - BUN-050 baseline;
  - BUN-052 hot-path migration results.
- Estimate full migration cost:
  - models;
  - migrations;
  - tests;
  - MariaDB compatibility.
- Write the decision in `docs/architecture/sqlite-storage.md`.

## Out of Scope

- Implementing full migration.
- Removing DB dependencies.
- Changing schema.

## Suggested Implementation

1. Gather RSS and query-time measurements.
2. List all major `R.` and `R.knex` usages.
3. Categorize usages as hot or cold.
4. Decide whether cold paths justify keeping Redbean/Knex.
5. Record one decision:
   - hot-path-only migration;
   - full SQLite migration;
   - defer.
6. If full migration is chosen, add follow-up task files.

## Files to Inspect

- `docs/perf/db-cost-baseline.md`
- `docs/architecture/sqlite-storage.md`
- `server/**/*.js`
- `db/knex_migrations/`

## Validation

```bash
rg -n "R\\.|R\\.knex|knex" server db | wc -l
rg -n "R\\.|R\\.knex|knex" server db > docs/perf/redbean-knex-usage.txt
```

## Acceptance Criteria

- An architecture decision document exists.
- It includes measurements from BUN-050 and BUN-052.
- It includes count and categories of remaining Redbean/Knex usage.
- The decision has a clear rationale.
- Any required follow-up work is added to `tasks/`.

## Completion Evidence

State the decision and the most important numeric argument supporting it.
