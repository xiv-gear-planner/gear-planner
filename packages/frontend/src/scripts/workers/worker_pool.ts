import { GearPlanSheet } from "@xivgear/core/sheet";
import { GearsetGenerationSettingsExport } from "@xivgear/core/solving/gearset_generation";
import { SolverSimulationSettingsExport } from "@xivgear/core/solving/sim_runner";
import { range } from "@xivgear/core/util/array_utils";
import { SheetExport } from "@xivgear/xivmath/geartypes";

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

export type AnyWorkRequest =
    InitializationRequest
    | GearsetGenerationRequest
    | SolverSimulationRequest;

type WorkRequestInternal = {
    jobId: number,
    request: AnyWorkRequest,
}

type WorkResponse<ResponseType extends string> = {
    responseType: ResponseType;
    data: unknown;
}

export type JobContext<Req extends AnyWorkRequest, Upd, Resp> = {
    dummyReq: Req,
    dummyUpd: Upd,
    dummyResp: Resp,
}

export type RequestTypeOf<X> = X extends JobContext<infer R, unknown, unknown> ? R : never;
export type UpdateTypeOf<X> = X extends JobContext<AnyWorkRequest, infer U, unknown> ? U : never;
export type ResponseTypeOf<X> = X extends JobContext<AnyWorkRequest, unknown, infer R> ? R : never;

export type AnyWorkResponse = WorkResponse<'update'> | WorkResponse<'done'> | WorkResponse<'error'>;

export class WorkerPool {

    workers: Worker[] = [];
    activeJobIds: Map<Worker, number> = new Map;
    messageQueue: WorkRequestInternal[] = [];
    resolves: Map<number, ResolveReject> = new Map;
    freeWorkers: Worker[] = [];
    updateCallbacks: Map<number, (data: unknown) => void> = new Map;

    get numFreeWorkers() {
        console.log(this.freeWorkers);
        return this.freeWorkers.length;
    }

    constructor(numWorkers: number) {

        this.currJobId = 0;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _i of range(0, numWorkers)) {
            const worker = this.makeActualWorker();
            this.workers.push(worker);
            this.freeWorkers.push(worker);
        }
    }

    private onWorkerMessage(worker: Worker, jobId: number, response: AnyWorkResponse) {

        if (response.responseType === 'update') {
            this.updateCallbacks.get(jobId)?.(response.data);
            return;
        }

        if (response.responseType === 'done') {
            this.resolves.get(jobId)?.resolve(response.data ?? null);
        } else { // response type === 'error'
            this.resolves.get(jobId)?.reject(response.data ?? null);
        }

        if (this.messageQueue.length !== 0) {
            const msg = this.messageQueue.pop();
            this.assignWorker(msg, worker);
            return;
        }

        this.activeJobIds.delete(worker);
        this.freeWorkers.push(worker);
    }

    private assignWorkerWithId(request: WorkRequestInternal, worker: Worker) {

    }

    private assignWorker(request: WorkRequestInternal, worker: Worker) {
        if (!worker) {
            console.error("assignWorker() called with null worker.");
            return;
        }

        this.activeJobIds.set(worker, request.jobId);

        worker.postMessage(request.request);
    }

    public requestWork(request: AnyWorkRequest, updateCallback?: (upd: unknown) => void): { promise: Promise<unknown>, jobId: number } {
        const internalRequest: WorkRequestInternal = {
            jobId: this.createJobId(),
            request: request
        };
        if (updateCallback) {
            this.updateCallbacks.set(internalRequest.jobId, updateCallback);
        }
        if (this.freeWorkers.length > 0) {
            this.assignWorker(internalRequest, this.freeWorkers.pop());
        } else {
            this.messageQueue.push(internalRequest);
        }

        return {
            promise: new Promise((resolve, reject) => {
                this.resolves.set(internalRequest.jobId, { resolve: resolve, reject: reject });
            }),
            jobId: internalRequest.jobId
        };
    }

    // Webpack sees this and it causes it to generate a separate js file for the worker.
    // import.meta.url doesn't actually work for this - we need to use document.location as shown in the ctor.
    private makeUselessWorker() {
        new Worker(new URL(
            // @ts-expect-error idk
            './worker_main.ts', import.meta.url)
        );
    }

    workerId = 0;

    private makeActualWorker(): Worker {
        const worker = new Worker(new URL(
            'src_scripts_workers_worker_main_ts.js', document.location.toString())
        , {
            name: 'worker-' + this.workerId++
        });
        worker.onmessage = (event) => {
            const id = this.activeJobIds.get(worker);
            this.onWorkerMessage(worker, id, event.data);
        };

        worker.onerror = (_event: ErrorEvent) => {
            this.freeWorkers.push(worker);
        };

        return worker;
    }

    public async initializeWorkers(sheet: GearPlanSheet) {
        const promises = [];
        if (this.freeWorkers.length !== this.workers.length) {
            console.error(`Can't initialize workers: Worker busy. Workers: ${this.workers.length}, free: ${this.freeWorkers.length}`);
            return;
        }
        const initReq: InitializationRequest = {
            jobType: 'workerInitialization',
            sheet: sheet.exportSheet(),
            data: undefined
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _w of this.workers) {

            promises.push(this.requestWork(initReq));
        }

        for (const promise of promises) {
            await promise;
            console.log("Promise done");
        }
    }

    currJobId: number = 0;
    private createJobId() {
        return this.currJobId++;
    }

    public async cancelJob(id: number, sheet: GearPlanSheet) {
        const worker = this.getWorkerByJobId(id);

        if (!worker) {
            return;
        }
        const idx = this.workers.indexOf(worker);

        worker.terminate();
        this.resolves.delete(this.activeJobIds.get(worker));
        this.updateCallbacks.delete(this.activeJobIds.get(worker));
        console.log("workers: ", this.workers);
        this.workers[idx] = this.makeActualWorker();

        /**Remove the worker in place. */

        //this.workers.push(worker);

        const initReq: InitializationRequest = {
            jobType: 'workerInitialization',
            sheet: sheet.exportSheet(),
            data: undefined
        };

        // Kinda hacky, but it works.
        //requestWork() pulls off the back of freeWorkers so we have a guarantee that the right worker gets init'ed
        this.freeWorkers.push(this.workers[idx]);
        await this.requestWork(initReq).promise;
    }

    getWorkerByJobId(idToGet: number): Worker | null {
        for (const [worker, id] of this.activeJobIds) {
            if (id === idToGet) {
                return worker;
            }
        }

        return null;
    }
}

// TODO: pool size
// Going too high seemed to slow it down even on a system with more than enough cores
export const workerPool: WorkerPool = new WorkerPool(4);
