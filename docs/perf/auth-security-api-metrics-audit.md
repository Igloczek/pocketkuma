# Auth, API key, and metrics security benchmark

Date: 2026-07-13 (Europe/Warsaw)

## Scope

This is a local, source-runtime security benchmark for authenticated `/metrics` rendering. It verifies that the
Prometheus response is filtered by the authenticated user and that monitor URL credentials/query secrets are not
published. It also records the small local timing, response-size, and RSS measurements produced by the same harness.

No public network, LXC, Docker, SSH, or remote service was used. The monitor URLs use `example.invalid`; only the
local push endpoint is called.

## Revisions

- Before runtime: `209259b1010fe9e7d4680c66393b228638885e7a`
- After runtime: `0859db97ef4a5125828366e2794334b0dd7cd66d`

The benchmark/docs commit following `0859db97` contains only this harness and report; it does not change runtime
source. The exact repository SHA is recorded in the final handoff.

Both measured revisions used Bun `1.3.14` on macOS arm64 and the same installed dependencies. The baseline was a
detached local worktree. Each sample used a fresh temporary SQLite database and a fresh server process.

## Repo-native harness

The deterministic harness is [scripts/benchmark/auth-security-api-metrics.ts](/Users/igloczek/Sites/pocketkuma/scripts/benchmark/auth-security-api-metrics.ts).
For each sample it boots once to create the SQLite schema, inserts exactly two Argon2id users and two active `push`
monitors owned by different users, boots again, sends one real local `/api/push/:token` sample per monitor, warms each
authenticated metrics request once, then measures one concurrent pair of full-body `GET /metrics` responses. It records
ownership booleans, response bytes, per-user latency, pair latency, and RSS before/after the measured pair.

Baseline preparation and identical runs:

```bash
git worktree add --detach /tmp/pocketkuma-baseline-auth 209259b1010fe9e7d4680c66393b228638885e7a
ln -s "$PWD/node_modules" /tmp/pocketkuma-baseline-auth/node_modules
(cd /tmp/pocketkuma-baseline-auth && bun run build:frontend)
bun scripts/benchmark/auth-security-api-metrics.ts \
  --repo=/tmp/pocketkuma-baseline-auth --samples=3 \
  > /tmp/pocketkuma-auth-metrics-before.jsonl
bun scripts/benchmark/auth-security-api-metrics.ts \
  --repo="$PWD" --samples=3 --expect-isolated=1 \
  > /tmp/pocketkuma-auth-metrics-after.jsonl
```

`--expect-isolated=1` makes the final run fail if either user sees the other user's monitor or if the URL secret is
present. The baseline is deliberately run without that assertion so its failure is captured as data.

## Median summary

| Runtime revision | owner A (ms) | owner B (ms) | pair (ms) | response bytes | RSS before/after (KiB) | ownership   | URL secrets  |
| ---------------- | -----------: | -----------: | --------: | -------------: | ---------------------: | ----------- | ------------ |
| Before `209259b` |       70.075 |       82.188 |    82.247 |          1,622 |      154,848 / 220,560 | both leaked | both present |
| After `0859db9`  |       77.676 |       80.313 |    80.378 |          1,118 |      154,720 / 253,216 | isolated    | absent       |

The median response body is 504 bytes smaller after filtering/redaction. Timing and RSS are intentionally reported as
local microbenchmark observations, not capacity claims; the endpoint includes password verification and process-level
allocation noise.

## Raw samples

Before:

```json
{"revision":"209259b1010fe9e7d4680c66393b228638885e7a","sample":1,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":70.075,"bytes":1622,"owned":"benchmark-a-1","ownedPresent":true,"foreignPresent":true,"secretsPresent":true},"ownerB":{"milliseconds":82.188,"bytes":1622,"owned":"benchmark-b-1","ownedPresent":true,"foreignPresent":true,"secretsPresent":true},"pairMilliseconds":82.247,"rssBeforeKB":154848,"rssAfterKB":220528}
{"revision":"209259b1010fe9e7d4680c66393b228638885e7a","sample":2,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":73.523,"bytes":1622,"owned":"benchmark-a-2","ownedPresent":true,"foreignPresent":true,"secretsPresent":true},"ownerB":{"milliseconds":83.034,"bytes":1622,"owned":"benchmark-b-2","ownedPresent":true,"foreignPresent":true,"secretsPresent":true},"pairMilliseconds":83.101,"rssBeforeKB":154944,"rssAfterKB":220624}
{"revision":"209259b1010fe9e7d4680c66393b228638885e7a","sample":3,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":68.936,"bytes":1622,"owned":"benchmark-a-3","ownedPresent":true,"foreignPresent":true,"secretsPresent":true},"ownerB":{"milliseconds":80.874,"bytes":1622,"owned":"benchmark-b-3","ownedPresent":true,"foreignPresent":true,"secretsPresent":true},"pairMilliseconds":80.929,"rssBeforeKB":154848,"rssAfterKB":220560}
```

After:

```json
{"revision":"0859db97ef4a5125828366e2794334b0dd7cd66d","sample":1,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":82.015,"bytes":1118,"owned":"benchmark-a-1","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"ownerB":{"milliseconds":85.413,"bytes":1118,"owned":"benchmark-b-1","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"pairMilliseconds":85.48,"rssBeforeKB":154960,"rssAfterKB":253456}
{"revision":"0859db97ef4a5125828366e2794334b0dd7cd66d","sample":2,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":74.904,"bytes":1118,"owned":"benchmark-a-2","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"ownerB":{"milliseconds":77.23,"bytes":1118,"owned":"benchmark-b-2","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"pairMilliseconds":77.29,"rssBeforeKB":154720,"rssAfterKB":253216}
{"revision":"0859db97ef4a5125828366e2794334b0dd7cd66d","sample":3,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":77.676,"bytes":1118,"owned":"benchmark-a-3","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"ownerB":{"milliseconds":80.313,"bytes":1118,"owned":"benchmark-b-3","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"pairMilliseconds":80.378,"rssBeforeKB":154272,"rssAfterKB":252736}
```

## Limits

This is a single-process local microbenchmark, not a throughput, multi-core, or long-running memory test. Password
verification is part of the timed request, so the numbers do not isolate only the SQL ownership query and line filter.
RSS is sampled with `ps` around one request pair and is noisy. The security assertions are the meaningful result: the
baseline admits cross-user monitor data and URL secrets, while the final run passes the same harness with isolation
required.
