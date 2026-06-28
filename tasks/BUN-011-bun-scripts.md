# BUN-011: Parallel Bun Scripts

## Objective

Add Bun scripts alongside the existing npm/Node scripts so migration paths can be tested without changing the default runtime.

## Context

Current scripts start the backend with `node server/server.js`. Before changing defaults, Bun needs separate smoke commands.

## Scope

- Add these scripts to `package.json`:
  - `bun:start-server`;
  - `bun:start-server-dev`;
  - `bun:test-backend`;
  - `bun:build`.
- Keep existing Node/npm scripts unchanged.
- Bun scripts may initially execute existing CommonJS code.
- Document known differences in `docs/bun-scripts.md`.

## Out of Scope

- Changing `start` to Bun.
- Removing `cross-env`.
- Migrating all tests to `bun test` if that requires test rewrites.

## Suggested Implementation

1. Add the scripts to `package.json`.
2. Set `NODE_ENV=development` for dev startup in a way that works under Bun and the local shell.
3. Make `bun:build` run Vite through Bun.
4. Make `bun:test-backend` run backend tests through Bun if compatible; otherwise document unsupported tests.
5. Add a short command/status document.

## Files to Inspect

- `package.json`
- `test/test-backend.mjs`
- `config/playwright.config.js`
- `docs/bun-scripts.md`

## Validation

```bash
bun run bun:build
bun run bun:test-backend
bun run bun:start-server -- --port=3001 --data-dir=./data/bun-smoke
```

Stop the smoke server and remove the test data directory if it is not needed.

## Acceptance Criteria

- All new scripts exist in `package.json`.
- `bun:build` succeeds or has a specific blocker.
- `bun:test-backend` succeeds or lists incompatible tests.
- Bun smoke start reaches server initialization or reports a specific runtime blocker.
- Existing npm scripts are not removed or remapped.

## Completion Evidence

Report the results of the three validation commands and link to `docs/bun-scripts.md`.
