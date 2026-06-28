# BUN-060: Password Hashing Through `Bun.password`

## Objective

Move new password hashes to `Bun.password` while preserving login for existing accounts.

## Context

The project currently uses `password-hash` and `bcryptjs`. Bun has native password hashing, but existing hashes must remain verifiable.

## Scope

- Identify existing hash formats.
- Add or update the password hashing abstraction.
- Use `Bun.password` for new hashes when running on Bun.
- Preserve verification for old hashes.
- Optionally add rehash-on-login if safe.

## Out of Scope

- Forced password resets.
- Changing 2FA behavior.
- Removing old libraries before compatibility is handled.

## Suggested Implementation

1. Inspect `server/password-hash.js`.
2. Add tests for:
   - old `password-hash`;
   - bcrypt;
   - new Bun hash;
   - invalid password.
3. Add `needsRehash(hash)`.
4. On successful login with an old hash, optionally rehash and store the new hash.
5. Remove old libraries only when they are no longer required for verification or migration.

## Files to Inspect

- `server/password-hash.js`
- `server/auth.js`
- `server/server.js`
- `server/model/user.js`
- `test/backend-test/`

## Validation

```bash
npm run test-backend
bun run bun:test-backend
```

Add focused password-hash tests.

## Acceptance Criteria

- Existing hashes still verify.
- New hashes under Bun use `Bun.password`.
- Invalid passwords are rejected.
- Rehash-on-login, if implemented, is tested.
- `password-hash` or `bcryptjs` are removed only if backward compatibility no longer needs them.

## Completion Evidence

Report the new hash type, test results, and the decision for old libraries.
