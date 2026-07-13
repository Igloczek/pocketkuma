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
- Previous runtime implementation commit: `0859db97ef4a5125828366e2794334b0dd7cd66d`
- Final security-fix tree measured: `6151edc5baf375138b96c2b0c1296ee42d63c4d9`

The final measured tree adds bounded credential-admission fallback, removes the production hash trace hooks, and fixes
modal lifecycle handling. This report commit follows the measured code commit; the reported SHA is the exact runtime
tree used for the samples.

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
| After `6151edc`  |       78.631 |       82.289 |    82.362 |          1,118 |      157,568 / 256,064 | isolated    | absent       |

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

After (final `6151edc`, command above with `--expect-isolated=1`):

```json
{"revision":"6151edc5baf375138b96c2b0c1296ee42d63c4d9","sample":1,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":78.631,"bytes":1118,"owned":"benchmark-a-1","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"ownerB":{"milliseconds":82.289,"bytes":1118,"owned":"benchmark-b-1","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"pairMilliseconds":82.362,"rssBeforeKB":157600,"rssAfterKB":256080}
{"revision":"6151edc5baf375138b96c2b0c1296ee42d63c4d9","sample":2,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":78.111,"bytes":1118,"owned":"benchmark-a-2","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"ownerB":{"milliseconds":80.341,"bytes":1118,"owned":"benchmark-b-2","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"pairMilliseconds":80.422,"rssBeforeKB":157392,"rssAfterKB":255888}
{"revision":"6151edc5baf375138b96c2b0c1296ee42d63c4d9","sample":3,"users":2,"monitors":2,"pushStatuses":[200,200],"ownerA":{"milliseconds":94.424,"bytes":1118,"owned":"benchmark-a-3","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"ownerB":{"milliseconds":101.448,"bytes":1118,"owned":"benchmark-b-3","ownedPresent":true,"foreignPresent":false,"secretsPresent":false},"pairMilliseconds":101.52,"rssBeforeKB":157568,"rssAfterKB":256064}
```

## Credential-admission churn measurement

The regression test first exhausts an exact credential bucket, then churns 1,001 foreign identities. Before
`6151edc`, the bounded LRU evicted the target: the next request was admitted (`false` → `true` in the RED proof), so
the next 20 target attempts again reached credential verification. After the fix, all 20 are denied at admission and
reach zero verifications. The hot exact map remains capped at 100 entries. When all 100 are protected, the fallback is
two fixed 4,096-bucket token arrays: one keyed by a process-randomized identity hash and one keyed by source. Thus
the maximum credential-admission state is 16,584 buckets: the login and API-key limiters each have 100 exact buckets
and two fixed 4,096-bucket arrays. This is independent of churn; a success resets only its exact identity bucket,
never the fixed fallback.

The native gate covers present targets, full-capacity late targets, 1,001-identity churn, valid-credential reset
attempts, and one target across distinct sources. The production integration gate additionally covers WebSocket,
HTTP Basic, and API-key identity churn with 101 foreign identities per protocol path.

The fixed identity hash and source fallback are process-randomized. A collision can produce a bounded false-positive
throttle within one window; it cannot evict or reset a target's aggregate fallback penalty, and is not a shared global
overflow bucket. This is the remaining bounded collision trade-off for fixed memory.

## Limits

This is a single-process local microbenchmark, not a throughput, multi-core, or long-running memory test. Password
verification is part of the timed request, so the numbers do not isolate only the SQL ownership query and line filter.
RSS is sampled with `ps` around one request pair and is noisy. The security assertions are the meaningful result: the
baseline admits cross-user monitor data and URL secrets, while the final run passes the same harness with isolation
required.
