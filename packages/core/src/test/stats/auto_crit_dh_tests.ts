import {finalizeStats} from "@xivgear/xivmath/xivstats";
import {RawStats} from "@xivgear/xivmath/geartypes";
import {getLevelStats} from "@xivgear/xivmath/xivconstants";
import {HEADLESS_SHEET_PROVIDER} from "../../sheet";
import {expect} from "chai";
import {Buff, DamagingAbility, GcdAbility} from "../../sims/sim_types";
import {abilityToDamageNew, combineBuffEffects} from "../../sims/sim_utils";

const level = 100;
const fakeSheetGNB = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'GNB', level, undefined);
const loadPromiseGNB = fakeSheetGNB.load();
const rawStats = new RawStats({
    hp: 0,
    vitality: 4119,
    strength: 1371,
    dexterity: 440,
    intelligence: 1038,
    mind: 2060,
    piety: 564,
    crit: 2988,
    dhit: 690,
    determination: 987,
    tenacity: 420,
    skillspeed: 456,
    spellspeed: 852,
    wdPhys: 79,
    wdMag: 79,
    weaponDelay: 3.12,
});
const makeStats = loadPromiseGNB.then(() => finalizeStats(rawStats, {}, level, getLevelStats(level), 'GNB', fakeSheetGNB.classJobStats, 0, "The Lost"));

describe("Auto Crit and Dh Bonus Multi Calculation", () => {
    it('has no bonuses by default', async () => {
        const stats = await makeStats;
        expect(stats.autoCritBuffMulti).to.eq(1);
        expect(stats.autoDhitBuffMulti).to.eq(1);
        expect(stats.critChance).to.eq(0.234);
        expect(stats.dhitChance).to.eq(0.053);
        expect(stats.critMulti).to.eq(1.584);
        expect(stats.dhitMulti).to.eq(1.25);
    });
    it('handles auto dh+crit with no buffs', async () => {
        let stats = await makeStats;
        stats = stats.withModifications((stats, bonuses) => {
            bonuses.forceCrit = true;
            bonuses.forceDh = true;
        });
        expect(stats.critChance).to.eq(1);
        expect(stats.dhitChance).to.eq(1);
        expect(stats.autoCritBuffMulti).to.eq(1);
        expect(stats.autoDhitBuffMulti).to.eq(1);
        expect(stats.critMulti).to.eq(1.584);
        expect(stats.dhitMulti).to.eq(1.25);
    });
    it('handles auto dh+crit with crit buffs', async () => {
        let stats = await makeStats;
        stats = stats.withModifications((stats, bonuses) => {
            bonuses.forceCrit = true;
            bonuses.forceDh = true;
            bonuses.critChance += 0.10;
        });
        expect(stats.critChance).to.eq(1);
        expect(stats.dhitChance).to.eq(1);
        // 1 + 0.584 * 0.1 = 1.0584, truncate to 1.058
        expect(stats.autoCritBuffMulti).to.eq(1.058);
        expect(stats.autoDhitBuffMulti).to.eq(1);
        expect(stats.critMulti).to.eq(1.584);
        expect(stats.dhitMulti).to.eq(1.25);
    });
    it('handles auto dh+crit with dhit buffs', async () => {
        let stats = await makeStats;
        stats = stats.withModifications((stats, bonuses) => {
            bonuses.forceCrit = true;
            bonuses.forceDh = true;
            bonuses.dhitChance += 0.10;
        });
        expect(stats.critChance).to.eq(1);
        expect(stats.dhitChance).to.eq(1);
        expect(stats.autoCritBuffMulti).to.eq(1);
        // 1 + 0.25 * 0.1 = 1.025
        expect(stats.autoDhitBuffMulti).to.eq(1.025);
        expect(stats.critMulti).to.eq(1.584);
        expect(stats.dhitMulti).to.eq(1.25);
    });
    it('handles auto dh+crit with crit+dhit buffs', async () => {
        let stats = await makeStats;
        stats = stats.withModifications((stats, bonuses) => {
            bonuses.forceCrit = true;
            bonuses.forceDh = true;
            bonuses.critChance += 0.10;
            bonuses.dhitChance += 0.10;
        });
        expect(stats.critChance).to.eq(1);
        expect(stats.dhitChance).to.eq(1);
        // 1 + 0.584 * 0.1 = 1.0584, truncate to 1.058
        expect(stats.autoCritBuffMulti).to.eq(1.058);
        // 1 + 0.25 * 0.1 = 1.025, truncate to 1.025
        expect(stats.autoDhitBuffMulti).to.eq(1.025);
        expect(stats.critMulti).to.eq(1.584);
        expect(stats.dhitMulti).to.eq(1.25);
    });
});

const ability = {
    id: 12345,
    name: "Test ability",
    attackType: 'Spell',
    potency: 100,
    type: "gcd",
    gcd: 2.5,
} satisfies GcdAbility & DamagingAbility;

const critChanceBuff = {
    name: 'crit buff',
    effects: {
        critChanceIncrease: 0.5,
    },
} satisfies Buff;

const critForceBuff = {
    name: 'crit force buff',
    effects: {
        forceCrit: true,
    },
} satisfies Buff;

const dhChanceBuff = {
    name: 'dh buff',
    effects: {
        dhitChanceIncrease: 0.5,
    },
} satisfies Buff;

const dhForceBuff = {
    name: 'dh force buff',
    effects: {
        forceDhit: true,
    },
} satisfies Buff;

