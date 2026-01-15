import 'global-jsdom/register';
import './polyfills';
import Fastify, {FastifyRequest} from "fastify";
import {getShortLink, getShortlinkFetchUrl} from "@xivgear/core/external/shortlink_server";
import {
    PartyBonusAmount,
    SetExport,
    SetExportExternalSingle,
    SheetExport,
    SheetStatsExport,
    TopLevelExport
} from "@xivgear/xivmath/geartypes";
import {getBisIndexUrl, getBisSheet, getBisSheetFetchUrl} from "@xivgear/core/external/static_bis";
import {ExportTypes, HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {JOB_DATA, JobName, MAX_PARTY_BONUS} from "@xivgear/xivmath/xivconstants";
import cors from '@fastify/cors';
import {
    DEFAULT_DESC,
    DEFAULT_NAME,
    HASH_QUERY_PARAM,
    NavPath,
    NavState,
    ONLY_SET_QUERY_PARAM,
    parsePath,
    PATH_SEPARATOR,
    PREVIEW_MAX_DESC_LENGTH,
    PREVIEW_MAX_NAME_LENGTH,
    SELECTION_INDEX_QUERY_PARAM,
    tryParseOptionalIntParam
} from "@xivgear/core/nav/common_nav";
import {nonCachedFetch} from "./polyfills";
import fastifyWebResponse from "fastify-web-response";
import {getFrontendPath, getFrontendServer} from "./frontend_file_server";
import process from "process";
import {extractSingleSet} from "@xivgear/core/util/sheet_utils";
import {getJobIcons} from "./preload_helpers";
import FastifyIP from 'fastify-ip';

let initDone = false;

type ExportedData = SheetExport | SetExportExternalSingle;

function checkInit() {
    if (!initDone) {
        doInit();
        initDone = true;
    }
}

function doInit() {
    // registerDefaultSims();
}

type SheetRequest = FastifyRequest<{
    Querystring: Record<string, string | undefined>;
    Params: Record<string, string>;
}>;

async function importExportSheet(request: SheetRequest, exportedPre: SheetExport | SetExport, nav?: NavPath): Promise<SheetStatsExport> {
    const exportedInitial: SheetExport | SetExport = exportedPre;
    const initiallyFullSheet = 'sets' in exportedPre;
    const onlySetIndex: number | undefined = (nav !== undefined && "onlySetIndex" in nav) ? nav.onlySetIndex : undefined;
    if (onlySetIndex !== undefined) {
        if (!initiallyFullSheet) {
            request.log.warn("onlySetIndex does not make sense when isFullSheet is false");
        }
        else {
            const singleMaybe = extractSingleSet(exportedInitial as SheetExport, onlySetIndex);
            if (singleMaybe === undefined) {
                throw new Error(`Error: Set index ${onlySetIndex} is not valid.`);
            }
            exportedPre = singleMaybe;
        }
    }
    const exported = exportedPre;
    const isFullSheet = 'sets' in exported;
    const sheet = isFullSheet ? HEADLESS_SHEET_PROVIDER.fromExport(exported as SheetExport) : HEADLESS_SHEET_PROVIDER.fromSetExport(exported as SetExport);
    sheet.setViewOnly();
    const pb = request.query.partyBonus;
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
    return sheet.exportSheet(ExportTypes.FullStatsExport);
}

function buildServerBase() {

    checkInit();

    const fastifyInstance = Fastify({
        logger: true,
        ignoreTrailingSlash: true,
        ignoreDuplicateSlashes: true,
        // querystringParser: str => querystring.parse(str, '&', '=', {}),
    });
    // Get the true IP from CF headers
    fastifyInstance.register(FastifyIP, {
        order: ['cf-connecting-ip'],
        strict: true,
    });
    fastifyInstance.register(cors, {
        methods: ['GET', 'OPTIONS'],
        strictPreflight: false,
    });

    fastifyInstance.get('/healthcheck', async (request, reply) => {
        return 'up';
    });

    process.on('uncaughtException', (reason: Error) => {
        fastifyInstance.log.error(`uncaught exception: ${reason}`);
    });
    process.on('unhandledRejection', (reason, promise) => {
        fastifyInstance.log.error(`unhandled rejection at: ${promise}, reason: ${reason}`);
    });

    return fastifyInstance;
}

type NavResult = {
    fetchPreloads: URL[],
    imagePreloads: Promise<URL[]>,
    sheetData: Promise<ExportedData> | null,
    name: Promise<string | undefined>,
    description: Promise<string | undefined>,
    job: Promise<JobName | undefined>,
}

type SheetSummaryData = {
    name: string | undefined,
    desc: string | undefined,
    job: JobName | undefined,
    multiJob: boolean,
}

function fillSheetData(sheetPreloadUrl: URL | null, sheetData: Promise<ExportedData>, osIndex: number | undefined): NavResult {
    const processed: Promise<SheetSummaryData> = sheetData.then(exported => {
        let set = undefined;
        if (osIndex !== undefined && 'sets' in exported) {
            set = exported.sets[osIndex] as SetExport;
        }
        return {
            name: set?.['name'] || exported['name'],
            desc: set?.['description'] || exported['description'],
            job: exported.job,
            multiJob: ('sets' in exported && osIndex === undefined && exported.isMultiJob) ?? false,
        };
    });
    return {
        fetchPreloads: sheetPreloadUrl === null ? [] : [sheetPreloadUrl],
        // As nice as it would be to preload item images, that would require awaiting more calls, or keeping a
        // DataManager around. Since the item icons have placeholder lookalikes anyway, it's not super important.
        imagePreloads: processed.then(p => {
            if (p.multiJob && p.job) {
                const myRole = JOB_DATA[p.job].role;
                return getJobIcons('frameless', thatJob => JOB_DATA[thatJob].role === myRole);
            }
            else {
                return [];
            }
        }),
        sheetData: sheetData,
        name: processed.then(p => p.name),
        description: processed.then(p => p.desc),
        job: processed.then(p => p.job),
    };
}

function fillBisBrowserData(path: string[]): NavResult {
    const job = (path.find(element => element.toUpperCase() in JOB_DATA)?.toUpperCase() as JobName ?? undefined);
    // Join the path parts with spaces, but make each individual part either start with a capital, or entirely capitalized
    // if it looks like a job name. If path is empty, use undefined instead.
    const label: string | undefined = path.length > 0 ? path.map(pathPart => {
        const upper = pathPart.toUpperCase();
        if (upper in JOB_DATA) {
            return upper;
        }
        else if (upper) {
            return `${pathPart.slice(0, 1).toUpperCase() + pathPart.slice(1)}`;
        }
        else {
            return pathPart;
        }
    }).join(" ") : undefined;
    const images = [];
    if (path.length === 0) {
        images.push(...getJobIcons('framed'));
    }
    return {
        description: Promise.resolve(label ? `Best-in-Slot Gear Sets for ${label} in Final Fantasy XIV` : "Best-in-Slot Gear Sets for Final Fantasy XIV"),
        job: Promise.resolve(job),
        name: Promise.resolve(label ? label + ' BiS' : undefined),
        fetchPreloads: [getBisIndexUrl()],
        imagePreloads: Promise.resolve(images),
        sheetData: null,
    };
}

function resolveNavData(nav: NavPath | null): NavResult | null {
    if (nav === null) {
        return null;
    }
    switch (nav.type) {
        case "newsheet":
        case "importform":
        case "saved":
            return null;
        case "shortlink":
            // TODO: combine these into one call
            return fillSheetData(getShortlinkFetchUrl(nav.uuid), getShortLink(nav.uuid).then(JSON.parse), nav.onlySetIndex);
        case "setjson":
            return fillSheetData(null, Promise.resolve(nav.jsonBlob as TopLevelExport), undefined);
        case "sheetjson":
            return fillSheetData(null, Promise.resolve(nav.jsonBlob as TopLevelExport), nav.onlySetIndex);
        case "bis":
            return fillSheetData(getBisSheetFetchUrl(nav.path), getBisSheet(nav.path).then(JSON.parse), nav.onlySetIndex);
        case "bisbrowser":
            return fillBisBrowserData(nav.path);
    }
    throw Error(`Unable to resolve nav result: ${nav.type}`);
}

export type EmbedCheckResponse = {
    isValid: true,
} | {
    isValid: false,
    reason: string,
}

export function buildStatsServer() {

    const fastifyInstance = buildServerBase();

    fastifyInstance.get('/validateEmbed', async (request: SheetRequest, reply) => {
        const path = request.query?.[HASH_QUERY_PARAM] ?? '';
        const osIndex: number | undefined = tryParseOptionalIntParam(request.query[ONLY_SET_QUERY_PARAM]);
        const selIndex: number | undefined = tryParseOptionalIntParam(request.query[SELECTION_INDEX_QUERY_PARAM]);
        const pathPaths = path.split(PATH_SEPARATOR);
        const state = new NavState(pathPaths, osIndex, selIndex);
        const nav = parsePath(state);
        request.log.info(pathPaths, 'Path');
        const navResult = resolveNavData(nav);
        if (nav !== null && navResult !== null && navResult.sheetData !== null) {
            const exported: ExportedData = await navResult.sheetData;
            reply.header("cache-control", "max-age=7200, public");
            if ('sets' in exported && osIndex === undefined) {
                reply.send({
                    isValid: false,
                    reason: "full sheets cannot be embedded",
                } satisfies EmbedCheckResponse);
            }
            else if ('embed' in nav && nav.embed) {
                reply.send({
                    isValid: true,
                } satisfies EmbedCheckResponse);
            }
            else {
                reply.send({
                    isValid: false,
                    reason: "not an embed",
                } satisfies EmbedCheckResponse);
            }
        }
        else {
            reply.send({
                isValid: false,
                reason: `path ${pathPaths} not found`,
            } satisfies EmbedCheckResponse);
        }
    });

    fastifyInstance.get('/basedata', async (request: SheetRequest, reply) => {
        const path = request.query?.[HASH_QUERY_PARAM] ?? '';
        const osIndex: number | undefined = tryParseOptionalIntParam(request.query[ONLY_SET_QUERY_PARAM]);
        const selIndex: number | undefined = tryParseOptionalIntParam(request.query[SELECTION_INDEX_QUERY_PARAM]);
        const pathPaths = path.split(PATH_SEPARATOR);
        const state = new NavState(pathPaths, osIndex, selIndex);
        const nav = parsePath(state);
        request.log.info(pathPaths, 'Path');
        const navResult = resolveNavData(nav);
        if (nav !== null && navResult !== null && navResult.sheetData !== null) {
            const exported: ExportedData = await navResult.sheetData;
            reply.header("cache-control", "max-age=7200, public");
            reply.send(exported);
        }
        reply.status(404);
    });

    fastifyInstance.get('/fulldata', async (request: SheetRequest, reply) => {
        // TODO: deduplicate this code
        const path = request.query?.[HASH_QUERY_PARAM] ?? '';
        const osIndex: number | undefined = tryParseOptionalIntParam(request.query[ONLY_SET_QUERY_PARAM]);
        const selIndex: number | undefined = tryParseOptionalIntParam(request.query[SELECTION_INDEX_QUERY_PARAM]);
        const pathPaths = path.split(PATH_SEPARATOR);
        const state = new NavState(pathPaths, osIndex, selIndex);
        const nav = parsePath(state);
        request.log.info(pathPaths, 'Path');
        const navResult = resolveNavData(nav);
        if (nav !== null && navResult !== null && navResult.sheetData !== null) {
            const exported: ExportedData = await navResult.sheetData;
            const out = await importExportSheet(request, exported as (SetExport | SheetExport), nav);
            reply.header("cache-control", "max-age=7200, public");
            reply.send(out);
        }
        reply.status(404);
    });

    // DEPRECATED - use /fulldata?page=sl|<uuid> instead
    fastifyInstance.get('/fulldata/:uuid', async (request: SheetRequest, reply) => {
        const osIndex: number | undefined = tryParseOptionalIntParam(request.query[ONLY_SET_QUERY_PARAM]);
        const selIndex: number | undefined = tryParseOptionalIntParam(request.query[SELECTION_INDEX_QUERY_PARAM]);
        const nav: NavPath = {
            type: 'shortlink',
            uuid: request.params['uuid'],
            onlySetIndex: osIndex,
            defaultSelectionIndex: selIndex,
            embed: false,
            viewOnly: true,
        };
        const rawData = await getShortLink(request.params['uuid'] as string);
        const out = await importExportSheet(request, JSON.parse(rawData), nav);
        reply.header("cache-control", "max-age=7200, public");
        reply.send(out);
    });

    // DEPRECATED - use /fulldata?page=bis|<job>|<sheet> instead
    fastifyInstance.get('/fulldata/bis/:job/:sheet', async (request: SheetRequest, reply) => {
        const osIndex: number | undefined = tryParseOptionalIntParam(request.query[ONLY_SET_QUERY_PARAM]);
        const selIndex: number | undefined = tryParseOptionalIntParam(request.query[SELECTION_INDEX_QUERY_PARAM]);
        const nav: NavPath = {
            type: 'bis',
            job: request.params['job'] as JobName,
            sheet: request.params['sheet'],
            path: [request.params['job'], request.params['sheet']],
            onlySetIndex: osIndex,
            defaultSelectionIndex: selIndex,
            embed: false,
            viewOnly: true,
        };
        const rawData = await getBisSheet([request.params['job'] as JobName, request.params['sheet'] as string]);
        const out = await importExportSheet(request, JSON.parse(rawData), nav);
        reply.header("cache-control", "max-age=7200, public");
        reply.send(out);
    });

    // DEPRECATED - use /fulldata?page=bis|<job>|<folder>|<sheet> instead
    fastifyInstance.get('/fulldata/bis/:job/:folder/:sheet', async (request: SheetRequest, reply) => {
        const osIndex: number | undefined = tryParseOptionalIntParam(request.query[ONLY_SET_QUERY_PARAM]);
        const selIndex: number | undefined = tryParseOptionalIntParam(request.query[SELECTION_INDEX_QUERY_PARAM]);
        const nav: NavPath = {
            type: 'bis',
            job: request.params['job'] as JobName,
            folder: request.params['folder'],
            sheet: request.params['sheet'],
            path: [request.params['job'], request.params['folder'], request.params['sheet']],
            onlySetIndex: osIndex,
            defaultSelectionIndex: selIndex,
            embed: false,
            viewOnly: true,
        };
        const rawData = await getBisSheet([request.params['job'], request.params['folder'], request.params['sheet']]);
        const out = await importExportSheet(request, JSON.parse(rawData), nav);
        reply.header("cache-control", "max-age=7200, public");
        reply.send(out);
    });
    return fastifyInstance;
}

export function buildPreviewServer() {

    const fastifyInstance = buildServerBase();

    // TODO: split preview and stats server into different images, since stats server does not need DOM stuff
    const parser = new DOMParser();

    let extraScripts: string[];
    const extraScriptsRaw = process.env.EXTRA_SCRIPTS;
    if (extraScriptsRaw) {
        extraScripts = extraScriptsRaw.split(';');
        console.log('extra scripts', extraScripts);
    }
    else {
        console.log('no extra scripts');
        extraScripts = [];
    }

    fastifyInstance.register(fastifyWebResponse);
    // This endpoint acts as a proxy. If it detects that you are trying to load something that looks like a sheet,
    // inject social media preview and preload urls.
    fastifyInstance.get('/', async (request: SheetRequest, reply) => {


        const serverUrl = getFrontendServer();
        const clientUrl = getFrontendPath();
        // Fetch original index.html
        const responsePromise = nonCachedFetch(serverUrl + '/index.html', undefined);
        try {
            const path = request.query[HASH_QUERY_PARAM] ?? '';
            const osIndex: number | undefined = tryParseOptionalIntParam(request.query[ONLY_SET_QUERY_PARAM]);
            const selIndex: number | undefined = tryParseOptionalIntParam(request.query[SELECTION_INDEX_QUERY_PARAM]);
            const pathPaths = path.split(PATH_SEPARATOR);
            const state = new NavState(pathPaths, osIndex, selIndex);
            const nav = parsePath(state);
            request.log.info(pathPaths, 'Path');
            const navResult = resolveNavData(nav);
            if (navResult !== null) {
                let name = await navResult.name || "";
                let desc = await navResult.description || "";
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
                    const meta = doc.createElement('meta');
                    meta.setAttribute('property', entry[0]);
                    meta.setAttribute('content', entry[1]);
                    head.append(meta);
                }
                if (name !== DEFAULT_NAME) {
                    head.querySelector('title')?.remove();
                    const newTitle = doc.createElement('title');
                    newTitle.textContent = name;
                    head.append(newTitle);
                }

                function addPreload(url: string, as: string) {
                    const preload = doc.createElement('link');
                    preload.rel = 'preload';
                    preload.href = url;
                    // For some reason, `.as = 'fetch'` doesn't work, but this does.
                    preload.setAttribute("as", as);
                    preload.setAttribute("crossorigin", "");
                    head.appendChild(preload);
                }

                function addFetchPreload(url: string) {
                    addPreload(url, 'fetch');
                }

                function addImagePreload(url: string) {
                    addPreload(url, 'image');
                }

                // function addDnsPreload(url: string) {
                //     const preload = doc.createElement('link');
                //     preload.rel = 'dns-prefetch';
                //     preload.href = url;
                //     head.append(preload);
                // }

                // Inject preload properties based on job
                // The rest are part of the static html
                const job = await navResult.job;
                if (job) {
                    addFetchPreload(`https://data.xivgear.app/Items?job=${job}`);
                }
                navResult.fetchPreloads.forEach(preload => addFetchPreload(preload.toString()));
                // TODO: image preloads need to account for hr vs non-hr images
                (await navResult.imagePreloads).forEach(preload => addImagePreload(preload.toString()));
                // addDnsPreload('https://v2.xivapi.com/');
                if (extraScripts) {
                    function addExtraScript(url: string, extraProps: object = {}) {
                        const script = doc.createElement('script');
                        script.src = url;
                        Object.entries(extraProps).forEach(([k, v]) => {
                            script.setAttribute(k, v);
                        });
                        head.appendChild(script);
                    }

                    const isEmbed = nav !== null && 'embed' in nav && nav.embed;
                    // Don't inject these if embedded
                    extraScripts.forEach(scriptUrl => {
                        if (!isEmbed) {
                            addExtraScript(scriptUrl, {'async': ''});
                        }
                    });

                    doc.documentElement.setAttribute('scripts-injected', 'true');
                }
                const headers: HeadersInit = {
                    'content-type': 'text/html',
                    // use a longer cache duration for success
                    'cache-control': 'max-age=7200, public',
                };
                // If the client is trying to cache bust, then send Clear-Site-Data header to try to clear client
                // cache entirely, and also override cache-control.
                if (request.query['_cacheBust']) {
                    headers['Clear-Site-Data'] = '"cache", "prefetchCache", "prerenderCache"';
                    headers['cache-control'] = 'max-age=0, no-cache';
                }
                return new Response('<!DOCTYPE html>\n' + doc.documentElement.outerHTML, {
                    status: 200,
                    headers: headers,
                });
            }
        }
        catch (e) {
            request.log.error(e, 'Error injecting preview');
        }
        // If error or no additional data needed, then just pass through the response as-is
        const response = await responsePromise;
        const headers: HeadersInit = {
            'content-type': response.headers.get('content-type') || 'text/html',
        };
        //
        // // Check if the URL looks like a hashed webpack JS chunk (e.g., script_name.a1b2c3d4.js)
        // const hashedChunkPattern = /\.[a-f0-9]{2,}\.js$/i;
        // const isHashedChunk = hashedChunkPattern.test(request.url);
        // if (isHashedChunk) {
        //     headers['cache-control'] = 'public, max-age=31536000, immutable';
        // }
        // // else if (response.headers.get('cache-control')) {
        // //     headers['cache-control'] = response.headers.get('cache-control') || '';
        // // }

        return new Response((await responsePromise).body, {
            status: 200,
            headers: headers,
        });
    });

    return fastifyInstance;

}
