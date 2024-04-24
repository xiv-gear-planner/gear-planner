# To be run from project root
FROM node:20
WORKDIR /app
COPY packages/backend-resolver/build/*.js .
COPY node_modules ./node_modules
EXPOSE 30000
CMD node --require ts-node/register server.js