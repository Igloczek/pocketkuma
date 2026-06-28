# AGENTS.md

## Repository Identity

`uptime-buna` is a personal fork of Uptime Kuma. It is not an official Uptime Kuma project and is not intended to operate as a public open-source community project.

The repository is published "as is": no formal support process, no issue triage process, no release promise, and no community governance files.

## Current Stack

- Backend: Node.js, CommonJS, Express, Socket.IO.
- Frontend: Vue 3, Vite, Bootstrap-based UI.
- Database layer: SQLite by default through Redbean/Knex/`@louislam/sqlite3`; MariaDB support is inherited from upstream.
- Package manager today: npm with `package-lock.json`.
- Runtime today: `node server/server.js`.
- Docker today: inherited Node-based Dockerfiles.

## Target Direction

- Move runtime execution from Node.js to Bun.
- Use native Bun APIs where they reduce memory, dependencies, or runtime complexity.
- Keep the application recognizable; do not rewrite the product from scratch.
- Prefer SQLite and a lightweight runtime as the default direction.

Preferred Bun targets when the relevant task calls for them:

- `bun install` and `bun.lock`
- `Bun.serve`
- native Bun WebSocket support
- `bun:sqlite`
- `Bun.SQL`
- Bun environment handling
- `Bun.password`
- `Bun.spawn` and Bun Shell

## Repository Decisions

- Migration work is tracked in `tasks/`.
- Each `tasks/BUN-*.md` file is one task and one implementation unit.
- Do not combine multiple task files into one implementation unless explicitly requested.
- Keep existing npm/Node paths until a task explicitly changes the default runtime.
- Do not restore upstream community files such as `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, PR templates, stale workflows, release workflows, or sponsor/funding files.
- Dependency update automation uses Renovate via `renovate.json`; do not restore Dependabot.
- Do not add GitHub Actions or other GitHub automation unless explicitly requested.

## Verification

Use the command set that matches the changed area.

Current inherited Node/npm checks:

```bash
npm ci
npm run lint
npm run build
npm run test-backend
npm run test-e2e
```

Current backend smoke start:

```bash
node server/server.js --port=3001 --data-dir=./data/smoke
```

Bun checks should be used only after the relevant Bun scripts or lockfile exist:

```bash
bun install --frozen-lockfile
bun run bun:build
bun run bun:test-backend
bun run bun:start-server -- --port=3002 --data-dir=./data/bun-smoke
```

Runtime, memory, dependency, database, Docker, networking, and monitor-scheduling changes must include before/after measurements. Store benchmark outputs under `docs/perf/` when the task specifies a report.

Docker changes should record image size with:

```bash
docker image inspect <image-name> --format '{{.Size}}'
```

Documentation-only changes do not require app tests; verify links, filenames, and `git status`.
