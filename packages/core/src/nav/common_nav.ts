import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {JobName} from "@xivgear/xivmath/xivconstants";
import {arrayEq} from "@xivgear/util/array_utils";

/** For loading saved sheets via UUID */
export const SHORTLINK_HASH = 'sl';
/** Obsolete */
export const SHARE_LINK = 'https://share.xivgear.app/share/';
/** For loading bis sheets */
export const BIS_HASH = 'bis';

/**
 * The BiS browser
 */
export const BIS_BROWSER_HASH = 'bisbrowser';

/** For viewing a sheet via json blob */
export const VIEW_SHEET_HASH = 'viewsheet';
/** For viewing an individual set via json blob */
export const VIEW_SET_HASH = 'viewset';
/** Prefix for embeds */
export const EMBED_HASH = 'embed';
/** Prefix for formula pages */
export const CALC_HASH = 'math';
/** The path separator */
export const PATH_SEPARATOR = '_';
/** The legacy path separator */
export const PATH_SEPARATOR_LEGACY = '|';
/** The query param used to represent the path */
export const HASH_QUERY_PARAM = 'page';

/**
 * The query param used to select a single gear set out of a sheet.
 */
export const ONLY_SET_QUERY_PARAM = 'onlySetIndex';

export const SELECTION_INDEX_QUERY_PARAM = 'selectedIndex';
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

/**
 * NavPath represents a more processed location of a page within the SPA. It encompasses the "type" of page (such as
 * a local sheet editor, the "my sheets" page, or a publicly-available set), and other relevant details, like
 * whether it is embedded or not, and view-only vs editable.
 */
export type NavPath = {
    type: 'mysheets',
} | {
    type: 'newsheet',
} | {
    type: 'importform'
} | {
    type: 'bisbrowser',
    path: string[],
    // TODO: more?
} | SheetBasePath & ({
    type: 'saved',
    saveKey: string
} | {
    type: 'shortlink',
    uuid: string,
    onlySetIndex?: number,
    defaultSelectionIndex?: number,
} | {
    type: 'setjson'
    jsonBlob: object
} | {
    type: 'sheetjson'
    jsonBlob: object
} | {
    type: 'bis',
    // TODO: is this being used anywhere?
    path: string[],
    job: JobName,
    folder?: string,
    sheet: string,
    onlySetIndex?: number,
    defaultSelectionIndex?: number,
});

export type SheetType = NavPath['type'];

/**
 * NavState represents a very raw location of a page within the SPA. It encompasses the `path` query parameter, as well
 * as a couple other optional parameters.
 *
 * {@link #parsePath} can turn a NavState into a NavPath.
 */
export class NavState {
    constructor(private readonly _path: string[], readonly onlySetIndex: number | undefined = undefined, readonly selectIndex: number | undefined = undefined) {
    }

    get path(): string[] {
        return [...this._path];
    }

    get encodedPath(): string {
        return this.path.map(part => encodeURIComponent(part)).join(PATH_SEPARATOR);
    }

    isEqual(other: NavState): boolean {
        return arrayEq(this._path, other._path) && this.onlySetIndex === other.onlySetIndex && this.selectIndex === other.selectIndex;
    }

    toString() {
        return `NavState(${this._path.join('|')}, ${this.onlySetIndex}, ${this.selectIndex})`;
    }
}

/**
 * Parse a NavState into a NavPath.
 *
 * @param state
 */
export function parsePath(state: NavState): NavPath | null {
    let path = state.path;
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
            const parsed = JSON.parse(decodeURIComponent(json)) as SheetExport;
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
            const parsed = JSON.parse(json) as SetExport;
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
                onlySetIndex: state.onlySetIndex,
                defaultSelectionIndex: state.selectIndex,
            };
        }
    }
    else if (mainNav === BIS_HASH) {
        if (path.length === 3) {
            return {
                type: 'bis',
                path: [path[1], path[2]],
                job: path[1] as JobName,
                sheet: path[2],
                viewOnly: true,
                embed: embed,
                onlySetIndex: state.onlySetIndex,
                defaultSelectionIndex: state.selectIndex,
            };
        }
        if (path.length >= 4) {
            return {
                type: 'bis',
                path: path.slice(1),
                job: path[1] as JobName,
                folder: path[2],
                sheet: path[path.length - 1],
                viewOnly: true,
                embed: embed,
                onlySetIndex: state.onlySetIndex,
                defaultSelectionIndex: state.selectIndex,
            };
        }
    }
    else if (mainNav === BIS_BROWSER_HASH) {
        embedWarn();
        return {
            type: 'bisbrowser',
            path: [...path.slice(1)],
        };
    }
    console.log('Unknown nav path', path);
    return null;
}

const VERTICAL_BAR_REPLACEMENT = '\u2758';

export function makeUrlSimple(...path: string[]): URL {
    return makeUrl(new NavState(path));
}

/**
 * Turns a NavState into a URL.
 *
 * @param navState
 */
export function makeUrl(navState: NavState): URL {
    const joinedPath = navState.path
        .map(pp => encodeURIComponent(pp))
        .map(pp => pp.replaceAll(PATH_SEPARATOR_LEGACY, VERTICAL_BAR_REPLACEMENT))
        .join(PATH_SEPARATOR);
    const currentLocation = document.location;
    const params = new URLSearchParams(currentLocation.search);
    const baseUrl = document.location.toString();
    params.delete(ONLY_SET_QUERY_PARAM);
    params.delete(SELECTION_INDEX_QUERY_PARAM);
    if (navState.onlySetIndex !== undefined) {
        params.set(ONLY_SET_QUERY_PARAM, navState.onlySetIndex.toString());
    }
    else if (navState.selectIndex !== undefined) {
        params.set(SELECTION_INDEX_QUERY_PARAM, navState.selectIndex.toString());
    }
    if (joinedPath.length > QUERY_PATH_MAX_LENGTH) {
        const oldStyleHash = [NO_REDIR_HASH, ...navState.path]
            .map(pp => encodeURIComponent(pp))
            .map(pp => '/' + pp)
            .join('');
        params.delete(HASH_QUERY_PARAM);
        return new URL(`?${params.toString()}#${oldStyleHash}`, baseUrl);
    }
    params.set(HASH_QUERY_PARAM, joinedPath);
    return new URL(`?${params.toString()}`, baseUrl);
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
 * e.g. for ?page=foo_bar, splitPath('foo_bar') => ['foo', 'bar']
 * or, legacy: for ?page=foo|bar, splitPath('foo|bar') => ['foo', 'bar']
 *
 * @param input The path, not including ?page=
 */
export function splitPath(input: string) {
    let separatorToUse = PATH_SEPARATOR;

    // If this link includes the old separator, use that instead.
    if (input.includes(VERTICAL_BAR_REPLACEMENT) || input.includes(PATH_SEPARATOR_LEGACY)) {
        separatorToUse = PATH_SEPARATOR_LEGACY;
    }

    return (input.startsWith(separatorToUse) ? input.substring(1) : input)
        .split(separatorToUse)
        .filter(item => item)
        .map(item => decodeURIComponent(item))
        .map(pp => pp.replaceAll(VERTICAL_BAR_REPLACEMENT, PATH_SEPARATOR_LEGACY));
}

export function tryParseOptionalIntParam(input: string | undefined): number | undefined {
    if (input) {
        try {
            return parseInt(input);
        }
        catch (e) {
            console.error(`Error parsing '${input}'`, e);
        }
    }
    return undefined;
}
