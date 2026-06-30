#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

echo "==> git status"
git status --short

echo "==> git add"
git add -A

echo "==> git commit"
git commit -m "Rename project from Uptime Buna to PocketKuma" || true

echo "==> git push"
git push origin master

echo "==> bun install"
bun install --frozen-lockfile

echo "==> lint"
bun run lint

echo "==> build"
bun run build

echo "==> test:backend"
bun run test:backend

echo "==> done"
git status --short