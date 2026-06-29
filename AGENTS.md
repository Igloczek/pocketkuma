# AGENTS.md

## Repository Identity

Uptime Buna is a performance-focused fork of Uptime Kuma. It is not an official Uptime Kuma project and is not intended to operate as a public open-source community project.

The repository is published "as is": no formal support process, no issue triage process, no release promise, and no community governance files.

## Current Stack

- Backend: Bun runtime, native ESM modules (`import`/`export`), Express compatibility routes, and Bun-native HTTP/WebSocket paths.
- Frontend: Vue 3, Vite, Bootstrap-based UI.
- Database layer: SQLite only through the Bun-native compatibility store; MariaDB/MySQL are not supported as application databases.
- Package manager today: Bun with `bun.lock`.
- Runtime today: `bun src/server/server.ts`.
- Docker today: root `Dockerfile` builds one local Bun runtime image; `compose.yaml` is runtime-only convenience, not a development workflow.

## Target Direction

- Keep runtime execution on Bun.
- Use native Bun APIs where they reduce memory, dependencies, or runtime complexity.
- Keep the application recognizable; do not rewrite the product from scratch.
- Prefer SQLite and a lightweight runtime. Do not add app-database backends only for upstream parity.

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
- Do not add npm or Node fallback paths for default runtime, package-manager, or verification workflows.
- Do not restore upstream community files such as `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, PR templates, stale workflows, release workflows, or sponsor/funding files.
- Dependency update automation uses Renovate via `renovate.json`; do not restore Dependabot.
- Do not add GitHub Actions or other GitHub automation unless explicitly requested.

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
bun src/server/server.ts --port=3001 --data-dir=./data/smoke
```

Runtime, memory, dependency, database, Docker, networking, and monitor-scheduling changes must include before/after measurements. Store benchmark outputs under `docs/perf/` when the task specifies a report.

Docker changes should record image size with:

```bash
docker image inspect <image-name> --format '{{.Size}}'
```

Documentation-only changes do not require app tests; verify links, filenames, and `git status`.
