import './inject_placeholders';
// import 'global-jsdom/register';
import {SheetExport} from "@xivgear/xivmath/geartypes"
import {HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {MeldSolverSettingsExport} from "../components/meld_solver_bar";
import {MeldSolver} from "../components/meldsolver";
import {registerDefaultSims} from "../sims/default_sims";

onmessage = async function (ev) {
    console.log("starting work");
    const [sheetexp, exportedSolverSettings] = ev.data as [SheetExport, MeldSolverSettingsExport];
    const sheet = HEADLESS_SHEET_PROVIDER.fromExport(sheetexp);
    await sheet.load();
    registerDefaultSims();

    const gearset = sheet.importGearSet(exportedSolverSettings.gearset);
    const sim = sheet.importSim(exportedSolverSettings.sim);
    const solveSettings = {
        ...exportedSolverSettings,
        gearset,
        sim,
    };

    const solver = new MeldSolver(sheet, solveSettings);
    this.postMessage(await solver.solveMelds());
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