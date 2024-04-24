import 'global-jsdom/register'
import 'isomorphic-fetch'
import Fastify from 'fastify';
import * as process from "process";
import {getShortLink} from "@xivgear/gearplan-frontend/external/shortlink_server";
import {GearPlanSheet} from "@xivgear/gearplan-frontend/components";


// Hack for JSDom not having ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {
        // do nothing
    }

    unobserve() {
        // do nothing
    }

    disconnect() {
        // do nothing
    }
};

const fastify = Fastify({
    logger: true,
    // querystringParser: str => querystring.parse(str, '&', '=', {}),
});

fastify.get('/echo', async (request, reply) => {
    return request.query;
});

fastify.get('/healthcheck', async (request, reply) => {
    return 'up';
})

fastify.get('/fulldata/:uuid', async (request, reply) => {
    const slData = await getShortLink(request.params['uuid']);
    const exported = JSON.parse(slData);
    const isFullSheet = 'sets' in exported;
    const sheet = isFullSheet ? GearPlanSheet.fromExport(exported) : GearPlanSheet.fromSetExport(exported);
    sheet.setViewOnly();
    await sheet.loadFully();
    return sheet.sets.map(set => ({
        name: set.name,
        description: set.description,
        computedStats: set.computedStats,
    }));
});

fastify.listen({
    port: 30000
}, (err, addr) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});