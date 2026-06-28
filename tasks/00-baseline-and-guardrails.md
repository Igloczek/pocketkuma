# 00. Baseline and guardrails

## BUN-000: Create a repeatable memory benchmark scenario

Scope:

- Add a local scenario that seeds a test database with 20 monitors.
- Use only local mock services where possible.
- Include HTTP, keyword, ping, TCP, and DNS monitor coverage.
- Make the scenario runnable for Node and Bun, even if Bun initially reports incompatibilities.
- Store results under `docs/perf/` or another clearly named perf output directory.

Files to inspect:

- `server/model/monitor.js`
- `server/server.js`
- `test/prepare-test-server.js`
- `test/backend-test/`
- `config/playwright.config.js`

Acceptance criteria:

- One command runs the Node baseline.
- One command runs the Bun baseline.
- Both scenarios create the same monitor count and monitor types.
- Output includes RSS, heap used, startup time, and monitor count.
- The scenario does not require GitHub access or external services.

## BUN-001: Define performance budgets

Scope:

- Save current baseline values.
- Define regression thresholds for migration tasks.
- At minimum, distinguish compatibility tasks from tasks expected to reduce memory.

Acceptance criteria:

- Baseline results for current Node runtime are recorded.
- A target budget exists for the 20-monitor scenario.
- Future task reports can compare against this baseline.

## BUN-002: Add contributor and agent working policy

Scope:

- Document how migration tasks should be implemented.
- Require small scope, human review, local testing, and measured results.
- Link the policy to this task directory.

Acceptance criteria:

- Policy is local to the repository.
- It allows AI assistance but requires human understanding and testing.
- It does not contain upstream ban/shame language.
