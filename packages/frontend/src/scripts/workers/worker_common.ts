import {
    AnyWorkRequest,
    AnyWorkResponse,
    JobContext,
    RequestTypeOf,
    ResponseTypeOf,
    UpdateTypeOf,
    WorkerToMainMessage
} from "./worker_pool";

export type JobInfo = {
    jobId: number,
}

export function postMsg(msg: WorkerToMainMessage) {
    postMessage(msg);
}

export abstract class WorkerBehavior<X extends JobContext<AnyWorkRequest, unknown, unknown>> {

    protected readonly jobId: number;

    protected constructor(jobInfo: JobInfo) {
        this.jobId = jobInfo.jobId;
    }

    post(response: AnyWorkResponse) {
        postMsg({
            res: response,
            jobId: this.jobId,
        });
    }

    postUpdate(update: UpdateTypeOf<X>) {
        this.post({
            responseType: 'update',
            data: update,
        });
    }

    postResult(result: ResponseTypeOf<X>) {
        this.post({
            responseType: 'done',
            data: result,
        });
    }

    postError(error: unknown) {
        this.post({
            responseType: 'error',
            data: error,
        });
    }

    abstract execute(request: RequestTypeOf<X>): void;
}

export const DEBUG_FINAL_REGISTRY = new FinalizationRegistry((item) => {
    console.info("Finalized " + item);
});
