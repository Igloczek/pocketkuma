# BUN-011: TypeScript Source Migration

## Objective

Migrate application source from `.js` to `.ts` while preserving the current Bun runtime behavior.

## Scope

- Convert backend, frontend, and shared app source files from `.js` to `.ts` in focused batches.
- Update imports, Vite config, test config, and Bun entrypoints to resolve TypeScript sources.
- Keep CommonJS compatibility only where required by remaining dependencies or runtime boundaries.
- Add type definitions or local declaration files where needed.
- Keep tests runnable through Bun.

## Out of Scope

- Full strict-mode type cleanup if it blocks incremental migration.
- Product behavior changes.
- Directory relocation into `src` beyond what is needed for TypeScript resolution; BUN-013 owns layout.

## Validation

```bash
bun install --frozen-lockfile
bun run tsc
bun run lint
bun run build
bun run test:backend
```

Run the Bun smoke server and a browser smoke for setup/login/monitor creation after the entrypoint changes.

## Acceptance Criteria

- Application-owned runtime source is TypeScript or explicitly documented as an exception.
- Bun start/build/test scripts resolve TypeScript entrypoints without Node transpilation glue.
- Type checking runs through the project script and catches app source.
- Backend tests and frontend build pass.

## Completion Evidence

Report converted file counts, remaining `.js` exceptions with reasons, typecheck result, build/test results, and Bun smoke result.
