import 'global-jsdom/register'
import {Ability, Buff, BuffController, FinalizedAbility, GcdAbility} from "../../sims/sim_types";
import {it} from "mocha";
import {CycleProcessor, DamageResult} from "../../sims/sim_processors";
import {Swiftcast} from "../../sims/common/swiftcast";
import * as assert from "assert";
import {assertClose} from "../test_utils";
import {removeSelf} from "../../sims/common/utils";
import {dia, exampleGearSet, filler, weaponSkill} from "./common_values";

const instant: GcdAbility = {
    type: 'gcd',
    name: "Dia",
    potency: 65,
    dot: {
        id: 1871,
        tickPotency: 65,
        duration: 30
    },
    attackType: "Spell",
    gcd: 2.5,
}

const long: GcdAbility = {
    type: 'gcd',
    name: "Raise",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 8
}

describe('Swiftcast', () => {
    it('should handle swiftcast correctly', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(filler);
        cp.use(Swiftcast);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not swifted
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].usedAt, -1.48);
        assertClose(actualAbilities[0].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[0].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[0].original.lockTime, 1.48);
        assertClose(actualAbilities[0].original.castTimeFromStart, 1.38);
        // Swiftcast
        assert.equal(actualAbilities[1].ability.name, "Swiftcast");
        assertClose(actualAbilities[1].usedAt, 0.0);
        assertClose(actualAbilities[1].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[1].original.totalTimeTaken, 0.6);
        assertClose(actualAbilities[1].original.lockTime, 0.6);
        assertClose(actualAbilities[1].original.castTimeFromStart, 0);
        // Swifted
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].usedAt, 0.83); // 0.83 === -1.48 + 2.31
        assertClose(actualAbilities[2].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[2].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[2].original.lockTime, 0.6);
        assertClose(actualAbilities[2].original.castTimeFromStart, 0);
        // Not swifted
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].usedAt, 3.14);
        assertClose(actualAbilities[3].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[3].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[3].original.lockTime, 1.48);
        assertClose(actualAbilities[3].original.castTimeFromStart, 1.38);

    });
    it('should not start combat', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(Swiftcast);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Swiftcast - should NOT start combat
        assert.equal(actualAbilities[0].ability.name, "Swiftcast");
        assertClose(actualAbilities[0].usedAt, -1.2);
        assertClose(actualAbilities[0].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[0].original.totalTimeTaken, 0.6);
        assertClose(actualAbilities[0].original.castTimeFromStart, 0);
        // Swifted - verifies that the 0.6 anim lock and 0.6 app delay don't cause an issue where swift 'misses' the
        // immediate next ability.
        assert.equal(actualAbilities[1].ability.name, "Glare");
        assertClose(actualAbilities[1].usedAt, -0.6);
        assertClose(actualAbilities[1].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[1].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[1].original.castTimeFromStart, 0);
        // Not swifted
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].usedAt, 1.71);
        assertClose(actualAbilities[2].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[2].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[2].original.castTimeFromStart, 1.38);

    });
    it('should not be consumed by an instant skill', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(filler);
        cp.use(Swiftcast);
        cp.use(instant);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not swifted
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].usedAt, -1.48);
        assertClose(actualAbilities[0].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[0].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[0].original.castTimeFromStart, 1.38);
        // Swiftcast
        assert.equal(actualAbilities[1].ability.name, "Swiftcast");
        assertClose(actualAbilities[1].usedAt, 0.0);
        assertClose(actualAbilities[1].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[1].original.totalTimeTaken, 0.6);
        assertClose(actualAbilities[1].original.castTimeFromStart, 0);
        // Swifted
        assert.equal(actualAbilities[2].ability.name, "Dia");
        assertClose(actualAbilities[2].usedAt, 0.83); // 0.83 === -1.48 + 2.31
        assertClose(actualAbilities[2].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[2].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[2].original.castTimeFromStart, 0);
        // Not swifted
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].usedAt, 3.14);
        assertClose(actualAbilities[3].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[3].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[3].original.castTimeFromStart, 0);

    });
    it('should work correctly with a long cast', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(filler);
        cp.use(Swiftcast);
        cp.use(long);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not swifted
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].usedAt, -1.48);
        assertClose(actualAbilities[0].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[0].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[0].original.lockTime, 1.48);
        assertClose(actualAbilities[0].original.castTimeFromStart, 1.38);
        // Swiftcast
        assert.equal(actualAbilities[1].ability.name, "Swiftcast");
        assertClose(actualAbilities[1].usedAt, 0.0);
        assertClose(actualAbilities[1].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[1].original.totalTimeTaken, 0.6);
        assertClose(actualAbilities[1].original.lockTime, 0.6);
        assertClose(actualAbilities[1].original.castTimeFromStart, 0);
        // Swifted
        assert.equal(actualAbilities[2].ability.name, "Raise");
        assertClose(actualAbilities[2].usedAt, 0.83); // 0.83 === -1.48 + 2.31
        assertClose(actualAbilities[2].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[2].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[2].original.lockTime, 0.6);
        assertClose(actualAbilities[2].original.castTimeFromStart, 0);
        // Not swifted
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].usedAt, 3.14);
        assertClose(actualAbilities[3].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[3].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[3].original.lockTime, 1.48);
        assertClose(actualAbilities[3].original.castTimeFromStart, 1.38);

    });
});

