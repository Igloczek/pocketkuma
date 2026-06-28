# BUN-072: Lightweight and Full Dependency Groups

## Objective

Define dependency and build-target groups for lightweight and full variants without accidentally removing functionality from the full variant.

## Context

The project should support a light setup for small installations, while some inherited Uptime Kuma functionality may remain available in a full variant.

## Scope

- Define variants:
  - lightweight: SQLite plus core monitors;
  - full: optional monitors and heavy integrations.
- Decide how to represent the split:
  - Docker targets;
  - optional dependencies;
  - build arguments;
  - documentation.
- Do not split dependencies without validating install behavior.

## Out of Scope

- Implementing the final lightweight Docker image; that is BUN-081.
- Removing optional monitor types.
- Publishing packages.

## Suggested Implementation

1. Use BUN-070 classification.
2. Create `docs/architecture/dependency-targets.md`.
3. List packages for lightweight and full variants.
4. For every full-only package, identify the feature requiring it.
5. Propose the implementation mechanism.
6. Add follow-up task files if needed.

## Files to Inspect

- `package.json`
- `docker/dockerfile`
- `docker/debian-base.dockerfile`
- `server/monitor-types/*`
- `docs/architecture/monitor-types.md`

## Validation

```bash
node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies).length)"
```

This task is primarily a design task. Do not change install behavior unless the scope is explicitly extended and installation is validated.

## Acceptance Criteria

- Dependency target documentation exists.
- Every heavy dependency is mapped to the feature requiring it.
- The document distinguishes lightweight and full variants.
- The document identifies the implementation mechanism.
- `package.json` is unchanged unless the change is minimal and install validation is run.

## Completion Evidence

Link to the document and list dependencies that belong only to the full variant.
