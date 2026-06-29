# BUN-013: Source Layout Under src

## Objective

Move actual application source under `src` so project root contains configuration, documentation, package metadata, and entrypoint files only.

## Scope

- Move backend application source currently under `server/` into `src/server/`.
- Move database/runtime app assets that are source-like into appropriate `src` subdirectories when feasible.
- Update imports, Vite aliases, Bun start scripts, Dockerfile paths, tests, and helper scripts.
- Keep project-root files limited to config, docs, metadata, scripts, and conventional entrypoints.
- Add compatibility entrypoints only if needed for transition and document their removal path.

## Out of Scope

- TypeScript migration, except for path updates to already-converted files.
- Product behavior changes.
- Moving generated or runtime data directories such as `data/` and `dist/`.

## Validation

```bash
bun install --frozen-lockfile
bun run lint
bun run build
bun run test:backend
bun run start -- --port=3007 --data-dir=./data/src-layout-smoke
```

Run a browser smoke for setup/login/monitor creation.

## Acceptance Criteria

- Runtime app code is under `src`.
- Bun, Vite, test, and Docker entrypoints use the new source paths.
- Root-level app implementation directories such as `server/` are removed or reduced to documented compatibility shims.
- Smoke data is cleaned up after validation.

## Completion Evidence

Report moved directories, updated entrypoints, remaining root exceptions, build/test results, and smoke result.
