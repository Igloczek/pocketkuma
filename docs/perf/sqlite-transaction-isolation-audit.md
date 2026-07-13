# SQLite transaction isolation audit

## Scope and result

PocketKuma uses one Bun SQLite connection. Before this change, `begin()` issued `BEGIN` on that connection, but
ordinary `R.store()`, `R.exec()`, reads, and a second `begin()` could still use it. An unrelated maintenance pause
could therefore report success from inside an edit transaction and then disappear when that edit rolled back.

The test commit is `38c52be7426de43dbb7a61d5df6083c4923e2565`. Applied to the detached baseline
`549881bb42132eb6fa094dce62f7be2dc11c88b8`, its SQLite-store suite produced 8 passes and 5 failures; the focused
maintenance handler suite produced 11 passes and 1 failure. The handler failure observed the pause callback before
the edit transaction was released. The store failures observed ordinary operations joining the transaction, nested
`BEGIN`, all 500 contended writes being rolled back, and `close()` closing the active transaction.

The runtime fix is `71de12422892b15225e7075e56faaa99410b8aef`. It gives the singleton connection one private transaction owner
and a FIFO barrier:

- transaction-handle operations carry a private `Symbol` owner; direct database helpers and the owner are private;
- ordinary operations use a synchronous fast path while no transaction or queue exists;
- once a transaction is active or queued, later reads, writes, schema fallback, and close operations wait in order;
- a failed `COMMIT` first rolls back, then releases waiters in `finally`; finalizers are idempotent, while stale handle
  reads and writes fail;
- the schema data migration uses the owned transaction handle instead of raw `store.db.run()` plus global store calls.

No transaction timeout was added. There was no previous timeout policy, and every production `begin()` callsite has
an explicit commit/rollback `try`/`catch`. A forgotten transaction intentionally blocks later database work instead
of silently admitting it to an unknown transaction.

## Correctness and stress evidence

The fixed SQLite-store suite passes 13/13 tests and 122 assertions. It covers every public read/write method,
multi-statement store fallback, FIFO order, a queued second and third transaction, commit and rollback, deferred-FK
commit failure, stale and repeated finalizers, close, and queue continuation after a waiter throws. Its 100-cycle
mixed stress preserves 151 expected rows: one sentinel, 50 committed transaction writes, and all 100 unrelated
writes. The focused maintenance suite passes 12/12 tests and 178 assertions; after a deferred-FK edit failure, the
concurrent pause callback fires once, the failed edit callback fires once, and database, live bean, scheduler state,
and response cache all agree that the original maintenance is paused.

The full source maintenance integration suite passes 9/9 tests and 143 assertions with a natural process exit. It
covers add/edit/pause/resume/delete, monitor and status-page relations, rollback and restart recovery, real monitor
suppression, webhook publication, and public response-cache behavior.

Twenty consecutive full source maintenance-integration runs also completed naturally: 180 scenarios and 2,860
assertions in aggregate, with no failures, deadlocks, orphaned processes, or upward runtime trend. Three consecutive
combined store/handler runs each passed 25/25 tests and 300 assertions.

## Final verification

- `bun install --frozen-lockfile`: 856 installs across 890 packages, no changes, exit 0.
- `bun run lint`: exit 0; only the repository's existing warnings and stylelint deprecation notices.
- `bun run build` and a separate `bun run build:binary`: exit 0.
- `bun run test:backend`: unit `256 pass / 6 skip / 0 fail / 2,243 expect()`, auth integration
  `13 pass / 0 fail / 424 expect()`, and maintenance integration `9 pass / 0 fail / 143 expect()`.
- Fresh compiled arm64 executable: maintenance `9/9 / 143 expect()`, SMTP production socket
  `1/1 / 6 expect()`, and auth `13/13 / 424 expect()`.
- Post-build transaction/handler probe: `25/25 / 300 expect()`.
- Full E2E: `36/36` twice, both with a fresh setup database and natural exit 0.
- Maintenance UI: `55/55` in a ten-repeat run, including setup and all five maintenance scenarios.

The verified 91,367,906-byte executable has SHA-256
`fa3d15a58ca694e87d288f3cab6e5b410c78a65a5df42cc8946f34567d5c1b1b`.

## Benchmark method

Raw samples are in [`sqlite-transaction-isolation-benchmark.ndjson`](./sqlite-transaction-isolation-benchmark.ndjson).
Both revisions were run five times with Bun 1.3.14 on an Apple M1 Mac mini with 16 GiB RAM. Each fresh process copied
the same SQLite template in `journal_mode=MEMORY`, warmed 500 inserts, forced a full Bun GC, then measured:

1. 5,000 awaited, non-contended inserts;
2. 500 inserts submitted while a transaction was held for 25 ms and then rolled back;
3. post-GC RSS before and after the measured work.

| Median                          | Baseline `549881bb` | Fixed `71de1242` |
| ------------------------------- | ------------------: | ---------------: |
| Non-contended inserts           |        15,405 ops/s |     15,774 ops/s |
| Contended completion p95        |             0.63 ms |         56.79 ms |
| Contended drain after release   |             0.23 ms |         31.57 ms |
| Contended writes preserved      |           **0/500** |      **500/500** |
| Fixed-path contended throughput |             invalid |      8,552 ops/s |
| Post-GC RSS delta               |            2.27 MiB |         4.00 MiB |

The baseline contention latency is not valid throughput: those operations returned from inside the held transaction
and all 500 were subsequently rolled back. The fixed p95 includes the deliberate 25 ms hold plus draining 500 real
SQLite writes. The private FIFO adds about 1.73 MiB of bounded retained RSS for 500 simultaneous waiters in this
process-level measurement; the 100-cycle test drains completely and follow-up transactions and close continue to
complete without deadlock.
