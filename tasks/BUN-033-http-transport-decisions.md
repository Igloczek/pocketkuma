# BUN-033: HTTP Transport Decisions

## Objective

Make explicit architecture decisions for special HTTP behavior before axios is removed.

## Context

Native `fetch` may not cover every behavior currently implemented with axios and Node agents. Risk areas include proxy support, mTLS, NTLM, cookies, Docker Unix sockets, and TLS certificate extraction.

## Scope

- Investigate:
  - HTTP proxy;
  - HTTPS proxy;
  - SOCKS proxy;
  - mTLS;
  - NTLM;
  - cookie jar behavior;
  - Docker API over Unix socket;
  - TLS certificate extraction.
- For each area, choose one decision:
  - native Bun/fetch;
  - keep axios for this path;
  - implement a focused compatibility adapter;
  - make the feature optional/full-only.
- Save results in `docs/http-transport-decisions.md`.

## Out of Scope

- Implementing all decisions.
- Removing axios.
- Removing features without a separate implementation task.

## Suggested Implementation

1. Create a Markdown decision matrix.
2. Prepare minimal smoke checks where practical:
   - proxy: local proxy or adapter test;
   - mTLS: local test certificate;
   - NTLM: existing provider tests;
   - Unix socket: Docker socket if locally available, otherwise document the blocker.
3. Check current Bun behavior and limitations.
4. For each decision, document risk and implementation follow-up.

## Files to Inspect

- `server/model/monitor.js`
- `server/proxy.js`
- `server/modules/axios-ntlm/`
- `server/docker.js`
- `server/monitor-types/tcp.js`
- `docs/http-transport-decisions.md`

## Validation

```bash
npm run test-backend
rg -n "proxy|ntlm|mtls|CookieJar|socketPath|checkCertificate" server
```

Validation for this task is the decision document plus smoke checks, not full migration.

## Acceptance Criteria

- `docs/http-transport-decisions.md` exists.
- It contains a decision for every listed transport area.
- Every decision includes justification and risk.
- Every decision has a follow-up task or an explicit "keep axios" status.
- Production behavior for special transports is unchanged.

## Completion Evidence

Link to the decision matrix and list the areas blocking full axios removal.
