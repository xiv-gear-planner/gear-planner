import {wrapChunkLoad} from "../../util/chunk_import";

function moduleExports<T extends object>(module: T): T {
    const wrappedModule = module as T & {exports?: T; default?: T; 'module.exports'?: T};
    return wrappedModule.exports ?? wrappedModule.default ?? wrappedModule['module.exports'] ?? module;
}

/**
 * How the Async sim loading works:
 *
 * The sim runtime and its GUI registration are loaded as async chunks. Webpack shares the runtime chunk with workers,
 * while keeping the DOM-dependent GUI code in the browser. For a sheet with no sims, or an embed, don't wait for it.
 */
export class AsyncSimLoader {

    private aload: Promise<unknown> | null = null;

    async load(): Promise<void> {
        if (this.aload === null) {
            this.aload = Promise.all([
                wrapChunkLoad(Promise.all([
                    import(/* webpackChunkName: "sims", webpackPreload: true */ '@xivgear/sims/default_sims'),
                    import(/* webpackChunkName: "sim-guis", webpackPreload: true */ '@xivgear/gearplan-frontend/sims/registration/default_sim_guis'),
                ]).then(([simRuntime, guiRegistration]) => {
                    const makeFail = new URLSearchParams(window.location.search).get('_debugMakeSimChunkFail') === 'true';
                    if (makeFail) {
                        throw new Error("Sim chunk load failure (debug)");
                    }
                    return {
                        simRuntime: moduleExports(simRuntime),
                        guiRegistration: moduleExports(guiRegistration),
                    };
                })).then(({simRuntime, guiRegistration}) => {
                    simRuntime.registerDefaultSims();
                    guiRegistration.registerDefaultSimGuis();
                }),
            ]);
        }
        await this.aload;
    }
}

export const ASYNC_SIM_LOADER = new AsyncSimLoader();

