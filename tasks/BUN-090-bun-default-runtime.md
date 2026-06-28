# BUN-090: Bun as Default Runtime

## Objective

Make Bun the default runtime only after critical tests and benchmarks pass.

## Context

Until this task, Node is a compatibility fallback. This task changes the default way the project is run.

## Scope

- Change default scripts:
  - `start`;
  - `start-server`;
  - backend dev server if ready.
- Update README.
- Update Docker release target if BUN-080/BUN-081 are complete.
- Keep a Node fallback only if explicitly documented.

## Out of Scope

- Removing all Node compatibility code.
- Removing npm immediately.
- Migrating all dev tools.

## Suggested Implementation

1. Confirm `bun:check` passes.
2. Confirm Bun benchmark results are within budget.
3. Change `package.json` default scripts to use Bun.
4. Add `node:start-server` as fallback if needed.
5. Update README and AGENTS if their instructions mention startup commands.
6. Run clean install/start smoke checks.

## Files to Inspect

- `package.json`
- `README.md`
- `AGENTS.md`
- `docker/dockerfile`
- `tasks/README.md`

## Validation

```bash
bun install --frozen-lockfile
bun run start
bun run bun:check
npm run node:start-server
```

Run the last command only if a Node fallback remains.

## Acceptance Criteria

- Default start uses Bun.
- README presents Bun as the primary runtime.
- Node fallback is documented or removed.
- Bun benchmark is within the BUN-001 budget.
- Docker release behavior matches the runtime decision.

## Completion Evidence

Report the `bun run start` smoke result and link to the current Bun benchmark.
