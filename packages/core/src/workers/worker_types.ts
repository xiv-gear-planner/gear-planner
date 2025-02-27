import {SheetExport} from "@xivgear/xivmath/geartypes";
import {GearsetGenerationSettingsExport} from "../solving/gearset_generation";
import {SolverSimulationSettingsExport} from "../solving/sim_runner";

export type ResolveReject<T> = {
    resolve: (res: T) => void,
    reject: (rej: unknown) => void,
}

export type SheetWorkRequest<JobType extends string, RequestDataType> = {
    jobType: JobType,
    sheet: SheetExport;
    data: RequestDataType,
}

export type InitializationRequest = SheetWorkRequest<'workerInitialization', SheetExport>;
export type GearsetGenerationRequest = SheetWorkRequest<'generateGearset', GearsetGenerationSettingsExport>
export type SolverSimulationRequest = SheetWorkRequest<'solverSimulation', SolverSimulationSettingsExport>


export type PingData = {
    pingId: unknown,
    waitMs: number,
}

export type PingRequest = SheetWorkRequest<'ping', PingData>

// export type AnyWorkRequest = SheetWorkRequest<string, unknown>;
export type AnyWorkRequest =
    InitializationRequest
    | GearsetGenerationRequest
    | SolverSimulationRequest
    | PingRequest;

export type MainToWorkerMessage = {
    req: AnyWorkRequest,
    jobId: number,
}

export type WorkRequestInternal<T extends AnyJobContext> = {
    jobId: number,
    workerMessage: RequestTypeOf<T>,
    updateCallback: JobUpdateCallback<T> | undefined,
    promiseControl: ResolveReject<ResponseTypeOf<T>>,
    promise: Promise<ResponseTypeOf<T>>,
}

export type AnyJobContext = JobContext<AnyWorkRequest, unknown, unknown>;

export type WorkResponseUpdate<T extends AnyJobContext> = {
    responseType: 'update',
    data: UpdateTypeOf<T>,
}

export type WorkResponseDone<T extends AnyJobContext> = {
    responseType: 'done',
    data: ResponseTypeOf<T>,
}

export type WorkResponseError = {
    responseType: 'error',
    data: unknown,
}


export type RequestTypeOf<X extends AnyJobContext> = X extends JobContext<infer R, unknown, unknown> ? R : never;
export type UpdateTypeOf<X extends AnyJobContext> = X extends JobContext<AnyWorkRequest, infer U, unknown> ? U : never;
export type ResponseTypeOf<X extends AnyJobContext> = X extends JobContext<AnyWorkRequest, unknown, infer R> ? R : never;

export type AnyWorkResponse<T extends AnyJobContext> = WorkResponseUpdate<T> | WorkResponseDone<T> | WorkResponseError;

export type WorkerToMainMessage<T extends AnyJobContext> = {
    res: AnyWorkResponse<T>,
    jobId: number,
}

export type JobUpdateCallback<U extends JobContext<AnyWorkRequest, unknown, unknown>> = (updateValue: UpdateTypeOf<U>) => void

export type JobContext<Req extends AnyWorkRequest, Upd, Resp> = {
    dummyReq: Req,
    dummyUpd: Upd,
    dummyResp: Resp,
}

export type WorkerStatus = 'uninitialized' | 'idle' | 'processing' | 'terminated' | 'initializing';
