import {ComputedSetStats, JobData, LevelStats} from "./geartypes";
import {CharacterGearSet} from "./gear";
import {EMPTY_STATS, JobName, RaceName, SupportedLevel} from "./xivconstants";

export function sksToGcd(sks: number): number {
    return 2.6
}

export function spsToGcd(baseGcd: number, levelStats: LevelStats, sps: number): number {
    return Math.round((100) * ((baseGcd * 1000 * (1000 - Math.round(130 * (sps - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000) / 1000)) / 100;
}

export function critChance(levelStats: LevelStats, crit: number) {
    return Math.floor(200 * (crit - levelStats.baseSubStat) / levelStats.levelDiv + 50) / 1000.0;
}

export function critDmg(levelStats: LevelStats, crit: number) {
    // return 1 + Math.floor(200 * (crit - levelStats.baseSubStat) / levelStats.levelDiv + 400) / 1000;
    return (1400 + Math.floor(200 * (crit - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000.0;
}

export function autoCritDmg(levelStats: LevelStats, crit: number) {
    return (1400)
}

export function dhitChance(levelStats: LevelStats, dhit: number) {
    // return 1 + Math.floor((550 * dhit - levelStats.baseSubStat) / levelStats.levelDiv) / 1000;
    return Math.floor(550 * (dhit - levelStats.baseSubStat) / levelStats.levelDiv) / 1000.0;
}

export function dhitDmg(levelStats: LevelStats, dhit: number) {
    return 1.25;
}

export function autoDhitDmg(levelStats: LevelStats, dhit: number) {
    return Math.floor(140 * ((dhit - levelStats.baseMainStat) / levelStats.levelDiv) + 1000);
}

export function detDmg(levelStats: LevelStats, det: number) {
    return (1000 + Math.floor(140 * (det - levelStats.baseMainStat) / levelStats.levelDiv)) / 1000.0;
}

export function wdMulti(levelStats: LevelStats, jobStats: JobData, wd: number) {
    const mainStatJobMod = jobStats.jobStatMulipliers[jobStats.mainStat];
    return Math.floor((levelStats.baseMainStat * mainStatJobMod / 1000) + wd);
}

export function spsTickMulti(sps: number) {
    return (1000 + Math.floor(130 * (sps - 400) / 1900)) / 1000;
}

// TODO: only works for 90 and non-tank?
export function mainStatMulti(levelStats: LevelStats, jobStats: JobData, mainstat: number) {
    if (jobStats.role === 'Tank') {
        // TODO: what is the number here?
        return (Math.floor(195 * (mainstat - levelStats.baseMainStat) / levelStats.baseMainStat) + 100) / 100;
    }
    else {
        return (Math.floor(195 * (mainstat - levelStats.baseMainStat) / levelStats.baseMainStat) + 100) / 100;
    }
}

export function pietyHealingMulti(levelStats: LevelStats, piety: number) {
    return 200 + (Math.floor(150 * (piety - levelStats.baseMainStat) / levelStats.levelDiv));
}

export function tenacityDmg(levelStats: LevelStats, tenacity: number) {
    return 1000 + Math.floor(100 * (tenacity - levelStats.baseSubStat) / levelStats.levelDiv) / 1000;
}

export function autoDhBonusDmg(levelStats: LevelStats, dhit: number) {
    return Math.floor(140 * ((dhit - levelStats.baseMainStat) / levelStats.levelDiv) + 1000);
}

const fl = Math.floor;
/**
 * Computes base damage. Does not factor in crit/dh RNG nor damage variance.
 *
 * TODO: where to factor in extra damage from buffs?
 */
export function baseDamage(stats: ComputedSetStats, potency: number, autoDH: boolean = false, autoCrit: boolean = false) {

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
    // const dhRate = gear.computedStats.dhitChance + extraBuffDhRate;
    const dhRate = stats.dhitChance;
    // Multiplier for a successful DH
    const dhMulti = stats.dhitMulti;
    // Det multiplier
    const detMulti = stats.detMulti;
    // Extra damage from auto DH bonus
    const autoDhBonus = stats.autoDhBonus;
    const tncMulti = 1000 / 1000 // if tank you'd do Funcs.fTEN(stats.tenacity, level) / 1000
    const detAutoDhMulti = fl((detMulti + autoDhBonus) * 1000) / 1000;
    const traitMulti = stats.traitMulti;

    // console.log({
    //     mainStatMulti: mainStatMulti, wdMulti: wdMulti, critMulti: critMulti, critRate: critRate, dhRate: dhRate, dhMulti: dhMulti, detMulti: detMulti, tncMulti: tncMulti, traitMulti: traitMulti
    // });

    // Base action potency and main stat multi
    const d1 = fl(potency * mainStatMulti * 100) / 100;
    // Factor in determination and auto DH multiplier
    const d2 = fl(d1 * (autoDH ? detAutoDhMulti : detMulti) * 100) / 100;
    // Factor in Tenacity multiplier
    const d3 = fl(d2 * tncMulti * 100) / 100;
    // Factor in weapon damage multiplier
    const d4 = fl(d3 * wdMulti);
    // const d5 = fl(fl(d4 * critMulti) * DH_MULT)
    const d5 = d4;
    // Factor in auto crit multiplier
    const d6 = autoCrit ? fl(d5 * (1 + (critRate * (critMulti - 1)))) : d5;
    // Factor in auto DH multiplier
    const d7 = autoDH ? fl(d6 * (1 + (dhRate * (dhMulti - 1)))) : d6;
    // Factor in trait multiplier
    const d8 = fl(fl(d7 * traitMulti) / 100);
    // console.log([d1, d2, d3, d4, d5, d6, d7, d8]);

    return d8;
}

