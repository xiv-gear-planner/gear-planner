import { SetExport, SimExport } from "@xivgear/xivmath/geartypes";
import { CharacterGearSet } from "../gear";
import { SimResult, SimSettings, Simulation } from "../sims/sim_types";
import { GearPlanSheet } from "../sheet";

export class SolverSimulationSettings {
    sim: Simulation<SimResult, unknown, unknown>;
    sets: CharacterGearSet[];

    static import(settingsExp: SolverSimulationSettingsExport, sheet: GearPlanSheet): SolverSimulationSettings {
        return {
            sets: settingsExp.sets.map(sheet.importGearSet),
            sim: sheet.importSim(settingsExp.sim),
        };
    }

    static export(settings: SolverSimulationSettings, sheet: GearPlanSheet): SolverSimulationSettingsExport {
        return {
            sets: settings.sets?.map(set => sheet.exportGearSet(set)),
            sim: {
                stub: settings.sim.spec.stub,
                settings: settings.sim.exportSettings() as SimSettings,
                name: settings.sim.displayName,
            },
        };
    }
}

export class SolverSimulationSettingsExport {
    sim: SimExport;
    sets: SetExport[];
}

export class SimRunner<SimType extends Simulation<SimResult, unknown, unknown>> {

    _sim: SimType;

    constructor(sim: SimType) {
        this._sim = sim;
    }

    /**
     * Simulate and process the best set in one function because splitting them up requires more work.
     */
    async simulateSetsAndReturnBest(gearsets: CharacterGearSet[], update: (n: number) => void): Promise<[number, CharacterGearSet]> {

        if (!gearsets
            || gearsets.length === 0
            || !this._sim) {

            return null;
        }

        update(0);
        let numSetsProcessed = 0;
        const threshold = gearsets.length * .05;

        let bestDps = 0;
        let bestSet = null;
        let set = gearsets.shift();
        while (set) {
            let result = await this._sim.simulate(set);

            if (result.mainDpsResult > bestDps) {
                bestDps = result.mainDpsResult;
                bestSet = set;
            }
            result = undefined;

            numSetsProcessed++;
            if (numSetsProcessed > threshold) {
                update(numSetsProcessed);
                numSetsProcessed = 0;
            }

            set = undefined;
            set = gearsets.shift();
        }

        return [bestDps, bestSet];
    }
}
