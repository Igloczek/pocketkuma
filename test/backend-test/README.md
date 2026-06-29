# Bun Backend Tests

Documentation: https://bun.sh/docs/cli/test

Create a test file in this directory with the name `*.test.ts` or `test-*.ts`.

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
bun run test:backend
```
