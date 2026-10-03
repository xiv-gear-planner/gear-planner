import {setDataApi} from "@xivgear/core/data_api_client";
import {frontendPaths} from "./frontend_file_server";
import {BisServiceImpl} from "@xivgear/core/external/static_bis";
import {ShortlinkServiceImpl} from "@xivgear/core/external/shortlink_server";
import {NavDataServiceImpl} from "./server_utils";
import {startPeriodicMemoryMonitor} from "./periodic_mem_stats";
import util from "node:util";
import {installFetchCache} from "./fetch_cache";

/*
This file is the entry point
 */

// Some node setup to reduce logging verbosity
util.inspect.defaultOptions.breakLength = 99999;
util.inspect.defaultOptions.compact = true;
util.inspect.defaultOptions.colors = true;
util.inspect.defaultOptions.maxStringLength = 100;
util.inspect.defaultOptions.maxArrayLength = 100;

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

startPeriodicMemoryMonitor();

const dataApiOverride = process.env.DATA_API;
if (dataApiOverride) {
    console.log(`Data api override: '${dataApiOverride}';`);
    validateUrl(dataApiOverride, 'data api');
    setDataApi(dataApiOverride);
}

async function startServer() {
    if (process.env.IS_PREVIEW_SERVER === 'true') {
        console.log('Building preview server');
        installFetchCache();
        // Parallel import
        const [{DOMParser}, {PreviewServer}] = await Promise.all([
            import('linkedom'),
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            Promise.resolve().then(() => require('@xivgear/backend-resolver/preview_server')),
        ]);
        new PreviewServer(fePaths, navDataService, new DOMParser()).setupAndStart();
    }
    else {
        console.log('Building stats server');
        // Don't install the fetch cache for stats server - data api items calls are too heavy, and it is
        // generally less performance-sensitive.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {StatsServer} = require('@xivgear/backend-resolver/stats_server');
        new StatsServer(shortlinkService, navDataService, bisService).setupAndStart();
    }
}

startServer().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
