import {CharacterGearSet} from "@xivgear/core/gear";
import {applyDhCrit, baseDamage} from "@xivgear/xivmath/xivmath";
import {SimResult, SimSettings, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";
import {EmptyObject} from "@xivgear/core/util/types";
import {NamedSection} from "../../components/section";
import {simpleMappedResultTable} from "../components/simple_tables";

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
    isDefaultSim: true
};

export interface PotencyRatioSimResults extends SimResult {
    withoutCritDh: number
}

function makeDescriptionPanel() {
    const out = new NamedSection('Potency Ratio');
    const text = document.createElement('p');
    text.textContent = 'This calculation represents the expected damage of a 100 potency action. This does not represent an accurate DPS value, as it does not take Skill/Spell Speed into account.';
    out.contentArea.appendChild(text);
    return out;
}

/**
 * "Simulation" that only calcuates dmg/100p.
 */
export class PotencyRatioSim implements Simulation<PotencyRatioSimResults, SimSettings, EmptyObject> {
    exportSettings() {
        return {
            ...this.settings
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
            withoutCritDh: base
        };
    };

    spec = potRatioSimSpec;
    makeConfigInterface = makeDescriptionPanel;

    makeResultDisplay(result: PotencyRatioSimResults): HTMLElement {
        const tbl = simpleMappedResultTable<PotencyRatioSimResults>({
            'mainDpsResult': 'Dmg/100p, with Crit/DH',
            'withoutCritDh': 'Dmg/100p, no Crit/DH',
        })(result);
        tbl.classList.add('sim-basic-result-table');
        const description = makeDescriptionPanel();
        description.appendChild(tbl);
        description.style.maxWidth = '400px';
        return description;
    }
}
