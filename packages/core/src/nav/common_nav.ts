import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {JobName} from "@xivgear/xivmath/xivconstants";

export const SHORTLINK_HASH = 'sl';
export const SHARE_LINK = 'https://share.xivgear.app/share/';
export const BIS_HASH = 'bis';
export const VIEW_SHEET_HASH = 'viewsheet';
export const VIEW_SET_HASH = 'viewset';
export const EMBED_HASH = 'embed';
export const PATH_SEPARATOR = '|';
export const HASH_QUERY_PARAM = 'page';
export const DEFAULT_NAME = 'XivGear - FFXIV Gear Planner';
export const DEFAULT_DESC = 'XivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

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
        }
    }
    if (path[0] === EMBED_HASH) {
        embed = true;
        path = path.slice(1);
    }
    const mainNav = path[0];
    if (path.length >= 2 && mainNav === "sheet") {
        return {
            type: 'saved',
            viewOnly: false,
            saveKey: path[1],
            embed: embed,
        }
    }
    else if (mainNav === "newsheet") {
        return {
            type: 'newsheet'
        }
    }
    else if (mainNav === "importsheet" || mainNav === VIEW_SHEET_HASH) {
        if (path.length === 1) {
            return {
                type: 'importform'
            }
        }
        else {
            const json = path.slice(1).join('/');
            const parsed = JSON.parse(decodeURI(json)) as SheetExport;
            return {
                type: 'sheetjson',
                jsonBlob: parsed,
                embed: embed,
                viewOnly: mainNav === VIEW_SHEET_HASH
            }
        }
    }
    else if (mainNav === "importset" || mainNav === VIEW_SET_HASH) {
        if (path.length === 1) {
            return {
                type: 'importform'
            }
        }
        else {
            const json = path.slice(1).join('/');
            const parsed = JSON.parse(decodeURI(json)) as SetExport;
            return {
                type: 'setjson',
                jsonBlob: parsed,
                embed: embed,
                viewOnly: mainNav === VIEW_SET_HASH
            }
        }
    }
    else if (mainNav === SHORTLINK_HASH) {
        return {
            type: 'shortlink',
            uuid: path[1],
            embed: embed,
            viewOnly: true
        }
    }
    else if (mainNav === BIS_HASH) {
        if (path.length >= 4) {
            return {
                type: 'bis',
                path: [path[1], path[2], path[3]],
                job: path[1] as JobName,
                expac: path[2],
                sheet: path[3],
                viewOnly: true,
                embed: embed
            }
        }
    }
    console.log('Unknown nav path', path);
    return null;
}

// TODO: this needs to account for the fact that '|' is a valid character in urls
// Using '/' previously was fine because it would simply get escaped
export function makeUrl(...pathParts: string[]): URL {
    return new URL(`?page=${pathParts.map(pp => encodeURIComponent(pp)).join(PATH_SEPARATOR)}`, document.location.toString());
}
