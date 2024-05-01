import {Ability} from "../../sims/sim_types";
import {CycleProcessor} from "../../sims/sim_processors";
import {exampleGearSet} from "./common_values";

type IdAb = (Ability & {
    id: number
});

const initial1: IdAb = {
    name: "Initial Ability 1",
    id: 100_001,
    attackType: 'Weaponskill',
    potency: 100,
    type: 'gcd',
    gcd: 2.5
}

const initial2: IdAb = {
    name: "Initial Ability 2",
    id: 100_002,
    attackType: 'Weaponskill',
    potency: 110,
    type: 'gcd',
    gcd: 2.5
}

const notCombo: Ability = {
    name: "Non-Combo Ability",
    id: 100_003,
    attackType: 'Weaponskill',
    potency: 120,
    type: 'gcd',
    gcd: 2.5
}

const cont1: IdAb = {
    name: "Followup Ability",
    id: 100_004,
    attackType: 'Weaponskill',
    potency: 140,
    type: 'gcd',
    gcd: 2.5,
    combos: [
        {
            comboFrom: [initial1],
            potency: 200
        },
        {
            comboFrom: [initial2],
            potency: 300
        }
    ]
}
const cont2: IdAb = {
    name: "Followup Ability 2",
    id: 100_004,
    attackType: 'Weaponskill',
    potency: 140,
    type: 'gcd',
    gcd: 2.5,
    combos: [
        {
            comboFrom: [cont1],
            potency: 200
        },
    ]
}

/** TODO: test cases
 * - non-combo version of ability
 * - combo versions of ability
 * - combo not interrupted by oGCD by default
 * - combo interrupted by GCD by default
 * - combo not interrupted by GCD which is explicitly not a combo breaker
 * - combo interrupted by oGCD which is explicitly a combo breaker
 * - GNB-style multiple combos
 */

describe('sim processor combo support', () => {
    it('understands combos', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 120,
            stats: exampleGearSet.computedStats,
            totalTime: 295,
            useAutos: false
        });
        // Use continuation ability initially, should not be a combo
        cp.use(cont1);

    });
});