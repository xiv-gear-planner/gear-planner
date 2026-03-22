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

### WebStorm (and other JetBrains products)

In WebStorm, you can simply right-click the `packages/frontend/dist/index.html` file, and select Open In > Browser.

### VS Code

In VS Code, you can use addons such as 
[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) to do the equivalent.
The file to open is `packages/frontend/dist/index.html`.