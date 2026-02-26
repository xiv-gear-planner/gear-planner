FROM node:24-alpine as build

# Don't install node via pnpm
ENV PNPM_USE_NODE_VERSION=""

RUN npm install -g pnpm

WORKDIR /build
COPY . .
RUN pnpm install

# Only build modules which are actually needed for this part of the project.
RUN pnpm --filter @xivgear/backend-resolver build

RUN pnpm test

# To be run from project root
FROM node:24-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY --from=build /build /app
EXPOSE 30000

# Don't install node via pnpm
ENV PNPM_USE_NODE_VERSION=""

# -T == transpile only. Reduces memory usage.
CMD pnpm --filter @xivgear/backend-resolver exec ts-node -T ./src/server.ts
