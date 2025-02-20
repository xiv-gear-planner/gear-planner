import {HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {registerDefaultSims} from "@xivgear/core/sims/default_sims";
import {GearsetGenerationWorker} from "./meld_generation_worker";
import {AnyWorkRequest, AnyWorkResponse, MainToWorkerMessage, WorkerToMainMessage} from "./worker_pool";
import {SolverSimulationRunner} from "./simulation_worker";
import {makeDataManager} from "@xivgear/core/datamanager";
import {JobInfo, postMsg} from "./worker_common";
import {PingWorker} from "./ping_worker";

registerDefaultSims();
let dataManager = null;
onmessage = async function (event) {

    const msg = event.data as MainToWorkerMessage;
    const jobId = msg.jobId;
    try {

        const request: AnyWorkRequest = msg.req;
        if (request.jobType === "workerInitialization") {
            // This "sheet" is only used to get everything into the cache - it is never actually used.
            // We re-use the DataManager only.
            const sheet = HEADLESS_SHEET_PROVIDER.fromExport(request.sheet);
            dataManager = makeDataManager(sheet.classJobName, sheet.level, sheet.ilvlSync);
            await dataManager.loadData();

            const response: AnyWorkResponse = {
                responseType: "done",
                data: null,
            };
            this.postMessage({
                res: response,
                jobId: jobId,
            } satisfies WorkerToMainMessage);
            return;
        }

        const jobInfo: JobInfo = {
            jobId: jobId,
        };
        if (request.jobType === 'ping') {
            const pinger = new PingWorker(jobInfo);
            await pinger.execute(request);
            return;
        }
        // This sheet is fresh for each work request, but it re-uses an already-loaded DataManager.
        const sheet = HEADLESS_SHEET_PROVIDER.fromExport(request.sheet);
        await sheet.loadFromDataManager(dataManager);
        if (request.jobType === "generateGearset") {
            let gearsetGen = new GearsetGenerationWorker(sheet, jobInfo);
            await gearsetGen.execute(request);
            // TODO
            gearsetGen = undefined;
            return;
        }
        if (request.jobType === "solverSimulation") {
            await new SolverSimulationRunner(sheet, jobInfo).execute(request);
            return;
        }
    }
    catch (e) {
        postMsg({
            jobId: jobId,
            res: {
                responseType: 'error',
                data: e,
            },
        });
    }
};
