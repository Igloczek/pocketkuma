# Maintenance scheduling audit

Date: 2026-07-13

- Boundary follow-up baseline: `b299847572562e89260f7b5331fb818d6be01de0`
- Final runtime and tests: `0a9ece49a4139432e376aede05d8cca80ec4646a`
- Earlier scheduling foundation: `aa6527d1ef6e993055ff22c07e72cd8db15a44d9` to
  `ba8bcaf1519e933b0374283b743d2e3c692c5ed3`

## Result

Maintenance scheduling treats the schedule and its monitor/group/status-page relations as one atomic save. Add and
edit now run an already-active cron silently until `COMMIT`; only a successful commit invalidates the public
status-page cache. A deferred foreign-key failure at the commit boundary verifies that rollback neither publishes
the draft schedule nor evicts a prewarmed response. Successful add, edit, detach, and relation reattach operations
invalidate the cache after commit.

Single schedules own separate one-shot start and end jobs. Restarting inside a window restores only its end job, and
the public cache is invalidated at the real start and end boundaries. Stop, pause, delete, or replacement invalidates
both one-shot jobs and callbacks that were already waiting on asynchronous duration work. Paused schedules stay
paused after restart.

All six UI strategies are covered: manual, single, cron, recurring interval, recurring weekday, and recurring day of
month. The model tests also cover cross-midnight duration, leap/month-end behavior, Europe/Warsaw spring and autumn
DST gaps and overlaps, malformed legacy list JSON, exact job behavior through 20 reloads, and callbacks completing
after stop. Recurring end instants are resolved in the timezone of each occurrence, so a `01:30` to `03:30` window
has the correct elapsed duration on both DST transition days.

The production WebSocket integration verifies authentication and owner isolation for every maintenance mutation,
atomic relation replacement and rollback, restart persistence, and inactive schedules. A real one-second manual
monitor verifies the sequence `MAINTENANCE -> DOWN -> MAINTENANCE -> DOWN`; a local webhook receives zero
notifications during maintenance and exactly one after each exit, while the public status-page API exposes only the
active maintenance window. Delete cleanup is checked directly in all three SQLite relation tables.

The maintenance UI sends schedule and relation data through the atomic server operation. Its E2E flow saves,
reloads, edits, and deletes every strategy and asserts that no page or console errors occur. Reusing the edit route
for add resets processing and all-status-page state. Generation and route guards ignore stale load, relation, and
submit callbacks instead of mutating or navigating the new page.

## RED to GREEN evidence

The exact final tests copied onto a detached `b2998475` worktree produced:

- model/timer suite: `5 pass / 4 fail / 77 expect()`; missing end-job cleanup, occurrence-aware DST timeslots, exact
  single-window restart behavior, and the post-stop async guard were exposed;
- production integration: `4 pass / 4 fail / 116 expect()`; add/edit/cron-start cache invalidation and single-window
  expiry across restart were exposed;
- UI: the all-status-pages checkbox remained selected when edit became add, and a delayed edit callback navigated
  the reused add route away.

On `0a9ece49`, the model/timer suite is `9 pass / 0 fail / 100 expect()` and the production integration is
`8 pass / 0 fail / 123 expect()`. The deferred-commit cache test passed `20/20` consecutive repetitions with
`380 expect()` calls. The maintenance UI file passed `55/55` in a ten-repeat run, including setup and all five
maintenance scenarios.

## Verification

- `bun install --frozen-lockfile --offline`: no changes, exit 0.
- `bun run lint`: exit 0; only the repository's existing warnings.
- `bun run build` and `bun run build:binary`: exit 0; compiled executable produced.
- `bun run test:backend`: unit `248 pass / 6 skip / 0 fail / 2122 expect()`, auth integration
  `13 pass / 0 fail / 424 expect()`, maintenance integration `8 pass / 0 fail / 123 expect()`.
- `POCKETKUMA_BINARY=./pocketkuma bun test ./test/integration-test/maintenance.test.ts`:
  `8 pass / 0 fail / 123 expect()`.
