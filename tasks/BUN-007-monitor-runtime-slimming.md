# BUN-007: Monitor Scheduler and Lazy Runtime Loading

## Objective

Reduce startup and resident runtime weight by loading monitor/provider code only when needed and by keeping monitor timers controlled.

## Scope

- Classify monitor types into core, optional, and removed-for-this-fork groups.
- Lazy-load optional monitor implementations and notification providers.
- Avoid importing heavyweight integrations during startup.
- Ensure start, pause, stop, and restart do not leave duplicate timers.
- Make heartbeat history loading demand-driven if the current startup/login path eagerly loads large history.

## Out of Scope

- Adding new monitor types.
- Preserving every upstream integration if it meaningfully harms the lightweight Bun fork.
- Standalone memory benchmark tasks.

## Validation

```bash
bun run bun:test:backend
bun run bun:build
bun run bun:start -- --port=3006 --data-dir=./data/bun-monitor-smoke
```

Add focused tests for repeated restart, pause, and stop so only one active check loop remains.

## Acceptance Criteria

- Startup imports only core monitor/provider code.
- Optional monitors load when configured, not at boot.
- Repeated monitor restart does not duplicate scheduled checks.
- Pause and stop clear future checks.
- Any removed monitor/provider type is listed explicitly.

## Completion Evidence

Report the core/optional/removed monitor groups, timer test names, and the remaining eager imports.
