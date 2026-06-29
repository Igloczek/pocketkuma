# Uptime Buna

Uptime Buna is a performance-focused fork of [Uptime Kuma](https://github.com/louislam/uptime-kuma) for self-hosted monitoring installs where lower memory usage, fewer dependencies, and a simpler runtime matter more than supporting every upstream deployment option.

## Focus

Uptime Buna is intentionally narrower than Uptime Kuma:

- Bun is the runtime, package manager, and default execution path.
- SQLite through `bun:sqlite` is the only application database.
- Realtime updates use Bun-native WebSockets.
- Runtime dependencies are cut when the related fallback path is removed.
- Configuration options are removed when they only exist for broad upstream parity.
- Docker builds one local runtime image instead of carrying an upstream-style image matrix.
- Setup is documented as one supported path, not a menu of equivalent choices.

## Uptime Kuma vs Uptime Buna

| Area                 | Uptime Kuma                                                            | Uptime Buna                                                                              |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Runtime              | Node.js for the default non-Docker path.                               | Bun for install, build, tests, and runtime.                                              |
| Package manager      | npm-based setup in upstream docs.                                      | `bun install` with `bun.lock`.                                                           |
| Dependency surface   | Broad compatibility paths and supporting packages.                     | Dependencies are cut when the related fallback path is removed.                          |
| Application database | SQLite plus broader MariaDB/MySQL compatibility code.                  | SQLite only for application data. MySQL/MariaDB checks may still exist as monitor types. |
| HTTP server          | Inherited Node/Express shape.                                          | `Bun.serve` for HTTP routes, static assets, metrics, and WebSocket upgrades.             |
| Realtime updates     | Socket.IO/WebSocket stack inherited from upstream.                     | Native Bun WebSocket protocol.                                                           |
| Docker               | Compose/direct Docker docs plus release/rootless/nightly/test targets. | One local Bun runtime image from the root `Dockerfile`.                                  |
| Configuration        | Broad upstream compatibility.                                          | Fewer runtime choices, lower memory cost, better defaults.                               |

## Runtime Snapshot

Measured on 2026-06-29. Evidence is in [docs/perf/readme-runtime-snapshot.md](docs/perf/readme-runtime-snapshot.md) and [docs/perf/bun-015-sqlite-only-docker-simplification.md](docs/perf/bun-015-sqlite-only-docker-simplification.md).

| Metric               | Current value                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Bun runtime          | `1.3.14`                                                                                  |
| Server path          | `Bun.serve HTTP`                                                                          |
| Application database | `sqlite` through `bun:sqlite`                                                             |
| Clean startup RSS    | `193.1 MiB` on macOS with a fresh data directory, no monitors, and `/setup` responding    |
| Local Docker image   | `277,529,464` bytes (`264.7 MiB`) for `uptime-buna:local`                                 |
| Image-size change    | `-160,524,599` bytes (`-153.1 MiB`, `-36.6%`) compared with the earlier Bun cleanup image |

## Run

```bash
bun install --frozen-lockfile
bun run build
bun src/server/server.ts --port=3001 --data-dir=./data
```

Open `http://localhost:3001`.

Application data lives in the configured data directory. A fresh install writes:

```json
{
    "type": "sqlite"
}
```

Non-SQLite application database configs are rejected.
