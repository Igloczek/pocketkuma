# BUN-043: Native Bun WebSocket

## Objective

Replace Socket.IO with native Bun WebSocket behind an event-compatibility layer, only if BUN-042 proves the migration is worthwhile.

## Context

The frontend expects a Socket.IO-like event API. The migration must preserve auth, reconnect, user routing, and heartbeat emission without broad component rewrites.

## Scope

- Add a backend WebSocket adapter.
- Add a frontend socket adapter.
- Preserve event names where practical.
- Support:
  - login;
  - logout;
  - setup;
  - `getMonitorList`;
  - heartbeat;
  - reconnect;
  - forced refresh/disconnect.
- Remove Socket.IO only after tests pass across the migrated contract.

## Out of Scope

- Changing event semantics.
- Broadly refactoring `src/mixins/socket.js`.
- Changing the auth model.

## Suggested Implementation

1. Use the BUN-042 event contract.
2. Define a wire format such as `{ "event": "...", "args": [], "id": "..." }`.
3. Add callback compatibility for events that currently use Socket.IO callbacks.
4. Implement user/room routing on the backend.
5. Add reconnect handling on the frontend.
6. Route UI code through the adapter, not raw WebSocket.
7. Run setup/dashboard/details E2E.

## Files to Inspect

- `server/server.js`
- `server/socket-handlers/*`
- `server/uptime-kuma-server.js`
- `src/mixins/socket.js`
- `src/util-frontend.js`
- `package.json`

## Validation

```bash
npm run build
npm run test-e2e
npm run test-backend
npm run bench:memory:node
bun run bench:memory:bun
```

## Acceptance Criteria

- Setup flow works.
- Login and logout work.
- Dashboard receives `monitorList`.
- Details view receives heartbeat updates.
- Reconnect works after connection interruption.
- Origin and auth checks are preserved.
- `socket.io` and `socket.io-client` are removed only if the full contract is migrated.
- RSS before/after is saved.

## Completion Evidence

Report E2E results, benchmark results, and the list of confirmed adapter events.
