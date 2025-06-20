import {OccGearSlotKey, RawStatKey} from "@xivgear/xivmath/geartypes";
import {xivApiGet} from "./external/xivapi";

export type IlvlSyncInfo = {
    readonly ilvl: number;
    substatCap(slot: OccGearSlotKey, statsKey: RawStatKey): number;
}

// TODO: this is only being used for etro imports. If that were refactored to use the data api, then most of the
// remaining xivapi code could be deleted.
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
