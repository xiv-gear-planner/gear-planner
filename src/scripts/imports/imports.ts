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
    rawUuid: string
}

export type ImportSpec = JsonImportSpec | ShortlinkImportSpec | EtroImportSpec;

const importSheetUrlRegex = RegExp(".*/(?:viewsheet|importsheet)/(.*)$");
const importSetUrlRegex = RegExp(".*/(?:viewset|importset)/(.*)$");
const importShortlinkRegex = RegExp(".*/(?:sl|share)/(.*)$");
const etroRegex = RegExp("https:\/\/etro\.gg\/gearset\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})");

export function parseImport(text: string): ImportSpec {

    const slExec = importShortlinkRegex.exec(text);
    if (slExec !== null) {
        return {
            importType: "shortlink",
            rawUuid: slExec[1],
        }
    }
    const sheetExec = importSheetUrlRegex.exec(text);
    if (sheetExec !== null) {
        return {
            importType: "json",
            rawData: decodeURIComponent(sheetExec[1])
        }
    }
    const setExec = importSetUrlRegex.exec(text);
    if (setExec !== null) {
        return {
            importType: "json",
            rawData: decodeURIComponent(setExec[1])
        }
    }
    const etroExec = etroRegex.exec(text);
    // TODO: check level as well
    if (etroExec !== null) {
        return {
            importType: 'etro',
            rawUuid: etroExec[1],
        }
    }
    return null;
}
