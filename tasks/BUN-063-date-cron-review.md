# BUN-063: Date and Cron Library Review

## Objective

Determine whether `dayjs` and `croner` are meaningful costs worth migrating, or whether they should remain because timezone and maintenance scheduling are high-risk areas.

## Context

Date, timezone, and maintenance schedule logic can fail subtly. They should not be rewritten without measurements.

## Scope

- Measure or estimate the cost of:
  - `dayjs`;
  - local timezone plugins;
  - `croner`.
- Inspect usage in:
  - maintenance;
  - background jobs;
  - uptime calculator;
  - frontend formatting.
- Record one decision:
  - keep;
  - reduce imports;
  - partially replace;
  - fully replace.

## Out of Scope

- Implementing date or cron migration.
- Changing timezone behavior.
- Changing date UI.

## Suggested Implementation

1. Run `rg -n "dayjs|Cron|croner" server src test`.
2. Estimate bundle/runtime impact.
3. Run uptime, maintenance, and status-page tests.
4. Add `docs/architecture/date-and-cron.md`.
5. If migration is recommended, add separate task files.

## Files to Inspect

- `server/jobs.js`
- `server/model/maintenance.js`
- `server/uptime-calculator.js`
- `src/mixins/datetime.js`
- `src/modules/dayjs/`
- `test/backend-test/`

## Validation

```bash
npm run test-backend
rg -n "dayjs|Cron|croner" server src test
```

## Acceptance Criteria

- A date/cron decision document exists.
- It includes usage count and risk areas.
- Maintenance/timezone tests pass.
- No runtime behavior changes are made in this task.
- The decision is based on measurement or a clear lack of meaningful savings.

## Completion Evidence

State the decision and the largest risk of any future migration.
