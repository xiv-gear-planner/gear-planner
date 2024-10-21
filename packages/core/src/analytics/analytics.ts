import {GearPlanSheet} from "../sheet";


type ExtraData = {
    [key: string]: unknown
}

export function recordEvent(name: string, data?: ExtraData) {
    try {
        const umami = window['umami'];
        // Don't blindly expect this to exist - someone might block the script with an adblocker, and we don't want
        // the rest of the site to blow up. It also might just be down.
        umami?.track(name, data);
    } catch (e) {
        console.error("Error recording analytics", e);
    }
}

export function recordCurrentSheetEvent(eventName: string, extraData: ExtraData) {
    const sheet = window['currentSheet'];
    if (sheet instanceof GearPlanSheet) {
        recordSheetEvent(eventName, sheet, extraData);
    } else {
        recordEvent(eventName, extraData);
    }
}

export function recordSheetEvent(eventName: string, sheet: GearPlanSheet, extraData: ExtraData = {}) {
    const fullData = {
        // ...prepSheetData(sheet),
        ...extraData,
        sheet: prepSheetData(sheet)
    };
    recordEvent(eventName, fullData);
}

function prepSheetData(sheet: GearPlanSheet) {
    return {
        'job': sheet.classJobName,
        'level': sheet.level,
        'isync': sheet.ilvlSync
    };
}
