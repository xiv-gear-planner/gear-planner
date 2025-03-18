import {OccGearSlotKey, RawStatKey} from "@xivgear/xivmath/geartypes";
import {xivApiGet} from "./external/xivapi";
// 'Item' is only there because I need to figure out how to keep the type checking happy
// TODO: make a better way of doing this. matColsTrn represents the columns that are transitively included by way of
// including a sub-column.
// Food cols on the base Item table
// Food cols on the FoodItem table
export type IlvlSyncInfo = {
    readonly ilvl: number;
    substatCap(slot: OccGearSlotKey, statsKey: RawStatKey): number;
}

export function queryBaseParams() {
    return xivApiGet({
        requestType: "list",
        sheet: 'BaseParam',
        columns: ['Name', 'OneHandWeaponPercent', 'TwoHandWeaponPercent', 'BraceletPercent', 'ChestPercent', 'EarringPercent', 'FeetPercent', 'HandsPercent', 'HeadPercent', 'LegsPercent', 'NecklacePercent', 'OffHandPercent', 'RingPercent'] as const,
        columnsTrn: [],
    }).then(data => {
        console.log(`Got ${data.Results.length} BaseParams`);
        return data;
    });
}

// noinspection RedundantIfStatementJS
