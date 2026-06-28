# BUN-080: Bun-Based Docker Target

## Objective

Add a Docker target that runs the application with Bun, without removing the current Node target before validation.

## Context

The current Dockerfile is Node-based and inherits upstream tagging/build assumptions. Bun runtime should be tested as a separate target with a minimal system package set.

## Scope

- Add a Docker target for Bun.
- Use either the official Bun image or Debian with Bun installed.
- Keep required system packages:
  - CA certificates;
  - ping;
  - dumb-init or equivalent init;
  - SQLite runtime requirements.
- Do not install Chromium or MariaDB in this target unless it is explicitly a full target.
- Start the application through a Bun script.

## Out of Scope

- Removing the Node Docker target.
- Publishing images.
- Final lightweight image work; that is BUN-081.

## Suggested Implementation

1. Add a `bun-release` target in `docker/dockerfile`.
2. Copy application files and Bun lockfile if it exists.
3. Run `bun install --production --frozen-lockfile`.
4. Set `CMD` to start the Bun server path.
5. Preserve the healthcheck.
6. Measure image size.

## Files to Inspect

- `docker/dockerfile`
- `docker/debian-base.dockerfile`
- `extra/healthcheck.go`
- `package.json`
- `bun.lock`

## Validation

```bash
docker build -f docker/dockerfile --target bun-release -t uptime-buna:bun .
docker run --rm -p 3001:3001 -v uptime-buna-bun-test:/app/data uptime-buna:bun
docker image inspect uptime-buna:bun --format '{{.Size}}'
```

## Acceptance Criteria

- Docker target `bun-release` builds locally.
- The container starts and responds on port 3001.
- Healthcheck works or has an explicit blocker.
- SQLite setup works on an empty volume.
- Image size is recorded.
- The Node target is not removed.

## Completion Evidence

Provide build/run commands and image size.
