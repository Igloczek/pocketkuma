# Monitor provider deadline and cleanup audit

Date: 2026-07-14

- RED-test baseline: `5add23ce1c67b6c46a958e2e5854fef89c8d7ff1`
- Runtime implementation: `2045324bf7e83d805088e1b73c4687294e789659`
- Audit documentation: `98defe4b`
- Final integration harness: `e48a377751543b322db71a1601724f25396b993f`
- Numeric-validation RED tests: `aed6b97cf96fd6266689d1828f1a415eaeaa70a8`
- Legacy-runtime RED tests: `02739620`
- Numeric-validation runtime: `f48b6f7dba188f7f845846dc79c492858cfeb83c`
- Compiled lifecycle harness: `f57f53f5`

`5add23ce` adds the deterministic RED tests only, so its runtime is identical to `295ca265`.

## Result

The network and process operations audited in this change now derive their bounds from the monitor's existing
`timeout` setting. Multi-phase checks either carry one absolute deadline forward, divide the budget among a known
number of sequential operations, or cap each phase independently. Connections, requests, subprocesses, and library
clients are closed, destroyed, disconnected, cancelled, or force-ended when a check succeeds, fails, or times out.

This closes the lifecycle gap found by the SQLite snapshot audit for the audited operations: `stop()` still waits for
the active heartbeat, but a stalled network request or subprocess no longer leaves that heartbeat pending without a
provider bound and cleanup path. The timeout fallback also remains in seconds (`interval * 0.8`) before providers
convert it to milliseconds; the previous multiplication by 1,000 at assignment time could turn an interval-derived
timeout into an unexpectedly long wait.

The original provider audit covered valid numeric monitor records. A follow-up adversarial pass found that malformed
numeric strings could still be stored through the production WebSocket add/edit path, and a legacy malformed timeout
could bypass the provider deadline after restart. The numeric-validation commits listed above close that separate
input and legacy-data gap without rewriting legacy rows during a read.

The implementation does not add a second cancellation setting or an operator workflow. The existing monitor timeout
is the source of the audited I/O bounds and their cleanup triggers.

## Provider inventory

| Monitor family                              | Deadline propagation                                                                                                                                                      | Cancellation and cleanup boundary                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| HTTP, keyword, JSON query                   | One absolute deadline covers OAuth token acquisition, the request, a single OAuth retry, and optional TLS inspection. Every later phase receives only the remaining time. | HTTP fetches are aborted by the shared client timeout; certificate-inspection sockets are destroyed by their timeout path. |
| Ping                                        | Each spawned ping attempt receives the monitor timeout without an extra one-second allowance.                                                                             | The subprocess helper sends `SIGKILL` at the attempt bound, including when a child ignores `SIGTERM`.                      |
| Push, manual, group                         | No outbound provider operation runs during a heartbeat.                                                                                                                   | No provider resource is opened; the monitor lifecycle generation remains the cancellation boundary.                        |
| Docker                                      | The Docker API request uses the monitor timeout instead of an interval-derived value.                                                                                     | The HTTP client aborts the request and releases its socket on timeout.                                                     |
| RADIUS                                      | The configured budget is split across the initial UDP request and one retry.                                                                                              | The shared UDP socket closes when a response, error, or final timeout settles the operation.                               |
| Kafka producer                              | Connect and request limits fit inside one overall timer; library retries are disabled.                                                                                    | The producer disconnects after success, failure, or overall timeout.                                                       |
| DNS                                         | Half of the budget resolves configured resolver hostnames and half performs the requested DNS lookup.                                                                     | Each `Resolver` is cancelled at its phase deadline and its timer is cleared.                                               |
| GameDig                                     | `attemptTimeout` and `socketTimeout` both derive from the monitor timeout.                                                                                                | GameDig owns the per-attempt socket lifecycle; no independent socket handle is exposed to PocketKuma.                      |
| Globalping ping, HTTP, DNS                  | One deadline covers HTTP-subtype OAuth, measurement creation, one HTTP 500 retry, and polling. Each client/fetch receives the remaining time.                             | SDK requests use abortable fetch timeouts; polling stops at the same deadline.                                             |
| gRPC keyword                                | The unary RPC receives a native gRPC deadline.                                                                                                                            | The client is closed in `finally`; expiry cancels the call and the loopback server observes cancellation.                  |
| MongoDB                                     | Connect, server-selection, socket, and command limits share the configured budget; the command receives the remaining time.                                               | The client is closed in `finally`.                                                                                         |
| PostgreSQL                                  | Connect and query limits derive from one deadline; the query receives the remaining time after connect.                                                                   | The client is ended in `finally`, including a stalled protocol handshake.                                                  |
| MySQL                                       | Connection and query operations are each capped by the configured timeout.                                                                                                | Successful connections end normally; timeout and protocol errors destroy the connection.                                   |
| Microsoft SQL Server                        | Connection and request limits derive from one deadline; the request receives the remaining time after pool connect.                                                       | The pool is closed after success or failure.                                                                               |
| Oracle Database                             | Connection and call limits derive from one deadline; the database call receives the remaining time.                                                                       | The connection is closed after success or failure.                                                                         |
| Redis                                       | Connect and socket limits use the monitor budget, reconnect is disabled, and the command has an abort signal.                                                             | The client is destroyed in `finally`.                                                                                      |
| MQTT                                        | Connect, subscribe, and message wait share one absolute timer; automatic reconnect is disabled.                                                                           | The client is force-ended exactly once on success, error, or timeout.                                                      |
| RabbitMQ                                    | The total budget is divided among the configured nodes.                                                                                                                   | Each node's HTTP request has both a timeout and an abort signal.                                                           |
| Real browser                                | Browser launch or remote connect, navigation, screenshot delay, and screenshot receive the remaining shared budget.                                                       | The Playwright context is closed in `finally`.                                                                             |
| SMTP                                        | Connection, greeting, and socket-inactivity timeouts are each capped at half the monitor timeout.                                                                         | The SMTP connection is closed in `finally`.                                                                                |
| SNMP                                        | The budget is divided by the configured retry count plus the initial attempt.                                                                                             | The session is closed after success or error, and the error path settles safely.                                           |
| Steam                                       | Hostname lookup, Steam API request, and ping share one deadline.                                                                                                          | The HTTP request is abortable and the ping subprocess is killed at its bound; a late system DNS result is ignored.         |
| SIP OPTIONS, system service, Tailscale ping | Each host command receives the monitor timeout.                                                                                                                           | The shared subprocess helper force-kills commands at the deadline.                                                         |
| TCP, STARTTLS, TLS-alert checks             | Connect, dialogue, and TLS phases are each capped by the monitor timeout.                                                                                                 | Timeout handlers destroy the active socket and clear dialogue timers.                                                      |
| WebSocket upgrade                           | OAuth acquisition and the upgrade handshake are each capped by the monitor timeout.                                                                                       | A failed or expired handshake closes the socket; OAuth fetch is aborted at its bound.                                      |

