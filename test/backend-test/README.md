# Bun Backend Tests

Documentation: https://bun.sh/docs/test

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

## Mocking

Use Bun's native mocks for `node:test`-style `mock.method` / `mock.fn` patterns:

```ts
import { describe, expect, spyOn, test } from "bun:test";

test("spies on a module method", async () => {
    const spy = spyOn(SomeModule, "method").mockImplementation(async () => "ok");
    try {
        // exercise code under test
        expect(spy).toHaveBeenCalled();
    } finally {
        spy.mockRestore();
    }
});
```

For standalone function mocks, use `mock()` from `bun:test` (`mock.fn()` in Node maps to `mock(() => undefined)`).

## Run

```bash
bun run test:backend          # CI gate: core unit tests (22 tests)
bun run test:backend:unit     # same as test:backend
bun run test:backend:all      # full suite (includes integration / Docker tests)
```

### CI gate (`test:backend`)

The gate runs fast, hermetic unit tests (no Docker/network):

- `bun-sqlite-store.test.ts` — SQLite store bootstrap and queries
- `http-client.test.ts` — fetch wrapper behavior
- `monitor-runtime-loading.test.ts` — lazy monitor/notification loading
- `monitor-scheduler.test.ts` — scheduler timer control
- `check-translations.test.ts` — translation key and placeholder safety
- `schema.test.ts` — generated `kuma.db` schema contract
- `upgrade.test.ts` — upstream Kuma 2.x one-time upgrade path

Add a file here only when it is fast, deterministic, and does not require external services.

### Expected failure categories in `test:backend:all`

The full suite discovers all `*.test.ts` files. Some failures are environmental, not migration regressions:

| Category                | Examples                                               | Cause                             |
| ----------------------- | ------------------------------------------------------ | --------------------------------- |
| Testcontainers          | `monitors/*.test.ts`, `monitors/mqtt.test.ts` (HiveMQ) | Requires Docker and live services |
| DB / network unit tests | `domain.test.ts`                                       | Needs live RDAP/network           |
| Platform-specific       | `system-service.test.ts`, `snmp.test.ts`               | systemd/SNMP/Docker availability  |

Use `test:backend` (unit subset) to validate core changes in CI.
