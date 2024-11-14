import {CharacterGearSet} from "@xivgear/core/gear";
import {applyDhCrit, baseDamage} from "@xivgear/xivmath/xivmath";
import {SimResult, SimSettings, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";
import {EmptyObject} from "@xivgear/core/util/types";

export const potRatioSimSpec: SimSpec<PotencyRatioSim, SimSettings> = {
    displayName: "Potency Ratio",
    loadSavedSimInstance(exported: SimSettings) {
        return new PotencyRatioSim();
    },
    makeNewSimInstance(): PotencyRatioSim {
        return new PotencyRatioSim();
    },
    stub: "pr-sim",
    description: "Expected damage per 100 potency",
    isDefaultSim: true,
};

export interface PotencyRatioSimResults extends SimResult {
    withoutCritDh: number
}

/**
 * "Simulation" that only calcuates dmg/100p.
 */
export class PotencyRatioSim implements Simulation<PotencyRatioSimResults, SimSettings, EmptyObject> {
    exportSettings() {
        return {
            ...this.settings,
        };
    };

    settings = {};
    shortName = "pr-sim";
    displayName = "Dmg/100p*";

    async simulate(set: CharacterGearSet): Promise<PotencyRatioSimResults> {
        const base = baseDamage(set.computedStats, 100, 'Spell');
        const final = applyDhCrit(base, set.computedStats);
        return {
            mainDpsResult: final,
            withoutCritDh: base,
        };
    };

    spec = potRatioSimSpec;

    settingsChanged(): void {

    }
}