## RED to GREEN evidence

The regression suite uses loopback peers that accept a request but deliberately never answer. It then calls
`Monitor.stop()` while the provider operation is active and verifies both that stop settles and that the remote side
observes cancellation or socket closure. A separate child-process fixture ignores `SIGTERM` and verifies the hard
deadline.

On `5add23ce`, with a 50 ms monitor timeout:

- the gRPC check was still pending after 250 ms and required forced server cleanup; the failed test took 286.67 ms;
- the PostgreSQL check was still pending after 250 ms and required forced socket cleanup; the failed test took
  261.75 ms.

On `2045324b`, the provider-cleanup file repeated five times completed `40 pass / 0 fail`. Every hanging peer saw its
connection close, and the child that ignored `SIGTERM` was killed. The expanded targeted monitor suite completed
`90 pass / 6 skip / 0 fail`; all six skips are opt-in public TLS/network cases. The monitor lifecycle suite completed
`4 pass / 0 fail`, including deletion waiting for an active check to reach its deadline without a stale write.

## Verification

- Backend unit gate: `276 pass / 6 skip / 0 fail / 2,815 expect()`.
- Targeted provider and lifecycle suites: `90 pass / 6 skip / 0 fail` and `4 pass / 0 fail`.
- SNMP suite (including one live Docker-agent case): `3/3`.
- Docker-backed database suites: PostgreSQL `2/2`, MySQL `4/4`, Microsoft SQL Server `8/8`, and Oracle `8/8`.
- Docker-backed messaging suites: RabbitMQ `9/9` and MQTT `19/19`.
- Kafka unreachable-broker cleanup: `1/1`.
- `bun run lint`: exit 0 with only the repository's pre-existing warnings.
- `bun run build`: exit 0 and produced the compiled executable.

### Final validation campaign

The final full integration run exposed a race in the MQTT test fixture, not in the monitor runtime. The fixture's
separate publisher could send a QoS 0 message before the monitor client had completed its subscription, so two nested
topic cases timed out even though the provider deadline and forced cleanup behaved correctly. Commit `e48a3777`
changes only the test harness: it publishes a retained QoS 1 message after the publisher connects, waits for the
broker acknowledgement, and deterministically clears the retained message with QoS 1 before force-closing the
publisher. No runtime source changed in that commit. The MQTT file then completed `95/95` across five repetitions.

Validation from the final code commit produced these results:

- `bun run test:backend:all`: `349 pass / 6 skip / 0 fail / 2,938 expect()`; the six skips are the explicitly opt-in
  public TLS cases.
