# BUN-013 Source Layout Evidence

Date: 2026-06-29

## Moved Source

- Moved backend runtime source from root `server/` to `src/server/`.
- Moved database source/assets from root `db/` to `src/db/`.
- Removed root `server/` and root `db/` directories.
- Kept generated/runtime directories such as `data/` and `dist/` at root.

## Updated Entrypoints

- Package start scripts now run `bun src/server/server.ts`.
- Docker release image now copies `src/` and runs `CMD ["src/server/server.ts"]`.
- Playwright web server now starts `src/server/server.ts`.
- The later Docker cleanup removed the dev Compose workflow; local development now uses `bun run dev`.
- Backend tests and helper scripts now import from `src/server` and `src/db`.

## Remaining JS Exceptions

- `src/server/modules/**` remains vendored JavaScript.
- `src/server/utils/knex/**` remains a vendored Knex dialect shim.
- `src/db/knex_migrations/*.js` remains JavaScript because these files are Knex migration assets.

## Validation

```bash
bun install --frozen-lockfile
bun run tsc
bun run lint
bun run build
bun run test:backend
bun run start -- --port=3007 --data-dir=./data/src-layout-smoke
```

Results:

- `bun install --frozen-lockfile`: passed, no lockfile changes.
- `bun run tsc`: passed.
- `bun run lint`: passed with inherited warnings and Stylelint deprecation warnings.
- `bun run build`: passed.
- `bun run test:backend`: passed, 17 tests.
- Browser smoke passed: setup page rendered, user `src-smoke` was created, monitor `src-layout-smoke` was created for `http://127.0.0.1:3007`, and first heartbeat returned `200 - OK`.
- Smoke server shut down gracefully and `data/src-layout-smoke` was removed.
