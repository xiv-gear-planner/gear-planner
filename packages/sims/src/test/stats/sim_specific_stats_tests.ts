import {finalizeStats} from "@xivgear/xivmath/xivstats";
import {ComputedSetStats, RawStats} from "@xivgear/xivmath/geartypes";
import {getLevelStats, getRaceStats} from "@xivgear/xivmath/xivconstants";
import {expect} from "chai";
import {baseDamageFull, getDefaultScalings} from "@xivgear/xivmath/xivmath";
import {
    LivingShadowAbyssalDrain,
    LivingShadowDisesteem,
    LivingShadowShadowbringer,
    ScarletDelirium
} from "../../tank/drk/drk_actions";
import {HEADLESS_SHEET_PROVIDER} from "@xivgear/core/sheet";
import {AlternativeScaling} from "@xivgear/core/sims/sim_types";
import {getScalingOverrides, potencyToDamage} from "@xivgear/core/sims/sim_utils";


const level = 100;


describe("ComputedSetStats Class-Specific", () => {
    const fakeSheetDRK = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'DRK', level, undefined, false);
    const loadPromiseDRK = fakeSheetDRK.load();
    it('Dark Knight known value scaling with higher strength, no crit', async () => {
        await loadPromiseDRK;
        // Based off https://xivgear.app/?page=sl|29bdd465-fbca-4995-97da-7125fb2423bf
        // This test uses no crit to make the damage values a little easier to compare like-
        // for-like, as it's no longer 'before crit'.
        const stats = finalizeStats(
            new RawStats({
                hp: 222621,
                vitality: 5109,
                strength: 4761,
                dexterity: 415,
                intelligence: 261,
                mind: 179,
                piety: 440,
                crit: 420,
                dhit: 420,
                determination: 2557,
                tenacity: 2467,
                skillspeed: 729,
                spellspeed: 420,
                wdPhys: 132,
                wdMag: 132,
                weaponDelay: 2.96,
            }),
            {}, level, getLevelStats(level), 'DRK', fakeSheetDRK.classJobStats, 5, getRaceStats("The Lost"));
        expect(stats.mainStatValue).to.eq(4999);
        expect(stats.gearStats.strength).to.eq(4761);

        // 620 potency attack (i.e. Scarlet Delirium)
        const damageBeforeDarkside620 = baseDamageFull(stats, 620, 'Weaponskill', false, false, getDefaultScalings(stats));
        expect(damageBeforeDarkside620.expected).to.eq(27308);

        const fullDamage620 = potencyToDamage(stats, 620, ScarletDelirium, {
            dmgMod: 1.1,
            critChanceIncrease: 0,
            dhitChanceIncrease: 0,
            forceCrit: false,
            forceDhit: false,
            haste: 0,
            modifyStats: function (stats: ComputedSetStats): ComputedSetStats {
                return stats;
            },
        }, getDefaultScalings(stats));
        expect(fullDamage620.expected).to.eq(30639.576);
    });
    it('Dark Knight Living Shadow known value scaling with higher strength, no crit', async () => {
        await loadPromiseDRK;
        // Based off https://xivgear.app/?page=sl|29bdd465-fbca-4995-97da-7125fb2423bf
        // This test uses no crit to make the damage values a little easier to compare like-
        // for-like, as it's no longer 'before crit'.
        const stats = finalizeStats(new RawStats({
            hp: 222621,
            vitality: 5109,
            strength: 4761,
            dexterity: 415,
            intelligence: 261,
            mind: 179,
            piety: 440,
            crit: 420,
            dhit: 420,
            determination: 2557,
            tenacity: 2467,
            skillspeed: 729,
            spellspeed: 420,
            wdPhys: 132,
            wdMag: 132,
            weaponDelay: 2.96,
        }), {}, level, getLevelStats(level), 'DRK', fakeSheetDRK.classJobStats, 5, getRaceStats("The Lost"));
        expect(stats.mainStatValue).to.eq(4999);
        expect(stats.gearStats.strength).to.eq(4761);

        const livingShadowScalings: AlternativeScaling[] = ["Living Shadow Strength Scaling", "Pet Action Weapon Damage"];
        const livingShadowScalingOverrides = getScalingOverrides(livingShadowScalings, stats);

        // 420 potency Living Shadow Attack
        const damageBeforeCrit420 = baseDamageFull(stats, 420, 'Ability', false, false, livingShadowScalingOverrides);
        expect(damageBeforeCrit420.expected).to.eq(21361);

        const fullDamageAbyssalDrain = potencyToDamage(stats, 420, LivingShadowAbyssalDrain, {
            dmgMod: 1,
            critChanceIncrease: 0,
            dhitChanceIncrease: 0,
            forceCrit: false,
            forceDhit: false,
            haste: 0,
            modifyStats: function (stats: ComputedSetStats): ComputedSetStats {
                return stats;
            },
        }, livingShadowScalingOverrides);
        expect(fullDamageAbyssalDrain.expected).to.eq(21788.22);

        // 570 potency Living Shadow Attack
        const damageBeforeCrit570 = baseDamageFull(stats, 570, 'Ability', false, false, livingShadowScalingOverrides);
        expect(damageBeforeCrit570.expected).to.eq(28990);

        const fullDamageShadowbringer = potencyToDamage(stats, 570, LivingShadowShadowbringer, {
            dmgMod: 1,
            critChanceIncrease: 0,
            dhitChanceIncrease: 0,
            forceCrit: false,
            forceDhit: false,
            haste: 0,
            modifyStats: function (stats: ComputedSetStats): ComputedSetStats {
                return stats;
            },
        }, livingShadowScalingOverrides);
        expect(fullDamageShadowbringer.expected).to.eq(29569.8);

        // 620 potency Living Shadow Attack
        const damageBeforeCrit620 = baseDamageFull(stats, 620, 'Ability', false, false, livingShadowScalingOverrides);
        expect(damageBeforeCrit620.expected).to.eq(31533);

        const fullDamageDisesteem = potencyToDamage(stats, 620, LivingShadowDisesteem, {
            dmgMod: 1,
            critChanceIncrease: 0,
            dhitChanceIncrease: 0,
            forceCrit: false,
            forceDhit: false,
            haste: 0,
            modifyStats: function (stats: ComputedSetStats): ComputedSetStats {
                return stats;
            },
        }, livingShadowScalingOverrides);
        expect(fullDamageDisesteem.expected).to.eq(32163.66);
    });

});
