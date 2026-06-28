# BUN-081: Lightweight Docker Image

## Objective

Build a lightweight Docker image for the basic `uptime-buna` use case: SQLite, core monitors, and no heavy optional components.

## Context

The current image inherits much of Uptime Kuma's full setup, including MariaDB and Chromium in some targets. The lightweight target should match this project goal: small installation, lower RAM, fewer dependencies.

## Scope

- Add a `lightweight` or `bun-lightweight` target.
- Do not install:
  - embedded MariaDB;
  - Chromium;
  - heavy optional monitor dependencies if dependency split exists.
- Use SQLite by default.
- Preserve healthcheck.
- Measure image size and container RSS.

## Out of Scope

- Removing the full image.
- Supporting real-browser monitor in lightweight.
- Publishing to Docker Hub or GHCR.

## Suggested Implementation

1. Base the target on BUN-080.
2. Apply decisions from BUN-054 and BUN-072.
3. Add a build argument if needed.
4. Run the container on an empty volume.
5. Complete the setup wizard or seed a minimal DB.
6. Run the 20-core-monitor benchmark inside or against the container.

## Files to Inspect

- `docker/dockerfile`
- `docker/debian-base.dockerfile`
- `server/setup-database.js`
- `package.json`
- `tasks/BUN-054-embedded-mariadb.md`
- `tasks/BUN-072-dependency-groups.md`

## Validation

```bash
docker build -f docker/dockerfile --target bun-lightweight -t uptime-buna:lightweight .
docker run --rm -p 3001:3001 -v uptime-buna-light-test:/app/data uptime-buna:lightweight
docker image inspect uptime-buna:lightweight --format '{{.Size}}'
```

## Acceptance Criteria

- Lightweight image builds locally.
- Container starts on an empty volume.
- Setup/dashboard work.
- Core monitors work.
- The image does not contain MariaDB or Chromium unless the architecture decision explicitly says otherwise.
- Image size and RSS are recorded.

## Completion Evidence

Report lightweight image size and comparison to the current/full image.
