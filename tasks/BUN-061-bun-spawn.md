# BUN-061: Process Execution Through `Bun.spawn` or Bun Shell

## Objective

Replace simple runtime uses of `child_process`, `promisify-child-process`, and `command-exists` with native Bun APIs where safe.

## Context

Not every helper process is part of the lightweight runtime. Runtime paths must be separated from release and development scripts.

## Scope

- Inventory usage of:
  - `child_process`;
  - `promisify-child-process`;
  - `command-exists`;
  - shell execution in runtime paths.
- Move simple local runtime commands to `Bun.spawn` or Bun Shell.
- Avoid changing release scripts unless they are required by the runtime target.

## Out of Scope

- Ping monitor migration; that is BUN-062.
- Release automation.
- Changing system-service behavior without tests.

## Suggested Implementation

1. Run `rg -n "child_process|promisify-child-process|command-exists|execFile|spawn|execSync" server extra test`.
2. Classify results as:
   - runtime;
   - dev/test;
   - release.
3. Add a process runner helper.
4. Provide a Bun implementation and Node fallback.
5. Replace only the simplest runtime call sites.
6. Add tests for success, non-zero exit, and timeout.

## Files to Inspect

- `server/database.js`
- `server/monitor-types/system-service.js`
- `server/monitor-types/real-browser-monitor-type.js`
- `extra/*.js`
- `extra/release/*.mjs`
- `package.json`

## Validation

```bash
npm run test-backend
bun run bun:test-backend
rg -n "promisify-child-process|command-exists" server package.json
```

## Acceptance Criteria

- Runtime process usage is inventoried.
- At least one simple runtime call site is moved to a Bun/Node helper.
- The helper has tests for exit code and stdout/stderr.
- `promisify-child-process` or `command-exists` is removed only if runtime usage is gone.
- Release scripts are not changed accidentally.

## Completion Evidence

Provide the process-usage classification and helper test results.
