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
        timestamp: exportedInitial.timestamp,
        specialStats: exportedInitial.specialStats,
    } satisfies SetExportExternalSingle;
}

/**
 * Given a full sheet export, create a new full-sheet export containing only one of the sheets.
 *
 * @param exportedInitial
 * @param onlySetIndex
 * @returns the sheet with the single set extracted in the form of a Set Export, or undefined if the index is invalid
 */
export function extractSingleSetAsSheet(exportedInitial: SheetExport, onlySetIndex: number): SheetExport | undefined {
    if (!(onlySetIndex in exportedInitial.sets)) {
        return undefined;
    }
    const theSet = exportedInitial.sets[onlySetIndex];
    // noinspection AssignmentToFunctionParameterJS
    return {
        ...exportedInitial,
        sets: [theSet],
    } satisfies SheetExport;
}

/**
 * Re-inflate a single-set export (or multiple) into a full sheet export.
 *
 * This is a lightweight alternative to creating a full GearPlanSheet and calling load().
 *
 * @param importedData The single-set(s) to re-inflate.
 */
export function inflateSetExport(...importedData: SetExportExternalSingle[]): SheetExport {
    if (importedData.length === 0) {
        throw Error("Imported sets cannot be be empty");
    }
    return {
        race: importedData[0].race ?? undefined,
        sets: [...importedData],
        sims: importedData[0].sims ?? [],
        name: importedData[0].name ?? "Imported Set",
        saveKey: undefined,
        job: importedData[0].job!,
        level: importedData[0].level!,
        ilvlSync: importedData[0].ilvlSync,
        partyBonus: importedData[0].partyBonus ?? 0,
        customItems: importedData.flatMap(imp => imp.customItems ?? []),
        customFoods: importedData.flatMap(imp => imp.customFoods ?? []),
        timestamp: importedData[0].timestamp,
        isMultiJob: false,
        specialStats: importedData[0].specialStats ?? null,
    };
}
