# Uptime Maku

**Uptime Maku is a lightweight, self-hosted monitoring application for websites, APIs, networks, and services.**

It provides the familiar essentials of an uptime monitor—scheduled checks, history, notifications, maintenance windows, incidents, and public status pages—while being built around a smaller and more maintainable architecture.

> Uptime Maku is under active development. Expect breaking changes until the first stable release.

## What it offers

- HTTP, TCP, ping, DNS, certificate, database, and other service monitors
- uptime history, response times, and operational dashboards
- notification integrations and configurable alerting
- public status pages, incidents, and maintenance windows
- SQLite storage with no external database server
- a single executable for deployment

## Why Uptime Maku?

Uptime Kuma is an excellent product, but its codebase has accumulated tightly coupled modules, hidden global state, broad compatibility layers, oversized dependency graphs, and weak internal boundaries. Those problems make the application harder to understand, change, test, and keep lightweight.

Uptime Maku keeps the useful product ideas and rebuilds the internals around explicit ownership, focused modules, direct dependencies, and a deliberately narrow platform.

Read [Why Uptime Maku exists](docs/why-uptime-maku.md) for the full architectural rationale.

## Run

Download the executable for your platform from [Releases](https://github.com/Igloczek/uptime-maku/releases), then run it:

```bash
chmod +x uptime-maku-linux-x64
./uptime-maku-linux-x64
```

Open `http://localhost:3001` to complete setup.

```text
--port=3001
--host=0.0.0.0
--data-dir=/path/to/data
```

Application data is stored in `./data` by default. Real-browser monitors also require Chrome or Chromium on the host.

## Migrate from Uptime Kuma

Uptime Maku can migrate a copy of an existing Uptime Kuma SQLite data directory.

1. Stop Uptime Kuma.
2. Back up and copy its data directory, including `kuma.db`, `upload/`, and `screenshots/` when present.
3. Start Uptime Maku with `--data-dir` pointing to the copy.

Never run both applications against the same database. Migration support is still evolving, so keep the original backup.

## Credits

Uptime Maku is derived from [Uptime Kuma](https://github.com/louislam/uptime-kuma), created by [Louis Lam](https://github.com/louislam) and its contributors. Their work established the product, integrations, translations, and user experience that made this rewrite possible.

Uptime Maku is an independent project and is not affiliated with or supported by Uptime Kuma. The original attribution is retained under the [MIT license](LICENSE).
