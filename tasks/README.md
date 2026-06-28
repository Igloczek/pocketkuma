# uptime-buna Bun migration tasks

This directory tracks the minimum implementation path for turning this fork into a Bun-first, memory-conscious Uptime Kuma fork. The goal is not to benchmark the old Node runtime. The goal is to remove the old runtime shape and run the app on Bun with Bun-native APIs where they materially reduce dependencies, resident memory, or startup complexity.

## Target State

- Bun is the default runtime and package manager.
- HTTP serving uses `Bun.serve`.
- Realtime updates use Bun-native WebSocket support.
- SQLite is the default database path and uses `bun:sqlite`.
- Node-only runtime helpers are replaced with Bun APIs such as `Bun.password`, `Bun.spawn`, Bun Shell, native `fetch`, and native environment handling.
- Heavy optional monitor/provider code is not loaded at startup unless it is used.
- Unused Node-era dependencies and Docker/runtime layers are removed.

## Non-Goals

- No standalone performance-budget or baseline-measurement tasks.
- No public community-process files or upstream governance restoration.
- No broad product rewrite.
- No MariaDB preservation work unless a task explicitly keeps it and proves it does not block the SQLite/Bun default.

## Working Rules

- One `tasks/BUN-*.md` file is one implementation unit.
- Work in order unless the user explicitly chooses a specific task.
- Each task must change code or runtime packaging toward the target state; compatibility-only work is acceptable only when it directly unblocks a later Bun-native change.
- Validation should prove the changed behavior works under Bun. Use Node validation only when preserving a temporary fallback is part of that task.
- If a task removes inherited behavior, the removal must be explicit in that task and in the completion notes.

## Recommended Order

1. [BUN-001](BUN-001-bun-runtime-entrypoint.md) - Bun runtime entrypoint and package manager.
2. [BUN-002](BUN-002-bun-serve-http.md) - HTTP and static serving through `Bun.serve`.
3. [BUN-003](BUN-003-native-websocket.md) - native Bun WebSocket protocol.
4. [BUN-004](BUN-004-bun-sqlite-store.md) - SQLite persistence through `bun:sqlite`.
5. [BUN-005](BUN-005-native-bun-services.md) - Bun-native password hashing, process execution, and shell helpers.
6. [BUN-006](BUN-006-fetch-http-clients.md) - outbound HTTP through native `fetch`.
7. [BUN-007](BUN-007-monitor-runtime-slimming.md) - monitor scheduler and lazy runtime loading.
8. [BUN-008](BUN-008-bun-default-and-prune.md) - Bun default runtime, Docker image, and dependency pruning.
