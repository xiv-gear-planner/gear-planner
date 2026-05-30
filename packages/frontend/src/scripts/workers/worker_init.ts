import {WORKER_POOL} from "./worker_pool";

/**
 * Function to set up the web worker creator.
 *
 * This has to be offloaded into a separate file because the unit testing setup will fail if it sees a worker
 * import.
 */
export function initWebWorkers() {
    WORKER_POOL.setWorkerProvider((name: string) => {
        return new Worker(
            /* @ts-expect-error not a module */
            /* webpackChunkName: "worker_main" */ new URL('./worker_main', import.meta.url),
            {
                name: name,
            });
    });
}
