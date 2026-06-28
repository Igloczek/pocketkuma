# AGENTS.md

This repository is `uptime-buna`, a fork of Uptime Kuma focused on reducing runtime memory and dependency weight by migrating carefully selected runtime paths from Node.js to Bun.

## Project goal

- Run the backend and supporting runtime scripts on Bun.
- Prefer native Bun APIs where they remove dependencies, reduce memory, or simplify runtime code.
- Avoid a full rewrite of Uptime Kuma.
- Preserve existing user-facing behavior unless a task explicitly says otherwise.
- Measure memory and startup changes before claiming an optimization.

## Task source

Migration work is tracked in `/tasks`.

Start with:

- `tasks/README.md`
- `tasks/00-baseline-and-guardrails.md`

Do not invent broad migration work outside those files unless the user asks for it.

## Agent working rules

- Keep changes small and scoped to the requested task.
- Read the existing code before editing.
- Prefer compatibility boundaries before replacing large subsystems.
- Do not remove features silently.
- Do not contact GitHub, create pull requests, push branches, or post comments unless the user explicitly asks.
- Do not write PR descriptions or review replies on behalf of the user.
- If a change affects memory, dependencies, startup, Docker, database, networking, or monitor scheduling, include a before/after measurement or explain why measurement was not possible.
- Preserve npm/Node paths until the relevant task says they can be removed.
- Do not run destructive git commands unless the user explicitly requests them.

## Validation expectations

Use the narrowest validation that proves the change:

- Documentation-only change: inspect rendered/linked markdown and check git status.
- Package/runtime change: run install/build/start smoke checks for the touched runtime.
- Monitor behavior change: run or add focused backend tests for the affected monitor type.
- Frontend behavior change: run build and focused E2E or manual browser verification.
- Docker change: build the affected target and record image size when relevant.

If validation cannot be run locally, state that clearly in the final response.

## Bun migration priorities

Prefer these native Bun APIs when they fit the task and preserve behavior:

- `bun install` and `bun.lock`
- `Bun.serve`
- Bun native WebSocket support
- `bun:sqlite`
- `Bun.SQL`
- Bun environment handling
- `Bun.password`
- `Bun.spawn` and Bun Shell

Use Node compatibility as a stepping stone, not as the final migration result.

## Code style

- Follow the existing project style.
- Keep CommonJS where the surrounding backend code is still CommonJS.
- Avoid broad formatting churn.
- Add comments only where they clarify non-obvious behavior or migration decisions.
- Keep docs factual and task-oriented.
