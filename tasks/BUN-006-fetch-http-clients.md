# BUN-006: Outbound HTTP Through Native `fetch`

## Objective

Remove Axios-style runtime weight by moving outbound HTTP paths to native `fetch`.

## Scope

- Add one internal HTTP client wrapper around `fetch`.
- Migrate core HTTP, keyword, JSON-query, and API monitor requests.
- Migrate simple notification providers that only need standard HTTP.
- Preserve timeout, redirect, headers, body, status-code validation, and response-size behavior.
- Explicitly remove or document advanced inherited features that are not worth carrying in this Bun-first fork, such as NTLM or unusual proxy/mTLS combinations.
- Remove `axios` once no runtime path uses it.

## Out of Scope

- Rewriting every notification provider if a provider needs a separate task-level decision.
- Reintroducing heavy HTTP dependencies to match upstream edge cases.

## Validation

```bash
bun run bun:test:backend
bun run bun:build
rg -n "axios|got|node-fetch|fetch\\(" server src package.json
```

Add or update focused tests with a local HTTP server for success, timeout, redirect, HTTP error body, and keyword matching.

## Acceptance Criteria

- Core HTTP monitor paths use the internal fetch wrapper.
- Simple notification providers use the wrapper or native `fetch`.
- Axios is removed or has a specific remaining call-site blocker.
- Any intentionally dropped advanced transport behavior is documented in the task completion notes.

## Completion Evidence

Report the wrapper contract, migrated monitor/provider paths, and the Axios removal status.
