# Xivgear Developer Documentation

## Project Structure

The project uses `pnpm` to manage multiple typescript modules. Each module is in the `packages` directory.

The modules which serve as entry points are:

- frontend: the client-side HTML/CSS/JS for xivgear.app
- math-frontend: the client-side HTML/CSS/JS for xivgear.app/math
- backend-resolver: contains two server-side JS components
    - preview_server: injects social media previews for xivgear URLs
    - stats_server: provides the stats API. Not used by the frontend, but is a public API.

The modules which serve as libraries are:

- common-ui: common client-side JS (used by frontend and math-frontend)
- core: contains most of the core sheet logic
- i18n: provides a small amount of translation logic (for item names and such)
- sims: contains the DPS simulations
- util: utilities which are not dependent on frontend types
- xivmath: contains most of the math for stat and damage calculations

Take care to not use browser-specific types outside of packages which are intended for the browser.

Finally, these are auto-generated API clients:

- account-service-client: account management
- data-api-client: item/class/etc data
- user-data-client: user data (preferences and saved sheets) management

## Other Repos

In addition to the projects in this repo, there are other relevant repos as well:

- [Static BiS](https://github.com/xiv-gear-planner/static-bis-sets): Contains the data for the 'bis' URLs
- [Storage Server](https://github.com/xiv-gear-planner/gear-planner-server): Storage for publicly published sets.
- [Account Service](https://github.com/xiv-gear-planner/account-service): Java Microservice for account management.
- [User Storage Service](https://github.com/xiv-gear-planner/user-storage-service): Java Microservice for preferences
  and personal sets storage.
- [Data API](https://github.com/xiv-gear-planner/xivgear-data-api): Provides data consumed by data-api-client (items,
  food, detailed class data, etc)
    - Note that *some* class data is still hardcoded within the frontend
- [xivapi-java](https://github.com/xiv-gear-planner/xivapi-java): Java library for Xivapi. Used by data API. Publicly
  published on Maven Central.
- [java-common-libs](https://github.com/xiv-gear-planner/java-common-libs): Other Java libraries (logging), used by the
  Java-based backend components. Not publicly published.
- [deployment](https://github.com/xiv-gear-planner/deployment): Helm chart monorepo.

## Architectural Guidance

- Use TS instead of JS where possible.
- Keep server-side TS/JS to a minimum in favor of Java - use it only when the goal is to run isomorphic code (i.e. when
  the goal is to run the same code on the client and server).
- Keep server-side load to a minimum. Try to do as much as possible on the client-side.
- Keep load times and subsequent user interactions fast. Do not use bloated client-side frameworks.

### Client-Side Architecture

The browser-side code is an SPA. It will intercept same-origin URL changes and display different content accordingly.
The server *can* be static HTML/CSS/JS (such as for local development), but in production it uses the preview server
to inject OpenGraph metadata (for Discord previews and such).

Client-side code should:

- Be performant.
- Not pull in large libraries to perform simple tasks.
- Use async chunk loading where applicable (e.g. sims).
- Gracefully handle failures.
- Use auto-generated API clients instead of manually-written API clients where possible.
- Use cacheable API requests where possible.
- Not require an account for anything other than things that legitimately require an account.

#### WebWorkers

Use webworkers to offload tasks that would:

- Hang the UI significantly, or
- Benefit greatly from parallelism.

Currently, the meld/food solver uses WebWorkers to offload and parallelize work. See [SOLVER](./SOLVER.md) for more
information.





