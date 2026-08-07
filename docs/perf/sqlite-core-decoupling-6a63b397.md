# SQLite core and legacy facade benchmark

Baseline legacy store: `1a0dc19fcc73af401fb37ad1d16592cbf1c261f5`.
Measured core/facade implementation: `619fd33b60a5e3a0417436927ad518539b43cc08`.

The current stacked parent is `7687fe5b02213d198083aae2e3099a81fb7cc0a9`. It contains test-only CI fixes; the raw measurements remain bound to the earlier production-equivalent parent/implementation SHAs above and are not relabeled.

Measured on 2026-08-07 with Bun `1.3.14`, Darwin `25.5.0`, `arm64`. Both commits use frozen lockfiles and were measured on this host; results are single-host comparisons, not portable limits.

## Fresh-process import cost

`scripts/benchmark/sqlite-store-import.ts` starts a fresh Bun process, waits for one module import, then samples external RSS and macOS physical footprint. The five samples are strictly alternated in each trial as old legacy → light core → compatibility facade. Each raw variant records its exact SHA: [sqlite-store-import-619fd33b.json](./sqlite-store-import-619fd33b.json).

| Median             | Old legacy store |   Light `sqlite-core` | Compatibility facade |
| ------------------ | ---------------: | --------------------: | -------------------: |
| Import time        |           134 ms |        33 ms (-75.4%) |       136 ms (+1.5%) |
| RSS                |       84,896 KiB |   45,200 KiB (-46.8%) |   85,888 KiB (+1.2%) |
| Physical footprint |     56,871,104 B | 24,332,416 B (-57.2%) | 57,985,280 B (+2.0%) |

The light core has no domain-model, monitor-runtime, notification, or transport imports (enforced by an import-graph test). The compatibility facade intentionally boots the static full model registry so existing `R` consumers retain typed beans; its import cost is reported separately and is not presented as a core improvement.

## Application startup and binary

The startup harness uses a fresh temporary data directory, HTTP readiness, a 1,000 ms warmup, and external RSS/macOS footprint. These are fixed grouped series, not alternating trials: the new implementation was run first, then the baseline immediately after on the same host. Raw reports are [source baseline](./sqlite-core-startup-source-1a0dc19f-rerun.json), [source implementation](./sqlite-core-startup-source-619fd33b.json), [compiled baseline](./sqlite-core-startup-compiled-1a0dc19f-rerun.json), [compiled implementation](./sqlite-core-startup-compiled-619fd33b.json), and [binary sizes](./sqlite-core-binary-size-619fd33b.json).

| Median               |      Baseline |   Core/facade | Change |
| -------------------- | ------------: | ------------: | -----: |
| Source readiness     |        364 ms |        363 ms |  -0.3% |
| Source RSS           |   167,856 KiB |   168,512 KiB |  +0.4% |
| Source footprint     | 122,178,304 B | 123,079,488 B |  +0.7% |
| Compiled readiness   |        466 ms |        415 ms | -10.9% |
| Compiled RSS         |   213,008 KiB |   213,200 KiB |  +0.1% |
| Compiled footprint   | 144,296,704 B | 144,395,008 B |  +0.1% |
| Compiled binary size |  97,989,218 B |  97,989,218 B |   0.0% |

No full-application median regressed by more than 2% in the same-host rerun.

## Manual QA

The earlier compiled UI QA for this PR used a fresh temporary data directory to create the first user, create/edit/delete an HTTP monitor, create/read `/status/qa-status-page`, then restart and read the same status page. This follow-up reran clean compiled restart/`SIGTERM` smoke and separately asserted that legacy `R.dispense("monitor")` and `R.convertToBean("heartbeat", ...)` are registered model instances.
