import { HEADLESS_SHEET_PROVIDER } from "@xivgear/core/sheet";
import { registerDefaultSims } from "@xivgear/core/sims/default_sims";
import { GearsetGenerationWorker } from "./meld_generation_worker";
import { AnyWorkRequest, InitializationRequest, GearsetGenerationRequest, AnyWorkResponse, SolverSimulationRequest } from "./worker_pool";
import { SolverSimulationRunner } from "./simulation_worker";
import { makeDataManager } from "@xivgear/core/datamanager";

registerDefaultSims();
let dataManager = null;
onmessage = async function (event) {

    let request = event.data as AnyWorkRequest;
    if (request.jobType === "workerInitialization") {
        request = event.data as InitializationRequest;
        const sheet = HEADLESS_SHEET_PROVIDER.fromExport(request.sheet);
        dataManager = makeDataManager(sheet.classJobName, sheet.level, sheet.ilvlSync);
        await dataManager.loadData();
        // eslint-disable-next-line no-case-declarations
        const response: AnyWorkResponse = {
            responseType: "done",
            data: null,
        };
        this.postMessage(response);
        return;
    }
    const sheet = HEADLESS_SHEET_PROVIDER.fromExport(request.sheet);
    sheet.loadFromDataManager(dataManager);
    if (request.jobType === "generateGearset") {
        request = event.data as GearsetGenerationRequest;
        let gearsetGen = new GearsetGenerationWorker(sheet);
        await gearsetGen.execute(request);
        gearsetGen = undefined;
        return;
    }
    if (request.jobType === "solverSimulation") {
        request = event.data as SolverSimulationRequest;
        await new SolverSimulationRunner(sheet).execute(request);
        return;
    }
}