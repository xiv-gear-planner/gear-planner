import { CharacterGearSet } from "@xivgear/core/gear";
import { SimResult, SimSettings, SimSpec, Simulation } from "@xivgear/core/sims/sim_types";

export abstract class SimulationGui<ResultType extends SimResult, SettingsType extends SimSettings, SettingsExport>
    implements Simulation<ResultType, SettingsType, SettingsExport> {

    _sim: Simulation<ResultType, SettingsType, SettingsExport>;

    constructor(sim: Simulation<ResultType, SettingsType, SettingsExport>) {
        this._sim = sim;
    }
    get shortName(): string {
        return this._sim.shortName;
    }

    get displayName(): string {
        return this._sim.displayName;
    }

    get settings(): SettingsType {
        return this._sim.settings;
    }

    set settings(newSettings: SettingsType) {
        this._sim.settings = newSettings;
    }

    get spec(): SimSpec<any, SettingsExport> {
        return this._sim.spec;
    }
    set spec(newSpec: SimSpec<any, SettingsExport>) {
        this._sim.spec = newSpec;
    }

    get manualRun(): boolean {
        return this._sim.manualRun;
    }

    simulate(set: CharacterGearSet): Promise<ResultType> {
        return this._sim.simulate(set);
    }

    exportSettings(): SettingsExport {
        return this._sim.exportSettings();
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