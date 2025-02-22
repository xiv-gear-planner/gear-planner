import {GearPlanSheet} from "@xivgear/core/sheet";
import {GearsetGenerationSettingsExport} from "@xivgear/core/solving/gearset_generation";
import {SolverSimulationSettingsExport} from "@xivgear/core/solving/sim_runner";
import {SheetExport} from "@xivgear/xivmath/geartypes";
import {SETTINGS} from "@xivgear/common-ui/settings/persistent_settings";

type ResolveReject = {
    resolve: (res: unknown) => void,
    reject: (rej: unknown) => void,
}

type WorkRequest<JobType extends string, RequestDataType> = {
    jobType: JobType,
    sheet: SheetExport;
    data: RequestDataType,
}

export type InitializationRequest = WorkRequest<'workerInitialization', SheetExport>;
export type GearsetGenerationRequest = WorkRequest<'generateGearset', GearsetGenerationSettingsExport>
export type SolverSimulationRequest = WorkRequest<'solverSimulation', SolverSimulationSettingsExport>

export type PingData = {
    pingId: unknown,
    waitMs: number,
}

export type PingRequest = WorkRequest<'ping', PingData>
export type PingResponse = WorkResponse<'ping'>

export type AnyWorkRequest =
    InitializationRequest
    | GearsetGenerationRequest
    | SolverSimulationRequest
    | PingRequest;

export type MainToWorkerMessage = {
    req: AnyWorkRequest,
    jobId: number,
}

type WorkRequestInternal = {
    jobId: number,
    workerMessage: AnyWorkRequest,
    updateCallback: (upd: unknown) => void,
    promiseControl: ResolveReject,
    promise: Promise<unknown>,
}

type WorkResponse<ResponseType extends string> = {
    responseType: ResponseType;
    data: unknown;
}

export type RequestTypeOf<X> = X extends JobContext<infer R, unknown, unknown> ? R : never;
export type UpdateTypeOf<X> = X extends JobContext<AnyWorkRequest, infer U, unknown> ? U : never;
export type ResponseTypeOf<X> = X extends JobContext<AnyWorkRequest, unknown, infer R> ? R : never;

export type AnyWorkResponse = WorkResponse<'update'> | WorkResponse<'done'> | WorkResponse<'error'>;

export type WorkerToMainMessage = {
    res: AnyWorkResponse,
    jobId: number,
}

export type JobContext<Req extends AnyWorkRequest, Upd, Resp> = {
    dummyReq: Req,
    dummyUpd: Upd,
    dummyResp: Resp,
}

type WorkerStatus = 'uninitialized' | 'idle' | 'processing' | 'terminated' | 'initializing';

let currJobId: number = 0;

function nextJobId(): number {
    return currJobId++;
}

function makeWorkRequest(request: AnyWorkRequest, updateCallback?: (upd: unknown) => void): {
    promise: Promise<unknown>,
    jobId: number,
    internalRequest: WorkRequestInternal
} {
    const jobId = nextJobId();
    let outerResolve: (value: unknown) => void;
    let outerReject: (reason?: never) => void;
    const promise = new Promise((resolve, reject) => {
        outerResolve = resolve;
        outerReject = reject;
    });
    const internalRequest: WorkRequestInternal = {
        jobId: jobId,
        workerMessage: request,
        updateCallback: updateCallback,
        promiseControl: {
            resolve: outerResolve,
            reject: outerReject,
        },
        promise: promise,
    };
    return {
        internalRequest: internalRequest,
        jobId: jobId,
        promise: promise,
    };
}

class SheetWorker {

    private _status: WorkerStatus = 'uninitialized';
    private _activeWorkRequest: WorkRequestInternal | null = null;

    constructor(private readonly worker: Worker, readonly name: string, private readonly readyCallback: () => void) {
        worker.onmessage = (event) => {
            this.onMessage(event);
        };

        worker.onerror = (_event: ErrorEvent) => {
            this.onError(_event);
        };
    }

    terminate(): void {
        console.log(`${this.name}: Worker terminating - current status is '${this.status}'`);
        this._status = 'terminated';
        this.worker.terminate();
    }

    get status(): WorkerStatus {
        return this._status;
    }

    get isFree(): boolean {
        return this.status === 'idle';
    }

    get isInitializing(): boolean {
        return this.status === 'initializing';
    }

