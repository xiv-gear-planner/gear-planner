import {SetExportExternalSingle, SheetExport} from "@xivgear/xivmath/geartypes";

/**
 * Given a full sheet export, create a single-set export matching the
 * @param exportedInitial
 * @param onlySetIndex
 */
export function extractSingleSet(exportedInitial: SheetExport, onlySetIndex: number | undefined): SetExportExternalSingle {
    const theSet = exportedInitial.sets[onlySetIndex];
    // noinspection AssignmentToFunctionParameterJS
    return {
        ...theSet,
        job: exportedInitial.job,
        level: exportedInitial.level,
        ilvlSync: exportedInitial.ilvlSync,
        sims: exportedInitial.sims,
        customItems: exportedInitial.customItems,
        customFoods: exportedInitial.customFoods,
        partyBonus: exportedInitial.partyBonus,
        race: exportedInitial.race,
    } satisfies SetExportExternalSingle;
}
