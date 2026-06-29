# AGENTS.md

## Repository Identity

Uptime Buna is a performance-focused fork of Uptime Kuma. It is not an official Uptime Kuma project and is not intended to operate as a public open-source community project.

The repository is published "as is": no formal support process, no issue triage process, no release promise, and no community governance files.

## Current Stack

- Backend: Bun runtime, native ESM modules (`import`/`export`), Express compatibility routes, and Bun-native HTTP/WebSocket paths.
- Frontend: Vue 3, Vite, Bootstrap-based UI.
- Database layer: SQLite only through the Bun-native compatibility store; MariaDB/MySQL are not supported as application databases.
- Package manager today: Bun with `bun.lock`.
- Distribution today: one compiled executable produced by `bun run build`.
- Development today: `bun run dev` for source runs; `bun src/server/server.ts` for backend-only work.

## Target Direction

- Keep runtime execution on Bun.
- Use native Bun APIs where they reduce memory, dependencies, or runtime complexity.
- Keep the application recognizable; do not rewrite the product from scratch.
- Prefer SQLite and a lightweight runtime. Do not add app-database backends only for upstream parity.
- Ship Uptime Buna as a single executable. Do not add Docker, compose, or parallel distribution paths unless explicitly requested.

Preferred Bun targets when the relevant task calls for them:

- `bun install` and `bun.lock`
- `Bun.serve`
- native Bun WebSocket support
- `bun:sqlite`
- `Bun.SQL`
- Bun environment handling
- `Bun.password`
- `Bun.spawn` and Bun Shell
- `bun build --compile` for release binaries

## Repository Decisions

- Do not add npm or Node fallback paths for default runtime, package-manager, or verification workflows.
- Do not restore upstream community files such as `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, PR templates, stale workflows, release workflows, or sponsor/funding files.
- Dependency update automation uses Renovate via `renovate.json`; do not restore Dependabot.
- Release binaries are built and published by `.github/workflows/release.yml` on `v*` tag push.
- CI runs via `.github/workflows/ci.yml` on `master` and pull requests.

## Verification

Use the command set that matches the changed area.

Current Bun checks:

```bash
bun install --frozen-lockfile
bun run lint
bun run build
bun run test:backend
bun run test-e2e
```

Current backend smoke start:

```bash
./uptime-buna --port=3001 --data-dir=./data/smoke
```

Development smoke start:

```bash
bun src/server/server.ts --port=3001 --data-dir=./data/smoke
```

Runtime, memory, dependency, database, networking, and monitor-scheduling changes must include before/after measurements. Store benchmark outputs under `docs/perf/` when the task specifies a report.

Documentation-only changes do not require app tests; verify links, filenames, and `git status`.
