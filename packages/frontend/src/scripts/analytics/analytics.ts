import {GearPlanSheet} from "@xivgear/core/sheet";
import {ExtraData, recordEvent} from "@xivgear/common-ui/analytics/analytics";

export function recordCurrentSheetEvent(eventName: string, extraData: ExtraData) {
    const sheet = window['currentSheet'];
    if (sheet instanceof GearPlanSheet) {
        recordSheetEvent(eventName, sheet, extraData);
    }
    else {
        recordEvent(eventName, extraData);
    }
}

export function recordSheetEvent(eventName: string, sheet: GearPlanSheet, extraData: ExtraData = {}) {
    const fullData = {
        // ...prepSheetData(sheet),
        ...extraData,
        sheet: prepSheetData(sheet),
    };
    recordEvent(eventName, fullData);
}

function prepSheetData(sheet: GearPlanSheet) {
    return {
        'job': sheet.classJobName,
        'level': sheet.level,
        'isync': sheet.ilvlSync,
    };
}
