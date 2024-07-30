FROM node:20 as build

WORKDIR /build
COPY . .
RUN npm ci
# TODO: this step specifically isn't really doing anything, since it's run from the TS files
RUN npm run build

RUN #npm run test

# To be run from project root
FROM node:20
WORKDIR /app
COPY --from=build /build /app
EXPOSE 30000
# -T == transpile only. Reduces memory usage.
CMD npx ts-node -T ./packages/backend-resolver/src/server.ts