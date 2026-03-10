import * as process from "process";
import {setDataApi} from "@xivgear/core/data_api_client";
import {ServerBase} from "./server_base";
import {StatsServer} from "./stats_server";
import {PreviewServer} from "./preview_server";
import {frontendPaths} from "./frontend_file_server";
import {BisServiceImpl} from "@xivgear/core/external/static_bis";
import {ShortlinkServiceImpl} from "@xivgear/core/external/shortlink_server";
import {NavDataServiceImpl} from "./server_utils";

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

// Using undefined instead of null so that it can be directly used in place of an optional field
function optionalUrl(url: string | null | undefined, description: string): URL | undefined {
    if (!url) {
        console.log(`URL '${description}' is not specified/empty, leaving as default`);
        return undefined;
    }
    try {
        console.log(`URL '${description}' is overridden to '${url}'`);
        return new URL(url);
    }
    catch (e) {
        console.error(`Not a valid ${description} URL: '${url}'`, url, e);
        throw e;
    }
}

const shortlinkService = new ShortlinkServiceImpl(optionalUrl(process.env.SHORTLINK_SERVER, 'shortlink'));
const bisService = new BisServiceImpl(optionalUrl(process.env.BIS_SERVER, 'BiS server'));

const fePaths = frontendPaths({
    frontendClientPath: optionalUrl(process.env.FRONTEND_CLIENT, 'frontend client path'),
    staticFilePath: optionalUrl(process.env.FRONTEND_SERVER, 'frontend static file path'),
});

const navDataService = new NavDataServiceImpl(shortlinkService, bisService);

// TODO: no particularly good way to override this yet
const dataApiOverride = process.env.DATA_API;
if (dataApiOverride) {
    console.log(`Data api override: '${dataApiOverride}';`);
    validateUrl(dataApiOverride, 'data api');
    setDataApi(dataApiOverride);
}

let server: ServerBase;
if (process.env.IS_PREVIEW_SERVER === 'true') {
    console.log('Building preview server');
    server = new PreviewServer(fePaths, navDataService);
}
else {
    console.log('Building stats server');
    server = new StatsServer(shortlinkService, navDataService, bisService);
}
server.setupAndStart();
