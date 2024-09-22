import { SetExport, SheetExport } from "@xivgear/xivmath/geartypes"
import { GearPlanSheet } from "@xivgear/core/sheet";
import { MeldSolverSettingsExport } from "./meld_solver_bar";
import { MeldSolver } from "./meldsolver";


onmessage = function(ev) {
    console.log("starting work");
    let [sheetexp, exportedSolverSettings] = ev.data as [SheetExport, MeldSolverSettingsExport];
    let sheet = new GearPlanSheet("key", sheetexp);
    sheet.load();
    
    const gearset = sheet.importGearSet(exportedSolverSettings.gearset);
    const sim = sheet.importSim(exportedSolverSettings.sim);
    const solveSettings = {
        ...exportedSolverSettings,
        gearset,
        sim,
    }

    let solver = new MeldSolver(sheet, solveSettings);
    this.postMessage(solver.solveMelds());
    console.log("done!");
    /*
    let typedData = ev.data as SheetExport;
    let sheet = new GearPlanSheet("key", typedData);
    this.postMessage(sheet.classJobName);
    let [solver, settings] = typedData;

    if (!settings.sim) {
        this.postMessage(null);
        return;
    }

    let generatedSets = solver.getAllMeldCombinations(
        solver._gearset,
        settings.overwriteExistingMateria,
        settings.useTargetGcd ? (settings.targetGcd ?? NORMAL_GCD) : null);

    if (generatedSets.size == 0) {
        this.postMessage(null);
        return;
    }

    const bestSet = solver.simulateSets(
        generatedSets,
        settings.sim
    );

    this.postMessage(bestSet);
    */
}