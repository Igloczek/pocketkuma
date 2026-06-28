# 08. Docker and local CI

## BUN-080: Add a Bun-based Docker target

Scope:

- Add a Docker target based on an official Bun image or Debian with Bun installed.
- Keep required system packages: CA certificates, ping, dumb-init, and only necessary debugging tools.
- Keep Chromium only in the full target.

Files to inspect:

- `docker/dockerfile`
- `docker/debian-base.dockerfile`
- `extra/healthcheck.go`

Acceptance criteria:

- Image starts with Bun.
- Healthcheck works.
- SQLite setup works on an empty volume.
- Image size is recorded and compared with the current Node image.

## BUN-081: Add a lightweight Docker image

Scope:

- Build a variant without embedded MariaDB, Chromium, and heavy optional monitor dependencies.
- Use SQLite as the default database.

Acceptance criteria:

- Lightweight image runs setup, dashboard, and core monitors.
- Full image still supports features intentionally kept in the full target.
- Image size difference is documented.

## BUN-082: Migrate local validation before GitHub Actions

Scope:

- Add local Bun validation commands.
- Prepare CI changes only after local validation works.

Acceptance criteria:

- `bun install --frozen-lockfile` passes.
- `bun run lint` passes or expected differences are documented.
- `bun run bun:test-backend` passes or unsupported tests are listed.
- `bun run bun:build` passes.
- Selected E2E pass or have documented follow-up tasks.
