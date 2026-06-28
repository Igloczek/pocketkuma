# 09. Final cleanup

## BUN-090: Remove Node-only runtime paths

Scope:

- After critical tests pass, make Bun the default runtime in runtime docs and Docker release.
- Keep Node only as a documented temporary fallback if needed.

Acceptance criteria:

- Default start uses Bun.
- README and contributor docs describe Bun.
- Docker release uses Bun.
- Any Node fallback is explicitly marked as temporary.

## BUN-091: Remove unused runtime dependencies

Scope:

- Remove dependencies replaced by native Bun APIs.
- Check each dependency before removal to avoid breaking dev/test/full targets.

Acceptance criteria:

- Removed dependencies are listed with reasons.
- `bun install --production --frozen-lockfile` passes.
- Runtime dependency count and lockfile size are lower than baseline.
- Lightweight and full targets work according to documented decisions.

## BUN-092: Write final migration report

Scope:

- Compare baseline, Bun-compatible phase, native Bun phase, and final lightweight target.
- Explain which dependencies were removed and which remain intentionally.

Acceptance criteria:

- Report includes RSS for the 20-monitor scenario.
- Report includes startup time and dependency count.
- Remaining largest memory costs are listed if the target is not reached.
