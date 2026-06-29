# uptime-buna

`uptime-buna` is a personal, opinionated fork of [Uptime Kuma](https://github.com/louislam/uptime-kuma).

It is not official Uptime Kuma, not affiliated with Uptime Kuma, and not trying to be a drop-in replacement for every upstream deployment style. If you need upstream behavior, broad database choices, or maximum configurability, use Uptime Kuma.

## What Is Different

`uptime-buna` keeps the recognizable Uptime Kuma product shape while moving the defaults toward a smaller self-hosted deployment:

- Bun is the runtime and package manager.
- SQLite is the only application database.
- The default server path uses Bun-native HTTP/WebSocket and SQLite integration.
- Docker is one runtime image, not a matrix of slim/rootless/nightly/test images.
- Docker Compose is not part of the development workflow.
- Community project process files and upstream support/governance machinery are intentionally not restored.

The goal is a lighter uptime monitor with better defaults for small personal deployments. It should be easier to run and reason about, even if that means fewer knobs.

## Tradeoffs

Advantages:

- Smaller operational surface: one runtime, one lockfile, one application database, one Docker image.
- SQLite by default and by design: no external database service is required.
- Bun-first execution: fewer Node compatibility paths in the hot runtime.
- Less inherited release and community automation noise.

Disadvantages:

- No MariaDB/MySQL/PostgreSQL application database backend.
- No embedded MariaDB image.
- No development Docker Compose workflow.
- Fewer deployment variants and fewer compatibility promises than upstream.
- Migration from an upstream non-SQLite deployment is not handled here.

That tradeoff is intentional. If SQLite-only and fewer configuration options are too restrictive for your deployment, upstream Uptime Kuma is the better fit.

## Local Development

```bash
bun install --frozen-lockfile
bun run dev
```

Backend only:

```bash
bun run start
```

The backend listens on port `3001` by default. The frontend dev server uses port `3000`.

## Docker

Build the single local runtime image:

```bash
bun run build-docker
```

Run it directly:

```bash
docker run --rm -p 3001:3001 -v ./data:/app/data uptime-buna:local
```

The root `compose.yaml` is only a small runtime convenience for people who prefer Compose to start the built image:

```bash
docker compose up --build
```

Use `UPTIME_BUNA_PORT` or `UPTIME_BUNA_DATA_DIR` to override the default `3001` port and `./data` volume in Compose.

## Data

Application data lives in SQLite under the configured data directory. A fresh install writes:

```json
{
    "type": "sqlite"
}
```

Non-SQLite application database configs are rejected.

## Status

Work in progress. This repository still contains inherited Uptime Kuma code while the migration continues.

There is no formal support, roadmap, contribution process, issue triage, release promise, or community governance process.

## License and Attribution

This project is based on Uptime Kuma, originally created by Louis Lam and contributors.

The inherited code is under the MIT license. See [`LICENSE`](LICENSE).
