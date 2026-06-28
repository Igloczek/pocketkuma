# BUN-054: Embedded MariaDB Decision

## Objective

Decide whether embedded MariaDB stays in `uptime-buna`, moves to a full build variant, or is removed from the lightweight target.

## Context

The project targets a lighter self-hosted setup. Embedded MariaDB, MariaDB server packages, and related dependencies may conflict with the lightweight goal.

## Scope

- Inspect current embedded MariaDB usage.
- Measure or estimate Docker image cost with and without MariaDB.
- Choose one decision:
  - keep everywhere;
  - keep only in full;
  - remove;
  - make it an optional build.
- Record the decision in `docs/architecture/database-targets.md`.

## Out of Scope

- Removing code before a decision is recorded.
- Migrating users from MariaDB.
- Changing the setup wizard without a dedicated implementation task.

## Suggested Implementation

1. Review `server/embedded-mariadb.js` and database setup.
2. Inspect Dockerfiles for `mariadb-server`.
3. Build or estimate the current/full image size.
4. Prepare an experimental no-MariaDB size comparison if practical.
5. Record the decision and follow-up tasks.

## Files to Inspect

- `server/embedded-mariadb.js`
- `server/setup-database.js`
- `server/database.js`
- `docker/debian-base.dockerfile`
- `docker/dockerfile`

## Validation

```bash
docker build -f docker/dockerfile --target release -t uptime-buna:db-current .
docker image inspect uptime-buna:db-current --format '{{.Size}}'
```

If local build is too expensive, document the reason and perform static layer analysis instead.

## Acceptance Criteria

- A database target decision exists.
- The decision distinguishes lightweight and full targets.
- Image size cost is measured or explicitly blocked.
- Setup wizard follow-up is identified if database options change.
- MariaDB is not removed without a separate implementation task.

## Completion Evidence

State the decision and provide current image size or the reason measurement was not possible.
