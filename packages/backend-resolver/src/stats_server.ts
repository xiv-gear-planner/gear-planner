import {ServerBase} from "./server_base";
import {FastifyInstance, FastifyRequest} from "fastify";
import 'global-jsdom/register';
import './polyfills';
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fs from 'node:fs';
import path from 'node:path';
import {ShortlinkService} from "@xivgear/core/external/shortlink_server";
import {
    PartyBonusAmount,
    SetExport,
    SetExportExternalSingle,
    SheetExport,
    SheetStatsExport
} from "@xivgear/xivmath/geartypes";
import {BisService} from "@xivgear/core/external/static_bis";
import {ExportTypes, HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {JobName, MAX_PARTY_BONUS} from "@xivgear/xivmath/xivconstants";
import {
    EXPORT_AS_SHEET_PARAM,
    HASH_QUERY_PARAM,
    NavPath,
    NavState,
    ONLY_SET_QUERY_PARAM,
    parsePath,
    PATH_SEPARATOR,
    SELECTION_INDEX_QUERY_PARAM,
    tryParseOptionalIntParam
} from "@xivgear/core/nav/common_nav";
import {extractSingleSet, extractSingleSetAsSheet, inflateSetExport} from "@xivgear/core/util/sheet_utils";
import {ExportedData, getMergedQueryParams, isRecord, NavDataService, SheetRequest, toEmbedUrl} from "./server_utils";
import {
    BaseDataResponse,
    EmbedCheckResponse,
    FullDataResponse,
    PutSetResponse,
    PutSheetResponse
} from "./stats_server_schema_types";


export class StatsServer extends ServerBase {

    constructor(private readonly shortlinkService: ShortlinkService, private readonly navDataService: NavDataService, private readonly bisService: BisService) {
        super();
    }

    private registerSchemas(fastifyInstance: FastifyInstance): void {
        const schemaFiles = [
            // '../schemas/api-schemas.json',
            '../schemas/stats-schemas.json',
        ];

        for (const relPath of schemaFiles) {
            try {
                const schemaPath = path.resolve(__dirname, relPath);
                if (fs.existsSync(schemaPath)) {
                    const raw = fs.readFileSync(schemaPath, {encoding: 'utf-8'});
                    const apiSchemas = JSON.parse(raw) as Record<string, unknown> & {
                        definitions?: Record<string, unknown>
                    };
                    if (apiSchemas.definitions && typeof apiSchemas.definitions === 'object') {
                        for (const [name, schema] of Object.entries(apiSchemas.definitions)) {
                            // Filter out names that are not valid URI-references or contain problematic characters
                            if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
                                continue;
                            }
                            // Deep-clean the schema to remove internal $ref that point to local definitions
                            // since Fastify doesn't always handle them well when they are registered individually.
                            const cleanSchema = JSON.parse(JSON.stringify(schema), (key, value) => {
                                if (key === '$ref' && typeof value === 'string' && value.startsWith('#/definitions/')) {
                                    const refName = value.replace('#/definitions/', '');
                                    if (true) {
                                        return refName;
                                    }
                                    // If the referenced name is one we would skip, we must skip this ref or fix it.
                                    // For now, only convert refs to names that match our allowed pattern.
                                    if (/^[a-zA-Z0-9_-]+$/.test(refName)) {
                                        return refName + '#';
                                    }
                                    // If it's a problematic name, we remove the ref to prevent Fastify from crashing.
                                    return undefined;
                                }
                                return value;
                            });
                            try {
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                fastifyInstance.addSchema({$id: name, ...cleanSchema});
                            }
                            catch (e) {
                                fastifyInstance.log.debug({
                                    err: e,
                                    name,
                                }, 'Skipping invalid generated schema');
                            }
                        }
                    }
                }
            }
            catch (e) {
                fastifyInstance.log.info({
                    err: e,
                    relPath,
                }, 'No or invalid generated API schemas; continuing');
            }
        }
    }

    setup(fastifyInstance: FastifyInstance): void {
        // Register Swagger only for the stats server
        fastifyInstance.register(fastifySwagger, {
            openapi: {
                info: {
                    title: 'Gearplan API',
                    version: '1.0.0',
                },
            },
        });
        fastifyInstance.register(fastifySwaggerUi, {
            routePrefix: '/swagger-ui',
        });

        // Register component schemas for this server
        this.registerSchemas(fastifyInstance);

        fastifyInstance.register(async (instance) => {
            instance.get('/validateEmbed', {
                schema: {
                    tags: ['public'],
                    querystring: {
                        type: 'object',
                        properties: {
                            page: {
                                type: 'string',
                                description: 'The page parameter, which can be a shortlink (sl|<uuid>), a BiS sheet (bis|<job>|<sheet>), or a legacy UUID.',
                            },
                            url: {
                                type: 'string',
                                description: 'A full URL to a sheet or set. If provided, it will be parsed for page, onlySetIndex, and selectedIndex. These can still be overridden by providing the specific parameters directly.',
                            },
                            onlySetIndex: {
                                type: 'integer',
                                description: 'If provided, only the set at this index will be loaded. This is often used for embedding a single set.',
                            },
                            selectedIndex: {
                                type: 'integer',
                                description: 'The index of the set that should be selected by default when the sheet is loaded.',
                            },
                        },
                        additionalProperties: false,
                    },
                    response: {200: {$ref: 'EmbedCheckResponse#'}},
                },
            }, async (request: SheetRequest, reply) => {
                const merged = getMergedQueryParams(request);
                const path = merged[HASH_QUERY_PARAM] ?? '';
                const osIndex: number | undefined = tryParseOptionalIntParam(merged[ONLY_SET_QUERY_PARAM]);
                const selIndex: number | undefined = tryParseOptionalIntParam(merged[SELECTION_INDEX_QUERY_PARAM]);
                const pathPaths = path.split(PATH_SEPARATOR);
                const state = new NavState(pathPaths, osIndex, selIndex);
                const nav = parsePath(state);
                request.log.info(pathPaths, 'Path');
                const navResult = this.navDataService.resolveNavData(nav);
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

            instance.get('/basedata', {
                schema: {
                    tags: ['public'],
                    querystring: {
                        type: 'object',
                        properties: {
                            page: {
                                type: 'string',
                                description: 'The page parameter, which can be a shortlink (sl|<uuid>), a BiS sheet (bis|<job>|<sheet>), or a legacy UUID.',
                            },
                            url: {
                                type: 'string',
                                description: 'A full URL to a sheet or set. If provided, it will be parsed for page, onlySetIndex, and selectedIndex. These can still be overridden by providing the specific parameters directly.',
                            },
                            onlySetIndex: {
                                type: 'integer',
                                description: 'If provided, only the set at this index will be loaded. This is often used for extracting a single set from a sheet.',
                            },
                            selectedIndex: {
                                type: 'integer',
                                description: 'The index of the set that should be selected by default.',
                            },
                            exportAsSheet: {
                                type: 'boolean',
                                description: 'If true, and the result would normally be a single set, it will be wrapped in a sheet export instead.',
                            },
                        },
                        additionalProperties: false,
                    },
                    response: {200: {$ref: 'BaseDataResponse#'}},
                },
            }, async (request: SheetRequest, reply) => {
                const merged = getMergedQueryParams(request);
                const path = merged[HASH_QUERY_PARAM] ?? '';
                const osIndex: number | undefined = tryParseOptionalIntParam(merged[ONLY_SET_QUERY_PARAM]);
                const selIndex: number | undefined = tryParseOptionalIntParam(merged[SELECTION_INDEX_QUERY_PARAM]);
                // This flag indicates that if the result would be a single set, that we instead want a full sheet.
                const exportAsSheet = merged[EXPORT_AS_SHEET_PARAM] === 'true';
                const pathPaths = path.split(PATH_SEPARATOR);
                const state = new NavState(pathPaths, osIndex, selIndex);
                const nav = parsePath(state);
                request.log.info(pathPaths, 'Path');
                const navResult = this.navDataService.resolveNavData(nav);
                // Must exist
                if (!(nav !== null && navResult !== null && navResult.sheetData !== null)) {
                    reply.status(404);
                    return;
                }
                // At this point, we have data but it could be either a set or sheet
                let exported: BaseDataResponse = await navResult.sheetData;
                const isSingleSet = !('sets' in exported);
                if (isSingleSet) {
                    // We have a single set.
                    // If this flag is set, convert it back to a full sheet.
                    if (exportAsSheet) {
                        exported = inflateSetExport(exported as SetExportExternalSingle);
                    }
                }
                else {
                    // We have a full sheet.
                    if (osIndex !== undefined) {
                        // user wants just a single set out of this sheet, so extract accordingly.
                        // This doesn't change the form of the data - it just filters everything else out of the 'sets' array.
                        const singleMaybe = extractSingleSetAsSheet(exported as SheetExport, osIndex);
                        if (singleMaybe === undefined) {
                            reply.status(500);
                            reply.send(`Error: Set index ${osIndex} is not valid.`);
                            return;
                        }
                        exported = singleMaybe;
                    }
                }
                reply.header("cache-control", "max-age=7200, public");
                reply.send(exported);
                return;
            });

            instance.get('/fulldata',
                {
                    schema: {
                        tags: ['public'],
                        querystring: {
                            type: 'object',
                            properties: {
                                page: {
                                    type: 'string',
                                    description: 'The page parameter, which can be a shortlink (sl|<uuid>), a BiS sheet (bis|<job>|<sheet>), or a legacy UUID.',
                                },
                                url: {
                                    type: 'string',
                                    description: 'A full URL to a sheet or set. If provided, it will be parsed for page, onlySetIndex, and selectedIndex. These can still be overridden by providing the specific parameters directly.',
                                },
                                onlySetIndex: {
                                    type: 'integer',
                                    description: 'If provided, only the set at this index will be loaded.',
                                },
                                selectedIndex: {
                                    type: 'integer',
                                    description: 'The index of the set that should be selected by default.',
                                },
                                partyBonus: {
                                    type: 'integer',
                                    description: 'Override the party bonus (0-5) for the calculation.',
                                },
                            },
                            additionalProperties: false,
                        },
                        response: {200: {$ref: 'FullDataResponse#'}},
                    },
                },
                async (request: SheetRequest, reply) => {
                    // TODO: deduplicate this code
                    const merged = getMergedQueryParams(request);
                    const path = merged[HASH_QUERY_PARAM] ?? '';
                    const osIndex: number | undefined = tryParseOptionalIntParam(merged[ONLY_SET_QUERY_PARAM]);
                    const selIndex: number | undefined = tryParseOptionalIntParam(merged[SELECTION_INDEX_QUERY_PARAM]);
                    const pathPaths = path.split(PATH_SEPARATOR);
                    const state = new NavState(pathPaths, osIndex, selIndex);
                    const nav = parsePath(state);
                    request.log.info(pathPaths, 'Path');
                    const navResult = this.navDataService.resolveNavData(nav);
                    if (nav !== null && navResult !== null && navResult.sheetData !== null) {
                        const exported: ExportedData = await navResult.sheetData;
                        const out: FullDataResponse = await importExportSheet(request, exported, nav);
                        reply.header("cache-control", "max-age=7200, public");
                        reply.send(out);
                        return;
                    }
                    reply.status(404);
                });

            // DEPRECATED - use /fulldata?page=sl|<uuid> instead
            instance.get('/fulldata/:uuid', {
                schema: {
                    deprecated: true,
                    tags: ['legacy'],
                    params: {
                        type: 'object',
                        properties: {uuid: {type: 'string'}},
                        required: ['uuid'],
                    },
                    response: {200: {$ref: 'FullDataResponse#'}},
                },
            }, async (request: SheetRequest, reply) => {
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
                const rawData = await this.getShortLink(request.params['uuid'] as string);
                const out = await importExportSheet(request, JSON.parse(rawData), nav);
                // @ts-expect-error - adding deprecation warning to response
                out['_DEPRECATION_WARNING'] = 'This endpoint is deprecated. Use /fulldata?page= or /fulldata?url= instead, e.g. /fulldata?page=sl|<uuid> instead.';
                reply.header("cache-control", "max-age=7200, public");
                reply.send(out);
            });

            // DEPRECATED - use /fulldata?page=bis|<job>|<sheet> instead
            instance.get('/fulldata/bis/:job/:sheet', {
                schema: {
                    deprecated: true,
                    tags: ['legacy'],
                    params: {
                        type: 'object',
                        properties: {
                            job: {type: 'string'},
                            sheet: {type: 'string'},
                        },
                        required: ['job', 'sheet'],
                    },
                    response: {200: {$ref: 'FullDataResponse#'}},
                },
            }, async (request: SheetRequest, reply) => {
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
                const rawData = await this.bisService.getBisSheet([request.params['job'] as JobName, request.params['sheet'] as string]);
                const out = await importExportSheet(request, JSON.parse(rawData), nav);
                // @ts-expect-error - adding deprecation warning to response
                out['_DEPRECATION_WARNING'] = 'This endpoint is deprecated. Use /fulldata?page= or /fulldata?url= instead, e.g. /fulldata?page=bis|<job>|<sheet> instead.';
                reply.header("cache-control", "max-age=7200, public");
                reply.send(out);
            });

            // DEPRECATED - use /fulldata?page=bis|<job>|<folder>|<sheet> instead
            instance.get('/fulldata/bis/:job/:folder/:sheet', {
                schema: {
                    deprecated: true,
                    tags: ['legacy'],
                    params: {
                        type: 'object',
                        properties: {
                            job: {type: 'string'},
                            folder: {type: 'string'},
                            sheet: {type: 'string'},
                        },
                        required: ['job', 'folder', 'sheet'],
                    },
                    response: {200: {$ref: 'FullDataResponse#'}},
                },
            }, async (request: SheetRequest, reply) => {
                const osIndex: number | undefined = tryParseOptionalIntParam(request.query[ONLY_SET_QUERY_PARAM]);
                const selIndex: number | undefined = tryParseOptionalIntParam(request.query[SELECTION_INDEX_QUERY_PARAM]);
                const nav: NavPath = {
                    type: 'bis',
                    job: request.params['job'] as JobName,
                    sheet: request.params['sheet'],
                    path: [request.params['job'], request.params['folder'], request.params['sheet']],
                    onlySetIndex: osIndex,
                    defaultSelectionIndex: selIndex,
                    embed: false,
                    viewOnly: true,
                };
                const rawData = await this.bisService.getBisSheet([request.params['job'] as JobName, request.params['folder'] as string, request.params['sheet'] as string]);
                const out = await importExportSheet(request, JSON.parse(rawData), nav);
                // @ts-expect-error - adding deprecation warning to response
                out['_DEPRECATION_WARNING'] = 'This endpoint is deprecated. Use /fulldata?page= or /fulldata?url= instead, e.g. /fulldata?page=bis|<job>|<folder>|<sheet> instead.';
                reply.header("cache-control", "max-age=7200, public");
                reply.send(out);
            });

            // Creates a shortlink, and returns the canonical URL for it, both in normal and embedded form.
            instance.put('/putset', {
                schema: {
                    tags: ['public'],
                    body: {$ref: 'SetExportExternalSingle#'},
                    response: {200: {$ref: 'PutSetResponse#'}},
                },
            }, async (request: FastifyRequest<{
                Body: SetExportExternalSingle,
            }>, reply) => {
                try {
                    const b = request.body;
                    if (!isValidSet(b)) {
                        reply.code(400).send({error: 'Body must be a single set export'});
                        return;
                    }
                    const contentStr = JSON.stringify(b);
                    const normalUrl = await this.shortlinkService.putShortLink(contentStr, false);
                    const embedUrl = toEmbedUrl(normalUrl);
                    const out: PutSetResponse = {
                        url: normalUrl.toString(),
                        embedUrl: embedUrl.toString(),
                    };
                    reply.send(out);
                }
                catch (e) {
                    request.log.error(e, 'Error creating set shortlink');
                    reply.code(500).send({error: 'Failed to create set shortlink'});
                }
            });
            // Creates a shortlink for a full sheet, and per-set links.
            // The per-set links include an onlySetIndex link, an onlySetIndex+embed link, and a selectedIndex link.
            instance.put('/putsheet', {
                schema: {
                    tags: ['public'],
                    body: {$ref: 'SheetExport#'},
                    response: {200: {$ref: 'PutSheetResponse#'}},
                },
            }, async (request: FastifyRequest<{
                Body: SheetExport,
            }>, reply) => {
                try {
                    const b = request.body;
                    if (!isValidSheet(b)) {
                        reply.code(400).send({error: 'Body must be a sheet export'});
                        return;
                    }
                    const contentStr = JSON.stringify(b);
                    const baseUrl = await this.shortlinkService.putShortLink(contentStr, false);
                    const setsOut: PutSheetResponse['sets'] = [];
                    const sheet = b as unknown as SheetExport;
                    for (let i = 0; i < sheet.sets.length; i++) {
                        const set = sheet.sets[i];
                        // Skip separators
                        if (set && !set.isSeparator) {
                            // Start with the base URL and add the onlySetIndex parameter
                            const setUrl = new URL(baseUrl.toString());
                            setUrl.searchParams.set(ONLY_SET_QUERY_PARAM, i.toString());
                            // Modify it into the embed URL as well
                            const embedSetUrl = toEmbedUrl(setUrl);
                            // Start over for the pre-select URL
                            const preSelectUrl = new URL(baseUrl.toString());
                            preSelectUrl.searchParams.set(SELECTION_INDEX_QUERY_PARAM, i.toString());
                            setsOut.push({
                                index: i,
                                url: setUrl.toString(),
                                embedUrl: embedSetUrl.toString(),
                                preSelectUrl: preSelectUrl.toString(),
                            });
                        }
                    }
                    const out: PutSheetResponse = {
                        url: baseUrl.toString(),
                        sets: setsOut,
                    };
                    reply.send(out);
                }
                catch (e) {
                    request.log.error(e, 'Error creating sheet shortlinks');
                    reply.code(500).send({error: 'Failed to create sheet shortlinks'});
                }
            });
        });
    }

    private async getShortLink(param: string) {
        return await this.shortlinkService.getShortLink(param);
    }
}

function isValidSet(b: unknown): b is SetExportExternalSingle {
    return isRecord(b) && !('sets' in b);
}

function isValidSheet(b: unknown): b is SheetExport {
    return isRecord(b) && 'sets' in b && Array.isArray((b as {
        sets?: unknown
    }).sets);
}

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
        const parsed = parseFloat(pb);
        if (!isNaN(parsed) && Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_PARTY_BONUS) {
            sheet.partyBonus = parsed as PartyBonusAmount;
        }
        else {
            throw Error(`Party bonus '${pb}' is invalid`);
        }
    }
    await sheet.load();
    return sheet.exportSheet(ExportTypes.FullStatsExport);
}