    startWork(request: WorkRequestInternal, isInitializer: boolean = false) {
        if (!this.isFree && !isInitializer) {
            throw new Error(`Cannot assign work to worker when it is not ready (state '${this.status}')`);
        }
        this._status = isInitializer ? 'initializing' : 'processing';
        this._activeWorkRequest = request;
        console.debug(`${this.name}: startWork for ${request.workerMessage.jobType}`);
        this.post({
            jobId: request.jobId,
            req: request.workerMessage,
        });
    }

    post(msg: MainToWorkerMessage) {
        this.worker.postMessage(msg);
    }

    async setSheet(sheet: GearPlanSheet): Promise<void> {
        console.debug(`${this.name}: setSheet`);
        this.reset();
        const innerReq: InitializationRequest = {
            sheet: sheet.exportSheet(),
            jobType: "workerInitialization",
            data: undefined,
        };
        const req = makeWorkRequest(innerReq);
        this.startWork(req.internalRequest, true);
        await req.promise;
    }

    private onMessage(event: MessageEvent) {

        console.debug(`${this.name}: onMessage`);
        // TODO: move jobId somewhere
        const msg = event.data as WorkerToMainMessage;
        const response = msg.res;
        console.debug(`response type: ${response.responseType}`);

        if (this._activeWorkRequest === null || this._activeWorkRequest?.jobId !== msg.jobId) {
            // Job was already re-assigned, ignore result
            console.warn(`${this.name}: Ignoring obsolete job`);
            return;
        }
        if (response.responseType === 'update') {
            this._activeWorkRequest.updateCallback(response.data);
            return;
        }
        else if (response.responseType === 'done') {
            this._activeWorkRequest.promiseControl.resolve(response.data ?? null);
            this.jobDone();
            return;
        }
        else if (response.responseType === 'error') {
            this._activeWorkRequest.promiseControl.reject(response.data ?? null);
            this.jobDone();
            return;
        }
        else {
            // @ts-expect-error fallback in case of unknown value
            console.error(`${this.name}: Unknown worker response type, terminating: '${response.responseType}'`);
        }
    }

    private jobDone() {
        console.debug(`${this.name}: jobDone`);
        this._status = 'idle';
        this._activeWorkRequest = null;
        this.readyCallback();
    }

    private onError(_event: ErrorEvent) {
        console.debug(`${this.name}: onError`);
        this._activeWorkRequest.promiseControl.reject(_event ?? null);
        this.jobDone();
    }

    private reset() {
        console.debug(`${this.name}: reset`);
        this._status = 'uninitialized';
        if (this._activeWorkRequest !== null) {
            this._activeWorkRequest.promiseControl.reject("worker reset");
            this._activeWorkRequest = null;
        }
    }

    get activeJobId(): number | null {
        return this._activeWorkRequest?.jobId ?? null;
    }
}

export class WorkerPool {

    workers: SheetWorker[] = [];
    messageQueue: WorkRequestInternal[] = [];
    currentSheet: GearPlanSheet | null = null;

    constructor(readonly minWorkers: number, readonly maxWorkers: number) {
        console.log(`WorkerPool starting. minWorkers ${minWorkers}, maxWorkers ${maxWorkers}`);
        this.stateUpdate();
    }

    get numFreeWorkers() {
        return this.workers.filter(worker => worker.isFree).length;
    }

    get numInitializingWorkers() {
        return this.workers.filter(worker => worker.isInitializing).length;
    }

    /**
     * Get a free worker, or null if there are no free workers.
     * @private
     */
    private getFreeWorker(): SheetWorker | null {
        return this.workers.find(worker => worker.isFree) ?? null;
    }

    /**
     * Add a new worker. The worker will initially be in "initializing" state, but it is immediately added to the
     * list.
     *
     * @private
     */
    private addNewWorker(doStateUpdate: boolean = true): void {
        const worker = this.makeActualWorker();
        this.workers.push(worker);
        if (this.currentSheet !== null) {
            worker.setSheet(this.currentSheet).then(() => this.stateUpdate());
        }
        if (doStateUpdate) {
            this.stateUpdate();
        }
    }

