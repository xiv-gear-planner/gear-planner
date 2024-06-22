import {AttackType, ComputedSetStats, JobData, LevelStats} from "./geartypes";
import {chanceMultiplierStdDev, multiplyValues, ValueWithDev} from "./deviation";

/*
    Common math for FFXIV.

    These mostly come from AkhMorning, however, there is one important difference - where possible, these are normalized
    to 1. That is, if something has no impact on the final result, it should be 1, rather than 100 or 1000. If it
    grants +50% damage, then it should be 1.5, rather than 150 or 1500, and so on.

    Most of these do not need to be used directly, because the values are already calculated on the ComputedSetStats
    object. It is preferable to use already-computed values since those are also exposed on the UI. This ensures
    consistency with the displayed values.
 */
/**
 * Enhanced flooring function which takes into account a small margin of error to account for
 * floating point errors.
 *
 * e.g. 2.3 * 100 => 229.99999999999997, but fl(2.3 * 100) => 230
 *
 * @param input
 */
export function fl(input: number) {
    const floored = Math.floor(input);
    const loss = input - floored;
    // e.g. if input is 2.999..., then floored == 2 and loss == 0.999...
    // so we can just return floor + 1;
    if (loss >= 0.99999995) {
        return floored + 1;
    }
    else {
        return floored;
    }
}

/**
 * Floor a number to the given precision.
 *
 * e.g. flp(2, 1.239) => 1.23
 *
 * @param places The number of decimal places to keep. Must be a non-negative integer. Zero is allowed,
 * but you should just call 'fl' directly in that case.
 * @param input The number to round.
 */
function flp(places: number, input: number) {
    if (places % 1 !== 0 || places < 0) {
        throw Error(`Invalid places input ${places} - must be non-negative integer`);
    }
    const multiplier = Math.pow(10, places);
    return fl(input * multiplier) / multiplier;
}

/**
 * Convert skill speed to GCD speed.
 *
 * @param baseGcd The base time of the ability in question (e.g. 2.5 for most abilities).
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param sks The skill speed stat value.
 * @param haste The haste value, e.g. 15 for 15% haste, etc.
 */
