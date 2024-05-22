import 'global-jsdom/register'
import './polyfills';
import Fastify from "fastify";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {PartyBonusAmount, SheetStatsExport} from "@xivgear/xivmath/geartypes";
import {getBisSheet} from "@xivgear/core/external/static_bis";
// import {registerDefaultSims} from "@xivgear/gearplan-frontend/sims/default_sims";
import {HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {MAX_PARTY_BONUS} from "@xivgear/xivmath/xivconstants";

let initDone = false;

function checkInit() {
    if (!initDone) {
        doInit();
        initDone = true;
    }
}

function doInit() {
    // registerDefaultSims();
}

async function importExportSheet(request, rawData: string): Promise<SheetStatsExport> {
    const exported = JSON.parse(rawData);
    const isFullSheet = 'sets' in exported;
    const sheet = isFullSheet ? HEADLESS_SHEET_PROVIDER.fromExport(exported) : HEADLESS_SHEET_PROVIDER.fromSetExport(exported);
    sheet.setViewOnly();
    const pb = request.query['partyBonus'];
    if (pb) {
        const parsed = parseInt(pb);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= MAX_PARTY_BONUS) {
            sheet.partyBonus = parsed as PartyBonusAmount;
        }
        else {
            throw Error(`Party bonus '${pb}' is invalid`);
        }
    }
    await sheet.loadFully();
    return sheet.exportSheet(true, true);
}

export function buildServerInstance() {

    checkInit();

    const fastifyInstance = Fastify({
        logger: true,
        ignoreTrailingSlash: true,
        ignoreDuplicateSlashes: true,
        // querystringParser: str => querystring.parse(str, '&', '=', {}),
    });

    fastifyInstance.get('/echo', async (request, reply) => {
        return request.query;
    });

    fastifyInstance.get('/healthcheck', async (request, reply) => {
        return 'up';
    })

    fastifyInstance.get('/fulldata/:uuid', async (request, reply) => {
        const rawData = await getShortLink(request.params['uuid']);
        return importExportSheet(request, rawData);
    });

    fastifyInstance.get('/fulldata/bis/:job/:expac/:sheet', async (request, reply) => {
        const rawData = await getBisSheet(request.params['job'], request.params['expac'], request.params['sheet']);
        return importExportSheet(request, rawData);
    });

    return fastifyInstance;

}
