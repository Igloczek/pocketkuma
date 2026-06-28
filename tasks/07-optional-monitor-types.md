# 07. Optional monitor types and dependency groups

## BUN-070: Classify monitor types as core or optional

Scope:

- Split monitor types into lightweight core and optional heavy groups.
- Candidate optional types: real-browser/Playwright, Oracle, MSSQL, MongoDB, SNMP, Kafka, GameDig, embedded MariaDB.

Files to inspect:

- `server/uptime-kuma-server.js`
- `server/monitor-types/*`
- `src/pages/EditMonitor.vue`
- `src/components/settings/*`

Acceptance criteria:

- Core/optional monitor list is documented.
- UI hides optional monitors when dependency or feature flag is unavailable.
- Lightweight runtime does not `require()` heavy optional libraries at startup.

## BUN-071: Lazy-load monitor types

Scope:

- Change `UptimeKumaServer.monitorTypeList` initialization so heavy types load only when enabled or used.
- Avoid loading Playwright, Oracle, MSSQL, MongoDB, and SNMP on cold start for lightweight installs.

Acceptance criteria:

- Lightweight cold start avoids heavy module imports.
- Optional monitor creation still works when dependencies are installed.
- `sendMonitorTypeList()` does not regress.
- RSS impact is measured.

## BUN-072: Split lightweight and full dependency groups

Scope:

- Prepare a lightweight install focused on SQLite and core monitors.
- Preserve full compatibility in a full target.

Acceptance criteria:

- Build or install targets clearly distinguish lightweight and full variants.
- Docker has separate targets or build args.
- Full target does not lose existing features by accident.