- Final `bun run test:backend`: unit `276 pass / 6 skip / 0 fail / 2,815 expect()`, authentication `13/13`, and
  maintenance `9/9`.
- Provider cleanup plus monitor lifecycle: `13/13`.
- Compiled executable checks: SMTP notification through the production WebSocket flow `1/1`, authentication
  `13/13`, and setup UI/readiness with a graceful zero-exit `SIGTERM` shutdown.
- Full Playwright E2E: `39/39` twice from fresh state.
- Maintenance UI repetition: `55/55` (`5` setup cases plus `5` maintenance cases repeated ten times), with no
  retries, failures, skips, page errors, or console errors in `11.2m`.
- Final executable SHA-256:
  `4de22dd4efdd5b7c2cb6d995586a5052f9e7ff0f3aaa9f7d2d381783fd05e9bb`.

Cleanup was clean after the campaign: the Playwright data directory was removed, its result recorded no failed
tests, ports `30001` and `51283` had no listeners, no PocketKuma, Bun test-server, or Playwright process remained,
and the test suites left no owned containers. The only residual verification limits are the six opt-in public TLS
cases. Lint and build completed with only the repository's baseline lint, deprecation, and bundle-size warnings.

### Numeric configuration follow-up

`Monitor.validate()` now parses and validates the numeric fields accepted by monitor add/edit before persistence.
Numeric strings remain compatible with the Vue/WebSocket payload contract, while blank values, malformed strings,
booleans, non-finite numbers, fractions in integer-only fields, negative values, unsafe integers, and values outside
their field bounds are rejected with stable messages. The covered fields are interval and retry timing, resend and
retry counts, provider timeout, redirects, saved-response length, optional port, ping packet/count/per-request
settings, and real-browser screenshot delay. SQLite assertions verify that accepted values are stored as numeric
`INTEGER`/`REAL` values and that failed add/edit requests do not partially mutate rows.

Provider timeout keeps its existing operator contract: `0` means automatic `interval * 0.8`; otherwise values from
`0.001` through `MAX_INTERVAL_SECOND` are accepted, including fractions. Runtime normalization gives malformed
legacy rows finite safe values before the first provider operation or push schedule. It deliberately does not write
those repaired values back to SQLite. Scheduler delay normalization independently prevents invalid legacy timing
from becoming an immediate loop or overflowing Bun's timer range.

The RED baseline demonstrated both boundaries through the public transport: invalid add/edit requests succeeded,
and a loopback PostgreSQL handshake with `timeout = 'bogus'` remained pending after 1,500 ms with its socket open.
After `f48b6f7d`, the same legacy fixture uses the 0.8-second fallback for a one-second interval and closes the peer
socket before pause returns. The source and compiled-executable lifecycle paths exercise the same assertions.

Final follow-up verification:

- `bun run test:backend:all`: `363 pass / 6 skip / 0 fail / 3,126 expect()` across 47 files; the six skips are the
  explicitly opt-in public TLS cases.
- `bun run test:backend`: unit `290 pass / 6 skip / 0 fail / 3,003 expect()`, authentication `13/13`, and maintenance
  `9/9`.
- Numeric validation, provider cleanup, scheduler defense, and lifecycle targeted suite repeated three times:
  `25 pass / 5 filtered / 0 fail / 220 expect()` on every run.
- Compiled executable: SMTP production WebSocket flow `1/1`, authentication `13/13`, and numeric/legacy monitor
  lifecycle `2/2`; a fresh production data directory served entry-page/manifest readiness and exited `0` on
  `SIGTERM`.
- Full Playwright E2E: `39/39` twice from fresh state, including SMTP test/save/edit/delete through a local sink.
- Final executable SHA-256:
  `439b2d5cb63b3e968b61f57796618c0c99dd8f12eaabc4e6f4acf4201432be07`.
- Cleanup: no owned PocketKuma, Bun test-server, or Playwright process and no owned test container remained. Existing
  containers from another workspace were left untouched.

The Docker-backed cases use real protocol servers, not mocked clients. The updated multi-case MySQL, Microsoft SQL
Server, Oracle, RabbitMQ, and MQTT harnesses keep one container per suite. PostgreSQL and SNMP start a container only
for their single live-service case. The suites use explicit startup or test bounds and await teardown so provider
assertions are not obscured by container churn or leaked cleanup.

## Measurements

All cleanup measurements use a configured provider timeout of 50 ms and deterministic loopback peers. Test duration
includes fixture setup, client scheduling, the timeout itself, and resource teardown, so the expected result is
slightly above 50 ms rather than exactly 50 ms.

