import * as process from "process";
import {setServerOverride} from "@xivgear/core/external/shortlink_server";
import {setFrontendClient, setFrontendServer} from "./frontend_file_server";
import {buildPreviewServer, buildStatsServer} from "./server_builder";
import {FastifyInstance} from "fastify";

let fastify: FastifyInstance;
if (process.env.IS_PREVIEW_SERVER === 'true') {
    fastify = buildPreviewServer();
}
else {
    fastify = buildStatsServer();
}

const backendOverride = process.env.SHORTLINK_SERVER;
if (backendOverride) {
    console.log(`Shortlink server override: '${backendOverride}'`);
    setServerOverride(backendOverride);
}

const frontendServerOverride = process.env.FRONTEND_SERVER;
if (frontendServerOverride) {
    console.log(`Frontend server override: '${frontendServerOverride}';`);
    setFrontendServer(frontendServerOverride);
}

const frontendClientOverride = process.env.FRONTEND_CLIENT;
if (frontendClientOverride) {
    console.log(`Frontend client override: '${frontendClientOverride}';`);
    setFrontendClient(frontendClientOverride);
}

fastify.listen({
    port: 30000,
    host: '0.0.0.0'
}, (err, addr) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});