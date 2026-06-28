# uptime-buna

`uptime-buna` is my personal fork of Uptime Kuma.

The intent is simple: keep the useful monitoring app shape, but make it lighter by migrating runtime paths from Node.js to Bun where native Bun APIs can reduce memory usage, dependencies, and Docker image weight.

This is not an official Uptime Kuma project, not affiliated with Uptime Kuma, and not meant to compete with it. If you want the stable upstream project, use [Uptime Kuma](https://github.com/louislam/uptime-kuma).

## Status

Work in progress.

The repository still contains a lot of upstream Uptime Kuma code and Node-based tooling. The Bun migration plan is tracked in [`tasks/`](tasks/).

Current direction:

- establish repeatable memory benchmarks;
- run the existing app under Bun compatibility first;
- replace selected runtime pieces with native Bun APIs;
- reduce heavy dependencies and optional monitor loading;
- keep the app recognizable instead of rewriting it from scratch.

## Current local development

The app is still mostly the inherited Uptime Kuma codebase.

```bash
npm ci
npm run dev
```

Backend only:

```bash
node server/server.js
```

The current backend listens on port `3001` by default. The frontend dev server uses port `3000`.

## Bun migration backlog

Start here:

- [`tasks/README.md`](tasks/README.md)
- [`tasks/00-baseline-and-guardrails.md`](tasks/00-baseline-and-guardrails.md)

The first real implementation task is to create a repeatable baseline for memory usage before changing runtime behavior.

## Support and contributions

There is no formal support, roadmap, contribution process, issue triage, or release promise.

I may push whatever I find useful. If somebody finds this repository useful, they can use it, fork it, or copy ideas from it under the license terms.

## License and attribution

This project is based on Uptime Kuma, originally created by Louis Lam and contributors.

The inherited code is under the MIT license. See [`LICENSE`](LICENSE).