| Hanging operation                |                     Baseline at 250 ms | Result median (`--rerun-each=5`) |
| -------------------------------- | -------------------------------------: | -------------------------------: |
| gRPC                             |                          Still pending |                         58.25 ms |
| PostgreSQL                       |                          Still pending |                         56.44 ms |
| MongoDB                          | Not bounded by the baseline regression |                         59.50 ms |
| MySQL                            | Not bounded by the baseline regression |                         57.98 ms |
| Redis                            | Not bounded by the baseline regression |                         58.38 ms |
| SMTP                             | Not bounded by the baseline regression |                         32.90 ms |
| MQTT                             | Not bounded by the baseline regression |                         60.90 ms |
| Child process ignoring `SIGTERM` | Not bounded by the baseline regression |                         54.07 ms |

For the two exact RED cases, the behavior changed from more than five times the configured timeout and still pending
to cleanup at roughly 1.1–1.2 times the timeout including harness overhead. The five result samples were:

```text
gRPC:      69.46, 58.25, 58.12, 58.40, 58.21 ms
Postgres:  56.42, 55.27, 56.83, 56.44, 57.02 ms
MongoDB:   71.07, 58.74, 59.22, 59.50, 60.95 ms
MySQL:     57.98, 59.61, 56.70, 57.98, 58.15 ms
Redis:     65.49, 55.58, 56.97, 59.80, 58.38 ms
SMTP:      34.61, 30.96, 32.90, 32.92, 32.81 ms
MQTT:      84.95, 60.90, 61.18, 58.67, 59.30 ms
process:   54.07, 53.45, 55.30, 53.58, 56.05 ms
```

### Numeric-validation measurements

The validation microbenchmark calls `Monitor.validate()` with one valid numeric monitor payload one million times
per sample. The median increased from 4.291625 ns/call to 7.098375 ns/call: +2.80675 ns/call (+65.4%), an absolute
increase of about 2.8 milliseconds per million monitor saves. This path runs on monitor mutation, not on every
heartbeat.

The legacy PostgreSQL measurement uses a loopback peer that accepts the connection and never completes its protocol
handshake. At the RED baseline it was still pending after 1,500 ms and required manual socket destruction. The final
five samples were 808.819, 804.511, 803.797, 803.275, and 803.993 ms (median 803.993 ms), matching the intended
0.8-second fallback plus fixture overhead.

Compiled startup and resident memory did not regress in the sample medians. Startup changed from 300.136 ms to
299.535 ms (-0.601 ms), and RSS changed from 187,808 KiB to 187,264 KiB (-544 KiB). The first final startup sample
was a cold 1,366.973 ms outlier; it is retained below rather than discarded from the record.

```text
validate baseline: 3.024209, 3.115917, 3.190833, 4.291625, 4.796666, 5.151208, 6.239417 ms / 1,000,000
validate final:    6.640042, 6.662000, 6.707209, 7.098375, 9.907541, 10.430126, 11.085959 ms / 1,000,000
startup baseline:  325.373000, 296.083750, 303.422292, 300.135999, 298.176458 ms
startup final:     1366.973000, 281.315917, 303.245583, 296.258583, 299.535292 ms
RSS baseline:      188304, 186528, 194000, 187088, 187808 KiB
RSS final:         195312, 187264, 187536, 187120, 187072 KiB
```

## Residual limits

- GameDig exposes per-attempt and socket timeouts, but no public top-level `AbortSignal` or socket handle. PocketKuma
  therefore relies on the library's bounded internal cleanup rather than independently destroying the socket.
- The operating-system `dns.lookup` used by Steam cannot be actively cancelled. PocketKuma races it against the
  shared deadline, ignores a late result, and does not allow it to publish a late heartbeat; the following HTTP and
  ping operations are abortable or killable.
- Playwright does not give this path a separate timeout for `browser.newContext()` or `context.close()`. All
  network-facing launch, remote-connect, navigation, delay, and screenshot operations use the remaining monitor
  budget, and the context closes in `finally`. Local Chromium discovery and the optional container-side Chromium
  installation happen before launch and retain their existing command-specific behavior.
- Some sequential paths cap individual phases rather than carrying one absolute deadline: ping can make an IPv6
  fallback attempt, MySQL caps connection and query operations separately, SMTP uses half-timeout phase caps, and
  TCP/STARTTLS/WebSocket OAuth paths can enter another bounded phase. Their worst-case wall time can therefore exceed
  one monitor timeout while remaining bounded by the finite phase count and cleanup.
- Graceful pause, delete, shutdown, and test snapshot restore can intentionally wait until an already active provider
  reaches its configured phase bounds and finishes cleanup. They wait for real cleanup rather than reporting a false
  stop.
- Malformed legacy values are normalized in memory but intentionally left unchanged on disk. A later successful edit
  persists canonical numeric values; this avoids hidden writes during startup or push requests.

The root README is unchanged because this work introduces no configuration, command, distribution path, or new
operator-visible workflow. The existing per-monitor timeout is the only control.
