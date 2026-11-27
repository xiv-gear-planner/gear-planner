import {MicroSetExport, SimExport} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet} from "../gear";
import {SimResult, SimSettings, Simulation} from "../sims/sim_types";
import {GearPlanSheet} from "../sheet";
import {microExportToFullExport, setToMicroExport} from "../workers/worker_utils";

export interface SolverSimulationSettings {
    sim: Simulation<SimResult, SimSettings, unknown>;
    sets: CharacterGearSet[];
}

export function exportSolverSimulationSettings(settings: SolverSimulationSettings): SolverSimulationSettingsExport {
    // It is not necessary to capture sheet-level details, because the workers' setSheet logic takes care of sheet-level
    // information.
    return {
        sets: settings.sets?.map(setToMicroExport) ?? [],
        sim: {
            stub: settings.sim.spec.stub,
            settings: settings.sim.exportSettings() as SimSettings,
            name: settings.sim.displayName,
        },
    };
}

export interface SolverSimulationSettingsExport {
    sim: SimExport;
    sets: MicroSetExport[];
}

export class SimRunner<SimType extends Simulation<SimResult, SimSettings, unknown>> {

    _sim: SimType;

    constructor(sim: SimType) {
        this._sim = sim;
    }

    /**
     * Simulate and process the best set in one function because splitting them up requires more work.
     */
    async simulateSetsAndReturnBest(sheet: GearPlanSheet, setExports: MicroSetExport[], update: (n: number) => void): Promise<[number, CharacterGearSet] | null> {
        if (!setExports
            || setExports.length === 0
            || !this._sim) {

            return null;
        }

        update(0);
        let numSetsProcessed = 0;
        const threshold = setExports.length * 0.05;

        let bestDps = 0;
        let bestSet = null;
        for (let i = 0; i < setExports.length; i++) {
            const set = sheet.importGearSet(microExportToFullExport(setExports[i]));
            const result = await this._sim.simulateSimple(set);
            // @ts-expect-error - this is not re-used. We clear it here so that the memory can be reclaimed.
            setExports[i] = undefined;

            if (result > bestDps) {
                bestDps = result;
                bestSet = set;
            }

            numSetsProcessed++;
            if (numSetsProcessed > threshold) {
                update(numSetsProcessed);
                numSetsProcessed = 0;
            }
        }
        update(numSetsProcessed);

        if (bestSet === null) {
            return null;
        }
        return [bestDps, bestSet];
    }
}
