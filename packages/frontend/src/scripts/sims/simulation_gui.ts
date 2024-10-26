import { SimResult, SimSettings, Simulation } from "@xivgear/core/sims/sim_types";

export type ResultTypeOfSim<Sim> = Sim extends Simulation<infer R, unknown, unknown> ? R : never;
export type SettingsTypeOfSim<Sim> = Sim extends Simulation<SimResult, infer S, unknown> ? S : never;
export type ExportSettingsTypeOfSim<Sim> = Sim extends Simulation<SimResult, unknown, infer SE> ? SE : never;

export abstract class SimulationGui<ResultType extends SimResult, SettingsType extends SimSettings, SettingsExport> {

    sim: Simulation<ResultType, SettingsType, SettingsExport>;

    constructor(sim: Simulation<ResultType, SettingsType, SettingsExport>) {
        this.sim = sim;
    }

    /**
     * Create the configuration interface for the simulation
     *
     * @param settings The settings.
     * @param updateCallback A callback that should be called after anything on the settings
     * object is changed. Depending on {@link manualRun}, this may trigger a re-run automatically.
     */
    abstract makeConfigInterface(settings: SettingsType, updateCallback: () => void): HTMLElement;

    /**
     * Overrides the default tooltip when hovering over a sim result cell in the set table.
     *
     * @param result The result
     * @returns The tooltip
     */
    abstract makeToolTip?(result: ResultType): string;

    /**
     * Overrides the results display when clicking into a sim result cell in the set table.
     *
     * @param result The result
     * @return the result HTML
     */
    abstract makeResultDisplay?(result: ResultType): HTMLElement;
}
