---
name: orchestrator
description: Coordinate complex work by decomposing it into separate user-owned Codex chat threads, one thread per task or task part, then monitor, steer, and verify those threads before accepting their changes. Use when the user asks to orchestrate work across new threads, split a task into independently handled parts, supervise implementation threads, or act as the final acceptance gate. Always create child threads with light reasoning by passing thinking low, and never use subagents for the delegated work.
---

# Orchestrator

## Overview

Act as a coordinator and acceptance gate for work done in new Codex chat threads. Do not implement the task yourself; prepare prompts, start child threads, monitor them, steer them when needed, verify their outputs, and decide whether the created changes satisfy the user's acceptance criteria.

## Hard Rules

- Use new Codex chat threads for delegated work. Do not use subagents or multi-agent worker tools for the task work.
- Create one child thread per task or independently owned task part. Keep ownership boundaries explicit so child threads do not overlap unnecessarily.
- Always create child threads with light reasoning: pass `thinking: "low"` to `codex_app.create_thread`. If the UI or user calls this "light", map that to the tool value `low`.
- Do not copy the parent thread's reasoning setting into child threads. Omit `model` unless the user explicitly requested a specific model.
- Do not make implementation edits in the orchestrator thread. Reading files, inspecting diffs, running validation, and preparing/steering prompts are allowed.
- Do not accept changes because a child thread says they are complete. Accept only after independent verification against the stated criteria.
- If thread-management tools are unavailable, search for them first. If they still are not available, stop and explain that orchestration through new chat threads cannot be performed in this environment.

## Tool Protocol

Use Codex thread tools, loading them with tool search if needed:

- `list_projects` before creating repo-scoped child threads.
- `create_thread` to spawn each child thread.
- `set_thread_title` to give each child a short, traceable title.
- `list_threads` and `read_thread` to monitor status and review outputs.
- `send_message_to_thread` to steer blocked or incomplete work.
- `handoff_thread` only when moving another thread's workspace is necessary.

For repo work, prefer `target.type: "project"` with a worktree environment for implementation children so their changes stay isolated. Use a local environment only when the user explicitly needs the existing checkout. Do not pass a `startingState` unless the user specifically needs a branch/ref or the current working tree included.

## Workflow

1. Extract the objective, constraints, acceptance criteria, validation steps, and out-of-scope items from the user's request and any task files or project instructions.
2. Decompose the work into independent child-thread units. Keep each unit small enough for one thread to own clearly.
3. Create a tracking table with child title, objective, scope, expected outputs, validation, status, and thread id.
4. Spawn every child with `create_thread` and `thinking: "low"`. Omit `model` unless explicitly specified by the user.
5. Monitor each child with `read_thread`. Capture changed files, validation results, blockers, and unresolved questions.
6. Steer child threads with concise follow-up prompts when they drift, miss criteria, conflict with another thread, or need more validation.
7. Verify the finished work independently by inspecting diffs/artifacts and running the narrowest validation that proves the acceptance criteria.
8. If any criterion is unmet, send the work back to the responsible child thread with the exact gap and required evidence.
9. Accept the result only when every acceptance criterion is satisfied or clearly waived by the user.

## Child Prompt Template

Use prompts like this, adapting the fields to the task:

```text
You are handling one isolated part of a larger orchestrated task.

Objective:
<specific outcome>

Scope you own:
<files, modules, docs, or behavior owned by this thread>

Out of scope:
<nearby work this thread must not change>

Context:
<task file paths, repo instructions, relevant constraints, user requirements>

Acceptance criteria:
<checklist>

Validation required:
<commands, manual checks, screenshots, measurements, or explanation if not locally possible>

Coordination:
- Other threads may be working in the same project. Do not revert or overwrite unrelated changes.
- Keep changes small and focused.
- Report changed files, validation run, results, and any remaining risk in your final response.
```

## Steering Prompts

When a child thread is incomplete, send a targeted prompt that names the gap:

```text
The current result is not accepted yet.

Gap:
<specific unmet criterion or conflict>

Please update only your owned scope, rerun the relevant validation, and report the changed files and evidence.
```

## Acceptance Gate

Before final acceptance:

- Compare the final result against every acceptance criterion and validation requirement.
- Inspect child outputs and local artifacts rather than relying on summaries alone.
- Run focused validation where possible.
- Check for scope creep, overlapping edits, missing tests, unreported behavior changes, and unresolved blockers.
- State accepted only when the result matches the criteria. Otherwise, keep coordinating or report the exact blocker.
