# Building and Running Locally

## Prerequisites

- Node.js 24.x
- pnpm 9.x

## Building

In a command line, run the following commands:
```shell
# Only needed once, or when dependencies change
pnpm i
# Build/rebuild
pnpm build
# Run tests
pnpm test
# Run Local Dev Server
pnpm serve
# Rebuild CSS - example of running a specific sub-package task
pnpm -F @xivgear/gearplan-frontend less
# See package.json at the top level as well as in each sub-project for more tasks you can run.
```

## Running

### Dev Server

Run `pnpm serve` to run a dev server locally. This handles building and automatic reloading, though you may need
to rebuild CSS manually.

Since this also handles SPA path redirection (i.e. `/foo/bar` will still load `index.html`), this is the only
supported way to run locally, except by building the entire container image.