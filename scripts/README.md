# Support Scripts

These scripts are outside the main release binary path.

- `admin/` contains local database recovery and maintenance commands exposed through `package.json`.
- `build/` generates embedded frontend assets and compiles the release executable.
- `dev/` contains small local helper servers for monitor development.
- `test/` contains test harness helpers used by Playwright.

Runtime data that the server reads directly lives under `src/server/assets/`.
