import {CharacterGearSet} from "./gear";
import {JobName, SupportedLevel} from "xivmath/xivconstants";
import {potRatioSimSpec} from "./sims/potency_ratio";
import {CustomTable} from "./tables";
import {camel2title} from "./util/strutils";

/**
 * Represents the final result of a simulation run. Sim implementors should extend this type with
 * whatever extra data is available.
 */
export interface SimResult {
    mainDpsResult: number;
}

/**
 * Represents simulation settings. Sim implementors should extend this type with any additional settings.
 */
export interface SimSettings {
    includeInExport?: boolean
}

/**
 * Represents a sim archetype which can produce the actual Simulation objects.
 */
export interface SimSpec<SimType extends Simulation<any, any, any>, SettingsExport> {
    /**
     * Unique stub used to reference this specific sim type. Should only use alphanumeric (but not
     * with a number as the first character) and hyphens. This effectively acts as the primary key
     * for the simulation, as it is used to represent the type of sim in serialized forms.
     */
    stub: string,
    /**
     * Display name for this sim type.
     */
    displayName: string,
    /**
     * Whether the sim should be added to applicable sheets by default
     */
    isDefaultSim?: boolean,

    /**
     * Make a new instance of the simulator without importing any saved settings.
     */
    makeNewSimInstance(): SimType;

    /**
     * Make an instance of the simulator from saved settings.
     *
     * @param exported The saved settings.
     */
    loadSavedSimInstance(exported: SettingsExport): SimType;

    /**
     * Optional: restrict this simulation to certain jobs.
     */
    supportedJobs?: JobName[] | undefined;
    /**
     * Optional: restrict this simulation to certain levels.
     */
    supportedLevels?: SupportedLevel[] | undefined;
}

let simSpecs: SimSpec<any, any>[] = [];

/**
 * Register a sim into the library
 *
 * @param simSpec The sim spec to register
 */
export function registerSim(simSpec: SimSpec<any, any>) {
    simSpecs.push(simSpec);
}

/**
 * Get all registered sim specs
 */
export function getRegisteredSimSpecs() {
    return [...simSpecs];
}

/**
 * Given a sim stub (see {@link SimSpec.stub}), return the actual sim spec.
 *
 * @param stub The sim spec stub
 */
export function getSimSpecByStub(stub: string): SimSpec<any, any> | undefined {
    return simSpecs.find(simSpec => simSpec.stub === stub);
}

/**
 * Get the default simulations for a new sheet for the given job and level.
 *
 * @param job The job
 * @param level The character level
 */
export function getDefaultSims(job: JobName, level: SupportedLevel): SimSpec<any, any>[] {
    return [potRatioSimSpec, ...simSpecs.filter(spec => {
        if (spec.supportedJobs !== undefined && !spec.supportedJobs.includes(job)) {
            return false;
        }
        if (spec.supportedLevels !== undefined && !spec.supportedLevels.includes(level)) {
            return false;
        }
        return spec.isDefaultSim ?? false;
    })];
}

/**
 * Represents a configured simulation. Note that an instance of this object is re-used across multiple runs of the
 * same simulation (e.g. multiple sets, or multiple runs of one set). Thus, no mutable state should be kept at this
 * level. Rather, all mutable state should be scoped within the {@link simulate} method.
 *
 * @type ResultType: The type of result returned by the sim.
 * @type SettingType: The internal settings type.
 * @type SettingsExport: The externalized settings type (for saving and restoring of settings).
 */
export interface Simulation<ResultType extends SimResult, SettingsType extends SimSettings, SettingsExport> {

    /**
     * A short name for the sim, used for internal naming. Should be usable as a CSS class name or other
     * HTML-ish applications, i.e. start with a letter, then keep to alphanumeric and hyphen.
     *
     * A good choice is to simply use the spec's stub name.
     */
    readonly shortName: string;
    /**
     * The user-facing display name of the sim. This needs to be writable, as users can change the display
     * name of sims.
     */
    displayName: string;

    /**
     * Run a simulation. As mentioned in the class-level docs, all mutable state should be scoped to this
     * method.
     *
     * @param set
     */
    simulate(set: CharacterGearSet): Promise<ResultType>;

    /**
     * The internalized settings of the object.
     */
    settings: SettingsType;

    /**
     * The settings, flatted into a form that is fully JSON-ifiable.
     */
    exportSettings(): SettingsExport;

