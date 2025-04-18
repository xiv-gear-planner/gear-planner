import {getBisSheet} from "../external/static_bis";
import {JobName} from "@xivgear/xivmath/xivconstants";
import {
    HASH_QUERY_PARAM,
    NavState,
    ONLY_SET_QUERY_PARAM,
    parsePath,
    splitPath,
    tryParseOptionalIntParam
} from "../nav/common_nav";

export const SHARED_SET_NAME = 'Imported Set';

export type JsonImportSpec = {
    importType: 'json',
    rawData: string,
}
export type ShortlinkImportSpec = {
    importType: 'shortlink',
    rawUuid: string,
    onlySetIndex?: number,
}
export type EtroImportSpec = {
    importType: 'etro',
    rawUuids: string[],
}
export type BisImportSpec = {
    importType: 'bis',
    path: string[],
    onlySetIndex?: number,
}

export type ImportSpec = JsonImportSpec | ShortlinkImportSpec | EtroImportSpec | BisImportSpec;

const importSheetUrlRegex = RegExp(".*/(?:viewsheet|importsheet)/(.*)$");
const importSetUrlRegex = RegExp(".*/(?:viewset|importset)/(.*)$");
const importShortlinkRegex = RegExp(".*/(?:sl|share)/(.*)$");
// This can remain only supporting the old form, because no legacy URLs would have existed with the new URL style
const bisRegex = RegExp(".*/bis/(.*?)/(.*?)/(.*?)$");
const newStyleUrl = RegExp(".*[&?]page=(.*)$");
const etroRegex = RegExp("https://etro\\.gg/gearset/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})");

export function parseImport(text: string): ImportSpec {

    text = text.replaceAll('%7C', '|');

    const slExec = importShortlinkRegex.exec(text);
    if (slExec !== null) {
        return {
            importType: "shortlink",
            rawUuid: slExec[1],
        };
    }
    const sheetExec = importSheetUrlRegex.exec(text);
    if (sheetExec !== null) {
        return {
            importType: "json",
            rawData: decodeURIComponent(sheetExec[1]),
        };
    }
    const setExec = importSetUrlRegex.exec(text);
    if (setExec !== null) {
        return {
            importType: "json",
            rawData: decodeURIComponent(setExec[1]),
        };
    }
    const etroExec = etroRegex.exec(text);
    // TODO: check level as well
    if (etroExec !== null) {
        const etroMulti = RegExp(etroRegex, 'g');
        const uuids: string[] = [];
        let etroResult: RegExpExecArray;
        while ((etroResult = etroMulti.exec(text)) !== null) {
            uuids.push(etroResult[1]);
        }
        return {
            importType: 'etro',
            rawUuids: uuids,
        };
    }
    const bisExec = bisRegex.exec(text);
    if (bisExec !== null) {
        return {
            importType: 'bis',
            path: [bisExec[1] as JobName, bisExec[2], bisExec[3]],
        };
    }
    // Catch-all for new-style links
    const slNewExec = newStyleUrl.exec(text);
    if (slNewExec !== null) {
        try {
            const url = new URL(text.trim());
            const qp = url.searchParams;
            const path = qp.get(HASH_QUERY_PARAM) ?? '';
            const osIndex = tryParseOptionalIntParam(qp.get(ONLY_SET_QUERY_PARAM));
            const pathParts = splitPath(path);
            const importNav = new NavState(pathParts, osIndex, undefined);
            const parsed = parsePath(importNav);
            if (parsed) {
                switch (parsed.type) {
                    case "shortlink":
                        return {
                            importType: "shortlink",
                            rawUuid: parsed.uuid,
                            onlySetIndex: parsed.onlySetIndex,
                        };
                    case "setjson":
                    case "sheetjson":
                        return {
                            importType: "json",
                            // TODO: this should be revised as we don't need to double-parse the json
                            rawData: JSON.stringify(parsed.jsonBlob),
                        };
                    case "bis":
                        return {
                            importType: 'bis',
                            path: parsed.path,
                            onlySetIndex: parsed.onlySetIndex,
                        };
                    default:
                        return null;
                }
            }
        }
        catch (e) {
            console.error("This looks like a link, but did not parse correctly.", e);
        }
    }
    try {
        JSON.parse(text);
        return {
            importType: 'json',
            rawData: text,
        };
    }
    catch (_) {
        // Fall through to return
    }
    return null;
}
