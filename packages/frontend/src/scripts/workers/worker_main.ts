import {HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {GearsetGenerationWorker} from "./meld_generation_worker";
import {SolverSimulationRunner} from "./simulation_worker";
import {DataManager, makeDataManager} from "@xivgear/core/datamanager";
import {JobInfo, postMsg} from "./worker_common";
import {PingWorker} from "./ping_worker";
import {
    AnyJobContext,
    AnyWorkRequest,
    MainToWorkerMessage,
    WorkerToMainMessage,
    WorkResponseDone
} from "@xivgear/core/workers/worker_types";

const originalConsoleValues = {
    log: console.log,
    info: console.info,
    trace: console.trace,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
} as const satisfies Partial<typeof console>;

/**
 * Special version of console that silences everything except error
 */
const silencedConsoleValues = {
    log: () => {
    },
    info: () => {
    },
    trace: () => {
    },
    debug: () => {
    },
    warn: () => {
    },
    // Keep error intact
    error: console.error,
} as const satisfies typeof originalConsoleValues;

function blockConsoleSpam() {
    Object.assign(console, silencedConsoleValues);
}

function resetConsoleToDefault() {
    Object.assign(console, originalConsoleValues);
}

let workerSimsReady: Promise<void> | null = null;

function loadWorkerSims(): Promise<void> {
    if (workerSimsReady === null) {
        workerSimsReady = import(/* webpackChunkName: "sims", webpackPreload: true */ "@xivgear/sims/default_sims")
            .then(({registerDefaultSims}) => registerDefaultSims());
    }
    return workerSimsReady;
}

let dataManager: DataManager | null = null;
onmessage = async function (event) {

    const msg = event.data as MainToWorkerMessage;
    const jobId = msg.jobId;
    try {

        const request: AnyWorkRequest = msg.req;
        if (request.jobType === "workerInitialization") {
            // This "sheet" is only used to get everything into the cache - it is never actually used.
            // We re-use the DataManager only.
            const sheet = HEADLESS_SHEET_PROVIDER.fromExport(request.sheet);
            dataManager = makeDataManager(sheet.allJobs, sheet.level, sheet.ilvlSync);
            await dataManager.loadData();

            const response: WorkResponseDone<AnyJobContext> = {
                responseType: "done",
                data: null,
            };
            this.postMessage({
                res: response,
                jobId: jobId,
            } satisfies WorkerToMainMessage<AnyJobContext>);
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
        if (request.jobType === "generateGearset") {
            // This sheet is fresh for each work request, but it re-uses an already-loaded DataManager.
            const sheet = HEADLESS_SHEET_PROVIDER.fromExport(request.sheet);
            await sheet.loadFromDataManager(dataManager);
            let gearsetGen = new GearsetGenerationWorker(sheet, jobInfo);
            await gearsetGen.execute(request);
            // TODO - not sure why this works to reduce memory but it does
            gearsetGen = undefined;
            return;
        }
        if (request.jobType === "solverSimulation") {
            blockConsoleSpam();
            // This sheet is fresh for each work request, but it re-uses an already-loaded DataManager.
            const sheet = HEADLESS_SHEET_PROVIDER.fromExport(request.sheet);
            await Promise.all([
                sheet.loadFromDataManager(dataManager),
                loadWorkerSims(),
            ]);
            await new SolverSimulationRunner(sheet, jobInfo).execute(request);
            return;
        }
    }
    catch (e) {
        resetConsoleToDefault();
        originalConsoleValues.error("Error in worker", e);
        postMsg({
            jobId: jobId,
            res: {
                responseType: 'error',
                data: e,
            },
        });
    }
    finally {
        resetConsoleToDefault();
    }
};
