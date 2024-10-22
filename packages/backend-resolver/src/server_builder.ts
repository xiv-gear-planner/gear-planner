import 'global-jsdom/register';
import './polyfills';
import Fastify, {FastifyRequest} from "fastify";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {PartyBonusAmount, SetExport, SheetExport, SheetStatsExport} from "@xivgear/xivmath/geartypes";
import {getBisSheet} from "@xivgear/core/external/static_bis";
// import {registerDefaultSims} from "@xivgear/gearplan-frontend/sims/default_sims";
import {HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {JobName, MAX_PARTY_BONUS} from "@xivgear/xivmath/xivconstants";
import {
    DEFAULT_DESC,
    DEFAULT_NAME,
    HASH_QUERY_PARAM,
    NavPath,
    parsePath,
    PATH_SEPARATOR,
    PREVIEW_MAX_DESC_LENGTH,
    PREVIEW_MAX_NAME_LENGTH
} from "@xivgear/core/nav/common_nav";
import {nonCachedFetch} from "./polyfills";
import fastifyWebResponse from "fastify-web-response";
import {getFrontendPath, getFrontendServer} from "./frontend_file_server";

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

async function importExportSheet(request: FastifyRequest, exported: object): Promise<SheetStatsExport> {
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

function buildServerBase() {

    checkInit();

    const fastifyInstance = Fastify({
        logger: true,
        ignoreTrailingSlash: true,
        ignoreDuplicateSlashes: true,
        // querystringParser: str => querystring.parse(str, '&', '=', {}),
    });

    // fastifyInstance.get('/echo', async (request: FastifyRequest, reply) => {
    //     return request.query;
    // });
    //
    fastifyInstance.get('/healthcheck', async (request, reply) => {
        return 'up';
    });

    return fastifyInstance;
}

export function buildStatsServer() {

    const fastifyInstance = buildServerBase();

    // TODO: write something like this but using the new generic pathing logic
    fastifyInstance.get('/fulldata/:uuid', async (request: FastifyRequest, reply) => {
        const rawData = await getShortLink(request.params['uuid'] as string);
        const out = await importExportSheet(request, JSON.parse(rawData));
        reply.header("cache-control", "max-age=7200, public");
        reply.send(out);
    });

    fastifyInstance.get('/fulldata/bis/:job/:expac/:sheet', async (request: FastifyRequest, reply) => {
        const rawData = await getBisSheet(request.params['job'] as JobName, request.params['expac'] as string, request.params['sheet'] as string);
        const out = await importExportSheet(request, JSON.parse(rawData));
        reply.header("cache-control", "max-age=7200, public");
        reply.send(out);
    });
    return fastifyInstance;
}

export function buildPreviewServer() {

    const fastifyInstance = buildServerBase();

    const parser = new DOMParser();

    fastifyInstance.register(fastifyWebResponse);
    // This endpoint acts as a proxy. If it detects that you are trying to load something that looks like a sheet,
    // inject social media preview and preload urls.
    fastifyInstance.get('/', async (request: FastifyRequest, reply) => {

        async function resolveNav(nav: NavPath): Promise<object | null> {
            try {
                switch (nav.type) {
                    case "newsheet":
                    case "importform":
                    case "saved":
                        return null;
                    case "shortlink":
                        return JSON.parse(await getShortLink(nav.uuid));
                    case "setjson":
                    case "sheetjson":
                        return nav.jsonBlob;
                    case "bis":
                        return JSON.parse(await getBisSheet(nav.job, nav.expac, nav.sheet));
                }
            }
            catch (e) {
                request.log.error(e, 'Error loading nav');
            }
            return null;
        }

        const path = request.query[HASH_QUERY_PARAM] ?? '';
        const pathPaths = path.split(PATH_SEPARATOR);
        const nav = parsePath(pathPaths);
        request.log.info(pathPaths, 'Path');
        const serverUrl = getFrontendServer();
        const clientUrl = getFrontendPath();
        // Fetch original index.html
        const responsePromise = nonCachedFetch(serverUrl + '/index.html', undefined);
        try {
            const exported: object | null = await resolveNav(nav);
            if (exported !== null) {
                let name: string = exported['name'] || "";
                let desc: string = exported['description'] || "";
                if (name.length > PREVIEW_MAX_NAME_LENGTH) {
                    name = name.substring(0, PREVIEW_MAX_NAME_LENGTH) + "…";
                }
                if (desc.length > PREVIEW_MAX_DESC_LENGTH) {
                    desc = desc.substring(0, PREVIEW_MAX_DESC_LENGTH) + "…";
                }
                name = name ? (name + " - " + DEFAULT_NAME) : DEFAULT_NAME;
                desc = desc ? (desc + '\n\n' + DEFAULT_DESC) : DEFAULT_DESC;

                const url: string = new URL(request.url, clientUrl).toString();
                const text: string = await (await responsePromise).text();
                const doc = parser.parseFromString(text, 'text/html');
                const head = doc.head;
                const propertyMap: Record<string, string> = {
                    'og:site_name': 'XivGear',
                    'og:type': 'website',
                    'og:title': name,
                    'og:description': desc,
                    'og:url': url,
                } as const;
                for (const entry of Object.entries(propertyMap)) {
                    const meta = document.createElement('meta');
                    meta.setAttribute('property', entry[0]);
                    meta.setAttribute('content', entry[1]);
                    head.append(meta);
                }
                if (name !== DEFAULT_NAME) {
                    head.querySelector('title')?.remove();
                    const newTitle = document.createElement('title');
                    newTitle.textContent = name;
                    head.append(newTitle);
                }
                // Inject preload properties based on job
                // The rest are part of the static html
                const job = exported['job'];
                if (job) {
                    const jobItemsPreload = document.createElement('link');
                    const jobItemsUrl = `https://data.xivgear.app/Items?job=${job}`;
                    jobItemsPreload.rel = 'preload';
                    jobItemsPreload.href = jobItemsUrl;
                    // For some reason, `.as = 'fetch'` doesn't work, but this does.
                    jobItemsPreload.setAttribute("as", 'fetch');
                    head.appendChild(jobItemsPreload);
                }
                return new Response(doc.documentElement.outerHTML, {
                    status: 200,
                    headers: {
                        'content-type': 'text/html',
                        // use a longer cache duration for success
                        'cache-control': 'max-age=7200, public',
                    },
                });
            }
        }
        catch (e) {
            request.log.error(e, 'Error injecting preview');
        }
        // If error or no additional data needed, then just pass through the response as-is
        const response = await responsePromise;
        return new Response((await responsePromise).body, {
            status: 200,
            headers: {
                'content-type': response.headers.get('content-type') || 'text/html',
                // TODO: should these have caching?
                // // use a shorter cache duration for these
                // 'cache-control': response.headers.get('cache-control') || 'max-age=120, public'
            },
        });
    });

    return fastifyInstance;

}
