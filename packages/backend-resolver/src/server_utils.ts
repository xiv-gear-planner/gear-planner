import 'global-jsdom/register';
import './polyfills';
import {FastifyRequest} from "fastify";
import {SetExport, SetExportExternalSingle, SheetExport, TopLevelExport} from "@xivgear/xivmath/geartypes";
import {getBisIndexUrl, getBisSheet, getBisSheetFetchUrl} from "@xivgear/core/external/static_bis";
import {JOB_DATA, JobName} from "@xivgear/xivmath/xivconstants";
import {HASH_QUERY_PARAM, NavPath, PATH_SEPARATOR, splitHashLegacy} from "@xivgear/core/nav/common_nav";
import {getJobIcons} from "./preload_helpers";
import {ShortlinkService} from "@xivgear/core/external/shortlink_server";

export interface NavDataService {
    resolveNavData(nav: NavPath | null): NavResult | null;
}

export class NavDataServiceImpl implements NavDataService {
    constructor(readonly shortlinkService: ShortlinkService) {
    }

    resolveNavData(nav: NavPath | null): NavResult | null {
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
                return fillSheetData(
                    this.shortlinkService.getShortlinkFetchUrl(nav.uuid),
                    this.shortlinkService.getShortLink(nav.uuid).then(JSON.parse),
                    nav.onlySetIndex);
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
        multiJob: processed.then(p => p.multiJob),
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
        multiJob: Promise.resolve(false),
        name: Promise.resolve(label ? label + ' BiS' : undefined),
        fetchPreloads: [getBisIndexUrl()],
        imagePreloads: Promise.resolve(images),
        sheetData: null,
    };
}

export type ExportedData = SheetExport | SetExportExternalSingle;

export type SheetRequest = FastifyRequest<{
    Querystring: Record<string, string | undefined>;
    Params: Record<string, string>;
}>;

/**
 * getMergedQueryParams combines the normal query parameters with whatever is present on the URL provided via the ?url=
 * query parameter specifically. The normal query parameters take precedence.
 * @param request
 */
export function getMergedQueryParams(request: SheetRequest): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {...(request.query ?? {})};
    // Try to pull from the full URL provided via ?url=
    const urlRaw = request.query?.['url'];
    if (!urlRaw) {
        return result;
    }
    let decoded = urlRaw;
    try {
        decoded = decodeURIComponent(urlRaw);
    }
    catch (e) {
        // If decoding fails, assume it's already decoded
    }
    try {
        // Use a dummy base to handle relative URLs or bare query strings
        const u = new URL(decoded, 'https://dummy.invalid/');
        // Merge all params from the parsed URL, but do not override direct params
        u.searchParams.forEach((value, key) => {
            if (result[key] === undefined) {
                result[key] = value;
            }
        });
        // Also parse paths for hash-based URLs
        if (result[HASH_QUERY_PARAM] === undefined && u.hash) {
            const hashParts = splitHashLegacy(u.hash);
            if (hashParts.length > 0) {
                result[HASH_QUERY_PARAM] = hashParts.join(PATH_SEPARATOR);
            }
        }
    }
    catch (e) {
        // If URL parsing fails entirely, keep existing result
    }
    return result;
}

// function toEmbedUrl(normalUrl: URL): URL {
//     const out = new URL(normalUrl.toString());
//     const cur = out.searchParams.get(HASH_QUERY_PARAM) || '';
//     if (cur.startsWith(EMBED_HASH + PATH_SEPARATOR)) {
//         return out;
//     }
//     out.searchParams.set(HASH_QUERY_PARAM, `${EMBED_HASH}${PATH_SEPARATOR}${cur}`);
//     return out;
// }

// function isRecord(x: unknown): x is Record<string, unknown> {
//     return typeof x === 'object' && x !== null;
// }


type NavResult = {
    fetchPreloads: URL[],
    imagePreloads: Promise<URL[]>,
    sheetData: Promise<ExportedData> | null,
    name: Promise<string | undefined>,
    description: Promise<string | undefined>,
    job: Promise<JobName | undefined>,
    multiJob: Promise<boolean | undefined>,
}

type SheetSummaryData = {
    name: string | undefined,
    desc: string | undefined,
    job: JobName | undefined,
    multiJob: boolean,
}

