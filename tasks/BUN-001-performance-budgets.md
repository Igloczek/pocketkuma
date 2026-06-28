# BUN-001: Performance Budgets

## Objective

Convert the BUN-000 benchmark output into concrete decision thresholds for the rest of the migration.

## Context

Compatibility tasks do not have to reduce memory immediately, but they must not introduce uncontrolled regressions. Optimization tasks must show measurable improvement or a clearly documented tradeoff.

## Scope

- Add `docs/perf/budgets.md`.
- Record the baseline from BUN-000.
- Define thresholds for:
  - cold-start RSS;
  - RSS after 10 minutes with 20 monitors;
  - startup time;
  - runtime dependency count;
  - Docker image size when relevant.
- Categorize future tasks as:
  - compatibility;
  - migration;
  - optimization;
  - cleanup.

## Out of Scope

- Changing application code.
- Changing dependencies.
- Setting final targets without an actual baseline.

## Suggested Implementation

1. Create `docs/perf/budgets.md`.
2. Add a table with:
   - metric;
   - baseline;
   - allowed regression for compatibility tasks;
   - expected direction for optimization tasks;
   - notes.
3. Use these default rules unless the measured baseline justifies different numbers:
   - compatibility tasks: no RSS increase above 5% without written justification;
   - optimization tasks: must reduce RSS, dependency count, startup time, or image size;
   - cleanup tasks: no functional regression.
4. Link `docs/perf/budgets.md` from `tasks/README.md`.

## Files to Inspect

- `docs/perf/`
- `tasks/README.md`

## Validation

Check that the document contains actual numbers:

```bash
rg -n "RSS|startup|dependency|Docker|%" docs/perf/budgets.md
```

## Acceptance Criteria

- `docs/perf/budgets.md` exists.
- The document includes the BUN-000 baseline.
- The document defines regression thresholds for compatibility tasks.
- The document defines reporting expectations for optimization tasks.
- `tasks/README.md` links to the budget document.

## Completion Evidence

Report the path to `docs/perf/budgets.md` and the main RSS threshold for the 20-monitor scenario.
