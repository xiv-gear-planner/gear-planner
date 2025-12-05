/**
 * How the Async sim loading works:
 *
 * The entire sim code is put in a separate webpack chunk. This way, the rest of the code can start executing while the
 * sims still load. For a sheet with no sims, or an embed, don't wait for it to load, since we don't need it.
 */
export class AsyncSimLoader {

    private aload: Promise<unknown> | null = null;

    async load(): Promise<void> {
        if (this.aload === null) {
            this.aload = Promise.all([
                import(/* webpackChunkName: "sims", webpackPrefetch: false, webpackPreload: true */ '@xivgear/gearplan-frontend/sims/registration/default_sim_guis').then(mod => {
                    mod.registerSims();
                    mod.registerDefaultSimGuis();
                }),
            ]);
        }
        await this.aload;
    }
}

export const ASYNC_SIM_LOADER = new AsyncSimLoader();

