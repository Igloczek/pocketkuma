# BUN-003: Native Bun WebSocket Protocol

## Objective

Replace Socket.IO with a native WebSocket protocol that runs on Bun's WebSocket server support.

## Scope

- Define a small JSON message envelope for events, replies, errors, and subscriptions.
- Implement server-side WebSocket upgrade and message handling through Bun.
- Replace Socket.IO auth, monitor updates, heartbeat updates, and status subscriptions with the new protocol.
- Replace the frontend Socket.IO client with a native WebSocket client module.
- Preserve reconnect and login/session behavior.
- Remove `socket.io` and `socket.io-client` once no runtime path uses them.

## Out of Scope

- Redesigning the frontend state model.
- Changing monitor semantics.
- Database changes.

## Validation

```bash
bun run bun:build
bun run bun:start -- --port=3003 --data-dir=./data/bun-ws-smoke
npm run test-backend
rg -n "socket\\.io|socket.io|io\\(" server src package.json
```

Use an E2E or browser smoke check to confirm login, dashboard status updates, and monitor detail updates.

## Acceptance Criteria

- The default realtime path uses Bun-native WebSockets.
- The dashboard receives monitor and heartbeat updates without Socket.IO.
- Socket.IO dependencies are removed or have a specific temporary blocker.
- Reconnect behavior works after server restart or client refresh.

## Completion Evidence

Report the WebSocket message envelope, the server handler location, the frontend client location, and the Socket.IO removal status.