const potBuff: Buff = {
    cooldown: 60,
    duration: 10,
    effects: {},
    job: 'BLU',
    name: "Pot Buff Status",
    beforeSnapshot<X extends Ability>(controller: BuffController, ability: X): X {
        controller.removeStatus(potBuff);
        return {
            ...ability,
            potency: ability.potency + 100
        }
    }
}

const potBuffAbility: GcdAbility = {
    type: 'gcd',
    name: "Pot Buff Ability",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.0,
    activatesBuffs: [potBuff]
}

describe('Potency Buff Ability', () => {
    it('should increase the damage once', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(filler);
        cp.use(potBuffAbility);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not swifted
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].directDamage, 15078, 1);
        // Swiftcast
        assert.equal(actualAbilities[1].ability.name, "Pot Buff Ability");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        // Swifted
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].directDamage, 15078 * (310 + 100) / 310, 1);
        // Not swifted
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].directDamage, 15078, 1);

    });
});

function multiplyDamage(damageResult: DamageResult, multiplier: number, multiplyDirectDamage: boolean = true, multiplyDot: boolean = true) {
    return {
        directDamage: (damageResult.directDamage === null || !multiplyDirectDamage) ? damageResult.directDamage : {
            expected: damageResult.directDamage.expected * multiplier
        },
        dot: (damageResult.dot === null || !multiplyDot) ? damageResult.dot : {
            ...damageResult.dot,
            damagePerTick: {
                expected: damageResult.directDamage.expected * multiplier
            }
        },
    }
}

// Demonstrates one way of doing a one-off damage increase
const bristleBuff: Buff = {
    // TODO
    cooldown: 60,
    duration: 10,
    effects: {
        dmgIncrease: 0.5
    },
    job: 'BLU',
    name: "Bristle",
    beforeSnapshot: removeSelf,
    appliesTo: ability => ability.attackType === "Spell" && ability.potency !== null,
}

const bristle: GcdAbility = {
    type: 'gcd',
    name: "Bristle",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.0,
    activatesBuffs: [bristleBuff],
}

// Demonstrates the longer but more flexible way
const bristleBuff2: Buff = {
    // TODO
    cooldown: 60,
    duration: 10,
    effects: {},
    job: 'BLU',
    name: "Bristle",
    modifyDamage(buffController: BuffController, damageResult: DamageResult, ability: Ability): DamageResult | void {
        if (ability.attackType === 'Spell' && ability.potency !== null) {
            buffController.removeSelf();
            return multiplyDamage(damageResult, 1.5, true, true);
        }
    }
}

const bristle2: GcdAbility = {
    type: 'gcd',
    name: "Bristle2",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.0,
    activatesBuffs: [bristleBuff2]
}

describe('Damage Buff Ability', () => {
    // TODO: test a DoT
    it('should increase the damage once', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(filler);
        cp.use(bristle);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not buffed
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].directDamage, 15078, 1);
        // Buff
        assert.equal(actualAbilities[1].ability.name, "Bristle");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        // Buffed
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].directDamage, 15078 * 1.5, 1);
        // Not buffed
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].directDamage, 15078, 1);

    });
    it('should increase the damage once, other style', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(filler);
        cp.use(bristle2);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not buffed
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].directDamage, 15078, 1);
        // Buff
        assert.equal(actualAbilities[1].ability.name, "Bristle2");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        // Buffed
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].directDamage, 15078 * 1.5, 1);
        // Not Buffed
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].directDamage, 15078, 1);
    });
    it('should multiply direct damage and dots by default', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(dia);
        cp.advanceTo(27);
        cp.use(bristle);
        cp.advanceTo(30);
        cp.use(dia);
        cp.advanceTo(60);
        cp.use(dia);
        // Don't cut off the final dot
        cp.advanceTo(90);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not buffed
        assert.equal(actualAbilities[0].ability.name, "Dia");
        assertClose(actualAbilities[0].directDamage, 3161.5, 1);
        assertClose(actualAbilities[0].totalDamage, 37174, 1);
        // Buff
        assert.equal(actualAbilities[1].ability.name, "Bristle");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        assertClose(actualAbilities[1].totalDamage, 0, 1);
        // Buffed
        assert.equal(actualAbilities[2].ability.name, "Dia");
        assertClose(actualAbilities[2].directDamage, 3161.5 * 1.5, 1);
        assertClose(actualAbilities[2].totalDamage, 37174 * 1.5, 1);
        // Not Buffed
        assert.equal(actualAbilities[3].ability.name, "Dia");
        assertClose(actualAbilities[3].directDamage, 3161.5, 1);
        assertClose(actualAbilities[3].totalDamage, 37174, 1);
    });
    it('should filter abilities correctly', () => {
        const cp = new CycleProcessor({
            allBuffs: [],
            cycleTime: 30,
            stats: exampleGearSet.computedStats,
            totalTime: 120,
            useAutos: false
        });
        cp.use(filler);
        cp.use(bristle);
        // Bristle does not apply to this
        cp.use(weaponSkill);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not buffed
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].directDamage, 15078, 1);
        // Buff
        assert.equal(actualAbilities[1].ability.name, "Bristle");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        // Filtered, not buffed
        assert.equal(actualAbilities[2].ability.name, "WepSkill");
        assertClose(actualAbilities[2].directDamage, 15078, 1);
        // Buffed
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].directDamage, 15078 * 1.5, 1);
        // Not buffed
        assert.equal(actualAbilities[4].ability.name, "Glare");
        assertClose(actualAbilities[4].directDamage, 15078, 1);
    });
});
