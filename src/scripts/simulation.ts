import {CharacterGearSet} from "./gear";
import {JobName, SupportedLevel} from "./xivconstants";
import {whmSheetSpec} from "./sims/whm_sheet_sim";
import {sgeSheetSpec} from "./sims/sge_sheet_sim";
import {potRatioSimSpec} from "./sims/potency_ratio";
import {CustomTable} from "./tables";
import {camel2title} from "./util/strutils";
import {sgeNewSheetSpec} from "./sims/sge_sheet_sim_mk2";
import {astNewSheetSpec} from "./sims/ast_sheet_sim";
import {schNewSheetSpec} from "./sims/sch_sheet_sim";
import {whmNewSheetSpec} from "./sims/whm_new_sheet_sim";

export interface SimResult {
    mainDpsResult: number;
}

export interface SimSettings {

}

export interface SimSpec<SimType extends Simulation<any, any, any>, SettingsExport> {
    /**
     * Unique stub used to reference this specific sim type. Should only use alphanumeric (but not
     * with a number as the first character) and hyphens.
     */
    stub: string,
    /**
     * Display name for this sim type.
     */
    displayName: string,

    /**
     * Make a new instance of the simulator without importing any saved settings.
     */
    makeNewSimInstance(): SimType;

    /**
     * Make an instance of the simulator from saved settings.
     *
     * @param exported The saved settings.
     */
    loadSavedSimInstance(exported: SettingsExport);

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

export function registerSim(simSpec: SimSpec<any, any>) {
    simSpecs.push(simSpec);
}

export function getRegisteredSimSpecs() {
    return [...simSpecs];
}

export function getSimSpecByStub(stub: string): SimSpec<any, any> | undefined {
    return simSpecs.find(simSpec => simSpec.stub === stub);
}

export function getDefaultSims(job: JobName, level: SupportedLevel): SimSpec<any, any>[] {
    const out: SimSpec<any, any>[] = [potRatioSimSpec];
    if (job === 'WHM' && level === 90) {
        out.push(whmNewSheetSpec);
    }
    else if (job === 'SGE' && level === 90) {
        out.push(sgeSheetSpec);
    }
    else if (job === 'AST' && level === 90) {
        out.push(astNewSheetSpec);
    }
    else if (job === 'SCH' && level === 90) {
        out.push(schNewSheetSpec);
    }
    return out;
}

/**
 * Represents a configured simulation
 *
 * @type ResultType: The type of result returned by the sim.
 * @type SettingType: The internal settings type.
 * @type SettingsExport: The externalized settings type (for saving and restoring of settings).
 */
export interface Simulation<ResultType extends SimResult, SettingsType extends SimSettings, SettingsExport> {

    shortName: string;
    displayName: string;

    simulate(set: CharacterGearSet): Promise<ResultType>;

    settings: SettingsType;

    exportSettings(): SettingsExport;

    spec: SimSpec<typeof this, SettingsExport>

    makeConfigInterface(settings: SettingsType, updateCallback: () => void): HTMLElement;

    makeToolTip?(result: ResultType): string;

    makeResultDisplay?(result: ResultType): HTMLElement;
}

type SimpleResultEntry = { name: string; value: any; }

export function bestEffortFormat(value: any): Node {
    if (typeof value === 'number') {
        return document.createTextNode(value.toFixed(3));
    }
    else {
        return document.createTextNode(value.toString());
    }
}
export function simpleAutoResultTable<X extends SimResult>(result: X): HTMLElement {
    const data: SimpleResultEntry[] = [];
    for (let fieldKey in result) {
        data.push({name: camel2title(fieldKey), value: result[fieldKey] });
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
export function simpleMappedResultTable<X extends SimResult>(fieldNames: {[K in keyof X]: string}): ((result: X) => HTMLElement) {
    return (result: X): HTMLElement => {
        const data: SimpleResultEntry[] = [];
        for (let fieldKey in fieldNames) {
            data.push({name: fieldNames[fieldKey], value: result[fieldKey] });
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

export function noSimSettings() {
    const outerDiv = document.createElement("div");
    const header = document.createElement("h1");
    header.textContent = "No Settings for This Simulation";
    outerDiv.replaceChildren(header);
    return outerDiv;
}


export interface SimCurrentResult<X extends SimResult> {
    result: X | undefined;
    status: 'Done' | 'Running' | 'Not Run' | 'Stale' | 'Error';
    error: any | undefined;
    resultPromise: Promise<X>;
}

registerSim(potRatioSimSpec);
registerSim(whmSheetSpec);
registerSim(sgeSheetSpec);
registerSim(sgeNewSheetSpec);
registerSim(astNewSheetSpec);
registerSim(schNewSheetSpec);
registerSim(whmNewSheetSpec);
