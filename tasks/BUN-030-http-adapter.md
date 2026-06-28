# BUN-030: Internal HTTP Adapter

## Objective

Introduce one internal abstraction for outbound HTTP so axios can be replaced incrementally and safely.

## Context

Axios is used by monitors, notification providers, Docker integration, and helper modules. A global replacement would be risky. A stable adapter contract must come first.

## Scope

- Add a module such as `server/http-client.js`.
- Define request and response contracts.
- The first implementation may delegate to axios.
- Move the core HTTP monitor path to the adapter without behavior changes.
- Add adapter tests.

## Out of Scope

- Removing axios.
- Migrating all notification providers.
- Migrating proxy, mTLS, or NTLM behavior.

## Suggested Implementation

1. Define a `request(options)` function.
2. Minimum response shape:
   - `status`;
   - `statusText`;
   - `headers`;
   - `data`;
   - `request`;
   - `durationMs`.
3. Minimum error shape:
   - `message`;
   - `code`;
   - `response`;
   - `cause`.
4. Internally call `axios.request(options)` for the first implementation.
5. In `server/model/monitor.js`, move only the main HTTP/keyword/json-query path onto the adapter.
6. Keep existing special-case behavior in place.

## Files to Inspect

- `server/model/monitor.js`
- `server/http-client.js`
- `server/notification-providers/*`
- `server/docker.js`
- `server/check-version.js`
- `server/monitor-types/rabbitmq.js`
- `server/monitor-types/steam.js`

## Validation

```bash
npm run test-backend
node --test test/backend-test/monitors/test-http*.js
```

If no dedicated HTTP monitor test exists, add a minimal test using a local HTTP server.

## Acceptance Criteria

- `server/http-client.js` or an equivalent module exists.
- The core HTTP monitor uses the adapter.
- The adapter has tests for success, timeout, and HTTP error with response body.
- Headers, body, status validation, and redirect behavior are preserved.
- Notification providers are not mass-refactored in this task.

## Completion Evidence

Report the adapter contract and the adapter/HTTP monitor test results.
