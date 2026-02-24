import {ServerBase} from "./server_base";
import {FastifyInstance} from "fastify";
import 'global-jsdom/register';
import './polyfills';
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
import {
    ExportedData,
    getMergedQueryParams,
    isRecord,
    NavDataService,
    SheetRequest,
    toEmbedUrl
} from "./server_utils";
import {FastifyRequest} from "fastify";

export type EmbedCheckResponse = {
    isValid: true,
} | {
    isValid: false,
    reason: string,
}

export class StatsServer extends ServerBase {

    constructor(private readonly shortlinkService: ShortlinkService, private readonly navDataService: NavDataService, private readonly bisService: BisService) {
        super();
    }

    setup(fastifyInstance: FastifyInstance): void {
        fastifyInstance.get('/validateEmbed', async (request: SheetRequest, reply) => {
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

        fastifyInstance.get('/basedata', async (request: SheetRequest, reply) => {
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

        fastifyInstance.get('/fulldata', async (request: SheetRequest, reply) => {
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
            const rawData = await this.getShortLink(request.params['uuid'] as string);
            const out = await importExportSheet(request, JSON.parse(rawData), nav);
            // @ts-expect-error - adding deprecation warning to response
            out['_DEPRECATION_WARNING'] = 'This endpoint is deprecated. Use /fulldata?page= or /fulldata?url= instead, e.g. /fulldata?page=sl|<uuid> instead.';
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
            const rawData = await this.bisService.getBisSheet([request.params['job'] as JobName, request.params['sheet'] as string]);
            const out = await importExportSheet(request, JSON.parse(rawData), nav);
            // @ts-expect-error - adding deprecation warning to response
            out['_DEPRECATION_WARNING'] = 'This endpoint is deprecated. Use /fulldata?page= or /fulldata?url= instead, e.g. /fulldata?page=bis|<job>|<sheet> instead.';
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
            const rawData = await this.bisService.getBisSheet([request.params['job'], request.params['folder'], request.params['sheet']]);
            const out = await importExportSheet(request, JSON.parse(rawData), nav);
            // @ts-expect-error - adding deprecation warning to response
            out['_DEPRECATION_WARNING'] = 'This endpoint is deprecated. Use /fulldata?page= or /fulldata?url= instead, e.g. /fulldata?page=bis|<job>|<folder>|<sheet> instead.';
            reply.header("cache-control", "max-age=7200, public");
            reply.send(out);
        });

        // Creates a shortlink, and returns the canonical URL for it
        // Creates shortlinks for a single set export; returns normal and embed URLs
        fastifyInstance.put('/putset', async (request: FastifyRequest<{
            Body: SetExportExternalSingle,
        }>, reply) => {
            try {
                const b = request.body;
                // Basic validation: must be an object and not contain a 'sets' array (which would indicate SheetExport)
                if (!isRecord(b) || Array.isArray((b as {sets?: unknown}).sets)) {
                    reply.code(400).send({error: 'Body must be a single set export object'});
                    return;
                }
                const contentStr = JSON.stringify(b);
                const normalUrl = await this.shortlinkService.putShortLink(contentStr, false);
                const embedUrl = toEmbedUrl(normalUrl);
                reply.send({url: normalUrl.toString(), embedUrl: embedUrl.toString()});
            }
            catch (e) {
                request.log.error(e, 'Error creating set shortlink');
                reply.code(500).send({error: 'Failed to create set shortlink'});
            }
        });
        // Creates a shortlink for a full sheet, and per-set links via onlySetIndex
        fastifyInstance.put('/putsheet', async (request: FastifyRequest<{
            Body: SheetExport,
        }>, reply) => {
            try {
                const b = request.body;
                // Basic validation: must be an object with a sets array
                if (!isRecord(b) || !('sets' in b) || !Array.isArray((b as {sets?: unknown}).sets)) {
                    reply.code(400).send({error: 'Body must be a sheet export object with a sets array'});
                    return;
                }
                const contentStr = JSON.stringify(b);
                const baseUrl = await this.shortlinkService.putShortLink(contentStr, false);
                const setsOut: { index: number, url: string, embedUrl: string }[] = [];
                const sheet = b as unknown as SheetExport;
                for (let i = 0; i < sheet.sets.length; i++) {
                    const set = sheet.sets[i];
                    if (set && !set.isSeparator) {
                        const setUrl = new URL(baseUrl.toString());
                        setUrl.searchParams.set(ONLY_SET_QUERY_PARAM, i.toString());
                        const embedSetUrl = toEmbedUrl(setUrl);
                        setsOut.push({index: i, url: setUrl.toString(), embedUrl: embedSetUrl.toString()});
                    }
                }
                reply.send({url: baseUrl.toString(), sets: setsOut});
            }
            catch (e) {
                request.log.error(e, 'Error creating sheet shortlinks');
                reply.code(500).send({error: 'Failed to create sheet shortlinks'});
            }
        });
    }

    private async getShortLink(param: string) {
        return await this.shortlinkService.getShortLink(param);
    }
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
