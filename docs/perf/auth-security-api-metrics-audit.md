# Auth, API key, and metrics security benchmark

Date: 2026-07-13 (Europe/Warsaw)

## Scope

This benchmark covers the security hot paths changed by the auth/API-key/metrics audit:

- password login over the production Bun WebSocket protocol, including persistent session issuance;
- authenticated `/metrics` rendering, including API principal ownership filtering;
- resident memory after both workloads.

No public network, LXC, Docker, SSH, or remote service was used.

## Revisions

- Before: `209259b1010fe9e7d4680c66393b228638885e7a`
- After: `c58816809d9d79e0d8e8a8876305cef5dc0a74ad`

Both revisions used Bun `1.3.14` on macOS arm64. The baseline was a detached local worktree. Both used the same installed dependencies and locally built frontend assets; the measured backend source files came from the exact revisions above.

## Harness

The identical `/tmp/pocketkuma-auth-benchmark.ts` harness ran each revision three times. Every sample used a fresh temporary SQLite database and process, then performed:

1. local server startup and initial setup;
2. one warm-up login;
3. five sequential successful password logins over `/ws`;
4. ten sequential HTTP Basic-authenticated `GET /metrics` requests, including full body reads;
5. an RSS sample from `ps`;
6. process and data-directory cleanup.

Commands:

```bash
bun /tmp/pocketkuma-auth-benchmark.ts /tmp/pocketkuma-auth-baseline
bun /tmp/pocketkuma-auth-benchmark.ts /Users/igloczek/Sites/pocketkuma
```

## Results

| Revision          | 5 logins (ms) | 10 metrics renders (ms) |  RSS (KiB) |
| ----------------- | ------------: | ----------------------: | ---------: |
| Before sample 1   |       291.797 |                 573.815 |     199936 |
| Before sample 2   |       288.834 |                 572.731 |     199776 |
| Before sample 3   |       289.716 |                 570.178 |     199616 |
| **Before median** |   **289.716** |             **572.731** | **199776** |
| After sample 1    |       308.842 |                 617.882 |     199216 |
| After sample 2    |       288.834 |                 580.964 |     199520 |
| After sample 3    |       289.976 |                 573.350 |     199456 |
| **After median**  |   **289.976** |             **580.964** | **199456** |
| **Median change** |    **+0.09%** |              **+1.44%** | **-0.16%** |

The login median is effectively unchanged. The metrics median increased by 8.233 ms across ten requests (about 0.823 ms per request) for the ownership lookup and sample filtering. RSS did not regress.

## Limits

This is a local source-runtime microbenchmark, not a capacity or multi-core load test. Compiled executable behavior is covered separately by the full auth/security integration suite, but compiled performance was not compared because the baseline executable did not contain a passing API-key lifecycle.
