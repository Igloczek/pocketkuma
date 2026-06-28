# BUN-020: Debug Runtime Memory Report

## Objective

Add a lightweight, explicitly enabled way to read process memory during local benchmarks and debugging.

## Context

BUN-000 can read RSS from the operating system, but an application-level report makes Node/Bun comparisons easier and reduces guesswork when tracking regressions.

## Scope

- Add an HTTP endpoint or socket event available only when an explicit debug environment variable is set.
- Return JSON.
- Include at least:
  - runtime name;
  - runtime version;
  - pid;
  - process uptime in seconds;
  - RSS;
  - heap total;
  - heap used;
  - external memory;
  - active monitor count;
  - loaded monitor type count.
- Include monitor timer count if it can be implemented without fragile runtime internals.

## Out of Scope

- Public diagnostics.
- A UI for memory monitoring.
- Prometheus integration.

## Suggested Implementation

1. Add an endpoint such as `GET /debug/runtime-memory`.
2. Register it only when `UPTIME_BUNA_DEBUG_RUNTIME=1`.
3. Use `process.memoryUsage()`.
4. Use `UptimeKumaServer.getInstance().monitorList` for active monitor count.
5. Add a smoke test or backend test for enabled and disabled behavior.
6. If BUN-000 already exists, make the benchmark consume this endpoint.

## Files to Inspect

- `server/server.js`
- `server/uptime-kuma-server.js`
- `server/client.js`
- `test/backend-test/`

## Validation

```bash
node server/server.js --port=3012 --data-dir=./data/memory-debug-off
curl -i http://127.0.0.1:3012/debug/runtime-memory

UPTIME_BUNA_DEBUG_RUNTIME=1 node server/server.js --port=3013 --data-dir=./data/memory-debug-on
curl -s http://127.0.0.1:3013/debug/runtime-memory
```

## Acceptance Criteria

- Without `UPTIME_BUNA_DEBUG_RUNTIME=1`, the endpoint does not expose data.
- With the flag enabled, the endpoint returns valid JSON.
- The JSON contains all required fields.
- The report works under Node.
- The report works under Bun or reports a specific blocker.
- The endpoint is protected by the explicit debug flag.

## Completion Evidence

Provide sample JSON output and the disabled-endpoint result.
