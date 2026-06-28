# BUN-042: Evaluate Socket.IO to Bun WebSocket Migration

## Objective

Determine whether replacing Socket.IO with native Bun WebSocket is worthwhile and feasible without rewriting the UI.

## Context

Socket.IO is central to the app transport layer. Migrating it might reduce memory, but event compatibility, reconnect behavior, and auth handling may cost more than the savings justify.

## Scope

- Document the complete Socket.IO event contract.
- Measure RSS with:
  - 0 connected clients;
  - 1 connected client;
  - 5 connected clients.
- Build a proof-of-concept event adapter on Bun WebSocket.
- Decide whether to migrate now, migrate later, or keep Socket.IO.

## Out of Scope

- Production WebSocket migration.
- Removing Socket.IO.
- Rewriting Vue components.

## Suggested Implementation

1. Run `rg -n "socket.on|socket.emit|io.to|emit\\(" server src`.
2. Create `docs/socket-event-contract.md`.
3. Group events by:
   - auth/setup;
   - monitor management;
   - heartbeat;
   - settings;
   - status pages;
   - maintenance;
   - notifications.
4. Measure memory with browser clients or a simple socket client.
5. Build a proof of concept for:
   - login;
   - `getMonitorList`;
   - heartbeat emit;
   - reconnect.
6. Record the decision with numbers.

## Files to Inspect

- `server/server.js`
- `server/socket-handlers/*`
- `src/mixins/socket.js`
- `src/util-frontend.js`
- `docs/socket-event-contract.md`

## Validation

```bash
rg -n "socket.on|socket.emit|io.to|emit\\(" server src
npm run bench:memory:node
```

For the proof of concept, include startup commands and event logs.

## Acceptance Criteria

- The event contract document exists.
- It lists client-to-server and server-to-client events.
- RSS measurements for 0/1/5 clients are saved.
- The proof of concept covers the minimal flow or documents a concrete blocker.
- The migration decision is explicit and justified by measurements.

## Completion Evidence

Link to the event contract, report the 0/1/5 client measurements, and state the decision.