    /**
     * The original sim spec.
     */
    spec: SimSpec<typeof this, SettingsExport>

    /**
     * Create the configuration interface for the simulation
     *
     * @param settings The settings.
     * @param updateCallback A callback that should be called after anything on the settings
     * object is changed. Depending on {@link manualRun}, this may trigger a re-run automatically.
     */
    makeConfigInterface(settings: SettingsType, updateCallback: () => void): HTMLElement;

    /**
     * Overrides the default tooltip when hovering over a sim result cell in the set table.
     *
     * @param result The result
     * @returns The tooltip
     */
    makeToolTip?(result: ResultType): string;

    /**
     * Overrides the results display when clicking into a sim result cell in the set table.
     *
     * @param result The result
     * @return the result HTML
     */
    makeResultDisplay?(result: ResultType): HTMLElement;

    /**
     * If true, do not automatically re-run the sim. Currently, this is only implemented for
     * the configuration - changing settings will not cause the sim to auto-re-run. Eventually, it
     * may also be implemented for changes to gear sets.
     */
    readonly manualRun?: boolean;
}

type SimpleResultEntry = {
    name: string;
    value: any;
}

export function bestEffortFormat(value: any): Node {
    if (typeof value === 'number') {
        return document.createTextNode(value.toFixed(3));
    }
    else {
        return document.createTextNode(value.toString());
    }
}

/**
 * Simple table for displaying key/value pairs of an object. The left column is the
 * keys, while the right column is the values. No header row.
 *
 * @param result The result to display
 */
export function simpleAutoResultTable<X extends SimResult>(result: X): HTMLElement {
    const data: SimpleResultEntry[] = [];
    for (let fieldKey in result) {
        data.push({
            name: camel2title(fieldKey),
            value: result[fieldKey]
        });
    }
    const table = new CustomTable<SimpleResultEntry>();
    table.columns = [
        {
            shortName: 'key',
            displayName: 'Key',
            getter: item => item.name,
        },
        {
            shortName: 'value',
            displayName: 'Value',
            getter: item => item.value,
            renderer: bestEffortFormat,
        }
    ]
    table.data = data;
    return table;

}

export function simpleMappedResultTable<X extends SimResult>(fieldNames: { [K in keyof X]: string }): ((result: X) => HTMLElement) {
    return (result: X): HTMLElement => {
        const data: SimpleResultEntry[] = [];
        for (let fieldKey in fieldNames) {
            data.push({
                name: fieldNames[fieldKey],
                value: result[fieldKey]
            });
        }
        const table = new CustomTable<SimpleResultEntry>();
        table.columns = [
            {
                shortName: 'key',
                displayName: 'Key',
                getter: item => item.name,
            },
            {
                shortName: 'value',
                displayName: 'Value',
                getter: item => item.value,
                renderer: bestEffortFormat,
            }
        ]
        table.data = data;
        return table;
    }
}

/**
 * Basic implementation of {@link Simulation.makeResultDisplay} for sims which do not actually
 * have any settings.
 */
export function noSimSettings() {
    const outerDiv = document.createElement("div");
    const header = document.createElement("h1");
    header.textContent = "No Settings for This Simulation";
    outerDiv.replaceChildren(header);
    return outerDiv;
}


/**
 * Class which holds the current status of a simulation run. While some sims runs synchronously,
 * others, such as those which use an external service, run asynchronously, and so intermediate
 * states such as 'Running' need to be represented.
 */
export interface SimCurrentResult<X extends SimResult> {
    /**
     * The result. undefined unless {@link status} === 'Done'.
     */
    result: X | undefined;
    /**
     * The current status. 'Done' means the sim is complete, while 'Error' means the sim did
     * not successfully complete. These are the only two states that are used for synchronous sims.
     * For asynchronous sims, there is also the 'Running' state. Finally, for sims which do not
     * re-run automatically upon a gear set or settings change, the 'Not Run' state means that
     * the sim has not yet run since opening the app, while 'Stale' indicates that the current
     * result is stale and does not reflect current gear or sim settings.
     */
    status: 'Done' | 'Running' | 'Not Run' | 'Stale' | 'Error';
    /**
     * If {@link status} === 'Error', then this contains the error.
     */
    error: any | undefined;
    /**
     * Like {@link result}, but in the form of a Promise. This allows you to wait for the results.
     */
    resultPromise: Promise<X>;
}

