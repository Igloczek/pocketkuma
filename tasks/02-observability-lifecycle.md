# 02. Observability and monitor lifecycle

## BUN-020: Add a lightweight memory report

Scope:

- Add a local command or debug-only endpoint that reports process memory.
- Include RSS, heap, external memory, monitor count, and active timer count if practical.
- Support Node and Bun.

Files to inspect:

- `server/server.js`
- `server/uptime-kuma-server.js`
- `server/client.js`

Acceptance criteria:

- The report is not publicly available unless explicitly enabled by a debug environment variable.
- Output is JSON.
- The benchmark task can consume this report.

## BUN-021: Check timer leaks around monitor restart and pause

Scope:

- Review `Monitor.start()`, `Monitor.stop()`, `startMonitor()`, `restartMonitor()`, and `pauseMonitor()`.
- Add tests that detect leftover heartbeat timers after restart, pause, and resume.

Files to inspect:

- `server/model/monitor.js`
- `server/server.js`
- `test/backend-test/`

Acceptance criteria:

- Restarting a monitor does not leave the previous heartbeat timer running.
- Pausing a monitor prevents the next check from running.
- Test behavior is documented for both Node and Bun.

## BUN-022: Reduce heartbeat history load cost

Scope:

- Measure `sendHeartbeatList()` and `sendImportantHeartbeatList()` for many monitors.
- Add lazy loading or pagination if reconnect/login sends more history than the UI needs.

Files to inspect:

- `server/client.js`
- `src/mixins/socket.js`
- `src/pages/Details.vue`

Acceptance criteria:

- Login does not fetch unnecessary heartbeat history for monitors the user is not viewing, or measurements prove the current behavior is acceptable.
- Setup and dashboard E2E still work.
- Client reconnect does not cause a permanent memory increase.
