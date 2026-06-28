# BUN-051: Repository Boundaries for Database Hot Paths

## Objective

Create small repository modules for the most frequently used database operations so later SQLite hot-path migration does not require monitor or socket logic changes.

## Context

The code uses `R` directly in many places. As long as hot paths are scattered, database implementation cannot be replaced safely in small steps.

## Scope

- Add repositories for:
  - heartbeat insert;
  - heartbeat list;
  - important heartbeat list;
  - monitor list by user;
  - settings get/set.
- The first implementation may delegate to `R`.
- Move hot-path call sites onto repositories.
- Add repository tests.

## Out of Scope

- Changing the database schema.
- Using `bun:sqlite`.
- Refactoring every model.

## Suggested Implementation

1. Add `server/repositories/`.
2. Add modules such as:
   - `heartbeat-repository.js`;
   - `monitor-repository.js`;
   - `settings-repository.js`.
3. Export functions unless a local pattern requires classes.
4. Replace hot-path usage in `server/client.js` and selected parts of `server/model/monitor.js`.
5. Do not move business logic into repositories.
6. Add tests using the test database.

## Files to Inspect

- `server/client.js`
- `server/model/monitor.js`
- `server/settings.js`
- `server/util-server.js`
- `server/database.js`
- `server/repositories/`

## Validation

```bash
npm run test-backend
rg -n "R\\.getAll|R\\.find|R\\.store|R\\.exec" server/client.js server/settings.js server/model/monitor.js
```

Some direct `R` usage may remain, but the hot paths in this task must go through repositories.

## Acceptance Criteria

- Repositories exist for heartbeat, monitor list, and settings.
- Hot paths in scope use repositories.
- Repositories have tests.
- API and socket behavior is unchanged.
- The implementation still uses Redbean underneath; no DB migration happens in this task.

## Completion Evidence

List the hot paths moved to repositories and provide test results.
