import {ComputedSetStats} from "@xivgear/xivmath/geartypes";
import {Ability, Buff, CombinedBuffEffect, ComputedDamage, DamageResult, DamagingAbility} from "./sim_types";
import {applyDhCritFull, baseDamageFull} from "@xivgear/xivmath/xivmath";
import {multiplyFixed} from "@xivgear/xivmath/deviation";

function dotPotencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect): ComputedDamage {
    const modifiedStats = {...stats};
    modifiedStats.critChance += combinedBuffEffects.critChanceIncrease;
    modifiedStats.dhitChance += combinedBuffEffects.dhitChanceIncrease;
    // TODO: are there any dots with auto-crit or auto-dh?
    const forceDh = false;
    const forceCrit = false;
    const nonCritDmg = baseDamageFull(modifiedStats, potency, dmgAbility.attackType, forceDh, forceCrit, true);
    const afterCritDh = applyDhCritFull(nonCritDmg, modifiedStats);
    return multiplyFixed(afterCritDh, combinedBuffEffects.dmgMod);
}

function potencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect): ComputedDamage {
    const modifiedStats = {...stats};
    modifiedStats.critChance += combinedBuffEffects.critChanceIncrease;
    modifiedStats.dhitChance += combinedBuffEffects.dhitChanceIncrease;
    const forceDhit = dmgAbility.autoDh || combinedBuffEffects.forceDhit;
    const forceCrit = dmgAbility.autoCrit || combinedBuffEffects.forceCrit;
    const nonCritDmg = baseDamageFull(modifiedStats, potency, dmgAbility.attackType, forceDhit, forceCrit);
    const afterCritDh = applyDhCritFull(nonCritDmg, {
        ...modifiedStats,
        critChance: forceCrit ? 1 : modifiedStats.critChance,
        dhitChance: forceDhit ? 1 : modifiedStats.dhitChance,
    });
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
            dot: null
        }
    }
    // noinspection AssignmentToFunctionParameterJS
    stats = combinedBuffEffects.modifyStats(stats);
    return {
        directDamage: ability.potency ? potencyToDamage(stats, ability.potency, ability as DamagingAbility, combinedBuffEffects) : null,
        dot: 'dot' in ability ? {
            fullDurationTicks: ability.dot.duration === 'indefinite' ? 'indefinite' : (ability.dot.duration / 3),
            damagePerTick: dotPotencyToDamage(stats, ability.dot.tickPotency, ability, combinedBuffEffects),
        } : null,
    }

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
        modifyStats: stats => stats
    };
}

/**
 * Given buffs, return a CombinedBuffEffect object that represents the total change of the combined buffs.
 *
 * @param buffs
 */
export function combineBuffEffects(buffs: Buff[]): CombinedBuffEffect {
    const combinedEffects: CombinedBuffEffect = noBuffEffects();
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
            const oldFunc = combinedEffects.modifyStats;
            combinedEffects.modifyStats = (stats) => {
                const before = oldFunc(stats);
                const copy = {...before};
                return effects.modifyStats(copy);
            }
        }
    }
    return combinedEffects;
}

