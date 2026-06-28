# uptime-buna migration tasks

This directory contains the implementation backlog for migrating this Uptime Kuma fork from Node.js to Bun.

The goal is not a full rewrite. The goal is to reduce runtime memory, dependency weight, and Docker image size by moving carefully selected parts of the app to native Bun APIs where that produces measurable value.

## Current baseline from repository inspection

- Local runtimes seen during planning: Bun 1.3.14 and Node.js v24.13.0.
- `package.json` still declares Node `>= 20.4.0`.
- The backend starts with `node server/server.js`.
- Runtime dependencies: 83 direct production dependencies.
- `package-lock.json` contains 1315 package entries.
- Backend is mostly CommonJS in `server/`.
- Main runtime weight areas: Express, Socket.IO, axios, Redbean/Knex/SQLite driver, optional monitor dependencies, Playwright/Chromium, embedded MariaDB.

## Working rules

- Keep every implementation change small and reviewable.
- Measure before and after any task that claims a memory, dependency, or startup improvement.
- Prefer compatibility boundaries before replacing implementations.
- Do not remove Uptime Kuma features silently.
- Keep Node-compatible paths only as temporary migration scaffolding unless a task explicitly decides otherwise.
- Human review and local testing are required before treating a change as done.

## Mandatory metrics

For any optimization task, record at least:

- RSS after cold start without monitors.
- RSS after 10 minutes with 20 active HTTP monitors.
- RSS after 10 minutes with a mixed set of HTTP, keyword, ping, TCP, and DNS monitors.
- Startup time until UI/API readiness.
- Runtime dependency count after production install.
- Docker release image size if Docker files are touched.

Suggested result format:

```text
runtime:
command:
commit:
os/arch:
scenario:
rss_start_mb:
rss_10m_mb:
heap_used_10m_mb:
monitors:
notes:
```

## Task files

1. [00-baseline-and-guardrails.md](00-baseline-and-guardrails.md)
2. [01-bun-package-runtime.md](01-bun-package-runtime.md)
3. [02-observability-lifecycle.md](02-observability-lifecycle.md)
4. [03-http-client.md](03-http-client.md)
5. [04-server-websocket.md](04-server-websocket.md)
6. [05-database-storage.md](05-database-storage.md)
7. [06-native-runtime-apis.md](06-native-runtime-apis.md)
8. [07-optional-monitor-types.md](07-optional-monitor-types.md)
9. [08-docker-ci.md](08-docker-ci.md)
10. [09-final-cleanup.md](09-final-cleanup.md)

## Recommended order

1. Baseline and guardrails.
2. Bun package manager and compatible runtime.
3. Memory observability and monitor lifecycle checks.
4. HTTP client adapter and axios reduction.
5. Database hot path work.
6. Native Bun APIs for small runtime dependencies.
7. Optional monitor dependency split.
8. Server/WebSocket migration only after contracts are isolated.
9. Docker and local CI.
10. Final cleanup and migration report.

## First implementation task

Start with `BUN-000` from [00-baseline-and-guardrails.md](00-baseline-and-guardrails.md).

It creates an objective baseline before runtime changes. Without it, later work cannot prove whether the migration actually reduces the memory usage problem.
