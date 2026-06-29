# BUN-012: Root Docker Files

## Objective

Move Docker runtime files to the project root so container build and compose entrypoints are discoverable without a `docker/` subdirectory.

## Scope

- Move the production Dockerfile to the project root with a conventional name.
- Move compose defaults to the project root.
- Move supporting Docker context files that are still needed by root Dockerfiles.
- Update package scripts, README, docs, and references to the new Docker paths.
- Remove obsolete `docker/` paths after all references are updated.

## Out of Scope

- Changing application runtime behavior.
- Tailwind or TypeScript work.
- Adding GitHub Actions or release automation.

## Validation

```bash
bun run build
docker compose config
docker compose build
docker image inspect uptime-buna:bun-final --format '{{.Size}}'
```

Run a compose smoke with an isolated data directory and non-default host port.

## Acceptance Criteria

- A root `Dockerfile` builds the Bun production runtime image.
- Root `compose.yaml` builds that local Dockerfile by default.
- No package script or documentation points at stale `docker/dockerfile` runtime paths.
- Docker image size is recorded.

## Completion Evidence

Report moved files, removed stale paths, Docker image size, compose smoke result, and any remaining non-root Docker helper exceptions.
