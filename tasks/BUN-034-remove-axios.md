# BUN-034: Remove Axios

## Objective

Remove `axios` from runtime dependencies only after all runtime paths have either migrated away from it or have been explicitly moved out of the lightweight runtime.

## Context

Axios is used widely. Removing it before special transports are resolved can break monitors, notifications, or Docker integration.

## Scope

- Remove all runtime imports of `axios`.
- Remove `axios` from `package.json`.
- Remove related helper packages only when unused:
  - `form-data`;
  - `http-cookie-agent`;
  - `http-proxy-agent`;
  - `https-proxy-agent`;
  - `socks-proxy-agent`;
  - `tough-cookie`.
- Update lockfiles.
- Measure dependency count and RSS before/after.

## Out of Scope

- Changing monitor APIs.
- Changing notification provider UI.
- Removing functionality that has no replacement.

## Suggested Implementation

1. Run `rg -n "axios|Axios" server src extra test config db`.
2. For each result, decide:
   - replace with adapter;
   - keep as test-only mock;
   - remove dead code.
3. Remove `axios` from dependencies.
4. Run install and tests.
5. Compare dependency count before/after.
6. Run memory benchmark.

## Files to Inspect

- `package.json`
- `package-lock.json`
- `bun.lock`
- `server/http-client.js`
- `server/notification-providers/*`
- `server/model/monitor.js`
- `server/docker.js`
- `server/check-version.js`

## Validation

```bash
rg -n "axios|Axios" server src extra test config db package.json
npm install
npm run test-backend
npm run build
npm run bench:memory:node
```

If a Bun lockfile exists:

```bash
bun install --frozen-lockfile
bun run bun:test-backend
```

## Acceptance Criteria

- `axios` is absent from runtime code and `package.json`.
- Remaining search results are test-only or documentation-only and are justified.
- Backend tests pass.
- Frontend build passes.
- Before/after memory benchmark is saved.
- Proxy, mTLS, NTLM, and Docker behavior have either tests or explicit BUN-033 decisions.

## Completion Evidence

Report the search result, removed packages, and dependency count/RSS difference.
