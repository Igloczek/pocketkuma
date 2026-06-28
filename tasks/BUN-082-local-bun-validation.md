# BUN-082: Local Bun Validation

## Objective

Define and implement a local Bun validation command before relying on any GitHub automation.

## Context

This repository does not need inherited upstream CI complexity, but it still needs a simple local way to verify that the Bun path is not broken.

## Scope

- Add an aggregate script such as `bun:check`.
- The script should run:
  - `bun install --frozen-lockfile` or a lockfile check;
  - lint if it works under Bun;
  - build;
  - backend tests;
  - server smoke start.
- Document unsupported steps.

## Out of Scope

- Reintroducing GitHub Actions.
- Publishing status badges.
- Full OS matrix testing.

## Suggested Implementation

1. Add `bun:check` to `package.json`.
2. If any step does not work under Bun, do not hide it. Document it in `docs/bun-validation.md`.
3. Use an isolated `DATA_DIR` for smoke start.
4. Make the script exit non-zero on real failure.
5. Add instructions to README.

## Files to Inspect

- `package.json`
- `README.md`
- `docs/bun-validation.md`
- `test/test-backend.mjs`

## Validation

```bash
bun run bun:check
```

## Acceptance Criteria

- `bun:check` exists.
- The command runs build, backend tests, and smoke start, or explicitly skips incompatible steps.
- Skipped steps are documented in `docs/bun-validation.md`.
- README points to local Bun validation.
- `.github/workflows` is not reintroduced.

## Completion Evidence

Report the result of `bun run bun:check` and list any skipped steps.
