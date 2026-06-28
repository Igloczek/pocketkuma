# uptime-buna task backlog

This directory is the task backlog for the Bun migration work. Each task has its own file. Stage files that bundle several tasks together are intentionally not used because they make scope and acceptance criteria unclear.

## Working Rules

- One task file equals one implementation unit.
- Do not start another task until the selected task has been validated according to its own validation section.
- If a task touches memory, dependencies, startup behavior, Docker, database access, networking, or monitor scheduling, the result must include before/after measurements.
- Do not silently remove inherited Uptime Kuma behavior. Any removal must be explicit in the relevant task.
- Bun compatibility is acceptable as a transition step, but the end goal of the migration tasks is to reduce runtime cost, dependency weight, or operational complexity.

## Required Measurement Format

```text
task:
runtime:
command:
commit:
os_arch:
scenario:
rss_start_mb:
rss_10m_mb:
heap_used_10m_mb:
startup_ms:
dependency_count:
notes:
```

## Recommended Order

1. [BUN-000](BUN-000-memory-benchmark.md) - repeatable memory benchmark.
2. [BUN-001](BUN-001-performance-budgets.md) - performance budgets.
3. [BUN-002](BUN-002-agent-policy.md) - local agent working policy.
4. [BUN-003](BUN-003-bun-lockfile.md) - controlled `bun.lock`.
5. [BUN-004](BUN-004-bun-scripts.md) - parallel Bun scripts.
6. [BUN-005](BUN-005-runtime-detection.md) - runtime detection.
7. [BUN-006](BUN-006-env-and-args.md) - `.env` and CLI arguments.
8. [BUN-007](BUN-007-memory-report.md) - runtime memory report.
9. [BUN-008](BUN-008-monitor-timer-lifecycle.md) - monitor timer lifecycle.
10. [BUN-009](BUN-009-heartbeat-history-load.md) - heartbeat history load cost.
11. [BUN-010](BUN-010-http-adapter.md) - internal HTTP adapter.
12. [BUN-011](BUN-011-notification-fetch.md) - simple notification providers through `fetch`.
13. [BUN-012](BUN-012-http-monitor-fetch.md) - HTTP/keyword/json-query monitors through `fetch`.
14. [BUN-013](BUN-013-http-transport-decisions.md) - decisions for proxy, mTLS, NTLM, and cookies.
15. [BUN-014](BUN-014-remove-axios.md) - remove axios.
16. [BUN-015](BUN-015-routing-bootstrap.md) - separate routing from Express bootstrap.
17. [BUN-016](BUN-016-bun-serve-static.md) - static files and simple endpoints through `Bun.serve`.
18. [BUN-017](BUN-017-websocket-evaluation.md) - evaluate Socket.IO migration.
19. [BUN-018](BUN-018-native-websocket.md) - native Bun WebSocket.
20. [BUN-019](BUN-019-db-cost-baseline.md) - Redbean/Knex/SQLite cost baseline.
21. [BUN-020](BUN-020-db-repositories.md) - database repository boundaries.
22. [BUN-021](BUN-021-bun-sqlite-hot-paths.md) - SQLite hot paths through `bun:sqlite`.
23. [BUN-022](BUN-022-sqlite-db-architecture.md) - Redbean/Knex architecture decision.
24. [BUN-023](BUN-023-embedded-mariadb.md) - embedded MariaDB decision.
25. [BUN-024](BUN-024-bun-password.md) - password hashing through `Bun.password`.
26. [BUN-025](BUN-025-bun-spawn.md) - process execution through `Bun.spawn` or Bun Shell.
27. [BUN-026](BUN-026-ping-with-bun-spawn.md) - ping without `@louislam/ping`.
28. [BUN-027](BUN-027-date-cron-review.md) - date and cron library review.
29. [BUN-028](BUN-028-monitor-type-classification.md) - monitor type classification.
30. [BUN-029](BUN-029-monitor-type-lazy-loading.md) - lazy loading monitor types.
31. [BUN-030](BUN-030-dependency-groups.md) - lightweight/full dependency groups.
32. [BUN-031](BUN-031-bun-docker-target.md) - Bun-based Docker target.
33. [BUN-032](BUN-032-lightweight-docker-image.md) - lightweight Docker image.
34. [BUN-033](BUN-033-local-bun-validation.md) - local Bun validation.
35. [BUN-034](BUN-034-bun-default-runtime.md) - Bun as default runtime.
36. [BUN-035](BUN-035-remove-unused-runtime-dependencies.md) - remove unused runtime dependencies.
37. [BUN-036](BUN-036-final-migration-report.md) - final migration report.
