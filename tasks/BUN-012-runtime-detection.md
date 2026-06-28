# BUN-012: Runtime Detection

## Objective

Replace Node-only runtime validation with logic that recognizes both Node and Bun without rejecting Bun because of Node compatibility fields.

## Context

`server/server.js` checks the Node version through `process.versions.node` and `package.json.engines.node`. Under Bun, that validation is not the correct startup gate.

## Scope

- Add a runtime helper, for example `server/runtime.js`.
- The helper must return:
  - `name`: `node` or `bun`;
  - `version`;
  - `platform`;
  - `arch`.
- Keep Node version warnings for Node.
- Add a Bun minimum-version check only if the project defines one.
- Include runtime info in `sendInfo()`.

## Out of Scope

- Broad UI redesign.
- Changing `engines.node`.
- Removing `semver` unless a separate task covers it.

## Suggested Implementation

1. Add a runtime helper independent from Express.
2. Use it in `server/server.js` before the current version gate.
3. Preserve the current warning behavior for Node.
4. Log `Bun version: x.y.z` when running on Bun.
5. Extend `info.runtime` in `server/client.js`.
6. If runtime is displayed in the UI, add the field without changing layout structure.

## Files to Inspect

- `server/server.js`
- `server/client.js`
- `src/components/settings/About.vue`
- `package.json`

## Validation

```bash
npm run start-server -- --port=3001 --data-dir=./data/node-runtime-smoke
bun run bun:start-server -- --port=3002 --data-dir=./data/bun-runtime-smoke
```

Check startup logs and the client `info` payload if the server reaches UI/API readiness.

## Acceptance Criteria

- Node still warns or errors for unsupported Node versions.
- Bun does not exit because of the Node-only gate.
- `info.runtime` contains runtime name and version.
- A smoke check confirms the Node path.
- A smoke check confirms the Bun path or reports a specific blocker.

## Completion Evidence

Report the runtime log output for Node and Bun, and identify where `info.runtime` is set.
