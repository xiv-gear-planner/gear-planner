import 'global-jsdom/register'
import './polyfills';
import Fastify from "fastify";
import {getShortLink} from "@xivgear/gearplan-frontend/external/shortlink_server";
import {GearPlanSheet} from "@xivgear/gearplan-frontend/components";
import {PartyBonusAmount} from "@xivgear/xivmath/geartypes";

export function buildServerInstance() {
    const fastifyInstance = Fastify({
        logger: true,
        // querystringParser: str => querystring.parse(str, '&', '=', {}),
    });

    fastifyInstance.get('/echo', async (request, reply) => {
        return request.query;
    });

    fastifyInstance.get('/healthcheck', async (request, reply) => {
        return 'up';
    })

    fastifyInstance.get('/fulldata/:uuid', async (request, reply) => {
        const slData = await getShortLink(request.params['uuid']);
        const exported = JSON.parse(slData);
        const isFullSheet = 'sets' in exported;
        const sheet = isFullSheet ? GearPlanSheet.fromExport(exported) : GearPlanSheet.fromSetExport(exported);
        sheet.setViewOnly();
        const pb = request.query['partyBonus'];
        if (pb) {
            sheet.partyBonus = parseInt(pb) as PartyBonusAmount;
        }
        await sheet.loadFully();
        return sheet.exportSheet(true, true);
    });
    return fastifyInstance;

}
