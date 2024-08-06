import {
    ComputedSetStats,
    FoodBonuses,
    FoodStatBonus,
    JobData,
    LevelStats,
    PartyBonusAmount,
    RawStats
} from "./geartypes";
import {
    autoAttackModifier,
    autoDhBonusDmg,
    critChance,
    critDmg,
    detDmg,
    dhitChance,
    dhitDmg, fl,
    mainStatMulti,
    mpTick,
    sksTickMulti,
    sksToGcd,
    spsTickMulti,
    spsToGcd,
    tenacityDmg,
    tenacityIncomingDmg,
    vitToHp,
    wdMulti
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
    gearStats: RawStats,
    foodStats: FoodBonuses,
    level: SupportedLevel,
    levelStats: LevelStats,
    classJob: JobName,
    classJobStats: JobData,
    partyBonus: PartyBonusAmount
): ComputedSetStats {
    const combinedStats: RawStats = {...gearStats};
    // const withPartyBonus: RawStats = {...combinedStats};
    const withPartyBonus = combinedStats;
    const mainStatKey = classJobStats.mainStat;
    const aaStatKey = classJobStats.autoAttackStat;
    withPartyBonus[mainStatKey] = fl(withPartyBonus[mainStatKey] * (1 + 0.01 * partyBonus));
    withPartyBonus[aaStatKey] = fl(combinedStats[mainStatKey] * (1 + 0.01 * partyBonus));
    withPartyBonus.vitality = fl(combinedStats.vitality * (1 + 0.01 * partyBonus));
    // Food stats
    for (const stat in foodStats) {
        const bonus: FoodStatBonus = foodStats[stat];
        const startingValue = combinedStats[stat];
        const extraValue = Math.min(bonus.max, Math.floor(startingValue * (bonus.percentage / 100)));
        combinedStats[stat] = startingValue + extraValue;
    }
    const wdEffective = Math.max(combinedStats.wdMag, combinedStats.wdPhys);
    const hp = withPartyBonus.hp + vitToHp(levelStats, classJobStats, withPartyBonus.vitality);
    const mainStat = withPartyBonus[mainStatKey];
    const aaStat = withPartyBonus[aaStatKey];
    const computedStats: ComputedSetStats = {
        ...combinedStats,
        vitality: withPartyBonus.vitality,
        level: level,
        levelStats: levelStats,
        job: classJob,
        jobStats: classJobStats,
        gcdPhys: (base, haste = 0) => sksToGcd(base, levelStats, withPartyBonus.skillspeed, haste),
        gcdMag: (base, haste = 0) => spsToGcd(base, levelStats, withPartyBonus.spellspeed, haste),
        haste: () => 0,
        hp: hp,
        critChance: critChance(levelStats, withPartyBonus.crit),
        critMulti: critDmg(levelStats, withPartyBonus.crit),
        dhitChance: dhitChance(levelStats, withPartyBonus.dhit),
        dhitMulti: dhitDmg(levelStats, withPartyBonus.dhit),
        detMulti: detDmg(levelStats, withPartyBonus.determination),
        spsDotMulti: spsTickMulti(levelStats, withPartyBonus.spellspeed),
        sksDotMulti: sksTickMulti(levelStats, withPartyBonus.skillspeed),
        tncMulti: classJobStats.role === 'Tank' ? tenacityDmg(levelStats, withPartyBonus.tenacity) : 1,
        tncIncomingMulti: classJobStats.role === 'Tank' ? tenacityIncomingDmg(levelStats, withPartyBonus.tenacity) : 1,
        // TODO: does this need to be phys/magic split?
        wdMulti: wdMulti(levelStats, classJobStats, wdEffective),
        mainStatMulti: mainStatMulti(levelStats, classJobStats, mainStat),
        aaStatMulti: mainStatMulti(levelStats, classJobStats, aaStat),
        traitMulti: classJobStats.traitMulti ? (type) => classJobStats.traitMulti(level, type) : () => 1,
        autoDhBonus: autoDhBonusDmg(levelStats, withPartyBonus.dhit),
        mpPerTick: mpTick(levelStats, withPartyBonus.piety),
        aaMulti: autoAttackModifier(levelStats, classJobStats, withPartyBonus.weaponDelay, withPartyBonus.wdPhys),
        aaDelay: combinedStats.weaponDelay
    };
    // TODO: should this just apply to all main stats, even ones that are irrelevant to the class?
    computedStats[mainStatKey] = mainStat;
    computedStats[aaStatKey] = aaStat;
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
