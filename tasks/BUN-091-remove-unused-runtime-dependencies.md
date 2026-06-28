# BUN-091: Remove Unused Runtime Dependencies

## Objective

Remove runtime dependencies that have been replaced by native Bun APIs or moved to full/optional targets.

## Context

Dependency reduction is a core project goal. Packages must be removed based on actual usage and tests, not assumptions.

## Scope

- Review `dependencies`.
- For each removal candidate, record:
  - why it can be removed;
  - which task replaced it;
  - how absence of usage was verified.
- Remove packages from `package.json`.
- Update lockfiles.
- Measure dependency count and install size.

## Out of Scope

- Removing devDependencies without a reason.
- Removing packages required by the full target.
- Functional code changes that belong in separate task files.

## Suggested Implementation

1. Build the candidate list from completed tasks.
2. For each candidate, run `rg` for package name and API usage.
3. Remove one package or one logical small group at a time.
4. Run install and tests.
5. Write `docs/perf/dependency-cleanup.md`.

## Files to Inspect

- `package.json`
- `package-lock.json`
- `bun.lock`
- `docs/perf/dependency-cleanup.md`
- `server/`
- `src/`
- `extra/`

## Validation

```bash
bun install --frozen-lockfile
bun run bun:check
npm install
npm run test-backend
node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies).length)"
```

## Acceptance Criteria

- Dependency cleanup report exists.
- Every removed package has a reason and source task.
- Removed packages have no runtime usage.
- Bun install and check pass.
- Dependency count is lower than baseline.
- Lightweight and full targets remain consistent with BUN-072 decisions.

## Completion Evidence

List removed packages and dependency count before/after.
