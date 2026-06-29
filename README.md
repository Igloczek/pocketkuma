# Uptime Buna

**Uptime Buna** is a fork of [Uptime Kuma](https://github.com/louislam/uptime-kuma) — the same monitoring product, rebuilt for a lighter runtime. It is not an official Uptime Kuma project.

## Why

Uptime Kuma supports a wide range of runtimes, databases, and deployment paths. That flexibility is useful, but it costs memory, dependencies, and complexity. Uptime Buna exists for self-hosted installs where a simpler stack matters more than matching every upstream option.

If you need Node, npm, MySQL as an application database, or upstream's full deployment matrix, use [Uptime Kuma](https://github.com/louislam/uptime-kuma).

## What's different

- **Distribution:** one binary — download, run, open the browser. No runtime install, no repo clone, no Docker, no compose files.
- **Runtime:** Bun compiled into that executable — not Node.js
- **Database:** SQLite only for application data. MySQL/MariaDB remain available as monitor types.
- **Server:** `Bun.serve` for HTTP, static assets, and WebSockets — not Socket.IO on Node
- **Data:** stored in `./data` next to the executable by default

## Run

Download the binary for your platform from [Releases](https://github.com/igloczek/uptime-buna/releases), then:

```bash
./uptime-buna
```

Open `http://localhost:3001` and complete the setup wizard on first visit.

Optional flags: `--port=3001`, `--data-dir=/path/to/data`.

## Build the binary

Requires [Bun](https://bun.sh) ≥ 1.2.

```bash
bun install --frozen-lockfile
bun run build
```

This writes `uptime-buna` in the project root. Cross-compile with:

```bash
bun run build -- --target=bun-linux-x64 --outfile=dist/releases/uptime-buna-linux-x64
```

Tagged releases (`v*`) are built for Linux, macOS, and Windows via GitHub Actions and published to [Releases](https://github.com/igloczek/uptime-buna/releases) with SHA256 checksums.

## Develop

```bash
bun install --frozen-lockfile
bun run dev
```

Development serves the frontend from Vite and runs the server from source. Release builds embed the frontend and database template into the executable.
