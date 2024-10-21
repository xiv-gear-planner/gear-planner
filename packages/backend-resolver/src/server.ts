import * as process from "process";
import {setServerOverride} from "@xivgear/core/external/shortlink_server";
import {setFrontendClient, setFrontendServer} from "./frontend_file_server";
import {buildPreviewServer, buildStatsServer} from "./server_builder";
import {FastifyInstance} from "fastify";
import {setDataApi} from "@xivgear/core/datamanager_new";

let fastify: FastifyInstance;
if (process.env.IS_PREVIEW_SERVER === 'true') {
    console.log('Building preview server');
    fastify = buildPreviewServer();
} else {
    console.log('Building stats server');
    fastify = buildStatsServer();
}

function validateUrl(url: string, description: string) {
    try {
        new URL(url);
    } catch (e) {
        console.error(`Not a valid ${description} URL: '${url}'`, url, e);
        throw e;
    }
}

const backendOverride = process.env.SHORTLINK_SERVER;
if (backendOverride) {
    console.log(`Shortlink server override: '${backendOverride}'`);
    validateUrl(backendOverride, 'shortlink');
    setServerOverride(backendOverride);
}

const frontendServerOverride = process.env.FRONTEND_SERVER;
if (frontendServerOverride) {
    console.log(`Frontend server override: '${frontendServerOverride}';`);
    validateUrl(frontendServerOverride, 'frontend server');
    setFrontendServer(frontendServerOverride);
}

const frontendClientOverride = process.env.FRONTEND_CLIENT;
if (frontendClientOverride) {
    console.log(`Frontend client override: '${frontendClientOverride}';`);
    validateUrl(frontendClientOverride, 'frontend client');
    setFrontendClient(frontendClientOverride);
}

const dataApiOverride = process.env.DATA_API;
if (dataApiOverride) {
    console.log(`Data api override: '${dataApiOverride}';`);
    validateUrl(dataApiOverride, 'data api');
    setDataApi(dataApiOverride);
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
