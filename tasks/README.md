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
4. [BUN-010](BUN-010-bun-lockfile.md) - controlled `bun.lock`.
5. [BUN-011](BUN-011-bun-scripts.md) - parallel Bun scripts.
6. [BUN-012](BUN-012-runtime-detection.md) - runtime detection.
7. [BUN-013](BUN-013-env-and-args.md) - `.env` and CLI arguments.
8. [BUN-020](BUN-020-memory-report.md) - runtime memory report.
9. [BUN-021](BUN-021-monitor-timer-lifecycle.md) - monitor timer lifecycle.
10. [BUN-022](BUN-022-heartbeat-history-load.md) - heartbeat history load cost.
11. [BUN-030](BUN-030-http-adapter.md) - internal HTTP adapter.
12. [BUN-031](BUN-031-notification-fetch.md) - simple notification providers through `fetch`.
13. [BUN-032](BUN-032-http-monitor-fetch.md) - HTTP/keyword/json-query monitors through `fetch`.
14. [BUN-033](BUN-033-http-transport-decisions.md) - decisions for proxy, mTLS, NTLM, and cookies.
15. [BUN-034](BUN-034-remove-axios.md) - remove axios.
16. [BUN-040](BUN-040-routing-bootstrap.md) - separate routing from Express bootstrap.
17. [BUN-041](BUN-041-bun-serve-static.md) - static files and simple endpoints through `Bun.serve`.
18. [BUN-042](BUN-042-websocket-evaluation.md) - evaluate Socket.IO migration.
19. [BUN-043](BUN-043-native-websocket.md) - native Bun WebSocket.
20. [BUN-050](BUN-050-db-cost-baseline.md) - Redbean/Knex/SQLite cost baseline.
21. [BUN-051](BUN-051-db-repositories.md) - database repository boundaries.
22. [BUN-052](BUN-052-bun-sqlite-hot-paths.md) - SQLite hot paths through `bun:sqlite`.
23. [BUN-053](BUN-053-sqlite-db-architecture.md) - Redbean/Knex architecture decision.
24. [BUN-054](BUN-054-embedded-mariadb.md) - embedded MariaDB decision.
25. [BUN-060](BUN-060-bun-password.md) - password hashing through `Bun.password`.
26. [BUN-061](BUN-061-bun-spawn.md) - process execution through `Bun.spawn` or Bun Shell.
27. [BUN-062](BUN-062-ping-with-bun-spawn.md) - ping without `@louislam/ping`.
28. [BUN-063](BUN-063-date-cron-review.md) - date and cron library review.
29. [BUN-070](BUN-070-monitor-type-classification.md) - monitor type classification.
30. [BUN-071](BUN-071-monitor-type-lazy-loading.md) - lazy loading monitor types.
31. [BUN-072](BUN-072-dependency-groups.md) - lightweight/full dependency groups.
32. [BUN-080](BUN-080-bun-docker-target.md) - Bun-based Docker target.
33. [BUN-081](BUN-081-lightweight-docker-image.md) - lightweight Docker image.
34. [BUN-082](BUN-082-local-bun-validation.md) - local Bun validation.
35. [BUN-090](BUN-090-bun-default-runtime.md) - Bun as default runtime.
36. [BUN-091](BUN-091-remove-unused-runtime-dependencies.md) - remove unused runtime dependencies.
37. [BUN-092](BUN-092-final-migration-report.md) - final migration report.
