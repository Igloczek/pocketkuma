# BUN-050: Redbean, Knex, and SQLite Driver Cost Baseline

## Objective

Measure memory and query cost for the current database layer before proposing any `bun:sqlite` migration.

## Context

The current database stack is `redbean-node`, Knex, and `@louislam/sqlite3`, with SQLite and MariaDB support. A full database migration is risky, so hot paths and dependency cost must be measured first.

## Scope

- Measure DB cold-start memory without active monitors.
- Measure query count and timing for:
  - heartbeat insert;
  - heartbeat list;
  - monitor list;
  - settings get/set;
  - status page read.
- Measure RSS after the DB layer is loaded.
- Write the report to `docs/perf/db-cost-baseline.md`.

## Out of Scope

- Changing the database layer.
- Migrating to `bun:sqlite`.
- Removing Redbean or Knex.

## Suggested Implementation

1. Add instrumentation behind a debug flag or a separate benchmark script.
2. Use the existing test database or an isolated `data/db-bench` directory.
3. Run each hot path in a series, for example 100 or 1000 operations.
4. Report min/avg/p95 if practical.
5. Separate SQLite and MariaDB results if MariaDB is locally available.

## Files to Inspect

- `server/database.js`
- `server/model/monitor.js`
- `server/client.js`
- `server/settings.js`
- `server/uptime-calculator.js`
- `db/knex_migrations/`

## Validation

```bash
npm run bench:db
```

If a different command is added, document it in `package.json` and in the report.

## Acceptance Criteria

- A DB baseline report exists.
- The report includes DB cold-start RSS.
- The report includes heartbeat insert/list timings.
- The report includes monitor list and settings timings.
- The report identifies candidate operations for `bun:sqlite`.
- Production DB behavior is unchanged except for safe instrumentation.

## Completion Evidence

Link to the report and list the three most expensive database paths by measurement.
