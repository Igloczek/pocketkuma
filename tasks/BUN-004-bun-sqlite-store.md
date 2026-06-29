# BUN-004: SQLite Persistence Through `bun:sqlite`

## Objective

Make SQLite the Bun-native default database path and stop loading Redbean/Knex/sqlite3 on that default path.

## Scope

- Add a SQLite data-access layer backed by `bun:sqlite`.
- Migrate core repositories needed at runtime:
    - users and auth state;
    - settings;
    - monitors;
    - heartbeats;
    - incidents/status pages if required by startup.
- Run migrations through Bun without `@louislam/sqlite3`.
- Keep the application database SQLite-only. Do not add MariaDB/MySQL back only for upstream parity.
- Use `Bun.SQL` only if a future non-SQLite feature has an explicit fork-local reason unrelated to the app database backend.

## Out of Scope

- Preserving every upstream database backend.
- Changing the user-visible monitor model.
- HTTP or WebSocket transport changes.

## Validation

```bash
bun run bun:start -- --port=3004 --data-dir=./data/bun-sqlite-smoke
bun run bun:test:backend
rg -n "@louislam/sqlite3|redbean|knex|mariadb" src/server package.json
```

## Acceptance Criteria

- A new SQLite data directory can be initialized and used under Bun.
- Core monitor CRUD and heartbeat writes use `bun:sqlite`.
- The default Bun runtime path does not import Redbean, Knex, or `@louislam/sqlite3`.
- MariaDB support is removed from the default fork; the application database target is SQLite only.

## Completion Evidence

Report the repository modules migrated, the migration command result, and the remaining legacy database imports.
