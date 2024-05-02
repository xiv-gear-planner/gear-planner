import 'global-jsdom/register'
import {Ability, FinalizedAbility} from "../../sims/sim_types";
import {CycleProcessor} from "../../sims/sim_processors";
import {exampleGearSet} from "./common_values";
import assert from "assert";

const initial1 = {
    name: "Initial Ability 1",
    id: 100_001,
    attackType: 'Weaponskill',
    potency: 100,
    type: 'gcd',
    gcd: 2.5,
    combos: [{
        comboBehavior: "start"
    }]
} as const satisfies Ability;

const initial2 = {
    name: "Initial Ability 2",
    id: 100_002,
    attackType: 'Weaponskill',
    potency: 110,
    type: 'gcd',
    gcd: 2.5,
    combos: [{
        comboBehavior: "start"
    }]
} as const satisfies Ability;

const notCombo = {
    name: "Non-Combo Ability",
    id: 100_003,
    attackType: 'Weaponskill',
    potency: 120,
    type: 'gcd',
    gcd: 2.5
} as const satisfies Ability;

const ogcd = {
    name: "Default oGCD",
    id: 100_101,
    attackType: 'Ability',
    potency: 123,
    type: 'ogcd',
} as const satisfies Ability;

const ogcdInterrupt = {
    name: "oGCD that breaks default combo",
    id: 100_102,
    attackType: 'Ability',
    potency: 124,
    type: 'ogcd',
    combos: [{
        comboBehavior: 'break'
    }]
} as const satisfies Ability;
// TODO: oGCD that breaks all combos
// TODO: gcd that doesn't break a specific combo
// TODO: gcd that doesn't break any combo

const ogcdWithOtherInterrupt = {
    name: "oGCD that breaks other combo",
    id: 100_103,
    attackType: 'Ability',
    potency: 125,
    type: 'ogcd',
    combos: [{
        comboKey: 'side combo',
        comboBehavior: 'break',
    }]
} as const satisfies Ability;


const cont1 = {
    name: "Followup Ability",
    id: 100_004,
    attackType: 'Weaponskill',
    potency: 140,
    type: 'gcd',
    gcd: 2.5,
    combos: [
        {
            comboBehavior: "continue",
            comboFrom: [initial1, initial2],
            potency: 200
        },
    ]
} as const satisfies Ability;

const cont2 = {
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
} as const satisfies Ability;

/** TODO: test cases
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
        assert.equal(actualAbilities[0].totalPotency, cont1.potency);
        assert.equal(actualAbilities[1].totalPotency, cont2.potency);
        assert.equal(actualAbilities[2].totalPotency, initial1.potency);
        assert.equal(actualAbilities[3].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[4].totalPotency, cont2.combos[0].potency);
        assert.equal(actualAbilities[5].totalPotency, initial1.potency);
        assert.equal(actualAbilities[6].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[7].totalPotency, initial2.potency);
        assert.equal(actualAbilities[8].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[9].totalPotency, cont2.combos[0].potency);
        assert.equal(actualAbilities[10].totalPotency, initial1.potency);
        assert.equal(actualAbilities[11].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[12].totalPotency, initial2.potency);
        assert.equal(actualAbilities[13].totalPotency, cont2.potency);
    });
    it('unrelated ability should cancel combo', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 120,
            stats: exampleGearSet.computedStats,
            totalTime: 295,
            useAutos: false
        });
        // Unrelated ability should cancel combo
        cp.use(initial1);
        cp.use(notCombo);
        cp.use(cont1);
        cp.use(cont2);
        // Try again, interrupt in different point
        cp.use(initial1);
        cp.use(cont1);
        cp.use(notCombo);
        cp.use(cont2);

        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });

        assert.equal(actualAbilities[0].totalPotency, initial1.potency);
        assert.equal(actualAbilities[1].totalPotency, notCombo.potency);
        assert.equal(actualAbilities[2].totalPotency, cont1.potency);
        assert.equal(actualAbilities[3].totalPotency, cont2.potency);

        assert.equal(actualAbilities[4].totalPotency, initial1.potency);
        assert.equal(actualAbilities[5].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[6].totalPotency, notCombo.potency);
        assert.equal(actualAbilities[7].totalPotency, cont2.potency);
    });
    it('should not interrupt a combo when an oGCD is used by default', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 120,
            stats: exampleGearSet.computedStats,
            totalTime: 295,
            useAutos: false
        });
        // oGCD should not cancel
        cp.use(initial2);
        cp.use(ogcd)
        cp.use(cont1);
        cp.use(cont2);
        cp.use(initial2);
        cp.use(cont1);
        cp.use(ogcd)
        cp.use(cont2);

        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });

        assert.equal(actualAbilities[0].totalPotency, initial2.potency);
        assert.equal(actualAbilities[1].totalPotency, ogcd.potency);
        assert.equal(actualAbilities[2].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[3].totalPotency, cont2.combos[0].potency);

        assert.equal(actualAbilities[4].totalPotency, initial2.potency);
        assert.equal(actualAbilities[5].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[6].totalPotency, ogcd.potency);
        assert.equal(actualAbilities[7].totalPotency, cont2.combos[0].potency);
    });
    it('should not interrupt a combo if the oGCD breaks a different combo', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 120,
            stats: exampleGearSet.computedStats,
            totalTime: 295,
            useAutos: false
        });
        // oGCD should not cancel
        cp.use(initial2);
        cp.use(ogcdWithOtherInterrupt)
        cp.use(cont1);
        cp.use(cont2);

        cp.use(initial2);
        cp.use(cont1);
        cp.use(ogcdWithOtherInterrupt)
        cp.use(cont2);

        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });

        assert.equal(actualAbilities[0].totalPotency, initial2.potency);
        assert.equal(actualAbilities[1].totalPotency, ogcdWithOtherInterrupt.potency);
        assert.equal(actualAbilities[2].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[3].totalPotency, cont2.combos[0].potency);

        assert.equal(actualAbilities[4].totalPotency, initial2.potency);
        assert.equal(actualAbilities[5].totalPotency, cont1.combos[0].potency);
        assert.equal(actualAbilities[6].totalPotency, ogcdWithOtherInterrupt.potency);
        assert.equal(actualAbilities[7].totalPotency, cont2.combos[0].potency);
    });
});