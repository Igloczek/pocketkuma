# BUN-000: Repeatable Memory Benchmark

## Objective

Create a local, repeatable memory benchmark for the current application before runtime migration begins. This task must not optimize code. It must produce a reliable baseline.

## Context

The current concern is RSS above 500 MB for a small monitor set. Without an automated benchmark, later changes cannot prove whether they reduce memory usage or merely move the cost elsewhere.

## Scope

- Add a local benchmark script.
- Use an isolated data directory, for example `data/bench-memory`.
- Seed exactly 20 monitors:
  - 10 HTTP monitors;
  - 4 keyword monitors;
  - 2 ping monitors;
  - 2 TCP monitors;
  - 2 DNS monitors.
- Start local mock services for HTTP, keyword, TCP, and DNS where needed.
- Measure:
  - RSS after startup;
  - RSS after 10 minutes;
  - heap used after 10 minutes;
  - startup time until the app is ready;
  - active monitor count.
- Write results to `docs/perf/`.

## Out of Scope

- Migrating runtime behavior to Bun.
- Changing monitor scheduling.
- Optimizing memory usage.
- Changing production monitor behavior.

## Suggested Implementation

1. Add a script such as `extra/bench-memory.js` or `test/bench-memory.mjs`.
2. The script should:
   - remove and recreate `data/bench-memory`;
   - start the server with `DATA_DIR=./data/bench-memory`;
   - wait until the configured port is ready;
   - create the user and monitors through an existing socket/API flow, or directly through the DB if setup APIs are too costly;
   - wait 10 minutes;
   - read process memory;
   - write a JSON or Markdown report.
3. Add `package.json` scripts:
   - `bench:memory:node`;
   - `bench:memory:bun`.
4. The Bun command may initially produce an incompatibility report, but it must still write an output file.

## Files to Inspect

- `server/server.js`
- `server/model/monitor.js`
- `server/client.js`
- `test/prepare-test-server.js`
- `package.json`
- `docs/perf/`

## Validation

Run:

```bash
npm run bench:memory:node
npm run bench:memory:bun
```

Then check:

```bash
ls docs/perf
```

## Acceptance Criteria

- `bench:memory:node` and `bench:memory:bun` exist.
- The Node benchmark writes a report under `docs/perf/`.
- The Bun benchmark writes either a measurement report or an explicit incompatibility report.
- The report includes startup RSS, 10-minute RSS, heap used, startup time, and monitor count.
- The benchmark does not require GitHub access or external services.
- No server or mock process remains running after the benchmark exits.

## Completion Evidence

Report the generated file path and the RSS summary for the Node scenario.
