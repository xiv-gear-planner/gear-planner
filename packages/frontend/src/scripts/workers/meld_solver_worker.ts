import './inject_placeholders';
// import 'global-jsdom/register';
import {SheetExport} from "@xivgear/xivmath/geartypes"
import {HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {MeldSolverSettingsExport} from "../components/meld_solver_bar";
import {MeldSolver} from "../components/meldsolver";
import {registerDefaultSims} from "../sims/default_sims";

registerDefaultSims();
onmessage = async function (ev) {
    const [sheetexp, exportedSolverSettings] = ev.data as [SheetExport, MeldSolverSettingsExport];
    const sheet = HEADLESS_SHEET_PROVIDER.fromExport(sheetexp);
    await sheet.load();

    const gearset = sheet.importGearSet(exportedSolverSettings.gearset);
    const sim = sheet.importSim(exportedSolverSettings.sim);
    const solveSettings = {
        ...exportedSolverSettings,
        gearset,
        sim,
    };

    const solver = new MeldSolver(sheet, solveSettings);
    this.postMessage(sheet.exportGearSet(await solver.solveMelds()));
}