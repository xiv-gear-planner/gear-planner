import {SetExportExternalSingle, SheetExport} from "@xivgear/xivmath/geartypes";

/**
 * Given a full sheet export, create a single-set export matching the containing sheet.
 *
 * @param exportedInitial
 * @param onlySetIndex
 * @returns the sheet with the single set extracted in the form of a Set Export, or undefined if the index is invalid
 */
export function extractSingleSet(exportedInitial: SheetExport, onlySetIndex: number): SetExportExternalSingle | undefined {
    if (!(onlySetIndex in exportedInitial.sets)) {
        return undefined;
    }
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
