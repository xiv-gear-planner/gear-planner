import 'global-jsdom/register'
import './polyfills';
import Fastify, {FastifyRequest} from "fastify";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {PartyBonusAmount, SetExport, SheetExport, SheetStatsExport} from "@xivgear/xivmath/geartypes";
import {getBisSheet} from "@xivgear/core/external/static_bis";
// import {registerDefaultSims} from "@xivgear/gearplan-frontend/sims/default_sims";
import {HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {JobName, MAX_PARTY_BONUS} from "@xivgear/xivmath/xivconstants";

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

async function importExportSheet(request: FastifyRequest, rawData: string): Promise<SheetStatsExport> {
    const exported = JSON.parse(rawData) as object;
    const isFullSheet = 'sets' in exported;
    const sheet = isFullSheet ? HEADLESS_SHEET_PROVIDER.fromExport(exported as SheetExport) : HEADLESS_SHEET_PROVIDER.fromSetExport(exported as SetExport);
    sheet.setViewOnly();
    const pb = request.query['partyBonus'] as string | undefined;
    if (pb) {
        const parsed = parseInt(pb);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= MAX_PARTY_BONUS) {
            sheet.partyBonus = parsed as PartyBonusAmount;
        }
        else {
            throw Error(`Party bonus '${pb}' is invalid`);
        }
    }
    await sheet.load();
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

    fastifyInstance.get('/echo', async (request: FastifyRequest, reply) => {
        return request.query;
    });

    fastifyInstance.get('/healthcheck', async (request, reply) => {
        return 'up';
    });

    fastifyInstance.get('/fulldata/:uuid', async (request: FastifyRequest, reply) => {
        const rawData = await getShortLink(request.params['uuid'] as string);
        return importExportSheet(request, rawData);
    });

    fastifyInstance.get('/fulldata/bis/:job/:expac/:sheet', async (request: FastifyRequest, reply) => {
        const rawData = await getBisSheet(request.params['job'] as JobName, request.params['expac'] as string, request.params['sheet'] as string);
        return importExportSheet(request, rawData);
    });

    return fastifyInstance;

}
