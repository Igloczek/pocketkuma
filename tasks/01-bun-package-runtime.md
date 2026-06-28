# 01. Bun package manager and compatible runtime

## BUN-010: Add Bun lockfile in a controlled migration

Scope:

- Generate `bun.lock`.
- Check lifecycle scripts and native dependency handling under Bun.
- Map current `allowScripts` from `package.json` to a Bun-safe approach.
- Keep `package-lock.json` until CI and Docker are confirmed on Bun.

Files to inspect:

- `package.json`
- `package-lock.json`
- `.npmrc`
- `.github/workflows/*`
- `docker/dockerfile`

Acceptance criteria:

- `bun install --frozen-lockfile` passes locally.
- `bun install --production --frozen-lockfile` passes locally.
- SQLite, Oracle, gRPC, and Playwright native dependencies are checked explicitly.
- Known differences from npm are documented.

## BUN-011: Add parallel Bun scripts

Scope:

- Add scripts such as `bun:start-server`, `bun:start-server-dev`, `bun:test-backend`, and `bun:build`.
- Keep existing Node/npm scripts working.
- Do not change the default `start` script until Bun passes backend and E2E smoke checks.

Files to inspect:

- `package.json`
- `test/test-backend.mjs`
- `config/playwright.config.js`

Acceptance criteria:

- Bun server smoke start does not fail only because the runtime is not Node.
- `bun run bun:build` builds the frontend.
- `bun run bun:test-backend` runs existing backend tests or clearly lists unsupported tests.
- Existing npm scripts still work.

## BUN-012: Add runtime detection

Scope:

- Replace the hard Node-only version gate in `server/server.js` with runtime-aware validation.
- Report runtime name, version, platform, and architecture in server info.

Files to inspect:

- `server/server.js`
- `server/client.js`
- `src/components/settings/About.vue`

Acceptance criteria:

- Bun is not rejected because `process.versions.node` differs.
- Node version warnings still work.
- UI/API can show runtime information.
- Smoke start works on Node and Bun.

## BUN-013: Replace simple dotenv and args-parser usage

Scope:

- Use Bun's `.env` behavior where possible.
- Add a tiny argument parser only for flags this app actually uses.
- Keep Node-compatible behavior until the default runtime changes.

Files to inspect:

- `server/server.js`
- `server/config.js`
- `extra/reset-password.js`
- `extra/remove-2fa.js`
- `extra/reset-migrate-aggregate-table-state.js`

Acceptance criteria:

- `dotenv` and `args-parser` are removable, or there is a documented reason to keep them.
- Existing flags keep working: `--port`, `--data-dir`, `--disable-frame-sameorigin`, `--cloudflared-token`, `--test`.
- Playwright webServer and existing scripts still start.
