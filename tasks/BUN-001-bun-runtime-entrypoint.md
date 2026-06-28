# BUN-001: Bun Runtime Entrypoint and Package Manager

## Objective

Make Bun the install and startup path without yet changing the HTTP server, WebSocket protocol, or database architecture.

## Scope

- Generate and commit `bun.lock`.
- Add temporary Bun-first scripts:
  - `bun:start`;
  - `bun:build`;
  - `bun:test:backend`.
- Add a Bun runtime helper that reports runtime name, version, platform, and arch.
- Replace simple Node-only argument parsing with a local parser that works under Bun.
- Load environment configuration in a way that does not require `dotenv` on the Bun path.
- Keep the existing Node path only as a temporary fallback until BUN-008.

## Out of Scope

- `Bun.serve`.
- Native WebSocket migration.
- Database migration.
- Dependency pruning beyond packages made unused by this task.

## Validation

```bash
bun install --frozen-lockfile
bun run bun:build
bun run bun:start -- --port=3001 --data-dir=./data/bun-entry-smoke
```

Stop the smoke server and remove the temporary data directory after validation.

## Acceptance Criteria

- `bun.lock` exists.
- `bun run bun:start -- --port=... --data-dir=...` starts the current app under Bun or reports a concrete runtime blocker with command output.
- Runtime information is available to the server and client info payload.
- The local argument parser supports `--flag=value`, `--flag value`, and boolean flags.
- `dotenv` and `args-parser` are either removed from the Bun path or kept with a written reason.

## Completion Evidence

Report the Bun version, the start command result, and the files that still depend on Node-only startup behavior.
