import { SheetExport } from "@xivgear/xivmath/geartypes";
import { HEADLESS_SHEET_PROVIDER } from "@xivgear/core/sheet";
import { registerDefaultSims } from "@xivgear/core/sims/default_sims";
import { MeldSolverSettingsExport, MeldSolver } from "@xivgear/core/materia/meldsolver";

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