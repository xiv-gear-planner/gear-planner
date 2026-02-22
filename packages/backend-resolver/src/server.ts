import * as process from "process";
import {setServerOverride} from "@xivgear/core/external/shortlink_server";
import {setFrontendClientPath, setFrontendServer} from "./frontend_file_server";
import {setDataApi} from "@xivgear/core/data_api_client";
import {ServerBase} from "./server_base";
import {StatsServer} from "./stats_server";
import {PreviewServer} from "./preview_server";

/*
This file is the entry point
 */

function validateUrl(url: string, description: string) {
    try {
        new URL(url);
    }
    catch (e) {
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
    setFrontendClientPath(frontendClientOverride);
}

const dataApiOverride = process.env.DATA_API;
if (dataApiOverride) {
    console.log(`Data api override: '${dataApiOverride}';`);
    validateUrl(dataApiOverride, 'data api');
    setDataApi(dataApiOverride);
}

let server: ServerBase;
if (process.env.IS_PREVIEW_SERVER === 'true') {
    console.log('Building preview server');
    server = new PreviewServer();
}
else {
    console.log('Building stats server');
    server = new StatsServer();
}
server.setupAndStart();
