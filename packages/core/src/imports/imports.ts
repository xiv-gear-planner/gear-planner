import {getBisSheet} from "../external/static_bis";
import {JobName} from "@xivgear/xivmath/xivconstants";

export const SHARED_SET_NAME = 'Imported Set';

export type JsonImportSpec = {
    importType: 'json',
    rawData: string
}
// TODO: also support bis links
export type ShortlinkImportSpec = {
    importType: 'shortlink',
    rawUuid: string
}
export type EtroImportSpec = {
    importType: 'etro',
    rawUuids: string[]
}
export type BisImportSpec = {
    importType: 'bis',
    path: Parameters<typeof getBisSheet>
}

export type ImportSpec = JsonImportSpec | ShortlinkImportSpec | EtroImportSpec | BisImportSpec;

const importSheetUrlRegex = RegExp(".*/(?:viewsheet|importsheet)/(.*)$");
const importSetUrlRegex = RegExp(".*/(?:viewset|importset)/(.*)$");
const importShortlinkRegex = RegExp(".*/(?:sl|share)/(.*)$");
const bisRegex = RegExp(".*/bis/(.*?)/(.*?)/(.*?)$");
const importSheetUrlRegexNew = RegExp(".*[&?]page=(?:viewsheet|importsheet)\\|(.*)$");
const importSetUrlRegexNew = RegExp(".*[&?]page=(?:viewset|importset)\\|(.*)$");
const importShortlinkRegexNew = RegExp(".*[&?]page=(?:sl|share)\\|(.*)$");
const bisRegexNew = RegExp(".*[&?]page=bis\\|(.*?)\\|(.*?)\\|(.*?)$");
const etroRegex = RegExp("https://etro\\.gg/gearset/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})");

export function parseImport(text: string): ImportSpec {

    text = text.replaceAll('%7C', '|');

    const slExec = importShortlinkRegex.exec(text) || importShortlinkRegexNew.exec(text);
    if (slExec !== null) {
        return {
            importType: "shortlink",
            rawUuid: slExec[1],
        }
    }
    const sheetExec = importSheetUrlRegex.exec(text) || importSheetUrlRegexNew.exec(text);
    if (sheetExec !== null) {
        return {
            importType: "json",
            rawData: decodeURIComponent(sheetExec[1])
        }
    }
    const setExec = importSetUrlRegex.exec(text)|| importSetUrlRegexNew.exec(text);
    if (setExec !== null) {
        return {
            importType: "json",
            rawData: decodeURIComponent(setExec[1])
        }
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
        }
    }
    const bisExec = bisRegex.exec(text) || bisRegexNew.exec(text);
    if (bisExec !== null) {
        return {
            importType: 'bis',
            path: [bisExec[1] as JobName, bisExec[2], bisExec[3]]
        }
    }
    try {
        JSON.parse(text);
        return {
            importType: 'json',
            rawData: text
        }
    }
    catch (e) {
        // Fall through to return
    }
    return null;
}
