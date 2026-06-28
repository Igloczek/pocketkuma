# BUN-041: Static Files and Simple Endpoints Through `Bun.serve`

## Objective

Serve production `dist` files and simple routes through `Bun.serve` while keeping the current Express path as a fallback.

## Context

Bun provides a native HTTP server and `Bun.file`. Static files are a low-risk first target, but SPA fallback, status pages, and precompressed assets must still work.

## Scope

- Add an experimental Bun server path.
- Serve:
  - `dist/index.html`;
  - assets from `dist`;
  - SPA fallback;
  - a health route.
- Serve gzip/brotli assets if they exist after build.
- Leave the Express path unchanged.

## Out of Scope

- Migrating Socket.IO.
- Migrating all API routes.
- Removing Express.

## Suggested Implementation

1. Run `npm run build` and inspect `dist`.
2. Add `server/bun-static-server.js` or an equivalent module.
3. Use `Bun.serve({ fetch(req) { ... } })`.
4. Map request paths to files in `dist` with path traversal protection.
5. Return `index.html` for frontend routes.
6. Set correct `Content-Type`.
7. Preserve `Content-Encoding` when serving `.gz` or `.br` files.

## Files to Inspect

- `server/server.js`
- `server/bun-static-server.js`
- `config/vite.config.js`
- local `dist/` after build

## Validation

```bash
npm run build
bun server/bun-static-server.js --port=3015
curl -i http://127.0.0.1:3015/
curl -i http://127.0.0.1:3015/assets/
curl -i http://127.0.0.1:3015/dashboard
```

## Acceptance Criteria

- The Bun server returns `index.html` for `/`.
- The Bun server returns SPA fallback for frontend routes.
- Assets return correct status and content type.
- `../` path traversal does not work.
- Express production serving still works.
- `express-static-gzip` and `compression` are not removed unless this task fully replaces and tests their behavior.

## Completion Evidence

Report `curl` results for `/`, one asset, and one SPA fallback route.
