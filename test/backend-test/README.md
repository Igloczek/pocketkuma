# Bun Backend Tests

Documentation: https://bun.sh/docs/cli/test

Create a test file in this directory with the name `*.test.ts`.

Bun discovers `*.test.ts` files when `./test/backend-test` is passed to `bun test`.

> [!TIP]
> Writing great tests is hard.
>
> You can make our live much simpler by following this guidance:
>
> - Use `describe()` to group related tests
> - Use `test()` for individual test cases
> - One test per scenario
> - Use descriptive test names: `function() [behavior] [condition]`
> - Don't prefix with "Test" or "Should"

## Template

```ts
import { describe, expect, test } from "bun:test";

describe("Feature Name", () => {
    test("function() returns expected value when condition is met", () => {
        expect(1).toBe(1);
    });
});
```

## Run

```bash
bun run test:backend          # CI gate: core unit tests (22 tests)
bun run test:backend:unit     # same as test:backend
bun run test:backend:all      # full suite (includes integration / Docker tests)
```

### Expected failure categories in `test:backend:all`

The full suite discovers all `*.test.ts` files. Many failures are pre-existing Bun runner gaps, not ESM regressions:

| Category | Examples | Cause |
|----------|----------|-------|
| `node:test` mocks | `domain.test.ts`, `globalping.test.ts` | `mock.method` / `mock.restoreAll` unavailable under Bun |
| Nested `node:test` | `monitor-conditions/*.test.ts` | `describe()`/`test()` nesting incompatible with Bun runner |
| Testcontainers | `monitors/*.test.ts` | Requires Docker and live services |
| DB / network unit tests | `uptime-calculator.test.ts`, `domain.test.ts` | Needs setup or live RDAP/network |

Use `test:backend` (unit subset) to validate ESM migration changes in CI.
