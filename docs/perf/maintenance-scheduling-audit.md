# Maintenance scheduling audit

Date: 2026-07-13

- Follow-up baseline: `aa6527d1ef6e993055ff22c07e72cd8db15a44d9`
- Final runtime and tests: `ba8bcaf1519e933b0374283b743d2e3c692c5ed3`

## Result

Maintenance scheduling now treats the schedule and its monitor/group/status-page relations as one atomic save. An
invalid add or edit leaves both SQLite and the live scheduler unchanged. Paused schedules stay paused after restart,
and stop, pause, delete, or replacement invalidates callbacks that were already waiting on asynchronous work.

All six UI strategies are covered: manual, single, cron, recurring interval, recurring weekday, and recurring day of
month. The model tests also cover cross-midnight duration, leap/month-end behavior, Europe/Warsaw spring and autumn
DST behavior, malformed legacy list JSON, exact single-job behavior through 20 reloads, and a callback completing
after stop. Recurring duration is calculated from validated `HH:mm` fields instead of relying on a date parser that
returned `NaN` under the Bun runtime.

The production WebSocket integration verifies authentication and owner isolation for every maintenance mutation,
atomic relation replacement and rollback, restart persistence, and inactive schedules. A real one-second manual
monitor verifies the sequence `MAINTENANCE -> DOWN -> MAINTENANCE -> DOWN`; a local webhook receives zero
notifications during maintenance and exactly one after each exit, while the public status-page API exposes only the
active maintenance window. Delete cleanup is checked directly in all three SQLite relation tables.

The maintenance UI sends schedule and relation data through the atomic server operation. Its E2E flow saves,
reloads, edits, and deletes every strategy and asserts that no page or console errors occur. Route-stale async
callbacks are ignored instead of issuing relation requests for a previous or null maintenance ID.

## RED to GREEN evidence

The final tests copied onto the `aa6527d1` worktree produced `3 pass / 3 fail / 37 expect()`: an inactive cron created
a job/timeslot, malformed legacy lists threw while serializing, and a paused cron revived while an invalid edit
mutated the live and persisted schedule. On the final tree, the targeted model and production integration suite is
`10 pass / 0 fail / 151 expect()`.

The critical UI save/reload/edit/delete scenario passed ten consecutive snapshot-restored repetitions. Two complete
fresh-database E2E runs each passed `34/34`. The compiled executable passed all four production maintenance
integration scenarios with `74` assertions.

## Verification

- `bun install --frozen-lockfile --offline`: no changes, exit 0.
- `bun run lint`: exit 0; only the repository's existing warnings.
- `bun run build` and `bun run build:binary`: exit 0; compiled executable produced.
- `bun run test:backend`: unit `245 pass / 6 skip / 0 fail / 2099 expect()`, auth integration
  `13 pass / 0 fail / 424 expect()`, maintenance integration `4 pass / 0 fail / 74 expect()`.
- `POCKETKUMA_BINARY=./pocketkuma bun test ./test/integration-test/maintenance.test.ts`:
  `4 pass / 0 fail / 74 expect()`.
- Targeted maintenance E2E: `6/6` including setup, then the critical spec `10/10` with `--repeat-each=10`.
- Full E2E: `34/34` twice, each with a separately removed and recreated test database.

One earlier backend attempt ran concurrently with `bun run build`, which regenerates the SQLite template. Its
monitor-lifecycle process exited during that replacement. That attempt is discarded and is not counted as a gate;
the strictly sequential full backend rerun above passed. `bun run tsc` is not a repository verification command in
`AGENTS.md` and remains red on pre-existing project-wide alias/Vue typing issues outside this change.

## Compiled-runtime measurement

Each sample starts the revision's own compiled arm64 executable with a fresh temporary SQLite directory on
`127.0.0.1`, polls `GET /` every 5 ms until success, records wall time and process RSS from `ps`, sends `SIGTERM`,
and removes the directory. Five sequential samples per revision were taken on the same host. Medians reduce the
effect of the first baseline process warming host caches.

Command shape:

```bash
bun /tmp/benchmark-maintenance-startup.ts <revision-binary> <exact-revision> 5
```

| Revision | Ready samples (ms)                           | Median (ms) | RSS samples (KiB)                      | Median (KiB) |
| -------- | -------------------------------------------- | ----------: | -------------------------------------- | -----------: |
| Baseline | 1464.948, 297.210, 296.283, 295.571, 296.079 |     296.283 | 188016, 187936, 187760, 187920, 187952 |       187936 |
| Final    | 385.121, 295.503, 296.218, 295.610, 298.809  |     296.218 | 188240, 187856, 187696, 188080, 187888 |       187888 |

The measured median delta is -0.065 ms ready time and -48 KiB RSS, effectively neutral at this sample size. The
scheduler still has no recurring polling loop; it owns one Croner job and, only while a window is active, one
duration timeout.

Raw samples:

```json
{"revision":"aa6527d1ef6e993055ff22c07e72cd8db15a44d9","sample":1,"readyMilliseconds":1464.947541,"rssKiB":188016}
{"revision":"aa6527d1ef6e993055ff22c07e72cd8db15a44d9","sample":2,"readyMilliseconds":297.209583,"rssKiB":187936}
{"revision":"aa6527d1ef6e993055ff22c07e72cd8db15a44d9","sample":3,"readyMilliseconds":296.282584,"rssKiB":187760}
{"revision":"aa6527d1ef6e993055ff22c07e72cd8db15a44d9","sample":4,"readyMilliseconds":295.570584,"rssKiB":187920}
{"revision":"aa6527d1ef6e993055ff22c07e72cd8db15a44d9","sample":5,"readyMilliseconds":296.078625,"rssKiB":187952}
{"revision":"ba8bcaf1519e933b0374283b743d2e3c692c5ed3","sample":1,"readyMilliseconds":385.121459,"rssKiB":188240}
{"revision":"ba8bcaf1519e933b0374283b743d2e3c692c5ed3","sample":2,"readyMilliseconds":295.502709,"rssKiB":187856}
{"revision":"ba8bcaf1519e933b0374283b743d2e3c692c5ed3","sample":3,"readyMilliseconds":296.217875,"rssKiB":187696}
{"revision":"ba8bcaf1519e933b0374283b743d2e3c692c5ed3","sample":4,"readyMilliseconds":295.609708,"rssKiB":188080}
{"revision":"ba8bcaf1519e933b0374283b743d2e3c692c5ed3","sample":5,"readyMilliseconds":298.808583,"rssKiB":187888}
```

## Residual limits

- Malformed legacy weekday/day JSON is handled safely as an empty list, but PocketKuma does not rewrite the
  corrupted row automatically.
- Existing manually inserted duplicate relation rows are deduplicated on the next save; the legacy SQLite tables do
  not have a new uniqueness constraint.
- Status pages are global in the current SQLite schema and therefore cannot be owner-filtered like monitors.
- Calendar tests exercise a representative DST timezone and boundary cases, not every IANA timezone transition.
