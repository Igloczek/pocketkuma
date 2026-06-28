# BUN-040: Separate Routing from Express Bootstrap

## Objective

Separate route and middleware registration from Express server creation so Express and Bun HTTP bootstrap paths can coexist during migration.

## Context

`server/server.js` and `server/uptime-kuma-server.js` currently create the Express app, HTTP server, and Socket.IO setup together. Without separation, `Bun.serve` cannot be tested safely.

## Scope

- Identify all route and middleware registration points.
- Extract Express route registration into one or more runtime-neutral modules.
- Preserve current Express behavior.
- Optionally add a minimal experimental Bun bootstrap for smoke checks.

## Out of Scope

- Switching production to `Bun.serve`.
- Migrating Socket.IO.
- Changing API contracts.

## Suggested Implementation

1. Inspect `app.use`, `app.get`, and `app.post` in `server/server.js`.
2. Create a module such as `server/app-routes.js`.
3. Export `registerExpressRoutes(app, context)`.
4. Move registration, not business logic.
5. Add a smoke check proving Express still starts and setup routes work.
6. If a Bun bootstrap is added, keep it explicitly experimental, for example `server/bun-server.js`.

## Files to Inspect

- `server/server.js`
- `server/uptime-kuma-server.js`
- `server/routers/api-router.js`
- `server/routers/status-page-router.js`
- `server/setup-database.js`
- `server/utils/simple-migration-server.js`

## Validation

```bash
npm run test-backend
node server/server.js --port=3014 --data-dir=./data/routes-smoke
curl -i http://127.0.0.1:3014/
```

## Acceptance Criteria

- The Express path starts as before.
- Route registration is moved into explicit module(s).
- Endpoint names are unchanged.
- Middleware ordering is preserved or any change is documented.
- Any Bun bootstrap added in this task is marked experimental.

## Completion Evidence

List the moved route groups and provide the smoke `curl` result.
