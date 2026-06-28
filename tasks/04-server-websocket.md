# 04. HTTP server, static files, and WebSocket

## BUN-040: Separate app routing from Express bootstrap

Scope:

- Extract route and middleware registration from `server/server.js` into runtime-neutral functions.
- Allow Express and Bun bootstrap paths to coexist during migration.

Files to inspect:

- `server/server.js`
- `server/uptime-kuma-server.js`
- `server/routers/api-router.js`
- `server/routers/status-page-router.js`
- `server/setup-database.js`
- `server/utils/simple-migration-server.js`

Acceptance criteria:

- Express behavior remains unchanged.
- Bun path can start at least a minimal health/setup route.
- API contracts do not change.

## BUN-041: Serve static files and simple endpoints with Bun.serve

Scope:

- Use `Bun.serve` and `Bun.file` for `dist`, assets, health routes, and simple setup routes where possible.
- Replace `express-static-gzip` and `compression` only if precompressed assets and headers are preserved.

Acceptance criteria:

- Production `dist` serves `index.html` and assets.
- Gzip/brotli assets are served when available.
- Status pages and SPA fallback still work.
- Setup and dashboard E2E pass.

## BUN-042: Evaluate Socket.IO to native Bun WebSocket migration

Scope:

- Document the full Socket.IO event contract used by frontend and backend.
- Measure Socket.IO memory cost with 1 and 5 browser connections.
- Build a proof of concept event adapter on Bun WebSocket without broad UI changes.

Files to inspect:

- `server/server.js`
- `server/socket-handlers/*`
- `src/mixins/socket.js`
- `src/util-frontend.js`

Acceptance criteria:

- Client/server event list is complete.
- Proof of concept supports login, `getMonitorList`, heartbeat emit, and reconnect.
- Decision is documented: migrate now, migrate later, or keep Socket.IO.

## BUN-043: Implement native WebSocket behind a compatibility adapter

Scope:

- Replace Socket.IO only behind a compatibility layer.
- Avoid broad Vue component changes outside the socket client adapter.

Acceptance criteria:

- Login, setup, dashboard, and details E2E pass.
- Reconnect and forced session refresh work.
- Origin checks and auth are preserved.
- `socket.io` and `socket.io-client` can be removed.
- RSS measurement confirms the memory impact.
