# PocketKuma and Uptime Kuma 2.4.0

## Comparison scope

PocketKuma forked Uptime Kuma v2.4.0 at
`584fc0761cb75e952af1d3fc53f8f78feb0bda0f`. The first PocketKuma Bun commit is
`39757790c379afdf37e13b761fdeb1f8a0c33db4`. This document describes intentional platform changes and classifies
the stabilization findings against that exact baseline.

For origin classification only, upstream was also inspected at `590f90e3` on 2026-07-13. That date-scoped check is
not a claim about later upstream revisions. "Inherited" below means the audited behavior existed in both inspected
upstream revisions; it is not a general assessment of the upstream project.

## Deliberate platform differences

| Area               | PocketKuma decision                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime            | Bun, native ESM, `Bun.serve`, native Bun WebSockets, and Bun runtime APIs replace the Node/Express/Socket.IO default path.                           |
| Database           | The application database is SQLite only, through the Bun-native store. MariaDB/MySQL remain available only as external monitor targets.              |
| Distribution       | `bun run build` produces one executable with the frontend and runtime dependencies embedded. Docker and parallel distribution paths are not shipped. |
| Dependencies       | Direct `package.json` entries fell from 83 production/154 total in the v2.4.0 baseline to 35 production/88 total.                                    |
| Project operations | PocketKuma is published as-is and does not retain upstream community governance, support, triage, or release-process files.                          |

The product remains recognizable: existing Uptime Kuma SQLite data, users, monitors, notifications, status pages,
and heartbeats are migrated rather than replaced.

## Stabilization finding origin

| Finding                                                                                                           | Classification                  | Resolution                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compiled SMTP provider import and migrated notification test                                                      | PocketKuma/Bun regression       | Replaced the runtime-relative provider load that resolved `smtp.ts` from `/$bunfs/root/server.js`; source and compiled migration/send coverage now use a local SMTP sink. |
| Notification forms, status-page rendering, dashboard heartbeat state, store bridge, and reverse-proxy settings UI | PocketKuma refactor regressions | Restored the affected UI and store contracts and added focused browser coverage.                                                                                          |
| HTTP TLS/proxy transport and proxy ownership/defaults                                                             | Mixed                           | Native-`fetch` TLS/proxy regressions came from the Bun migration; missing ownership checks and unsafe proxy defaults were inherited from the v2.4.0 baseline.             |
| Authentication, API keys, sessions, and metrics ownership/redaction                                               | Inherited gap                   | Added owner isolation, secret redaction, bounded credential admission, and real peer-source attribution.                                                                  |
| Maintenance ownership, publication, timers, and DST boundaries                                                    | Inherited gap                   | Made mutations atomic, owner-checked, occurrence-aware, and safe across restart and commit failure.                                                                       |
| `Monitor.stop()` active-heartbeat race and timeout-unit fallback                                                  | Inherited gap                   | Stop now quiesces the active generation; provider bounds consistently derive from seconds before conversion.                                                              |
| SNMP retry watchdog and unbounded Playwright `newContext`/`close` phases                                          | Inherited gaps                  | Added whole-check deadlines, cancellation, and deterministic cleanup.                                                                                                     |
| SQLite transaction quarantine and development snapshot restore                                                    | PocketKuma-only hardening       | Isolated the Bun SQLite singleton, quarantined failed rollback state, and made the E2E restore route transactional and development-only.                                  |
| Browser supervisor and standalone Playwright bundling                                                             | PocketKuma-only runtime/tooling | Added owned POSIX process-group cleanup and embedded `playwright-core` in the executable.                                                                                 |

## Operational compatibility

- SQLite is the only supported application database; use a consistent copy of an upstream SQLite data directory for
  migration.
- The executable needs no adjacent `node_modules` directory or runtime sidecar. It includes `playwright-core`.
- Real-browser monitors additionally require a configured system Chrome/Chromium executable. Other monitor types do
  not. POSIX browser supervision uses the host's `/bin/sh`.
- PocketKuma does not ship or document a Docker deployment path.
