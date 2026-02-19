FROM node:20 as build

RUN npm install -g pnpm

WORKDIR /build
COPY . .
RUN pnpm install

# Only build modules which are actually needed for this part of the project.
RUN pnpm --filter @xivgear/backend-resolver build

RUN pnpm test

# To be run from project root
FROM node:20
RUN npm install -g pnpm
WORKDIR /app
COPY --from=build /build /app
EXPOSE 30000
# -T == transpile only. Reduces memory usage.
CMD pnpm --filter @xivgear/backend-resolver exec ts-node -T ./src/server.ts
