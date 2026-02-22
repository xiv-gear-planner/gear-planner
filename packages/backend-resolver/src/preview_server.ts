import {ServerBase} from "./server_base";
import {FastifyInstance} from "fastify";
import fastifyWebResponse from "fastify-web-response";
import {FrontendFileServerProvider} from "./frontend_file_server";
import {nonCachedFetch} from "./polyfills";
import {
    DEFAULT_DESC,
    DEFAULT_NAME,
    HASH_QUERY_PARAM,
    NavState,
    ONLY_SET_QUERY_PARAM,
    parsePath,
    PATH_SEPARATOR,
    PREVIEW_MAX_DESC_LENGTH,
    PREVIEW_MAX_NAME_LENGTH,
    SELECTION_INDEX_QUERY_PARAM,
    tryParseOptionalIntParam
} from "@xivgear/core/nav/common_nav";
import 'global-jsdom/register';
import './polyfills';
import {ALL_COMBAT_JOBS, JOB_DATA} from "@xivgear/xivmath/xivconstants";
import process from "process";
import {getMergedQueryParams, NavDataService, SheetRequest} from "./server_utils";

export class PreviewServer extends ServerBase {
    constructor(private readonly frontendPaths: FrontendFileServerProvider, private readonly navDataService: NavDataService) {
        super();
    }

    setup(fastifyInstance: FastifyInstance): void {
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


            const serverUrl = this.frontendPaths.staticFilePath;
            const clientUrl = this.frontendPaths.frontendClientPath;
            // Fetch original index.html
            const responsePromise = nonCachedFetch(serverUrl + '/index.html', undefined);
            try {
                const merged = getMergedQueryParams(request);
                const path = merged[HASH_QUERY_PARAM] ?? '';
                const osIndex: number | undefined = tryParseOptionalIntParam(merged[ONLY_SET_QUERY_PARAM]);
                const selIndex: number | undefined = tryParseOptionalIntParam(merged[SELECTION_INDEX_QUERY_PARAM]);
                const pathPaths = path.split(PATH_SEPARATOR);
                const state = new NavState(pathPaths, osIndex, selIndex);
                const nav = parsePath(state);
                request.log.info(pathPaths, 'Path');
                const navResult = this.navDataService.resolveNavData(nav);
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
                        const multiJob = await navResult.multiJob;
                        if (multiJob) {
                            const thisJob = JOB_DATA[job];
                            const jobs = ALL_COMBAT_JOBS.filter(j => JOB_DATA[j]?.role === thisJob?.role).join(",");
                            addFetchPreload(`https://data.xivgear.app/Items?job=${jobs}`);
                        }
                        else {
                            addFetchPreload(`https://data.xivgear.app/Items?job=${job}`);
                        }
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
    }
}
