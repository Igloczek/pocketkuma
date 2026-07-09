# PocketKuma

**PocketKuma** is a fork of [Uptime Kuma](https://github.com/louislam/uptime-kuma) — the same monitoring product, but built on [Bun](https://bun.sh/) and TypeScript. It is a single binary with SQLite as the only supported database, and it is designed for self-hosted installs where simplicity matters more than matching every upstream option.

## Why

The Uptime Kuma codebase is a bit out of date and heavily relies on a large number of dependencies, which leads to unnecessary memory usage. Bun is lighter and comes with lots of built-in features, so it is a good fit for this project. The goal is to provide a simple, fast, and easy-to-deploy monitoring solution without reinventing the wheel.

## What's different

PocketKuma keeps the same product surface — monitors, notifications, status pages, and the dashboard UI — but changes how it is built, shipped, and run.

### Distribution and deployment

- **What changed:** the release artifact is a single compiled binary (`bun build --compile`) with the frontend embedded inside it.
- **Effect:** download, run, open the browser. No Node.js install, no `git clone`, no `npm ci`, and no Docker image required for the default install path.

### Runtime and server stack

- **What changed:** the server runs on Bun instead of Node.js. Express, Socket.IO, and the Node HTTP fallback path are gone. HTTP is served through `Bun.serve`, realtime UI updates use Bun's native WebSocket support, and outbound HTTP uses `fetch` instead of `axios`.
- **Effect:** a smaller runtime surface, fewer moving parts at startup, and no separate web framework process layered on top of the monitor.

### Dependencies

- **What changed:** compared to upstream Uptime Kuma v2.4.0, PocketKuma drops **50 direct** `package.json` entries (**41** from production dependencies) and about **200** fewer packages in the full install tree. Common utilities were replaced with Bun builtins or small in-repo helpers — for example `Bun.password` for hashing, native JWT handling, and built-in SQLite access.
- **Effect:** less dependency churn, faster installs for development, and a leaner production footprint. Monitor-specific packages (Postgres, MQTT, SNMP, Playwright, and similar) are still there, but optional monitor and notification code loads on demand instead of at process start.

### Database

- **What changed:** SQLite is the only supported application database. The first-run setup no longer offers MariaDB, embedded MariaDB, or any other app-database backend.
- **Effect:** one fewer deployment decision and one fewer database service to run alongside the monitor. MySQL/MariaDB are still available as **monitor types** for checking external databases.

### Data layout

- **What changed:** application state lives in a local data directory instead of an external database server.
- **Effect:** by default, data is stored in `./data` next to the executable — easy to back up, move, or mount as a volume.

## Run

Download the binary for your platform from [Releases](https://github.com/Igloczek/pocketkuma/releases), then:

```bash
chmod +x pocketkuma-linux-x64   # or the asset for your OS/arch
./pocketkuma-linux-x64
```

Open `http://localhost:3001` and complete the setup wizard on first visit.

Optional flags: `--port=3001`, `--host=0.0.0.0`, `--data-dir=/path/to/data`.

By default the process listens on all interfaces and stores data in `./data` next to the executable (`kuma.db`, `upload/`, `screenshots/`).

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

`real-browser` monitors use Chromium via `playwright-core`. That package is optional and loaded only when such a monitor runs. Regular HTTP/keyword/redis monitors do not need it.