- Full E2E on the exact final runtime: `36/36` twice, each with a fresh setup database and natural exit 0.
- Post-format hook: model/timer suite `9/9 / 100 expect()` and lint exit 0.

All repository gates were run sequentially because the build regenerates the SQLite template and embedded asset
bundle. The lint output contains only the repository's existing warnings and stylelint deprecation notices.

## Compiled-runtime measurement

Each sample starts the revision's own compiled arm64 executable with a fresh temporary SQLite directory on
`127.0.0.1`, polls `GET /` every 5 ms until success, records wall time and process RSS from `ps`, sends `SIGTERM`,
and removes the directory. Five baseline/final pairs were alternated on the same host. The first pair includes cold
host-cache cost; medians reduce its effect.

- Baseline binary SHA-256: `3440825f6822a00f7922ae4c816574971109e50e20de351b2144803a70255349`
- Final binary SHA-256: `23c08b3a344e1f3c2a7374bf66e5e4fdd0f5afa1716960fa918868ce0cfec259`

Command shape:

```bash
bun /tmp/benchmark-maintenance-startup.ts <baseline-binary> <baseline-revision> <final-binary> <final-revision> 5
```

| Revision | Ready samples (ms)                           | Median (ms) | RSS samples (KiB)                      | Median (KiB) |
| -------- | -------------------------------------------- | ----------: | -------------------------------------- | -----------: |
| Baseline | 1464.948, 293.478, 290.549, 323.295, 292.249 |     293.478 | 188960, 189024, 189040, 189408, 189168 |       189040 |
| Final    | 1387.809, 294.064, 292.119, 299.620, 295.145 |     295.145 | 189264, 189136, 189152, 189488, 189152 |       189152 |

The measured median delta is +1.667 ms ready time and +112 KiB RSS, effectively neutral at this sample size. The
scheduler still has no recurring polling loop. Cron/recurring schedules own one Croner job and only an active-window
timeout while running; a single schedule owns at most one start and one end job.

Raw samples:

```json
{"revision":"b299847572562e89260f7b5331fb818d6be01de0","sample":1,"readyMilliseconds":1464.948417,"rssKiB":188960}
{"revision":"0a9ece49a4139432e376aede05d8cca80ec4646a","sample":1,"readyMilliseconds":1387.809125,"rssKiB":189264}
{"revision":"b299847572562e89260f7b5331fb818d6be01de0","sample":2,"readyMilliseconds":293.478,"rssKiB":189024}
{"revision":"0a9ece49a4139432e376aede05d8cca80ec4646a","sample":2,"readyMilliseconds":294.064042,"rssKiB":189136}
{"revision":"b299847572562e89260f7b5331fb818d6be01de0","sample":3,"readyMilliseconds":290.548917,"rssKiB":189040}
{"revision":"0a9ece49a4139432e376aede05d8cca80ec4646a","sample":3,"readyMilliseconds":292.119042,"rssKiB":189152}
{"revision":"b299847572562e89260f7b5331fb818d6be01de0","sample":4,"readyMilliseconds":323.295042,"rssKiB":189408}
{"revision":"0a9ece49a4139432e376aede05d8cca80ec4646a","sample":4,"readyMilliseconds":299.620375,"rssKiB":189488}
{"revision":"b299847572562e89260f7b5331fb818d6be01de0","sample":5,"readyMilliseconds":292.249291,"rssKiB":189168}
{"revision":"0a9ece49a4139432e376aede05d8cca80ec4646a","sample":5,"readyMilliseconds":295.144792,"rssKiB":189152}
```

## Residual limits

- Malformed legacy weekday/day JSON is handled safely as an empty list, but PocketKuma does not rewrite the
  corrupted row automatically.
- Existing manually inserted duplicate relation rows are deduplicated on the next save; the legacy SQLite tables do
  not have a new uniqueness constraint.
- Status pages are global in the current SQLite schema and therefore cannot be owner-filtered like monitors.
- Calendar tests exercise a representative DST timezone and boundary cases, not every IANA timezone transition.
