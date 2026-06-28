# BUN-032: HTTP, Keyword, and JSON Query Monitors Through Native `fetch`

## Objective

Move the main HTTP monitor path from axios to the HTTP adapter backed by native `fetch`, without losing monitor features.

## Context

HTTP monitors are core functionality. The current implementation uses axios, Node agents, cookie jars, and TLS socket internals. The migration must be precise and thoroughly tested.

## Scope

- Applies to monitor types:
  - `http`;
  - `keyword`;
  - `json-query`.
- Preserve:
  - custom headers;
  - JSON/form/XML request bodies;
  - accepted status codes;
  - redirect limit;
  - cache busting;
  - basic auth;
  - bearer auth;
  - OAuth2 client credentials;
  - response saving;
  - timeout behavior.
- Handle TLS information explicitly, or keep TLS info on the old path with a clear justification.

## Out of Scope

- Proxy, mTLS, NTLM, and cookie jar behavior if BUN-033 has not resolved them.
- Docker monitor.
- Notification providers.
- Removing axios.

## Suggested Implementation

1. Extend the BUN-030 adapter with a `fetch` backend.
2. Map axios-like options to fetch-compatible options.
3. Implement redirect behavior compatible with `maxredirects`.
4. Use `AbortController` for timeout.
5. Preserve body parsing behavior:
   - parse JSON only when expected;
   - keep text as text for keyword checks;
   - preserve access to raw response for response saving where needed.
6. Add tests for each monitor type.
7. Measure RSS and check duration before/after.

## Files to Inspect

- `server/model/monitor.js`
- `server/http-client.js`
- `server/util-server.js`
- `test/backend-test/monitors/`
- `test/backend-test/test-monitor-response.js`

## Validation

```bash
npm run test-backend
npm run bench:memory:node
bun run bench:memory:bun
```

Add or run tests for:

- accepted HTTP status;
- rejected HTTP status;
- keyword found and not found;
- JSON query pass and fail;
- timeout;
- response saving.

## Acceptance Criteria

- HTTP, keyword, and json-query monitor tests pass.
- Timeout uses abort behavior and produces a predictable message.
- Response saving works for success and failure according to monitor settings.
- TLS expiry and hostname behavior are preserved or explicitly deferred to a follow-up task.
- Memory and request-timing measurements are saved.

## Completion Evidence

Report monitor test results and the before/after measurement file.