describe("Auto Crit and Dh Damage Calculation", () => {
    it('no bonuses + never crit or dh (baseline)', async () => {
        const stats = await makeStats;
        const damageResult = abilityToDamageNew(stats, ability, combineBuffEffects([{
            name: "remove all crit/dhit",
            effects: {
                critChanceIncrease: -1,
                dhitChanceIncrease: -1,
            },
        }]));
        expect(damageResult.directDamage?.expected).to.be.closeTo(633, 0.01);
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(18.273, 0.01);
    });
    it('no bonuses', async () => {
        const stats = await makeStats;
        const damageResult = abilityToDamageNew(stats, ability, combineBuffEffects([]));
        expect(damageResult.directDamage?.expected).to.be.closeTo(729.037, 0.01);
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(165.271, 0.01);
    });
    it('dh bonus but no auto dh', async () => {
        const stats = await makeStats;
        const damageResult = abilityToDamageNew(stats, ability, combineBuffEffects([dhChanceBuff]));
        // We're adding approximately a 50% chance to do 25% more damage, so should be about a 12.5% increase.
        expect(damageResult.directDamage?.expected).to.be.closeTo(818.975, 0.01);
        // Variance also goes up as a result
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(201.754, 0.01);
    });
    it('no bonuses + force crit on skill', async () => {
        const stats = await makeStats;
        const modAbility = {
            ...ability,
            autoCrit: true,
        } satisfies GcdAbility & DamagingAbility;
        const damageResult = abilityToDamageNew(stats, modAbility, combineBuffEffects([]));
        // Crit multi is 1.584, so this is the baseline of 633 * 1.584 (plus the natural guaranteed crit bonus)
        expect(damageResult.directDamage?.expected).to.be.closeTo(1015.957, 0.01);
        // Variance goes down since we no longer have crit RNG
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(63.376, 0.01);
    });
    it('no bonuses + force crit on buff', async () => {
        const stats = await makeStats;
        const damageResult = abilityToDamageNew(stats, ability, combineBuffEffects([{
            name: "Test buff",
            effects: {
                forceCrit: true,
            },
        }]));
        expect(damageResult.directDamage?.expected).to.be.closeTo(1015.957, 0.01);
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(63.376, 0.01);
    });
    it('no bonuses + force dhit on skill', async () => {
        const stats = await makeStats;
        const modAbility = {
            ...ability,
            autoDh: true,
        } satisfies GcdAbility & DamagingAbility;
        const damageResult = abilityToDamageNew(stats, modAbility, combineBuffEffects([]));
        // We're guaranteeing a 25% damage bonus, so should be about +25% over base.
        expect(damageResult.directDamage?.expected).to.be.closeTo(912.166, 0.01);
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(200.239, 0.01);
    });
    it('no bonuses + force dhit on buff', async () => {
        const stats = await makeStats;
        const damageResult = abilityToDamageNew(stats, ability, combineBuffEffects([{
            name: "Test buff",
            effects: {
                forceDhit: true,
            },
        }]));
        // We're guaranteeing a 25% damage bonus, so should be about +25% over base.
        expect(damageResult.directDamage?.expected).to.be.closeTo(912.166, 0.01);
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(200.239, 0.01);
    });
    it('dhit bonus + force dhit on skill', async () => {
        const stats = await makeStats;
        const modAbility = {
            ...ability,
            autoDh: true,
        } satisfies GcdAbility & DamagingAbility;
        const damageResult = abilityToDamageNew(stats, modAbility, combineBuffEffects([dhChanceBuff]));
        // This should be a +25% boost from the guaranteed DH, plus another 12.5 or so for the bonus
        expect(damageResult.directDamage?.expected).to.be.closeTo(1026.187, 0.01);
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(225.269, 0.01);
    });
    it('dhit bonus + force dhit on buff', async () => {
        const stats = await makeStats;
        const damageResult = abilityToDamageNew(stats, ability, combineBuffEffects([dhChanceBuff, dhForceBuff]));
        // This should be a +25% boost from the guaranteed DH, plus another 12.5 or so for the bonus
        expect(damageResult.directDamage?.expected).to.be.closeTo(1026.187, 0.01);
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(225.269, 0.01);
    });
    it('crit bonus + force crit on skill', async () => {
        const stats = await makeStats;
        const modAbility = {
            ...ability,
            autoCrit: true,
        } satisfies GcdAbility & DamagingAbility;
        const damageResult = abilityToDamageNew(stats, modAbility, combineBuffEffects([critChanceBuff]));
        // Baseline * 1.584 from the crit itself * 1.292 (.584 * 0.5 + 1)
        expect(damageResult.directDamage?.expected).to.be.closeTo(1312.617, 0.01);
        // Less variance because no crit RNG
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(81.882, 0.01);
    });
    it('crit bonus + force crit on buff', async () => {
        const stats = await makeStats;
        const damageResult = abilityToDamageNew(stats, ability, combineBuffEffects([critChanceBuff, critForceBuff]));
        // Baseline * 1.584 from the crit itself * 1.292 (.584 * 0.5 + 1)
        expect(damageResult.directDamage?.expected).to.be.closeTo(1312.617, 0.01);
        // Less variance because no crit RNG
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(81.882, 0.01);
    });
    it('everything', async () => {
        const stats = await makeStats;
        const damageResult = abilityToDamageNew(stats, ability, combineBuffEffects([critChanceBuff, critForceBuff, dhChanceBuff, dhForceBuff]));
        // Baseline * 1.584 from the crit itself * 1.292 (.584 * 0.5 + 1) * 1.25 (dh) * 1.125 (dh bonus)
        expect(damageResult.directDamage?.expected).to.be.closeTo(1847.631, 0.01);
        // Even less variance because neither crit nor dhit rng
        expect(damageResult.directDamage?.stdDev).to.be.closeTo(53.337, 0.01);
    });
});
