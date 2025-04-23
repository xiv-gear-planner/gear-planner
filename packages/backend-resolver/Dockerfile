FROM node:20 as build

WORKDIR /build
COPY . .
RUN npm ci

# Only build modules which are actually needed for this part of the project.
RUN npm run -w @xivgear/backend-resolver build

RUN npm run test

# To be run from project root
FROM node:20
WORKDIR /app
COPY --from=build /build /app
EXPOSE 30000
# -T == transpile only. Reduces memory usage.
CMD npx ts-node -T ./packages/backend-resolver/src/server.ts