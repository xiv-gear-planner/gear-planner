import {GearPlanSheet} from "@xivgear/core/sheet";
import {SETTINGS} from "@xivgear/common-ui/settings/persistent_settings";
import {
    AnyJobContext,
    InitializationRequest,
    JobUpdateCallback,
    MainToWorkerMessage,
    PingRequest,
    RequestTypeOf,
    ResponseTypeOf,
    UpdateTypeOf,
    WorkerStatus,
    WorkerToMainMessage,
    WorkRequestInternal
} from "@xivgear/core/workers/worker_types";
import {PingContext} from "./ping_worker";


let currJobId: number = 0;

function nextJobId(): number {
    return currJobId++;
}

function makeWorkRequest<T extends AnyJobContext>(request: RequestTypeOf<T>, updateCallback?: JobUpdateCallback<T>): {
    promise: Promise<ResponseTypeOf<T>>,
    jobId: number,
    internalRequest: WorkRequestInternal<T>
} {
    const jobId = nextJobId();
    let outerResolve: (value: ResponseTypeOf<T>) => void;
    let outerReject: (reason?: never) => void;
    const promise: Promise<ResponseTypeOf<T>> = new Promise((resolve, reject) => {
        outerResolve = resolve;
        outerReject = reject;
    });
    const internalRequest: WorkRequestInternal<T> = {
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
    private _activeWorkRequest: WorkRequestInternal<AnyJobContext> | null = null;

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
        if (this._activeWorkRequest !== null) {
            this._activeWorkRequest.promiseControl.reject("worker terminated");
        }
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

    /**
     * Start work on this worker.
     *
     * @param request The work request
     * @param isInitializer True if this is an initializer, false if this is a real workload.
     */
    startWork(request: WorkRequestInternal<AnyJobContext>, isInitializer: boolean = false) {
        if (!this.isFree && !isInitializer) {
            throw new Error(`Cannot assign work to worker when it is not ready (state '${this.status}')`);
        }
        this._status = isInitializer ? 'initializing' : 'processing';
        this._activeWorkRequest = request;
        this.post({
            jobId: request.jobId,
            req: request.workerMessage,
        });
        // Don't retain unnecessary memory
        request.workerMessage = null;
    }

    post(msg: MainToWorkerMessage) {
        this.worker.postMessage(msg);
    }

    async setSheet(sheet: GearPlanSheet): Promise<void> {
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

        const msg = event.data as WorkerToMainMessage<AnyJobContext>;
        const response = msg.res;

        if (this._activeWorkRequest === null || this._activeWorkRequest?.jobId !== msg.jobId) {
            // Job was already re-assigned, ignore result
            console.warn(`${this.name}: Ignoring obsolete job`);
            return;
        }
        if (response.responseType === 'update') {
            this._activeWorkRequest.updateCallback?.(response.data as UpdateTypeOf<AnyJobContext>);
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
        this._status = 'idle';
        this._activeWorkRequest = null;
        this.readyCallback();
    }

    private onError(_event: ErrorEvent) {
        this._activeWorkRequest.promiseControl.reject(_event ?? null);
        this.jobDone();
    }

    private reset() {
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
    messageQueue: WorkRequestInternal<AnyJobContext>[] = [];
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

    // This parameter is defaulted to 'never' as a workaround to force the parameter to be explicitly specified, as we
    // do not get adequate type checking without that.
    public submitTask<T extends AnyJobContext = never>(request: RequestTypeOf<T>, updateCallback?: JobUpdateCallback<T>): {
        promise: Promise<ResponseTypeOf<T>>,
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

    // TODO: this is called upon sheet load. It should be as minimal as possible.
    public async setSheet(sheet: GearPlanSheet) {
        this.currentSheet = sheet;
        const promises: Promise<unknown>[] = [];
        this.workers.forEach((worker: SheetWorker) => {
            promises.push(worker.setSheet(sheet).then(() => this.stateUpdate()));
        });
        await Promise.all(promises);
    }

    public cancelJob(id: number) {
        for (let i = 0; i < this.messageQueue.length; i++) {
            const msg = this.messageQueue[i];
            if (msg.jobId === id) {
                this.messageQueue.splice(i, 1);
                msg.promiseControl.reject("job canceled");
                return;
            }
        }
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
        const requested = this.submitTask<PingContext>(req);
        return requested.promise;
    }

}

// Logic for maxWorkers:
// If explicit override exists, use that.
// If navigator.hardwareConcurrency is not available, default to 4. Some browsers clamp or randomize hardwareConcurrency to prevent device fingerprinting.
// If it is, then clamp its value to between 4 and 24.
// Intensive meld solving frequently crashes on Chrome if the worker pool size is greater than 24.
const maxWorkers = SETTINGS.workersOverride ?? Math.min(24, Math.max((navigator.hardwareConcurrency || 4), 4));
console.log(`Worker pool size settings: explicit setting ${SETTINGS.workersOverride}, navigator.hardwareConcurrency ${navigator.hardwareConcurrency}, final value ${maxWorkers}`);
export const WORKER_POOL: WorkerPool = new WorkerPool(1, maxWorkers);


declare global {
    interface Window {
        workerPool: typeof WORKER_POOL;
    }
}

// Debugging
window.workerPool = WORKER_POOL;
