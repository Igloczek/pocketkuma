# BUN-009: Oxlint and Oxfmt Tooling

## Objective

Replace inherited ESLint and Prettier defaults with Oxlint and Oxfmt as the JavaScript, TypeScript, Vue, and formatting toolchain.

## Scope

- Replace `eslint`, `prettier`, and their direct configuration files with Oxlint/Oxfmt equivalents.
- Update `package.json` scripts so `bun run lint` and `bun run fmt` use Oxlint/Oxfmt.
- Keep style linting for the existing Vue/CSS/SCSS surface.
- Preserve useful ignore patterns from existing lint/format configs.
- Keep changes limited to tooling and generated lockfile updates.

## Out of Scope

- Tailwind migration.
- TypeScript source migration.
- Broad formatting churn unrelated to the configured formatter.
- Rewriting application code solely to satisfy new lint rules unless the rule is a clear bug catch.

## Validation

```bash
bun install --frozen-lockfile
bun run lint
bun run fmt -- --check
bun run build
bun run test:backend
```

If Oxfmt does not support a needed check mode, document the closest supported validation command and avoid silently keeping Prettier.

## Acceptance Criteria

- `package.json` no longer has direct `eslint`, `prettier`, or ESLint/Prettier plugin/config dependencies.
- `.eslintrc.js` and `.prettierrc.js` are removed or replaced with Oxlint/Oxfmt config files.
- `bun run lint` runs Oxlint for JS/TS/Vue code.
- `bun run fmt` runs Oxfmt.
- Remaining stylelint usage is documented as the SCSS lint path.

## Migration Notes

- `stylelint` remains only for the existing Vue/CSS/SCSS surface because the Tailwind migration was intentionally skipped.
- `eslint-plugin-vue-scoped-css` has no direct Oxlint equivalent and is intentionally not replaced here.
- The old JSDoc ESLint rules are not fully mapped because Oxlint's JSDoc plugin does not support the same `require-jsdoc` coverage.
- `no-throw-literal` and `no-unused-expressions` are disabled during this tooling-only migration because inherited tests and short-circuit cleanup patterns currently violate them.

## Completion Evidence

Report the removed dependencies, new scripts/config files, validation commands, and any lint rules that could not be mapped.