    /**
     * stateUpdate must be called any time that work is added to the queue, or a worker becomes available.
     * @private
     */
    private stateUpdate() {
        // First, remove any workers in terminated state
        let i = this.workers.length;
        while (i--) {
            if (this.workers[i].status === 'terminated') {
                console.log("Removing terminated worker");
                this.workers.splice(i, 1);
            }
        }

        // Then, if the number of current workers is fewer than the minWorkers param (e.g. due to termination),
        // add new workers.
        while (this.workers.length < this.minWorkers) {
            this.addNewWorker(false);
        }
        // Try assigning messages to workers
        while (this.messageQueue.length > 0) {
            const worker: SheetWorker | null = this.getFreeWorker();
            if (worker === null) {
                // No more free workers, break the loop.
                break;
            }
            const msg = this.messageQueue.pop();
            worker.startWork(msg);
        }

        // If the number of pending tasks is greater than the number of free + initializing workers, add more workers,
        // up to the maximum.
        // Number of ready workers
        const freeWorkers = this.numFreeWorkers;
        // Number of initializing workers. If we have 5 tasks in queue, we would initialize 5, but we shouldn't try to
        // initialize another 5 just because those 5 aren't ready yet.
        const initializingWorkers = this.numInitializingWorkers;
        // Number of pending tasks.
        const pendingTasks = this.messageQueue.length;
        // Current number of workers.
        const currentNumWorkers = this.workers.length;
        // How many additional workers we would like.
        const additionalDesiredWorkers = pendingTasks - (freeWorkers + initializingWorkers);
        if (additionalDesiredWorkers > 0) {
            // How many new workers to create
            const desiredNewWorkers = Math.min(this.maxWorkers - currentNumWorkers, additionalDesiredWorkers);
            console.log(`creating ${desiredNewWorkers} new workers (current: ${currentNumWorkers}); free: ${freeWorkers}; init: ${initializingWorkers}; pending: ${pendingTasks})`);
            for (let j = 0; j < desiredNewWorkers; j++) {
                this.addNewWorker(false);
            }
        }
    }

    public submitTask(request: AnyWorkRequest, updateCallback?: (upd: unknown) => void): {
        promise: Promise<unknown>,
        jobId: number
    } {
        const inner = makeWorkRequest(request, updateCallback);
        this.messageQueue.push(inner.internalRequest);
        this.stateUpdate();
        return {
            promise: inner.promise,
            jobId: inner.jobId,
        };
    }

    // Webpack sees this and it causes it to generate a separate js file for the worker.
    // import.meta.url doesn't actually work for this - we need to use document.location as shown in the ctor.
    // noinspection JSUnusedLocalSymbols
    private makeUselessWorker() {
        new Worker(new URL(
            // @ts-expect-error idk
            './worker_main.ts', import.meta.url)
        );
    }

    workerId = 0;

    private makeActualWorker(): SheetWorker {
        const name = 'worker-' + this.workerId++;
        console.log(`Creating worker ${name}`);
        const worker = new Worker(
            new URL('src_scripts_workers_worker_main_ts.js',
                document.location.toString()),
            {
                name: name,
            });
        return new SheetWorker(worker, name, () => this.stateUpdate());
    }

    public async setSheet(sheet: GearPlanSheet) {
        this.currentSheet = sheet;
        const promises = [];
        this.workers.forEach((worker: SheetWorker) => {
            promises.push(worker.setSheet(sheet).then(() => this.stateUpdate()));
        });
        await Promise.all(promises);
    }

    public async cancelJob(id: number) {
        for (const wrk of this.workers) {
            if (wrk.activeJobId === id) {
                wrk.terminate();
            }
        }
        this.stateUpdate();
    }

    public async ping<X>(value: X, waitMs: number) {
        const req: PingRequest = {
            data: {
                pingId: value,
                waitMs: waitMs,
            },
            jobType: "ping",
            sheet: undefined,
        };
        const requested = this.submitTask(req);
        return requested.promise;
    }

}

// Logic for maxWorkers:
// If explicit override exists, use that.
// If navigator.hardwareConcurrency is not available, default to 4. Some browsers clamp or randomize hardwareConcurrency to prevent device fingerprinting.
// If it is, then clamp its value to between 4 and 24.
// Intensive meld solving frequently crashes on Chrome if the worker pool size is greater than 24.
const maxWorkers = SETTINGS.workersOverride ?? Math.min(24, Math.max((navigator.hardwareConcurrency || 4), 4));
export const WORKER_POOL: WorkerPool = new WorkerPool(1, maxWorkers);

// Debugging
window['workerPool'] = WORKER_POOL;
