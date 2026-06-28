# 05. Database and storage

## BUN-050: Measure Redbean, Knex, and SQLite driver cost

Scope:

- Measure memory after DB startup without active monitors.
- Measure query count and timings for heartbeat insert/list, monitor list, settings, and status page paths.
- Estimate the cost of `redbean-node`, Knex, and `@louislam/sqlite3`.

Acceptance criteria:

- SQLite report exists.
- MariaDB report exists if a local environment is available.
- Report identifies hot paths worth migrating.

## BUN-051: Add repository boundaries for DB hot paths

Scope:

- Add small repository modules for heartbeat insert/list, monitor list, and settings.
- Initially they may delegate to `R`.
- Higher-level code should stop depending directly on Redbean for these hot paths.

Files to inspect:

- `server/model/monitor.js`
- `server/client.js`
- `server/settings.js`
- `server/util-server.js`
- `server/database.js`

Acceptance criteria:

- Hot paths have tests.
- API and UI behavior do not change.
- The new layer stays small and does not mix models with transport concerns.

## BUN-052: Move SQLite hot paths to `bun:sqlite`

Scope:

- Use native `bun:sqlite` prepared statements for hot paths from BUN-051.
- Keep MariaDB on the existing path.
- Do not break Knex migrations.

Acceptance criteria:

- Heartbeat insert/list and settings work through `bun:sqlite` for SQLite.
- Knex migrations still work.
- No `SQLITE_BUSY` regression appears with 20 monitors.
- Benchmark records query time and RSS before and after.

## BUN-053: Decide whether to remove Redbean/Knex for SQLite

Scope:

- After hot path migration, decide if full removal is worth the migration cost.
- Only split migration tooling if measured memory savings justify it.

Acceptance criteria:

- Architecture decision exists: full DB migration or keep Redbean/Knex for cold paths.
- Decision includes memory measurement and migration risks.
- No partial migration exists without a rollback plan.

## BUN-054: Reconsider embedded MariaDB

Scope:

- Decide whether embedded MariaDB belongs in uptime-buna.
- If lightweight self-hosting is the default goal, consider moving embedded MariaDB to a full build target.

Files to inspect:

- `server/embedded-mariadb.js`
- `server/setup-database.js`
- `docker/debian-base.dockerfile`

Acceptance criteria:

- Product decision is explicit: keep, move to full variant, or remove.
- Lightweight Docker image does not install MariaDB if SQLite is the default.
- Setup documentation explains the default database choice.
