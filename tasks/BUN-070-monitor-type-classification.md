# BUN-070: Monitor Type Classification

## Objective

Classify monitor types as lightweight core or heavy optional so small installations do not load unnecessary libraries at cold start.

## Context

`UptimeKumaServer` registers many monitor types at startup. Some dependencies are heavy or niche, such as Playwright, Oracle, MSSQL, MongoDB, SNMP, Kafka, and GameDig.

## Scope

- List every monitor type.
- For each type, record:
  - backend file;
  - runtime dependencies;
  - core or optional classification;
  - reason for classification;
  - whether a UI feature flag is needed.
- Write the document to `docs/architecture/monitor-types.md`.

## Out of Scope

- Lazy loading implementation.
- Removing dependencies.
- Changing UI behavior.

## Suggested Implementation

1. Inspect `server/uptime-kuma-server.js`.
2. Inspect `server/monitor-types/*`.
3. Search for dependencies used by each type.
4. Propose this default core set unless evidence suggests otherwise:
   - HTTP;
   - keyword;
   - json-query;
   - ping;
   - TCP;
   - DNS;
   - push;
   - group/manual.
5. Mark anything requiring large external libraries as optional unless there is a strong reason not to.

## Files to Inspect

- `server/uptime-kuma-server.js`
- `server/monitor-types/*`
- `src/pages/EditMonitor.vue`
- `src/components/settings/*`
- `package.json`

## Validation

```bash
rg -n "monitorTypeList|require\\(" server/uptime-kuma-server.js server/monitor-types
```

## Acceptance Criteria

- A monitor type classification document exists.
- Every monitor type is classified.
- Every classification has a reason.
- Heavy/optional dependencies are identified.
- The document identifies follow-up work for lazy loading.

## Completion Evidence

Link to the document and report the number of core and optional monitor types.
