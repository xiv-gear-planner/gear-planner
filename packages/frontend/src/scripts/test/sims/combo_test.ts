import 'global-jsdom/register'
import {Ability, FinalizedAbility} from "../../sims/sim_types";
import {CycleProcessor} from "../../sims/sim_processors";
import {exampleGearSet} from "./common_values";
import assert from "assert";

type IdAb = (Ability & {
    id: number
});

const initial1: IdAb = {
    name: "Initial Ability 1",
    id: 100_001,
    attackType: 'Weaponskill',
    potency: 100,
    type: 'gcd',
    gcd: 2.5,
    combos: [{
        comboBehavior: "start"
    }]
}

const initial2: IdAb = {
    name: "Initial Ability 2",
    id: 100_002,
    attackType: 'Weaponskill',
    potency: 110,
    type: 'gcd',
    gcd: 2.5,
    combos: [{
        comboBehavior: "start"
    }]
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
            comboBehavior: "continue",
            comboFrom: [initial1],
            potency: 200
        },
        {
            comboBehavior: "continue",
            comboFrom: [initial2],
            potency: 300,
        }
    ]
}

const cont2: IdAb = {
    name: "Followup Ability 2",
    id: 100_004,
    attackType: 'Weaponskill',
    potency: 150,
    type: 'gcd',
    gcd: 2.5,
    combos: [
        {
            comboBehavior: "continue",
            comboFrom: [cont1],
            potency: 500
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
 *      - including "default" vs "non-default" vs "all" combo keys
 */

describe('sim processor combo support', () => {
    it('understands basic combo mechanics', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 120,
            stats: exampleGearSet.computedStats,
            totalTime: 295,
            useAutos: false
        });
        // Use continuation ability initially, should not be a combo
        cp.use(cont1);
        cp.use(cont2);
        // Use combo properly
        cp.use(initial1);
        cp.use(cont1);
        cp.use(cont2);
        // Start combo but interrupt
        cp.use(initial1);
        cp.use(cont1);
        // And then do combo normally
        cp.use(initial2);
        cp.use(cont1);
        cp.use(cont2);
        // Start combo but interrupt, mess up subsequently
        cp.use(initial1);
        cp.use(cont1);
        cp.use(initial2);
        cp.use(cont2);

        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        assert.equal(140, actualAbilities[0].totalPotency);
        assert.equal(150, actualAbilities[1].totalPotency);
        assert.equal(100, actualAbilities[2].totalPotency);
        assert.equal(200, actualAbilities[3].totalPotency);
        assert.equal(500, actualAbilities[4].totalPotency);


    });
});