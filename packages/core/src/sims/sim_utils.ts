import {ComputedSetStats} from "@xivgear/xivmath/geartypes";
import {Ability, AlternativeScaling, Buff, CombinedBuffEffect, ComputedDamage, DamageResult, DamagingAbility, ScalingOverrides} from "./sim_types";
import {applyDhCritFull, baseDamageFull, getDefaultScalings, getLivingShadowStrength, mainStatMultiLivingShadow} from "@xivgear/xivmath/xivmath";
import {multiplyFixed} from "@xivgear/xivmath/deviation";
import {StatModification} from "@xivgear/xivmath/xivstats";

function dotPotencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect, scalingOverrides = getDefaultScalings(stats)): ComputedDamage {
    const modifiedStats = stats.withModifications((stats, bonuses) => {
        bonuses.critChance += combinedBuffEffects.critChanceIncrease;
        bonuses.dhitChance += combinedBuffEffects.dhitChanceIncrease;
    });
    // TODO: are there any dots with auto-crit or auto-dh?
    const forceDhit = false;
    const forceCrit = false;
    const nonCritDmg = baseDamageFull(modifiedStats, potency, dmgAbility.attackType, forceDhit, true, scalingOverrides);
    const afterCritDh = applyDhCritFull(nonCritDmg, modifiedStats, forceCrit, forceDhit);
    return multiplyFixed(afterCritDh, combinedBuffEffects.dmgMod);
}

function potencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect, scalingOverrides = getDefaultScalings(stats)): ComputedDamage {
    const forceDhit = dmgAbility.autoDh || combinedBuffEffects.forceDhit;
    const forceCrit = dmgAbility.autoCrit || combinedBuffEffects.forceCrit;
    const modifiedStats = stats.withModifications((stats, bonuses) => {
        bonuses.critChance += combinedBuffEffects.critChanceIncrease;
        bonuses.dhitChance += combinedBuffEffects.dhitChanceIncrease;
        if (forceCrit) {
            // These are capped at 100% anyway, so we can force crit/dh by just adding a massive value
            bonuses.forceCrit = true;
        }
        if (forceDhit) {
            bonuses.forceDh = true;
        }
    });
    const nonCritDmg = baseDamageFull(modifiedStats, potency, dmgAbility.attackType, forceDhit, false, scalingOverrides);
    const afterCritDh = applyDhCritFull(nonCritDmg, modifiedStats, forceCrit, forceDhit);
    return multiplyFixed(afterCritDh, combinedBuffEffects.dmgMod);
}

/**
 * Given stats, an ability, and combined buff effects, calculate the damage dealt.
 *
 * @param stats The stats
 * @param ability The ability
 * @param combinedBuffEffects The combined buff effects
 * @return if the ability is not damaging, returns a DamageResult with 'null' for both direct damage and DoT. If the
 * ability is damaging, returns a value representing the damage and variance. In addition, if the ability also has
 * DoT damage, returns predicted DoT damage information.
 */
export function abilityToDamageNew(stats: ComputedSetStats, ability: Ability, combinedBuffEffects: CombinedBuffEffect): DamageResult {
    if (!('potency' in ability)) {
        return {
            directDamage: null,
            dot: null,
        };
    }

    const strengthBeforeBuffs = stats.strength;
    stats = combinedBuffEffects.modifyStats(stats);
    // This is a little hacky but it's a way to get the strength bonus for Living Shadow abilities.
    // This seemed better than the alternative of storing Living Shadow specific info in stats.
    const strengthAfterBuffs = stats.strength;

    const scalingOverrides = getScalingOverrides(ability.alternativeScalings, stats, strengthAfterBuffs - strengthBeforeBuffs);

    // TODO: can we avoid having all of these separate stat modifications?
    return {
        directDamage: ability.potency ? potencyToDamage(stats, ability.potency, ability as DamagingAbility, combinedBuffEffects, scalingOverrides) : null,
        dot: 'dot' in ability ? {
            fullDurationTicks: ability.dot.duration === 'indefinite' ? 'indefinite' : (ability.dot.duration / 3),
            damagePerTick: dotPotencyToDamage(stats, ability.dot.tickPotency, ability, combinedBuffEffects),
        } : null,
    };
}

/**
 * Returns the "zero" CombinedBuffEffect object, which represents not having any offensive buffs.
 */
export function noBuffEffects(): CombinedBuffEffect {
    return {
        dmgMod: 1,
        critChanceIncrease: 0,
        dhitChanceIncrease: 0,
        forceCrit: false,
        forceDhit: false,
        haste: 0,
        modifyStats: stats => stats,
    };
}

/**
 * Translates the given alternate scalings into the specific numerical scaling overrides.
 */
export function getScalingOverrides(alternativeScalings: AlternativeScaling[], stats: ComputedSetStats, strengthBuff: number = 0): ScalingOverrides {
    const scalings = getDefaultScalings(stats);
    // Process alternative scalings for the ability. There may be multiple.
    if (alternativeScalings) {
        if (alternativeScalings.find(scaling => scaling === "Living Shadow Strength Scaling")) {
            const livingShadowStrength = getLivingShadowStrength(stats.gearStats.strength, stats.racialStats) + strengthBuff;
            scalings.mainStatMulti = mainStatMultiLivingShadow(stats.levelStats, livingShadowStrength);
        }
        if (alternativeScalings.find(scaling => scaling ===  "Pet Action Weapon Damage")) {
            scalings.wdMulti = stats.wdMultiPetAction;
        }
    }

    return scalings;
}

/**
 * Given buffs, return a CombinedBuffEffect object that represents the total change of the combined buffs.
 *
 * @param buffs
 */
export function combineBuffEffects(buffs: Buff[]): CombinedBuffEffect {
    const combinedEffects: CombinedBuffEffect = noBuffEffects();
    const statModifications: StatModification[] = [];
    for (const buff of buffs) {
        const effects = buff.effects;
        if (effects.dmgIncrease) {
            combinedEffects.dmgMod *= (1 + effects.dmgIncrease);
        }
        if (effects.critChanceIncrease) {
            combinedEffects.critChanceIncrease += effects.critChanceIncrease;
        }
        if (effects.dhitChanceIncrease) {
            combinedEffects.dhitChanceIncrease += effects.dhitChanceIncrease;
        }
        if (effects.haste) {
            combinedEffects.haste += effects.haste;
        }
        if (effects.forceCrit) {
            combinedEffects.forceCrit = true;
        }
        if (effects.forceDhit) {
            combinedEffects.forceDhit = true;
        }
        if (effects.modifyStats) {
            statModifications.push(effects.modifyStats);
        }
    }
    combinedEffects.modifyStats = (stats) => {
        return stats.withModifications((stats, bonuses) => {
            statModifications.forEach(mod => {
                mod(stats, bonuses);
            });
        });
    };
    return combinedEffects;
}

