# 06. Native Bun runtime APIs and small dependencies

## BUN-060: Move password hashing to `Bun.password`

Scope:

- Use native Bun password hashing for new hashes if it supports the required algorithm.
- Preserve verification for existing `password-hash` and `bcryptjs` hashes.
- Consider rehash-on-login if safe.

Files to inspect:

- `server/password-hash.js`
- `server/auth.js`
- `server/server.js`
- `server/model/user.js`

Acceptance criteria:

- Existing accounts can log in without password reset.
- New passwords are stored through the target mechanism.
- Old hashes can be rehashed safely after login, or the reason not to do it is documented.
- `password-hash` and/or `bcryptjs` are removable if unused.

## BUN-061: Replace simple child_process usage with `Bun.spawn` or Bun Shell

Scope:

- Review `child_process`, `promisify-child-process`, `command-exists`, and `node-ssh` usage.
- Move simple local commands to `Bun.spawn` or Bun Shell.
- Avoid migrating release scripts unless they are part of the runtime target.

Files to inspect:

- `server/database.js`
- `server/monitor-types/system-service.js`
- `server/monitor-types/real-browser-monitor-type.js`
- `extra/*.js`
- `extra/release/*.mjs`

Acceptance criteria:

- `promisify-child-process` and `command-exists` are removable or documented as still needed.
- System-service monitor works on Linux.
- macOS and Windows behavior is tested or documented as follow-up work.

## BUN-062: Replace ping dependency if measurement supports it

Scope:

- Measure the cost of `@louislam/ping`.
- If worthwhile, use `Bun.spawn` to call system `ping` with per-platform parsing.
- Preserve IPv4/IPv6 fallback, timeout, count, packet size, and numeric mode.

Files to inspect:

- `server/util-server.js`
- `server/model/monitor.js`
- `test/backend-test/`

Acceptance criteria:

- Ping monitor works on Linux and macOS.
- Windows is supported or tracked as a follow-up task.
- Tests cover success, timeout, DNS failure, and IPv6 fallback.
- `@louislam/ping` is removed only after tests pass.

## BUN-063: Review date and cron libraries

Scope:

- Measure whether `dayjs` and `croner` matter for memory or dependency weight.
- Do not replace timezone or maintenance scheduling code without evidence.

Acceptance criteria:

- Memory and transitive dependency cost is recorded.
- Decision is documented: keep, reduce imports, or replace.
- Maintenance window and timezone tests pass.
