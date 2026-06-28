# 03. HTTP client and axios reduction

## BUN-030: Introduce an internal HTTP adapter

Scope:

- Add one module, for example `server/http-client.js`, that hides request implementation details.
- Return the minimal response shape the app needs: `status`, `statusText`, `headers`, `data`, timing, and `error.response`.
- The first implementation may delegate to axios.

Files to inspect:

- `server/model/monitor.js`
- `server/notification-providers/*`
- `server/docker.js`
- `server/check-version.js`
- `server/monitor-types/rabbitmq.js`
- `server/monitor-types/steam.js`

Acceptance criteria:

- At least the core HTTP monitor uses the adapter.
- HTTP, keyword, and json-query tests continue to pass.
- Timeout, redirects, headers, JSON/form/XML bodies, and response-body errors are preserved.

## BUN-031: Move simple notification providers to native fetch

Scope:

- Pick 5 to 10 notification providers that do not require upload, proxy agents, NTLM, or special transport handling.
- Move them to the internal adapter backed by `fetch`.
- Leave complex providers on the old path for now.

Acceptance criteria:

- Each changed provider has a test or local mock smoke test.
- Runtime axios usage count goes down.
- HTTP errors are shown/logged consistently with existing behavior.
- Providers outside this scope do not regress.

## BUN-032: Move HTTP, keyword, and json-query monitors to native fetch

Scope:

- Replace axios in the main HTTP monitor path.
- Preserve custom headers, body encodings, redirect limits, cache busting, basic/bearer/OAuth2 auth, response saving, and accepted status codes.
- Handle TLS certificate information explicitly because the current implementation reads it from Node/axios socket internals.

Acceptance criteria:

- HTTP, keyword, json-query, and response-saving tests pass.
- Timeout behavior is preserved or documented exactly.
- Certificate expiry and hostname match still work for HTTPS.
- Benchmark records RSS and request timing before and after.

## BUN-033: Decide special HTTP transport behavior

Scope:

- Spike proxy, mTLS, NTLM, cookie jar, and Docker Unix socket behavior under Bun/native fetch.
- Decide per feature: native Bun, keep axios for a special path, or add a focused compatibility adapter.

Acceptance criteria:

- A decision table exists for HTTP/HTTPS/SOCKS proxy, mTLS, NTLM, cookie jar, and Docker Unix socket API.
- Each decision has a smoke test or documented risk.
- No feature is removed silently.

## BUN-034: Remove axios only after all runtime usage is gone

Scope:

- Remove axios after monitors, notification providers, Docker API, and helper modules no longer use it.
- Remove related packages only when they are truly unused.

Acceptance criteria:

- Runtime search finds no axios imports.
- `package.json` and lockfile no longer include axios if it is unused.
- Backend tests and selected E2E pass.
- RSS and runtime dependency counts are recorded before and after.
