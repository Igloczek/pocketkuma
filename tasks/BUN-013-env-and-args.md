# BUN-013: Environment Loading and CLI Arguments

## Objective

Remove simple `dotenv` and `args-parser` usage if the current CLI contract can be preserved under both Node and Bun.

## Context

Bun has native environment handling, but the project must keep the current Node path until the default runtime changes.

## Scope

- Inventory all `args-parser` usage.
- Inventory required CLI flags:
  - `--port`;
  - `--data-dir`;
  - `--disable-frame-sameorigin`;
  - `--cloudflared-token`;
  - `--test`;
  - any other flags found in the code.
- Add a small local argument parser.
- Adjust `.env` loading so:
  - Node still loads `.env`;
  - Bun does not require `dotenv` if native behavior is sufficient.
- Remove dependencies only when runtime usage is gone.

## Out of Scope

- Renaming flags.
- Changing database configuration behavior.
- Migrating all environment variables.

## Suggested Implementation

1. Add a helper such as `server/cli-args.js` or `server/runtime-config.js`.
2. The parser must support:
   - `--flag=value`;
   - `--flag value`;
   - boolean flags.
3. Add unit tests for the parser.
4. Replace `args-parser` imports.
5. Add runtime-aware `.env` behavior:
   - Node: load `.env` while needed;
   - Bun: use native behavior or explicitly document why `dotenv` remains.
6. If dependencies are removed, run install and tests.

## Files to Inspect

- `server/server.js`
- `server/config.js`
- `extra/reset-password.js`
- `extra/remove-2fa.js`
- `extra/reset-migrate-aggregate-table-state.js`
- `package.json`

## Validation

```bash
npm run test-backend
node server/server.js --port=3010 --data-dir=./data/args-node-smoke --test
bun run bun:start-server -- --port=3011 --data-dir=./data/args-bun-smoke --test
rg -n "args-parser|dotenv" server extra package.json
```

## Acceptance Criteria

- All known flags behave as before.
- The parser has tests for `--x=y`, `--x y`, and boolean flags.
- `args-parser` is removed or remains with a specific justification.
- `dotenv` is removed or remains with a specific justification.
- Node and Bun smoke starts do not lose `--port` or `--data-dir`.

## Completion Evidence

Report parser test results, the `rg` result for `args-parser|dotenv`, and the dependency decision for each package.
