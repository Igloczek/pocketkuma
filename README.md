# Uptime Buna

**Uptime Buna** is a fork of [Uptime Kuma](https://github.com/louislam/uptime-kuma) — the same monitoring product, but built on [Bun](https://bun.sh/) and TypeScript. It is a single binary with SQLite as the only supported database, and it is designed for self-hosted installs where simplicity matters more than matching every upstream option.

## Why

Uptime Kuma codebase is a bit out of date and heavily rely on number of dependencies, which leads to unnecessary memory usage. Bun is lighter and comes with lots of built-in features, so it is a good fit for this project. The goal is to provide a simple, fast, and easy-to-deploy monitoring solution without reinventing the wheel.

## What's different

Uptime Buna keeps the same product surface — monitors, notifications, status pages, and the dashboard UI — but changes how it is built, shipped, and run.

### Distribution and deployment

- **What changed:** the release artifact is a single compiled binary (`bun build --compile`) with the frontend embedded inside it.
- **Effect:** download, run, open the browser. No Node.js install, no `git clone`, no `npm ci`, and no Docker image required for the default install path.

### Runtime and server stack

- **What changed:** the server runs on Bun instead of Node.js. Express, Socket.IO, and the Node HTTP fallback path are gone. HTTP is served through `Bun.serve`, realtime UI updates use Bun's native WebSocket support, and outbound HTTP uses `fetch` instead of `axios`.
- **Effect:** a smaller runtime surface, fewer moving parts at startup, and no separate web framework process layered on top of the monitor.

### Dependencies

- **What changed:** compared to upstream Uptime Kuma v2.4.0, Uptime Buna drops **50 direct** `package.json` entries (**41** from production dependencies) and about **200** fewer packages in the full install tree. Common utilities were replaced with Bun builtins or small in-repo helpers — for example `Bun.password` for hashing, native JWT handling, and built-in SQLite access.
- **Effect:** less dependency churn, faster installs for development, and a leaner production footprint. Monitor-specific packages (Postgres, MQTT, SNMP, Playwright, and similar) are still there, but optional monitor and notification code loads on demand instead of at process start.

### Database

- **What changed:** SQLite is the only supported application database. The first-run setup no longer offers MariaDB, embedded MariaDB, or any other app-database backend.
- **Effect:** one fewer deployment decision and one fewer database service to run alongside the monitor. MySQL/MariaDB are still available as **monitor types** for checking external databases.

### Data layout

- **What changed:** application state lives in a local data directory instead of an external database server.
- **Effect:** by default, data is stored in `./data` next to the executable — easy to back up, move, or mount as a volume.

## Run

Download the binary for your platform from [Releases](https://github.com/igloczek/uptime-buna/releases), then:

```bash
./uptime-buna
```

Open `http://localhost:3001` and complete the setup wizard on first visit.

Optional flags: `--port=3001`, `--data-dir=/path/to/data`.
