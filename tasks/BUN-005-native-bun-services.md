# BUN-005: Bun-Native Passwords, Processes, and Shell Helpers

## Objective

Replace small Node-era runtime helpers with Bun-native APIs where that removes dependencies or simplifies the runtime.

## Scope

- Use `Bun.password` for password hashing and verification.
- Preserve login for existing hashes through a one-time verification/migration path if old hashes exist.
- Replace process execution helpers with `Bun.spawn` or Bun Shell.
- Move ping and command-based monitor checks to the Bun process API.
- Remove packages made unused by the migration, such as password or process helper dependencies.

## Out of Scope

- WebSocket transport.
- Database repository design.
- Outbound HTTP client migration.

## Validation

```bash
bun run bun:test:backend
bun run bun:start -- --port=3005 --data-dir=./data/bun-services-smoke
rg -n "bcrypt|child_process|execa|cross-env|password" src scripts package.json
```

## Acceptance Criteria

- New passwords are hashed with `Bun.password`.
- Existing supported hashes can still log in or have a documented migration path.
- Command execution uses `Bun.spawn` or Bun Shell on the Bun path.
- Ping/port command behavior still works for core monitor checks.
- Removed helper dependencies no longer appear in `package.json`.

## Completion Evidence

Report the password migration behavior, the process helper location, and the removed dependency list.
