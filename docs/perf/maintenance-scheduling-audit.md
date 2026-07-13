# Maintenance scheduling audit

Date: 2026-07-13

- Baseline: `c5fe1c82f86d72c4008f08f8783fe05edf0b9f5b`
- Maintenance fix: `a058dd9925af211302bf1cb62d444b879090b3df`

## Compiled-runtime measurement

Each sample starts the compiled executable with a fresh temporary SQLite data
directory on localhost, waits for a successful `GET /`, records elapsed wall
time and the process RSS, then terminates the process. Three cold process
samples were taken for each revision on the same host. The first baseline
sample includes one-off host cache warm-up, so medians are the useful
comparison.

| Revision | Ready samples (s)   | Median (s) | RSS samples (KiB)      | Median (KiB) |
| -------- | ------------------- | ---------: | ---------------------- | -----------: |
| Baseline | 1.517, 0.297, 0.305 |      0.305 | 190848, 187680, 194864 |       190848 |
| Fix      | 0.451, 0.309, 0.316 |      0.316 | 195776, 195808, 195664 |       195776 |

The approximately 4.8 MiB RSS difference is within this deliberately small
three-sample cold-process measurement and coincides with the generated UI
bundle changing. The maintenance scheduler has no recurring polling loop;
the fix clears existing timeouts on stop and computes interval timing only
when its scheduled callback runs.

## Scope and remaining risk

The automated suite covers every strategy exposed by the UI, ownership of
maintenance schedules and monitor relations, duplicate relation input,
validation boundaries, persistence through a real server, compiled-binary
startup, and timer cleanup. It does not simulate every DST transition,
month-end/leap-day occurrence, or a corrupted legacy JSON schedule inserted
directly into SQLite. These remain compatibility risks to assess against real
legacy data before a broad production migration.
