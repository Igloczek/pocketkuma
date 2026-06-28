# BUN-062: Ping Without `@louislam/ping`

## Objective

Replace `@louislam/ping` with system `ping` executed through `Bun.spawn` if measurements show that the replacement is worthwhile.

## Context

Ping monitoring is core functionality, but system `ping` output differs across Linux, macOS, and Windows. The migration must preserve timeout, count, packet size, numeric mode, and IPv6 fallback.

## Scope

- Measure the cost of `@louislam/ping`.
- Add output parsing for Linux and macOS.
- Handle:
  - success;
  - host unreachable;
  - timeout;
  - DNS failure;
  - IPv6 fallback.
- Support Windows or explicitly record it as follow-up work.
- Remove the dependency only after tests pass.

## Out of Scope

- Changing ping monitor UI.
- Changing default timeout/count values.
- TCP monitor behavior.

## Suggested Implementation

1. Add `server/ping-runner.js`.
2. Build arguments per platform.
3. Use `Bun.spawn` under Bun and a Node fallback under Node.
4. Return ping latency in milliseconds as a number.
5. Add fixture outputs for Linux and macOS.
6. Replace `exports.pingAsync` in `server/util-server.js`.
7. Run benchmarks before/after.

## Files to Inspect

- `server/util-server.js`
- `server/model/monitor.js`
- `package.json`
- `test/backend-test/`

## Validation

```bash
npm run test-backend
bun run bun:test-backend
npm run bench:memory:node
bun run bench:memory:bun
```

Add parser tests using fixture output.

## Acceptance Criteria

- Ping monitor works on Linux.
- Ping monitor works on macOS.
- Timeout does not leave a `ping` process running.
- IPv6 fallback works or has a documented blocker.
- `@louislam/ping` is removed only after tests pass.
- RSS/dependency impact is recorded.

## Completion Evidence

Report parser test results, ping monitor smoke results, and the Windows decision.
