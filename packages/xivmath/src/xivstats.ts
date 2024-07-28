import {ComputedSetStats, JobData, LevelStats, PartyBonusAmount, RawStats} from "./geartypes";
import {
    autoAttackModifier,
    autoDhBonusDmg,
    critChance,
    critDmg,
    detDmg,
    dhitChance,
    dhitDmg, mainStatMulti, mpTick,
    sksTickMulti,
    sksToGcd,
    spsTickMulti,
    spsToGcd, tenacityDmg, tenacityIncomingDmg,
    vitToHp, wdMulti
} from "./xivmath";
import {JobName, SupportedLevel} from "./xivconstants";

/**
 * Adds the stats of 'addedStats' into 'baseStats'.
 *
 * Modifies 'baseStats' in-place.
 *
 * @param baseStats  The base stat sheet. Will be modified.
 * @param addedStats The stats to add.
 */
export function addStats(baseStats: RawStats, addedStats: RawStats): void {
    for (const entry of Object.entries(baseStats)) {
        const stat = entry[0] as keyof RawStats;
        baseStats[stat] = addedStats[stat] + (baseStats[stat] ?? 0);
    }
}

export function finalizeStats(
    combinedStats: RawStats,
    level: SupportedLevel,
    levelStats: LevelStats,
    classJob: JobName,
    classJobStats: JobData,
    partyBonus: PartyBonusAmount
): ComputedSetStats {
    const mainStat = Math.floor(combinedStats[classJobStats.mainStat] * (1 + 0.01 * partyBonus));
    const aaStat = Math.floor(combinedStats[classJobStats.autoAttackStat] * (1 + 0.01 * partyBonus));
    const vitEffective = Math.floor(combinedStats.vitality * (1 + 0.01 * partyBonus));
    const wdEffective = Math.max(combinedStats.wdMag, combinedStats.wdPhys);
    const hp = combinedStats.hp + vitToHp(levelStats, classJobStats, vitEffective);
    const computedStats: ComputedSetStats = {
        ...combinedStats,
        vitality: vitEffective,
        level: level,
        levelStats: levelStats,
        job: classJob,
        jobStats: classJobStats,
        gcdPhys: (base, haste = 0) => sksToGcd(base, levelStats, combinedStats.skillspeed, haste),
        gcdMag: (base, haste = 0) => spsToGcd(base, levelStats, combinedStats.spellspeed, haste),
        haste: () => 0,
        hp: hp,
        critChance: critChance(levelStats, combinedStats.crit),
        critMulti: critDmg(levelStats, combinedStats.crit),
        dhitChance: dhitChance(levelStats, combinedStats.dhit),
        dhitMulti: dhitDmg(levelStats, combinedStats.dhit),
        detMulti: detDmg(levelStats, combinedStats.determination),
        spsDotMulti: spsTickMulti(levelStats, combinedStats.spellspeed),
        sksDotMulti: sksTickMulti(levelStats, combinedStats.skillspeed),
        tncMulti: classJobStats.role === 'Tank' ? tenacityDmg(levelStats, combinedStats.tenacity) : 1,
        tncIncomingMulti: classJobStats.role === 'Tank' ? tenacityIncomingDmg(levelStats, combinedStats.tenacity) : 1,
        // TODO: does this need to be phys/magic split?
        wdMulti: wdMulti(levelStats, classJobStats, wdEffective),
        mainStatMulti: mainStatMulti(levelStats, classJobStats, mainStat),
        aaStatMulti: mainStatMulti(levelStats, classJobStats, aaStat),
        traitMulti: classJobStats.traitMulti ? (type) => classJobStats.traitMulti(level, type) : () => 1,
        autoDhBonus: autoDhBonusDmg(levelStats, combinedStats.dhit),
        mpPerTick: mpTick(levelStats, combinedStats.piety),
        aaMulti: autoAttackModifier(levelStats, classJobStats, combinedStats.weaponDelay, combinedStats.wdPhys),
        aaDelay: combinedStats.weaponDelay
    };
    // TODO: should this just apply to all main stats, even ones that are irrelevant to the class?
    computedStats[classJobStats.mainStat] = mainStat;
    computedStats[classJobStats.autoAttackStat] = aaStat;
    if (classJobStats.traits) {
        classJobStats.traits.forEach(trait => {
            if (trait.minLevel && trait.minLevel > level) {
                return;
            }
            if (trait.maxLevel && trait.maxLevel < level) {
                return;
            }
            trait.apply(computedStats);
        });
    }
    if (computedStats.weaponDelay <= 0) {
        computedStats.weaponDelay = 100_000;
    }
    return computedStats;

}
