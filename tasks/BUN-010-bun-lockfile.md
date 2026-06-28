# BUN-010: Controlled `bun.lock`

## Objective

Introduce Bun as a package manager without breaking the current npm workflow.

## Context

The repository currently has `package-lock.json`, `.npmrc`, and `allowScripts` in `package.json`. Several dependencies have native or postinstall requirements. Before runtime migration, the install behavior under Bun must be known.

## Scope

- Generate `bun.lock`.
- Keep `package-lock.json`.
- Verify production install behavior.
- Explicitly check native dependencies:
  - `@louislam/sqlite3`;
  - `oracledb`;
  - `@grpc/grpc-js`;
  - `playwright-core`;
  - `ssh2` and `cpu-features` if they appear through dependencies.
- Document install differences in `docs/bun-install-notes.md`.

## Out of Scope

- Changing the default package manager in README.
- Removing npm scripts.
- Updating dependency versions unless required to make installation work.

## Suggested Implementation

1. Run `bun install`.
2. Confirm that `bun.lock` is created.
3. Run a production install in the same repo or in a clean temporary checkout:
   `bun install --production --frozen-lockfile`.
4. Record Bun lifecycle-script warnings.
5. Check whether the current `allowScripts` field still matters or needs a Bun-specific replacement.
6. Add install notes with risks and blockers.

## Files to Inspect

- `package.json`
- `package-lock.json`
- `.npmrc`
- `bun.lock`
- `docs/bun-install-notes.md`

## Validation

```bash
bun install --frozen-lockfile
bun install --production --frozen-lockfile
```

If production install requires a clean directory, describe exactly how it was run.

## Acceptance Criteria

- `bun.lock` exists and is suitable for commit.
- `package-lock.json` still exists.
- `bun install --frozen-lockfile` succeeds or produces a specific blocker.
- Production install succeeds or produces a specific blocker.
- Install notes list every native dependency checked and its result.

## Completion Evidence

Report the result of both install commands and link to the install notes.
