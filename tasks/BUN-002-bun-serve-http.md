# BUN-002: HTTP and Static Serving Through `Bun.serve`

## Objective

Move the default HTTP listener from Express/Node HTTP to `Bun.serve` while keeping the existing app behavior recognizable.

## Scope

- Introduce a Bun HTTP entrypoint using `Bun.serve`.
- Serve built frontend assets through Bun APIs such as `Bun.file`.
- Route existing API endpoints through a request adapter or extracted handlers.
- Preserve existing auth/session behavior needed by the frontend.
- Keep Express only as a temporary compatibility layer if a route has not yet been migrated, and document every remaining Express dependency.

## Out of Scope

- Native WebSocket migration.
- Outbound HTTP client changes.
- Database migration.

## Validation

```bash
bun run bun:build
bun run bun:start -- --port=3002 --data-dir=./data/bun-serve-smoke
curl -i http://127.0.0.1:3002/
curl -i http://127.0.0.1:3002/api/entry-page
rg -n "express|app\\.use|app\\.get|app\\.post|listen\\(" server
```

## Acceptance Criteria

- The default Bun start path creates the listener with `Bun.serve`.
- Static assets and required API endpoints respond correctly.
- Startup no longer depends on Node's `http.createServer` for the default Bun path.
- Any remaining Express usage is documented as temporary and scoped.

## Completion Evidence

Report the `Bun.serve` entrypoint, the smoke URLs, and the remaining Express call sites.
