FROM node:20 as build

WORKDIR /build
COPY . .
RUN npm install
RUN npm run build
RUN npm --workspaces --if-present test

# To be run from project root
FROM node:20
WORKDIR /app
#COPY --from=build /build/packages/backend-resolver/build/src .
#COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build /app
EXPOSE 30000
CMD npx ts-node ./packages/backend-resolver/src/server.ts