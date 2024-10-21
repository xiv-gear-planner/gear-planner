import { AnyWorkRequest, JobContext, RequestTypeOf, ResponseTypeOf, UpdateTypeOf } from "./worker_pool";

export abstract class WorkerBehavior<X extends JobContext<AnyWorkRequest, unknown, unknown>> {

    postUpdate(update: UpdateTypeOf<X>) {
        postMessage({
            responseType: 'update',
            data: update,
        });
    }

    postResult(result: ResponseTypeOf<X>) {
        postMessage({
            responseType: 'done',
            data: result,
        });
    }

    postError(error: unknown) {
        postMessage({
            responseType: 'error',
            data: error,
        });
    }
    abstract execute(request: RequestTypeOf<X>): void;
}
