# BUN-052: SQLite Hot Paths Through `bun:sqlite`

## Objective

Move selected measured SQLite hot paths to native `bun:sqlite` behind the repositories introduced in BUN-051.

## Context

A full DB migration is risky. This task is limited to SQLite and to hot paths with stable repository contracts.

## Scope

- Add SQLite implementations for:
  - heartbeat insert;
  - heartbeat list;
  - settings get/set;
  - monitor list if BUN-050 shows it is a significant cost.
- Use prepared statements.
- Keep Redbean/Knex for migrations and cold paths.
- Enable `bun:sqlite` only under Bun or behind an explicit feature flag.

## Out of Scope

- MariaDB.
- Database migrations.
- Removing Redbean or Knex.
- Changing model behavior.

## Suggested Implementation

1. Add a runtime database adapter that detects SQLite.
2. Open a `bun:sqlite` connection to `Database.sqlitePath`.
3. Apply PRAGMA settings compatible with `Database.initSQLite` where relevant.
4. Prepare statements for each selected operation.
5. Close the connection during shutdown.
6. Fall back to Redbean outside Bun or outside the feature flag.
7. Run the 20-monitor benchmark.

## Files to Inspect

- `server/database.js`
- `server/repositories/*`
- `server/model/monitor.js`
- `server/client.js`
- `server/uptime-kuma-server.js`

## Validation

```bash
bun run bun:test-backend
bun run bench:memory:bun
npm run test-backend
```

Check logs for `SQLITE_BUSY`.

## Acceptance Criteria

- SQLite hot paths use `bun:sqlite` under Bun.
- The Node path still uses Redbean/Knex.
- Knex migrations still run.
- No `SQLITE_BUSY` regression appears in the 20-monitor benchmark.
- RSS and query timings before/after are saved.

## Completion Evidence

Report which repositories use `bun:sqlite` and provide benchmark results before/after.
