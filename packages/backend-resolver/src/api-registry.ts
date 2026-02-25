import {
    FoodStatBonus,
    ItemsSlotsExport,
    MateriaMemoryExport,
    NormalOccGearSlotKey,
    RawStats,
    RelicStats,
    SetExportExternalSingle,
    SheetExport,
    SimExport
} from "@xivgear/xivmath/geartypes";
import {EmbedCheckResponse, PutSetResponse, PutSheetResponse} from "./stats_server";

export interface ApiSchemas {
    sheetExport: SheetExport;
    setExport: SetExportExternalSingle;
    foodStatBonus: FoodStatBonus;
    rawStats: RawStats;
    itemsSlotsExport: ItemsSlotsExport;
    materiaMemoryExport: MateriaMemoryExport;
    relicStats: RelicStats;
    simExport: SimExport;
    normalOccGearSlotKey: NormalOccGearSlotKey;
    embedCheckResponse: EmbedCheckResponse;
    putSetResponse: PutSetResponse;
    putSheetResponse: PutSheetResponse;
}
