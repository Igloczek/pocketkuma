# BUN-014: Final Bun Cleanup

## Objective

Finish the Bun migration by removing remaining npm/Node-era configuration and fallback defaults, including `.npmrc`.

## Scope

- Remove or migrate `.npmrc` settings to Bun-compatible configuration only where still needed.
- Remove Node-specific package scripts, Node fallback commands, and Node-only docs that are no longer valid.
- Remove remaining compatibility dependencies that became unused after BUN-009 through BUN-013.
- Ensure Bun is the only documented package manager and runtime path.
- Update docs and performance evidence for final Bun defaults.

## Out of Scope

- New product features.
- Public release automation.
- Reintroducing npm or Node support.

## Validation

```bash
bun install --frozen-lockfile
bun run lint
bun run build
bun run test:backend
bun run start -- --port=3007 --data-dir=./data/final-bun-smoke
docker compose build
docker image inspect uptime-buna:bun-final --format '{{.Size}}'
```

Run a browser smoke for setup/login/monitor creation and SQLite persistence.

## Acceptance Criteria

- `.npmrc` is removed or replaced with a Bun-specific equivalent and documented.
- No npm default workflow remains in package scripts or docs.
- Remaining Node-era dependencies are either removed or documented with exact runtime owners.
- Bun install/build/start/test/docker flows pass.

## Completion Evidence

Report `.npmrc` migration, removed dependencies/scripts, final validation results, Docker image size, and final smoke checklist.
