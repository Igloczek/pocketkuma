# PocketKuma

**PocketKuma** is a fork of [Uptime Kuma](https://github.com/louislam/uptime-kuma) — the same monitoring product, but built on [Bun](https://bun.sh/) and TypeScript. It is a single binary with SQLite as the only supported database, and it is designed for self-hosted installs where simplicity matters more than matching every upstream option.

## Why

Uptime Kuma targets a broad Node-based deployment surface. PocketKuma deliberately narrows that surface to Bun,
SQLite, and one executable, replacing dependencies where Bun already provides the required runtime feature. The goal
is a simple self-hosted monitor without rewriting the product.

## What's different

PocketKuma keeps the same product surface — monitors, notifications, status pages, and the dashboard UI — but changes how it is built, shipped, and run.

See the [Uptime Kuma 2.4.0 comparison](docs/upstream-differences.md) and the
[July 2026 stabilization audit](docs/audits/2026-07-stabilization.md) for the exact baseline, finding origins, test
method, and residual limits.

### Distribution and deployment

- **What changed:** the release artifact is a single compiled binary (`bun build --compile`) with the frontend embedded inside it.
- **Effect:** download, run, open the browser. No Node.js install, no `git clone`, no `npm ci`, and no Docker image required for the default install path.

### Runtime and server stack

- **What changed:** the server runs on Bun instead of Node.js. `Bun.serve` owns HTTP and native WebSocket traffic;
  inherited routes run through an Express-compatible adapter, while Socket.IO and the Node HTTP listener path are
  gone. Outbound HTTP uses `fetch` instead of `axios`.
- **Effect:** one Bun server owns the HTTP and realtime lifecycle.

### Dependencies

- **What changed:** compared with upstream Uptime Kuma v2.4.0, direct `package.json` entries fall from **83 to 35** production dependencies and from **154 to 88** total dependencies (production plus development): reductions of **48** and **66**, respectively. Common utilities were replaced with Bun builtins or small in-repo helpers — for example `Bun.password` for hashing, native JWT handling, and built-in SQLite access.
- **Effect:** less dependency churn, faster installs for development, and a leaner production footprint. Monitor-specific code (Postgres, MQTT, SNMP, Playwright, and similar) loads on demand instead of at process start; dependencies needed at runtime are embedded in the executable.

### Database

- **What changed:** SQLite is the only supported application database. The first-run setup no longer offers MariaDB, embedded MariaDB, or any other app-database backend.
- **Effect:** one fewer deployment decision and one fewer database service to run alongside the monitor. MySQL/MariaDB are still available as **monitor types** for checking external databases.

### Data layout

- **What changed:** application state lives in a local data directory instead of an external database server.
- **Effect:** by default, data is stored in `./data` under the process working directory — easy to back up or move.

## Run

Download the binary for your platform from [Releases](https://github.com/Igloczek/pocketkuma/releases), then:

```bash
chmod +x pocketkuma-linux-x64   # or the asset for your OS/arch
./pocketkuma-linux-x64
```

Open `http://localhost:3001` and complete the setup wizard on first visit.

Optional flags: `--port=3001`, `--host=0.0.0.0`, `--data-dir=/path/to/data`.

By default the process listens on all interfaces and stores data in `./data` under its working directory (`kuma.db`,
`upload/`, `screenshots/`).

### systemd example (Linux)

```bash
sudo install -d /opt/pocketkuma
sudo install -m 0755 pocketkuma-linux-x64 /opt/pocketkuma/pocketkuma

sudo tee /etc/systemd/system/pocketkuma.service >/dev/null <<'EOF'
[Unit]
Description=PocketKuma
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/pocketkuma
ExecStart=/opt/pocketkuma/pocketkuma --port=3001 --data-dir=/opt/pocketkuma/data
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now pocketkuma.service
```

### Migrate from Uptime Kuma (SQLite)

PocketKuma can open an existing Uptime Kuma SQLite data directory.

1. Stop Uptime Kuma.
2. Copy the data directory (at least `kuma.db`; include `upload/` and `screenshots/` if present).
3. Start PocketKuma with `--data-dir` pointing at that directory.

On first start PocketKuma upgrades the upstream schema automatically (`buna_schema_version`) and keeps existing users, monitors, notifications, and heartbeats. Existing bcrypt password hashes continue to work.

If the source instance is still running, export a consistent SQLite copy first:

```bash
python3 - <<'PY'
import sqlite3
src = sqlite3.connect("file:/path/to/uptime-kuma/data/kuma.db?mode=ro", uri=True)
dst = sqlite3.connect("/tmp/kuma.db")
with dst:
    src.backup(dst)
src.close(); dst.close()
print("exported /tmp/kuma.db")
PY
```

Then place that `kuma.db` into the PocketKuma data directory before starting the service.

### Notes for real-browser monitors

`real-browser` monitors require a configured system Chrome/Chromium executable. `playwright-core` is embedded in the
release executable, so the binary needs no adjacent `node_modules` directory or runtime sidecar. Other monitor types
do not require Chrome.

Browser acquisition and cleanup are bounded. POSIX builds use the host's `/bin/sh` to supervise the owned browser
process group and fail closed instead of signalling an unrelated reused PID.
