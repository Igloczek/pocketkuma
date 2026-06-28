# BUN-071: Lazy Loading Monitor Types

## Objective

Change monitor type loading so heavy optional dependencies are not imported during lightweight cold start.

## Context

BUN-070 identifies optional monitor types. The registration mechanism must now allow metadata to be available for UI while loading heavy implementations only when needed.

## Scope

- Add a monitor type registry with metadata.
- Load optional implementations only:
  - on first check for that monitor type; or
  - when a feature flag enables them.
- Keep `sendMonitorTypeList()` functional.
- Measure cold-start RSS before/after.

## Out of Scope

- Removing optional dependencies.
- Changing monitor check logic.
- Broad UI changes beyond hiding or disabling unavailable types.

## Suggested Implementation

1. Add `server/monitor-types/registry.js`.
2. Registry entries should include:
   - `type`;
   - display/metadata needed by UI;
   - `core`;
   - `featureFlag`;
   - `load()`.
3. Core types may load immediately.
4. Optional types should use lazy `require`.
5. Update `UptimeKumaServer.monitorTypeList` usage.
6. Add a test proving a heavy dependency such as `playwright-core` is not loaded during lightweight cold start.

## Files to Inspect

- `server/uptime-kuma-server.js`
- `server/monitor-types/*`
- `server/client.js`
- `src/pages/EditMonitor.vue`

## Validation

```bash
npm run test-backend
npm run bench:memory:node
node -e "require('./server/uptime-kuma-server'); console.log(Object.keys(require.cache).filter(k => k.includes('playwright')).length)"
```

## Acceptance Criteria

- Optional monitor dependencies are not loaded during lightweight cold start.
- Core monitors still work.
- Optional monitors still work when dependencies and feature flags are available.
- UI hides or disables unavailable monitor types.
- Cold-start RSS before/after is recorded.

## Completion Evidence

Report the `require.cache` check result and cold-start RSS difference.