export function sksToGcd(baseGcd: number, levelStats: LevelStats, sks: number, haste = 0): number {
    return fl((100 - haste) * (baseGcd * 1000 * (1000 - fl(130 * (sks - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000 / 1000)) / 100;
}

/**
 * Convert spell speed to GCD speed.
 *
 * @param baseGcd The base time of the ability in question (e.g. 2.5 for most abilities).
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param sps The spell speed stat value.
 * @param haste The haste value, e.g. 15 for 15% haste, etc.
 */
export function spsToGcd(baseGcd: number, levelStats: LevelStats, sps: number, haste = 0): number {
    return fl((100 - haste) * (baseGcd * 1000 * (1000 - fl(130 * (sps - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000 / 1000)) / 100;
}

/**
 * Convert crit stat to crit chance.
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param crit The critical hit stat value.
 */
export function critChance(levelStats: LevelStats, crit: number) {
    return fl(200 * (crit - levelStats.baseSubStat) / levelStats.levelDiv + 50) / 1000.0;
}

/**
 * Convert crit stat to crit damage multiplier.
 *
 * AkhMorning equivalent: F(CRIT)
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param crit The critical hit stat value.
 */
export function critDmg(levelStats: LevelStats, crit: number) {
    return (1400 + fl(200 * (crit - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000.0;
}

/**
 * Convert direct hit stat to direct hit chance.
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param dhit The direct hit stat value.
 */
export function dhitChance(levelStats: LevelStats, dhit: number) {
    return fl(550 * (dhit - levelStats.baseSubStat) / levelStats.levelDiv) / 1000.0;
}

/**
 * Convert direct hit stat to direct hit multiplier. Note that this is a fixed multiplier at the moment. This
 * function is only here in case that changes in the future.
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param dhit The direct hit stat value.
 */
export function dhitDmg(levelStats: LevelStats, dhit: number) {
    return 1.25;
}

/**
 * Convert a determination stat to its respective damage multiplier.
 *
 * AkhMorning equivalent: F(DET)
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param det The determination stat value.
 */
export function detDmg(levelStats: LevelStats, det: number) {
    return (1000 + fl(140 * (det - levelStats.baseMainStat) / levelStats.levelDiv)) / 1000.0;
}

/**
 * Convert a Weapon Damage value to a damage multiplier.
 *
 * AkhMorning equivalent: F(WD)
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param jobStats Job stats for the job for which the computation is to be performed.
 * @param wd The weapon damage value.
 */
export function wdMulti(levelStats: LevelStats, jobStats: JobData, wd: number) {
    const mainStatJobMod = jobStats.jobStatMultipliers[jobStats.mainStat];
    return fl(levelStats.baseMainStat * mainStatJobMod / 1000 + wd);
}

/**
 * Convert a spell speed amount to a DoT/HoT tick multiplier.
 *
 * AkhMorning equivalent: F(SPD)
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param sps The spell speed.
 */
export function spsTickMulti(levelStats: LevelStats, sps: number) {
    return (1000 + fl(130 * (sps - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000;
}

/**
 * Convert a skill speed amount to a DoT/HoT tick multiplier.
 *
 * AkhMorning equivalent: F(SPD)
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param sks The skill speed.
 */
export function sksTickMulti(levelStats: LevelStats, sks: number) {
    return (1000 + fl(130 * (sks - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000;
}

/**
 * Convert a main stat value to a damage multiplier.
 *
 * AkhMorning equivalent: F(AP) or F(ATK)
 *
 * @param levelStats
 * @param jobStats
 * @param mainstat
 */
export function mainStatMulti(levelStats: LevelStats, jobStats: JobData, mainstat: number) {
    // TODO make this work without ts-ignore
    // @ts-expect-error - can't figure out type def
    const apMod = levelStats.mainStatPowerMod[jobStats.role] ?? levelStats.mainStatPowerMod.other;
    return (fl(apMod * (mainstat - levelStats.baseMainStat) / levelStats.baseMainStat) + 100) / 100;
}

/**
 * Convert a tenacity stat value to its respective damage multiplier.
 *
 * AkhMorning equivalent: F(TNC)
 *
 * @param levelStats
 * @param tenacity
 */
export function tenacityDmg(levelStats: LevelStats, tenacity: number) {
    return (1000 + fl(100 * (tenacity - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000;
}

/**
 * Convert direct hit stat to a damage multiplier for auto-DH abilities. Having more direct hit will provide more
 * damage in cases where the ability automatically direct hits.
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param dhit The direct hit stat value.
 */
export function autoDhBonusDmg(levelStats: LevelStats, dhit: number) {
    return fl(140 * ((dhit - levelStats.baseSubStat) / levelStats.levelDiv) + 1000) / 1000;
}

/**
 * Convert a piety stat to (MP regen)/tick amount.
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param piety The piety stat.
 */
export function mpTick(levelStats: LevelStats, piety: number) {
    return 200 + fl(150 * (piety - levelStats.baseMainStat) / levelStats.levelDiv);
}

/**
 * Like wdMulti, but for auto-attacks.
 *
 * AkhMorning equivalent: f(AUTO)
 *
 * @param levelStats level stats
 * @param jobStats job stats
 * @param weaponDelay weapon delay in seconds
 * @param weaponDamage weapon damage
 */
export function autoAttackModifier(levelStats: LevelStats, jobStats: JobData, weaponDelay: number, weaponDamage: number) {
    return fl(fl(levelStats.baseMainStat * jobStats.jobStatMultipliers[jobStats.autoAttackStat] / 1000 + weaponDamage) * (weaponDelay * 1000 / 3)) / 1000;
}

/**
 * Computes base damage. Does not factor in crit/dh RNG nor damage variance.
 */
export function baseDamage(...args: Parameters<typeof baseDamageFull>): number {
    return baseDamageFull(...args).expected;
}

/**
 * Determines whether the caster variant of the damage formula should be used instead of the normal variant.
 *
 * @param stats The set stats.
 * @param attackType The type of attack.
 */
function usesCasterDamageFormula(stats: ComputedSetStats, attackType: AttackType): boolean {
    return (stats.jobStats.role === 'Caster' || stats.jobStats.role === 'Healer')
        && attackType !== 'Auto-attack';
}

/**
 * Computes base damage. Does not factor in crit/dh RNG nor damage variance.
 */
export function baseDamageFull(stats: ComputedSetStats, potency: number, attackType: AttackType = 'Unknown', autoDH: boolean = false, autoCrit: boolean = false, isDot: boolean = false): ValueWithDev {

    let spdMulti: number;
    const isAA = attackType === 'Auto-attack';
    if (isAA) {
        spdMulti = stats.sksDotMulti;
    }
    else if (isDot) {
        // SkS: "Affects both the casting and recast timers, as well as the damage over time potency for
        // weaponskills and auto-attacks. The higher the value, the shorter the timers/higher the potency."
        // SpS: "Affects both the casting and recast timers for spells. The higher the value, the shorter
        // the timers. Also affects a spell's damage over time or healing over time potency."
        spdMulti = (attackType === 'Weaponskill') ? stats.sksDotMulti : stats.spsDotMulti;
    }
    else {
        spdMulti = 1.0;
    }
    // Multiplier from main stat
    const mainStatMulti = isAA ? stats.aaStatMulti : stats.mainStatMulti;
    // Multiplier from weapon damage. If this is an auto-attack, use the AA multi instead of the pure WD multi.
    const wdMulti = isAA ? stats.aaMulti : stats.wdMulti;
    // Multiplier for a successful crit
    const critMulti = stats.critMulti;
    // Crit chance
    // const critRate = gear.computedStats.critChance + extraBuffCritRate;
    const critRate = stats.critChance;
    // Dh chance
    // const dhRate = gear.computedStats.dhitChance + extraBuffDhRate;
    const dhRate = stats.dhitChance;
    // Multiplier for a successful DH
    const dhMulti = stats.dhitMulti;
    // Det multiplier
    const detMulti = stats.detMulti;
    // Extra damage from auto DH bonus
    const autoDhBonus = stats.autoDhBonus;
    const tncMulti = stats.tncMulti; // if tank you'd do Funcs.fTEN(stats.tenacity, level) / 1000
    const detAutoDhMulti = flp(3, detMulti + autoDhBonus);
    const traitMulti = stats.traitMulti(attackType);
    const effectiveDetMulti = autoDH ? detAutoDhMulti : detMulti;

    // console.log({
    //     mainStatMulti: mainStatMulti, wdMulti: wdMulti, critMulti: critMulti, critRate: critRate, dhRate: dhRate, dhMulti: dhMulti, detMulti: detMulti, tncMulti: tncMulti, traitMulti: traitMulti
    // });
    // Base action potency and main stat multi
    let stage1potency: number;
    // Mahdi:
    // Caster Damage has potency multiplied into weapon damage and then truncated
    // to an integer as opposed to into ap and truncated to 2 decimal.
    if (usesCasterDamageFormula(stats, attackType)) {
        // https://github.com/Amarantine-xiv/Amas-FF14-Combat-Sim_source/blob/main/ama_xiv_combat_sim/simulator/calcs/compute_damage_utils.py#L130
        const apDet = flp(2, mainStatMulti * effectiveDetMulti);
        const basePotency = fl(apDet * flp(2, wdMulti * potency));
        // Factor in Tenacity multiplier
        const afterTnc = flp(2, basePotency * tncMulti);
        // noinspection UnnecessaryLocalVariableJS
        const afterSpd = flp(3, afterTnc * spdMulti);
        stage1potency = afterSpd;
    }
    else {
        const basePotency = flp(2, potency * mainStatMulti);
        // Factor in determination and auto DH multiplier
        const afterDet = flp(2, basePotency * effectiveDetMulti);
        // Factor in Tenacity multiplier
        const afterTnc = flp(2, afterDet * tncMulti);
        const afterSpd = flp(3, afterTnc * spdMulti);
        // Factor in weapon damage multiplier
        // noinspection UnnecessaryLocalVariableJS
        const afterWeaponDamage = fl(afterSpd * wdMulti);
        stage1potency = afterWeaponDamage;
    }
    // const d5 = fl(fl(afterWeaponDamage * critMulti) * DH_MULT)
    // Factor in auto crit multiplier
    const afterAutoCrit = autoCrit ? fl(stage1potency * (1 + (critRate * (critMulti - 1)))) : stage1potency;
    // Factor in auto DH multiplier
    const afterAutoDh = autoDH ? fl(afterAutoCrit * (1 + (dhRate * (dhMulti - 1)))) : afterAutoCrit;
    // Factor in trait multiplier
    const finalDamage = fl(fl(afterAutoDh * traitMulti) / 100);
    // console.log([basePotency, afterDet, afterTnc, afterWeaponDamage, d5, afterAutoCrit, afterAutoDh, afterTrait]);

    // +-5% damage variance, uniform distribution.
    // Full formula is sqrt((max - min)^2 / 12)
    // == sqrt((1.05d - 0.95d)^2 / 12)
    // == sqrt((.1d)^2 / 12)
    // == sqrt(d^2 * .01 / 12)
    // == d * sqrt(.01 / 12)
    const stdDev = Math.sqrt(0.01 / 12) * finalDamage;

    return {
        expected: finalDamage,
        stdDev: stdDev
    }
}

export function baseHealing(stats: ComputedSetStats, potency: number, attackType: AttackType = 'Unknown', autoCrit: boolean = false) {

    // Multiplier from main stat
    const mainStatMulti = stats.mainStatMulti;
    // Multiplier from weapon damage
    const wdMulti = stats.wdMulti;
    // Multiplier for a successful crit
    const critMulti = stats.critMulti;
    // Crit chance
    // const critRate = gear.computedStats.critChance + extraBuffCritRate;
    const critRate = stats.critChance;
    // Dh chance
    // Det multiplier
    const detMulti = stats.detMulti;
    // Extra damage from auto DH bonus
    const tncMulti = stats.tncMulti;
    const traitMulti = stats.traitMulti(attackType);

    // Base action potency and main stat multi
    const basePotency = fl(potency * mainStatMulti * 100) / 100;
    // Factor in determination and auto DH multiplier
    const afterDet = fl(basePotency * detMulti * 100) / 100;
    // Factor in Tenacity multiplier
    const afterTnc = fl(afterDet * tncMulti * 100) / 100;
    // Factor in weapon damage multiplier
    const afterWeaponDamage = fl(afterTnc * wdMulti);
    // const d5 = fl(fl(afterWeaponDamage * critMulti) * DH_MULT)
    // Factor in auto crit multiplier
    const afterAutoCrit = autoCrit ? fl(afterWeaponDamage * (1 + (critRate * (critMulti - 1)))) : afterWeaponDamage;
    // Factor in auto DH multiplier
    // Factor in trait multiplier
    const afterTrait = fl(fl(afterAutoCrit * traitMulti) / 100);
    // console.log([basePotency, afterDet, afterTnc, afterWeaponDamage, d5, afterAutoCrit, d7, afterTrait]);

    return afterTrait;
}

/**
 * Factors in the expected multiplier value resulting from random direct hits. Used for general damage.
 *
 * @param baseDamage The base damage amount.
 * @param stats The stats.
 */
export function applyDhCrit(baseDamage: number, stats: ComputedSetStats) {
    return baseDamage * (1 + stats.dhitChance * (stats.dhitMulti - 1)) * (1 + stats.critChance * (stats.critMulti - 1));
}

export function dhCritPercentStdDev(stats: ComputedSetStats) {
    return multiplyValues(
        chanceMultiplierStdDev(stats.critChance, stats.critMulti),
        chanceMultiplierStdDev(stats.dhitChance, stats.dhitMulti)
    );
}

export function applyDhCritFull(baseDamage: ValueWithDev, stats: ComputedSetStats): ValueWithDev {
    const stdDevFromCritDh = dhCritPercentStdDev(stats);
    return multiplyValues(baseDamage, stdDevFromCritDh);
}

/**
 * Factors in the expected multiplier value resulting from random critical hits. Used for healing, as healing can crit
 * but not direct hit.
 *
 * @param baseDamage The base damage amount.
 * @param stats The stats.
 */
export function applyCrit(baseDamage: number, stats: ComputedSetStats) {
    return baseDamage * (1 + stats.critChance * (stats.critMulti - 1));
}

// export function critDhVarianceRatio(stats: ComputedSetStats): number {
//
// }

// export function critDhVariance(damage: number, stats: ComputedSetStats) {
//     return critDhVarianceRatio(stats) * damage;
// }

/**
 * Convert vitality to hp.
 *
 * @param levelStats Level stats for the level at which the computation is to be performed.
 * @param jobStats Job stats.
 * @param vitality The vitality stat.
 */
export function vitToHp(levelStats: LevelStats, jobStats: JobData, vitality: number) {
    // TODO make this work without ts-ignore
    // @ts-expect-error - can't figure out type def
    const hpMod = levelStats.hpScalar[jobStats.role] ?? levelStats.hpScalar.other;
    return fl(levelStats.hp * jobStats.jobStatMultipliers.hp / 100) + fl( (vitality - levelStats.baseMainStat) * hpMod);
}
