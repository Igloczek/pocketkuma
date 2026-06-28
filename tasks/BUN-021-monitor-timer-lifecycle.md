# BUN-021: Monitor Timer Lifecycle

## Objective

Verify and protect monitor lifecycle behavior so restart, pause, and stop do not leave old heartbeat timers running.

## Context

`Monitor.start()` schedules future checks through `setTimeout`. If restart or pause leaves old timers behind, memory benchmarks become unreliable and the app can do duplicate work.

## Scope

- Review:
  - `Monitor.start()`;
  - `Monitor.stop()`;
  - `startMonitor()`;
  - `restartMonitor()`;
  - `pauseMonitor()`.
- Add tests for:
  - start -> pause;
  - start -> restart;
  - start -> stop;
  - repeated restart.
- The test must detect either scheduled check count or mock check invocation count.

## Out of Scope

- Rewriting the monitor scheduler.
- Changing monitor intervals.
- Optimizing heartbeat database writes.

## Suggested Implementation

1. Add a backend test with a fake or local monitor and a short interval.
2. Use a mocked check function or a simple local HTTP endpoint.
3. After pause/stop, wait longer than the interval and assert no extra check runs.
4. After several restarts, assert only one active cycle remains.
5. If the code is hard to test without starting the server, extract a minimal lifecycle helper.

## Files to Inspect

- `server/model/monitor.js`
- `server/server.js`
- `test/backend-test/`

## Validation

```bash
npm run test-backend -- --test-name-pattern timer
bun run bun:test-backend
```

If the current runner does not support `--test-name-pattern`, run the specific test file directly with `node --test`.

## Acceptance Criteria

- A test proves pause stops future executions.
- A test proves restart does not duplicate timers.
- A test proves stop clears the timer.
- Public monitor APIs are unchanged.
- If Bun timer behavior differs, the difference is documented.

## Completion Evidence

Report the test name and the check invocation count in the restart scenario.
