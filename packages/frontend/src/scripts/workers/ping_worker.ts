import {JobInfo, WorkerBehavior} from "./worker_common";
import {JobContext, PingData, PingRequest} from "./worker_pool";

export type PingContext = JobContext<PingRequest, never, PingData>;

export class PingWorker extends WorkerBehavior<PingContext> {

    constructor(jobInfo: JobInfo) {
        super(jobInfo);
    }

    override async execute(request: PingRequest) {
        await new Promise(r => setTimeout(r, request.data.waitMs));
        this.postResult(request.data);
    }
}
