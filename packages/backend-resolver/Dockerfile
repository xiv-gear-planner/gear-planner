FROM node:20
WORKDIR /app
COPY backend-resolver-1.0.0.tgz .
RUN tar -xzf backend-resolver-1.0.0.tgz
WORKDIR /app/package
RUN npm install
EXPOSE 30000
CMD node --require ts-node/register src/server.ts