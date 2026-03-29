FROM node:24-alpine as build

RUN npm install -g pnpm@9

WORKDIR /build
COPY . .
# Override use-node-version from root .npmrc — pnpm must not try to download
# a glibc Node.js binary inside an Alpine (musl) container. This was causing
# pipeline failures.
RUN echo "use-node-version=" >> .npmrc
RUN pnpm install

# Only build modules which are actually needed for this part of the project.
RUN pnpm --filter @xivgear/backend-resolver build

RUN pnpm test

# To be run from project root
FROM node:24-alpine
RUN npm install -g pnpm@9
WORKDIR /app
COPY --from=build /build /app
EXPOSE 30000

# -T == transpile only. Reduces memory usage.
CMD pnpm --filter @xivgear/backend-resolver exec ts-node -T ./src/server.ts
