# BUN-008: Bun Default Runtime and Dependency Pruning

## Objective

Make Bun the default production runtime and remove the Node-era compatibility layers that are no longer needed.

## Scope

- Make `bun run start` the documented and packaged production command.
- Update Dockerfiles to use Bun and remove Node base images.
- Remove unused runtime dependencies and lockfile entries.
- Remove temporary Express, Socket.IO, Redbean/Knex/sqlite3, Axios, bcrypt, dotenv, and process-helper compatibility paths after previous tasks make them unused.
- Keep only documentation that reflects the personal Bun fork.
- Add a final local smoke checklist for install, build, start, login, monitor creation, status updates, and SQLite persistence.

## Out of Scope

- Publishing upstream-compatible release artifacts.
- Adding GitHub Actions or public support processes.
- Reintroducing npm as the default package manager.

## Validation

```bash
bun install --frozen-lockfile
bun run build
bun run test:backend
bun run start -- --port=3007 --data-dir=./data/bun-final-smoke
rg -n "node server/server.js|express|socket.io|@louislam/sqlite3|redbean|knex|axios|bcrypt|dotenv|args-parser" package.json server src extra Dockerfile* README.md
docker image inspect <image-name> --format '{{.Size}}'
```

Only run the Docker image-size command after building the final Bun image.

## Acceptance Criteria

- Bun is the default install and runtime path.
- The Docker runtime image uses Bun, not Node.
- Removed dependencies no longer appear in `package.json` or the lockfile.
- The app can start, create a user, add a monitor, update status over native WebSocket, and persist data in SQLite.
- Any remaining Node-era dependency has a written reason and a follow-up task, not a silent leftover.

## Completion Evidence

Report the final start command, Docker image size, removed dependencies, and the final smoke checklist result.
