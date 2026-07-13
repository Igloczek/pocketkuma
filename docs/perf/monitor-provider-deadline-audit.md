# Monitor provider deadline and cleanup audit

Date: 2026-07-14

- Baseline tests: `5add23ce1c67b6c46a958e2e5854fef89c8d7ff1`
- Baseline runtime: `295ca265b8771e3573abe33c1239c71b012d17be`
- Runtime and tests: `2045324bf7e83d805088e1b73c4687294e789659`

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

The root README is unchanged because this work introduces no configuration, command, distribution path, or new
operator-visible workflow. The existing per-monitor timeout is the only control.
