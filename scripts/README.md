# Support Scripts

These scripts are outside the main Bun runtime path.

- `admin/` contains local database recovery and maintenance commands exposed through `package.json`.
- `dev/` contains small local helper servers for monitor development.
- `runtime/` contains the Docker healthcheck entrypoint copied into the production image.
- `test/` contains test harness helpers used by Playwright.

Runtime data that the server reads directly lives under `src/server/assets/`.
