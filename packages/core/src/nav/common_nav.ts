import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {JobName} from "@xivgear/xivmath/xivconstants";

/** For loading saved sheets via UUID */
export const SHORTLINK_HASH = 'sl';
/** Obsolete */
export const SHARE_LINK = 'https://share.xivgear.app/share/';
/** For loading bis sheets */
export const BIS_HASH = 'bis';
/** For viewing a sheet via json blob */
export const VIEW_SHEET_HASH = 'viewsheet';
/** For viewing an individual set via json blob */
export const VIEW_SET_HASH = 'viewset';
/** Prefix for embeds */
export const EMBED_HASH = 'embed';
/** Prefix for formula pages */
export const CALC_HASH = 'math';
/** Path separator */
export const PATH_SEPARATOR = '|';
/** The query param used to represent the path */
export const HASH_QUERY_PARAM = 'page';
/**
 * Special hash value used to indicate that the page should stay with the old-style hash, rather than redirecting
 * to the new style query parameter.
 */
export const NO_REDIR_HASH = 'nore';
/** Max length before switching to fallback hash method (see {@link NO_REDIR_HASH} */
export const QUERY_PATH_MAX_LENGTH = 1000;
/**
 * Default name, used for social media previews. Used as the sheet name if the sheet has no name, otherwise
 * it is appended to the actual name.
 */
export const DEFAULT_NAME = 'XivGear - FFXIV Gear Planner';
/**
 * Default description, used for social media previews. Used as the sheet name if the sheet has no name, otherwise
 * it is appended to the actual name.
 */
export const DEFAULT_DESC = 'XivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';
// 60 is the recommended length for an og:title attribute. The default name is appended to this,
// e.g. "WHM 90 BiS - XivGear - FFXIV Gear Planner", so we need to leave room for the default name to
// be appended, as well as the " - " in the middle.
export const PREVIEW_MAX_NAME_LENGTH = 60 - DEFAULT_NAME.length - 3;
// 200 is well over the recommendation but discord still manages to hold the whole thing which is the
// important part here.
export const PREVIEW_MAX_DESC_LENGTH = 200;

export type SheetBasePath = {
    embed: boolean,
    viewOnly: boolean
}

export type NavPath = {
    type: 'mysheets',
} | {
    type: 'newsheet',
} | {
    type: 'importform'
} | (SheetBasePath & ({
    type: 'saved',
    saveKey: string
} | {
    type: 'shortlink',
    uuid: string
} | {
    type: 'setjson'
    jsonBlob: object
} | {
    type: 'sheetjson'
    jsonBlob: object
} | {
    type: 'bis',
    path: string[],
    job: JobName,
    expac: string,
    sheet: string,
}));

export type SheetType = NavPath['type'];

export function parsePath(originalPath: string[]): NavPath | null {
    let path = [...originalPath];
    let embed = false;
    if (path.length === 0) {
        return {
            type: 'mysheets',
        };
    }
    if (path[0] === EMBED_HASH) {
        embed = true;
        path = path.slice(1);
    }
    const mainNav = path[0];

    function embedWarn() {
        if (embed) {
            console.warn(`embed does not make sense with ${path}`);
        }
    }

    if (path.length >= 2 && mainNav === "sheet") {
        embedWarn();
        return {
            type: 'saved',
            viewOnly: false,
            saveKey: path[1],
            embed: false,
        };
    }
    else if (mainNav === "newsheet") {
        embedWarn();
        return {
            type: 'newsheet',
        };
    }
    else if (mainNav === "importsheet" || mainNav === VIEW_SHEET_HASH) {
        const viewOnly = mainNav === VIEW_SHEET_HASH;
        // Cannot embed a full sheet
        embedWarn();
        // TODO: weird case with ['viewsheet'] only - should handle better
        if (path.length === 1) {
            return {
                type: 'importform',
            };
        }
        else {
            const json = path.slice(1).join(PATH_SEPARATOR);
            const parsed = JSON.parse(decodeURI(json)) as SheetExport;
            return {
                type: 'sheetjson',
                jsonBlob: parsed,
                embed: false,
                viewOnly: viewOnly,
            };
        }
    }
    else if (mainNav === "importset" || mainNav === VIEW_SET_HASH) {
        // TODO: weird case with ['viewset'] only
        if (path.length === 1) {
            embedWarn();
            return {
                type: 'importform',
            };
        }
        else {
            const json = path.slice(1).join(PATH_SEPARATOR);
            const parsed = JSON.parse(decodeURI(json)) as SetExport;
            const viewOnly = mainNav === VIEW_SET_HASH;
            if (!viewOnly) {
                embedWarn();
                embed = false;
            }
            return {
                type: 'setjson',
                jsonBlob: parsed,
                embed: embed,
                viewOnly: viewOnly,
            };
        }
    }
    else if (mainNav === SHORTLINK_HASH) {
        if (path.length >= 2) {
            return {
                type: 'shortlink',
                uuid: path[1],
                embed: embed,
                viewOnly: true,
            };
        }
    }
    else if (mainNav === BIS_HASH) {
        embedWarn();
        if (path.length >= 4) {
            return {
                type: 'bis',
                path: [path[1], path[2], path[3]],
                job: path[1] as JobName,
                expac: path[2],
                sheet: path[3],
                viewOnly: true,
                embed: false,
            };
        }
    }
    console.log('Unknown nav path', path);
    return null;
}

const VERTICAL_BAR_REPLACEMENT = '\u2758';

export function makeUrl(...pathParts: string[]): URL {
    const joinedPath = pathParts
        .map(pp => encodeURIComponent(pp))
        .map(pp => pp.replaceAll(PATH_SEPARATOR, VERTICAL_BAR_REPLACEMENT))
        .join(PATH_SEPARATOR);
    const currentLocation = document.location;
    const params = new URLSearchParams(currentLocation.search);
    if (joinedPath.length > QUERY_PATH_MAX_LENGTH) {
        const oldStyleHash = [NO_REDIR_HASH, ...pathParts]
            .map(pp => encodeURIComponent(pp))
            .map(pp => '/' + pp)
            .join('');
        params.delete(HASH_QUERY_PARAM);
        return new URL(`?${params.toString()}#${oldStyleHash}`, document.location.toString());
    }
    params.set(HASH_QUERY_PARAM, joinedPath);
    return new URL(`?${params.toString()}`, document.location.toString());
}

/**
 * Given a legacy hash, split it into its parts (e.g. #/sl/1234 or /sl/1234 => ['sl', '1234']).
 *
 * @param input The legacy hash path
 */
export function splitHashLegacy(input: string) {
    return (input.startsWith("#") ? input.substring(1) : input).split('/').filter(item => item).map(item => decodeURIComponent(item));
}

/**
 * Given a page path, split it into constituent parts
 * (e.g. for ?page=foo|bar, splitPath('foo|bar') => ['foo', 'bar']
 *
 * @param input The path, not including ?page=
 */
export function splitPath(input: string) {
    return (input.startsWith(PATH_SEPARATOR) ? input.substring(1) : input)
        .split(PATH_SEPARATOR)
        .filter(item => item)
        .map(item => decodeURIComponent(item))
        .map(pp => pp.replaceAll(VERTICAL_BAR_REPLACEMENT, PATH_SEPARATOR));
    // TODO: replace | with a lookalike character?
    // .map(item => item.replaceAll())
}
