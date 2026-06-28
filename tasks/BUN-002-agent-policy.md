# BUN-002: Local Agent Working Policy

## Objective

Keep repository instructions aligned with task-based work: small changes, explicit validation, and no broad undocumented refactors.

## Context

The repository can use AI assistance, but task implementation must be locally verifiable and understandable. Instructions should define how to work, not embed a roadmap.

## Scope

- Ensure `AGENTS.md` describes agent workflow only.
- Ensure task implementation rules point to one `tasks/BUN-*.md` file at a time.
- Require validation appropriate to the touched area.
- Require measurements for runtime-impacting changes.
- Remove or avoid duplicate agent instruction files that conflict with `AGENTS.md`.

## Out of Scope

- Creating community contribution rules.
- Creating a security policy.
- Creating pull request or issue templates.

## Suggested Implementation

1. Read `AGENTS.md`.
2. Remove roadmap-specific or scope-specific wording from `AGENTS.md`.
3. Keep general rules:
   - read code before editing;
   - keep changes small;
   - follow the selected task file;
   - validate changes;
   - measure runtime-impacting work.
4. Check for competing agent files such as Claude/Copilot instruction files.
5. Delete or reduce duplicate files to pointers only if needed.

## Files to Inspect

- `AGENTS.md`
- `tasks/README.md`
- `README.md`

## Validation

Run:

```bash
rg -n "tasks/|BUN-|measurement|validation" AGENTS.md tasks/README.md
find . -maxdepth 2 -iname '*claude*' -o -iname '*copilot*'
```

## Acceptance Criteria

- `AGENTS.md` contains working rules, not a project roadmap.
- `AGENTS.md` instructs agents to follow one selected task file at a time.
- No second active agent-instruction file contains conflicting rules.
- The document does not contain upstream community policy, threats, or pull request process text.

## Completion Evidence

Report which instruction files were checked and whether competing instructions remain.
