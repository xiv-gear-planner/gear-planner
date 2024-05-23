import {ComputedSetStats} from "@xivgear/xivmath/geartypes";
import {Ability, Buff, CombinedBuffEffect, ComputedDamage, DamageResult, DamagingAbility} from "./sim_types";
import {applyDhCritFull, baseDamageFull} from "@xivgear/xivmath/xivmath";
import {multiplyFixed, multiplyValues} from "@xivgear/xivmath/deviation";

function dotPotencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect): ComputedDamage {
    const modifiedStats = {...stats};
    modifiedStats.critChance += combinedBuffEffects.critChanceIncrease;
    modifiedStats.dhitChance += combinedBuffEffects.dhitChanceIncrease;
    // TODO: are there any dots with auto-crit or auto-dh?
    const forceDh = false;
    const forceCrit = false;
    // TODO: why is autoDH true
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
    return multiplyValues(afterCritDh, {
        expected: combinedBuffEffects.dmgMod,
        stdDev: 0
    });
}

export function abilityToDamageNew(stats: ComputedSetStats, ability: Ability, combinedBuffEffects: CombinedBuffEffect): DamageResult {
    if (!('potency' in ability)) {
        return {
            directDamage: null,
            dot: null
        }
    }
    return {
        directDamage: ability.potency ? potencyToDamage(stats, ability.potency, ability as DamagingAbility, combinedBuffEffects) : null,
        dot: 'dot' in ability ? {
            fullDurationTicks: ability.dot.duration === 'indefinite' ? 'indefinite' : (ability.dot.duration / 3),
            damagePerTick: dotPotencyToDamage(stats, ability.dot.tickPotency, ability, combinedBuffEffects),
        } : null,
    }

}

export function combineBuffEffects(buffs: Buff[]): CombinedBuffEffect {
    const combinedEffects: CombinedBuffEffect = {
        dmgMod: 1,
        critChanceIncrease: 0,
        dhitChanceIncrease: 0,
        forceCrit: false,
        forceDhit: false,
        haste: 0,
    }
    for (let buff of buffs) {
        if (buff.effects.dmgIncrease) {
            combinedEffects.dmgMod *= (1 + buff.effects.dmgIncrease);
        }
        if (buff.effects.critChanceIncrease) {
            combinedEffects.critChanceIncrease += buff.effects.critChanceIncrease;
        }
        if (buff.effects.dhitChanceIncrease) {
            combinedEffects.dhitChanceIncrease += buff.effects.dhitChanceIncrease;
        }
        if (buff.effects.haste) {
            combinedEffects.haste += buff.effects.haste;
        }
        if (buff.effects.forceCrit) {
            combinedEffects.forceCrit = true;
        }
        if (buff.effects.forceDhit) {
            combinedEffects.forceDhit = true;
        }
    }
    return combinedEffects;
}

