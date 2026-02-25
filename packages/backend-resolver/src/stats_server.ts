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

export type EmbedCheckResponse = {
    isValid: true,
} | {
    isValid: false,
    reason: string,
}

export type PutSetResponse = {
    /**
     * The direct URL to this set
     */
    url: string,
    /**
     * The embedded version of the direct URL to this set
     */
    embedUrl: string,
}

export type PutSheetResponse = {
    /**
     * The direct URL to the overall sheet.
     */
    url: string,
    /**
     * URLs for each individual set. Does not include separators. Use the index property to correlate them back to
     * sets in the original input.
     */
    sets: ({
        /**
         * The index of the set based on the original list.
         */
        index: number,
        /**
         * A URL which links to the sheet, but with this set pre-selected.
         */
        preSelectUrl: string,
    } & PutSetResponse)[],
}

export class StatsServer extends ServerBase {

    constructor(private readonly shortlinkService: ShortlinkService, private readonly navDataService: NavDataService, private readonly bisService: BisService) {
        super();
    }

    private registerSchemas(fastifyInstance: FastifyInstance): void {
        // Core inline schemas used by routes
        fastifyInstance.addSchema({
            $id: 'EmbedCheckResponse',
            anyOf: [
                {
                    type: 'object',
                    properties: { isValid: { type: 'boolean', const: true } },
                    required: ['isValid'],
                },
                {
                    type: 'object',
                    properties: { isValid: { type: 'boolean', const: false }, reason: { type: 'string' } },
                    required: ['isValid', 'reason'],
                }
            ]
        });
        fastifyInstance.addSchema({
            $id: 'PutSetResponse',
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The direct URL to this set' },
                embedUrl: { type: 'string', description: 'The embedded version of the direct URL to this set' },
            },
            required: ['url', 'embedUrl']
        });
        fastifyInstance.addSchema({
            $id: 'PutSheetResponse',
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The direct URL to the overall sheet.' },
                sets: {
                    type: 'array',
                    description: 'URLs for each individual set. Does not include separators. Use the index property to correlate them back to sets in the original input.',
                    items: {
                        type: 'object',
                        allOf: [
                            {
                                type: 'object',
                                properties: {
                                    index: { type: 'number', description: 'The index of the set based on the original list.' },
                                    preSelectUrl: { type: 'string', description: 'A URL which links to the sheet, but with this set pre-selected.' }
                                },
                                required: ['index', 'preSelectUrl']
                            },
                            {
                                type: 'object',
                                properties: {
                                    url: { type: 'string', description: 'The direct URL to this set' },
                                    embedUrl: { type: 'string', description: 'The embedded version of the direct URL to this set' }
                                },
                                required: ['url', 'embedUrl']
                            }
                        ]
                    }
                }
            },
            required: ['url', 'sets']
        });

        // Minimal but concrete schemas for key types used by the API so Swagger can render them
        fastifyInstance.addSchema({
            $id: 'RelicStats',
            type: 'object',
            additionalProperties: { type: 'number' }
        });
        fastifyInstance.addSchema({
            $id: 'MateriaMemoryExport',
            type: 'object',
            additionalProperties: true
        });
        fastifyInstance.addSchema({
            $id: 'ItemSlotExport',
            type: 'object',
            properties: {
                id: { type: 'number' },
                materia: {
                    type: 'array',
                    items: {
                        anyOf: [
                            { type: 'null' },
                            {
                                type: 'object',
                                properties: {
                                    id: { type: 'number' },
                                    locked: { type: 'boolean' }
                                },
                                required: ['id']
                            }
                        ]
                    }
                },
                relicStats: { $ref: 'RelicStats#' },
                forceNq: { type: 'boolean' }
            },
            required: ['id', 'materia']
        });
        fastifyInstance.addSchema({
            $id: 'ItemsSlotsExport',
            type: 'object',
            additionalProperties: {
                anyOf: [
                    { type: 'null' },
                    { $ref: 'ItemSlotExport#' }
                ]
            }
        });
        fastifyInstance.addSchema({
            $id: 'SimExport',
            type: 'object',
            properties: {
                stub: { type: 'string' },
                settings: { type: 'object', additionalProperties: true },
                name: { type: 'string' }
            },
            required: ['stub', 'settings']
        });
        fastifyInstance.addSchema({
            $id: 'SetExport',
            type: 'object',
            properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                items: { $ref: 'ItemsSlotsExport#' },
                food: { type: 'number' },
                relicStatMemory: { type: 'object', additionalProperties: { $ref: 'RelicStats#' } },
                materiaMemory: { $ref: 'MateriaMemoryExport#' },
                isSeparator: { type: 'boolean' },
                jobOverride: { anyOf: [{ type: 'string' }, { type: 'null' }] }
            },
            required: ['name', 'items']
        });
        fastifyInstance.addSchema({
            $id: 'SetExportExternalSingle',
            type: 'object',
            allOf: [ { $ref: 'SetExport#' } ],
            properties: {
                job: { type: 'string' },
                level: { type: 'number' },
                ilvlSync: { type: 'number' },
                sims: { type: 'array', items: { $ref: 'SimExport#' } },
                customItems: { type: 'array', items: { type: 'object', additionalProperties: true } },
                customFoods: { type: 'array', items: { type: 'object', additionalProperties: true } },
                partyBonus: { type: 'number', minimum: 0, maximum: 5 },
                race: { type: 'string' },
                timestamp: { type: 'number' },
                specialStats: { anyOf: [{ type: 'string' }, { type: 'null' }] }
            }
        });
        fastifyInstance.addSchema({
            $id: 'SheetExport',
            type: 'object',
            properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                saveKey: { type: 'string' },
                race: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                partyBonus: { type: 'number', minimum: 0, maximum: 5 },
                job: { type: 'string' },
                level: { type: 'number' },
                sets: { type: 'array', items: { $ref: 'SetExport#' } },
                sims: { type: 'array', items: { $ref: 'SimExport#' } },
                itemDisplaySettings: { type: 'object', additionalProperties: true },
                mfm: { type: 'string' },
                mfp: { type: 'array', items: { type: 'string' } },
                mfMinGcd: { type: 'number' },
                ilvlSync: { type: 'number' },
                customItems: { type: 'array', items: { type: 'object', additionalProperties: true } },
                customFoods: { type: 'array', items: { type: 'object', additionalProperties: true } },
                timestamp: { type: 'number' },
                isMultiJob: { type: 'boolean' },
                specialStats: { anyOf: [{ type: 'string' }, { type: 'null' }] }
            },
            required: ['name', 'job', 'level', 'sets']
        });
        fastifyInstance.addSchema({
            $id: 'SheetStatsExport',
            type: 'object',
            allOf: [ { $ref: 'SheetExport#' } ],
            properties: {
                sets: {
                    type: 'array',
                    items: {
                        allOf: [
                            { $ref: 'SetExport#' },
                            {
                                type: 'object',
                                properties: { computedStats: { type: 'object', additionalProperties: true } },
                                required: ['computedStats']
                            }
                        ]
                    }
                }
            }
        });

        // Optionally load generated JSON Schemas if present, but skip any invalid refs
        try {
            const schemaPath = path.resolve(__dirname, '../schemas/api-schemas.json');
            if (fs.existsSync(schemaPath)) {
                const raw = fs.readFileSync(schemaPath, { encoding: 'utf-8' });
                const apiSchemas = JSON.parse(raw) as Record<string, unknown> & { definitions?: Record<string, unknown> };
                if (apiSchemas.definitions && typeof apiSchemas.definitions === 'object') {
                    for (const [name, schema] of Object.entries(apiSchemas.definitions)) {
                        try {
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            fastifyInstance.addSchema({ $id: name, ...schema });
                        } catch (e) {
                            fastifyInstance.log.debug({ err: e, name }, 'Skipping invalid generated schema');
                        }
                    }
                }
            }
        } catch (e) {
            fastifyInstance.log.info({ err: e }, 'No or invalid generated API schemas; continuing with built-in schemas');
        }
    }

    setup(fastifyInstance: FastifyInstance): void {
        // Register Swagger only for the stats server
        fastifyInstance.register(fastifySwagger, {
            openapi: {
                info: { title: 'Gearplan API', version: '1.0.0' },
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
                                description: 'The page parameter, which can be a shortlink (sl|<uuid>), a BiS sheet (bis|<job>|<sheet>), or a legacy UUID.'
                            },
                            url: {
                                type: 'string',
                                description: 'A full URL to a sheet or set. If provided, it will be parsed for page, onlySetIndex, and selectedIndex. These can still be overridden by providing the specific parameters directly.'
                            },
                            onlySetIndex: {
                                type: 'integer',
                                description: 'If provided, only the set at this index will be loaded. This is often used for embedding a single set.'
                            },
                            selectedIndex: {
                                type: 'integer',
                                description: 'The index of the set that should be selected by default when the sheet is loaded.'
                            }
                        },
                        additionalProperties: false
                    },
                    response: { 200: { $ref: 'EmbedCheckResponse#' } }
                }
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
                                description: 'The page parameter, which can be a shortlink (sl|<uuid>), a BiS sheet (bis|<job>|<sheet>), or a legacy UUID.'
                            },
                            url: {
                                type: 'string',
                                description: 'A full URL to a sheet or set. If provided, it will be parsed for page, onlySetIndex, and selectedIndex. These can still be overridden by providing the specific parameters directly.'
                            },
                            onlySetIndex: {
                                type: 'integer',
                                description: 'If provided, only the set at this index will be loaded. This is often used for extracting a single set from a sheet.'
                            },
                            selectedIndex: {
                                type: 'integer',
                                description: 'The index of the set that should be selected by default.'
                            },
                            exportAsSheet: {
                                type: 'string',
                                enum: ['true','false'],
                                description: 'If true, and the result would normally be a single set, it will be wrapped in a sheet export instead.'
                            }
                        },
                        additionalProperties: false
                    },
                    response: { 200: { type: 'object', additionalProperties: true } }
                }
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
                let exported: ExportedData = await navResult.sheetData;
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

            instance.get('/fulldata', {
                schema: {
                    tags: ['public'],
                    querystring: {
                        type: 'object',
                        properties: {
                            page: {
                                type: 'string',
                                description: 'The page parameter, which can be a shortlink (sl|<uuid>), a BiS sheet (bis|<job>|<sheet>), or a legacy UUID.'
                            },
                            url: {
                                type: 'string',
                                description: 'A full URL to a sheet or set. If provided, it will be parsed for page, onlySetIndex, and selectedIndex. These can still be overridden by providing the specific parameters directly.'
                            },
                            onlySetIndex: {
                                type: 'integer',
                                description: 'If provided, only the set at this index will be loaded.'
                            },
                            selectedIndex: {
                                type: 'integer',
                                description: 'The index of the set that should be selected by default.'
                            },
                            partyBonus: {
                                type: 'string',
                                description: 'Override the party bonus (0-5) for the calculation.'
                            }
                        },
                        additionalProperties: false
                    },
                    response: { 200: { $ref: 'SheetStatsExport#' } }
                }
            }, async (request: SheetRequest, reply) => {
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
                    const out = await importExportSheet(request, exported as (SetExport | SheetExport), nav);
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
                    params: { type: 'object', properties: { uuid: { type: 'string' } }, required: ['uuid'] },
                    response: { 200: { type: 'object', additionalProperties: true } }
                }
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
                    params: { type: 'object', properties: { job: { type: 'string' }, sheet: { type: 'string' } }, required: ['job', 'sheet'] },
                    response: { 200: { type: 'object', additionalProperties: true } }
                }
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
                    params: { type: 'object', properties: { job: { type: 'string' }, folder: { type: 'string' }, sheet: { type: 'string' } }, required: ['job', 'folder', 'sheet'] },
                    response: { 200: { type: 'object', additionalProperties: true } }
                }
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
                    body: { $ref: 'SetExportExternalSingle#' },
                    response: { 200: { $ref: 'PutSetResponse#' } }
                }
            }, async (request: FastifyRequest<{
                Body: SetExportExternalSingle,
            }>, reply) => {
                try {
                    const b = request.body;
                    if (!isValidSet(b)) {
                        reply.code(400).send({ error: 'Body must be a single set export' });
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
                    reply.code(500).send({ error: 'Failed to create set shortlink' });
                }
            });
            // Creates a shortlink for a full sheet, and per-set links.
            // The per-set links include an onlySetIndex link, an onlySetIndex+embed link, and a selectedIndex link.
            instance.put('/putsheet', {
                schema: {
                    tags: ['public'],
                    body: { $ref: 'SheetExport#' },
                    response: { 200: { $ref: 'PutSheetResponse#' } }
                }
            }, async (request: FastifyRequest<{
                Body: SheetExport,
            }>, reply) => {
                try {
                    const b = request.body;
                    if (!isValidSheet(b)) {
                        reply.code(400).send({ error: 'Body must be a sheet export' });
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
                    reply.code(500).send({ error: 'Failed to create sheet shortlinks' });
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
