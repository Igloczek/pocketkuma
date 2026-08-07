# SQLite core decoupling benchmark

Baseline: `1a0dc19fcc73af401fb37ad1d16592cbf1c261f5`.
Measured implementation: `6a63b397183e7a7e7462b5f71e1f0fdb2f683e49`.

Measured on 2026-08-07 with Bun `1.3.14`, Darwin `25.5.0`, `arm64`. Both revisions were built and measured on this host with frozen lockfiles. These values are single-host comparisons, not portable limits.

## Import boundary

`scripts/benchmark/sqlite-store-import.ts` starts a fresh Bun process, imports only `src/server/bun-sqlite-store.ts`, waits for the import to complete, and samples external RSS plus macOS physical footprint. Five baseline/after pairs were alternated to reduce warming bias. Raw data is in [sqlite-store-import-6a63b397.json](./sqlite-store-import-6a63b397.json).

| Median             |     Baseline |        After | Change |
| ------------------ | -----------: | -----------: | -----: |
| Import time        |       131 ms |        33 ms | -74.8% |
| RSS                |   85,392 KiB |   45,232 KiB | -58.7% |
| Physical footprint | 57,313,408 B | 24,365,056 B | -57.5% |

The import reduction is expected: the store no longer traverses the model graph, monitor runtime, notification dependencies, or transports. Model loading remains explicit at server bootstrap.

## Application startup and binary

Each startup row uses the existing `scripts/benchmark/startup-memory.ts` harness: fresh temporary data directory, HTTP readiness, 1,000 ms warmup, then external process RSS and macOS footprint. Each revision has three trials. Raw reports are [source baseline](./sqlite-core-startup-source-1a0dc19f.json), [source after](./sqlite-core-startup-source-6a63b397.json), [compiled baseline](./sqlite-core-startup-compiled-1a0dc19f.json), and [compiled after](./sqlite-core-startup-compiled-6a63b397.json).

| Median               |      Baseline |         After | Change |
| -------------------- | ------------: | ------------: | -----: |
| Source readiness     |        312 ms |        315 ms |  +1.0% |
| Source RSS           |   167,808 KiB |   168,800 KiB |  +0.6% |
| Source footprint     | 122,555,008 B | 123,505,408 B |  +0.8% |
| Compiled readiness   |        368 ms |        368 ms |   0.0% |
| Compiled RSS         |   212,352 KiB |   213,648 KiB |  +0.6% |
| Compiled footprint   | 143,919,936 B | 144,067,456 B |  +0.1% |
| Compiled binary size |  97,989,218 B |  97,972,706 B | -0.02% |

No application-level metric regressed by more than 2%. The cold compiled trial is retained in both raw reports (1,624 ms baseline; 1,581 ms after); median readiness is unchanged.

## Manual QA

Fresh compiled setup on a temporary data directory: created the first user; created, edited, and deleted an HTTP monitor; created and read `/status/qa-status-page`; sent `SIGTERM`, restarted against the same data directory, and read that status page again. The browser reported no errors on the post-restart public page.
