import {noSimSettings, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {applyDhCrit, baseDamage} from "../xivmath";

export const potRatioSimSpec: SimSpec<PotencyRatioSim, SimSettings> = {
    displayName: "Potency Ratio",
    loadSavedSimInstance(exported: SimSettings) {
        return new PotencyRatioSim();
    },
    makeNewSimInstance(): PotencyRatioSim {
        return new PotencyRatioSim();
    },
    stub: "pr-sim",
}

export interface PotencyRatioSimResults extends SimResult {
    withoutCritDh: number
}

export class PotencyRatioSim implements Simulation<PotencyRatioSimResults, SimSettings, {}> {
    exportSettings() {
        return {
            ...this.settings
        };
    };
    settings = {

    };
    shortName = "pr-sim";
    displayName = "Dmg/100p";
    async simulate(set: CharacterGearSet): Promise<PotencyRatioSimResults> {
        const base = baseDamage(set.computedStats, 100, 'Spell');
        const final = applyDhCrit(base, set.computedStats);
        return {mainDpsResult: final, withoutCritDh: base};
    };
    spec = potRatioSimSpec;
    makeConfigInterface = noSimSettings;
}
