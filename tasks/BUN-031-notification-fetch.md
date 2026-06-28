# BUN-031: Simple Notification Providers Through Native `fetch`

## Objective

Move a small selected group of simple notification providers from axios to the HTTP adapter backed by native `fetch`.

## Context

Many notification providers perform simple GET/POST requests without proxy agents, upload handling, or special transports. They are a good first target for reducing axios usage.

## Scope

- Select 5 to 10 simple providers.
- For each selected provider, document why it is simple:
  - no proxy agent;
  - no FormData/upload;
  - no NTLM;
  - no custom socket behavior.
- Move those providers to the BUN-030 adapter.
- Add tests or mock smoke checks for each selected provider.

## Out of Scope

- Providers using `form-data`.
- Providers requiring proxy agents.
- Providers with special authentication or custom transports.
- Removing axios.

## Suggested Implementation

1. Run `rg -n "axios" server/notification-providers`.
2. Select providers with the simplest payloads.
3. Record selected providers in `docs/http-client-migration.md`.
4. Replace request code with the adapter.
5. Preserve existing error messages.
6. Add a test with a local mock server or mocked adapter.

## Files to Inspect

- `server/notification-providers/*`
- `server/notification-providers/notification-provider.js`
- `server/http-client.js`
- `test/backend-test/notification-providers/`

## Validation

```bash
npm run test-backend
rg -n "axios" server/notification-providers
```

Run tests or smoke checks for every changed provider.

## Acceptance Criteria

- Only providers listed in the task output are changed.
- Every changed provider has a test or documented smoke check.
- The number of axios usages in `server/notification-providers` decreases.
- Non-2xx error behavior remains consistent with existing UI/log behavior.
- Providers outside the selected set are not refactored.

## Completion Evidence

Report the provider list, the before/after axios usage count, and test results.
