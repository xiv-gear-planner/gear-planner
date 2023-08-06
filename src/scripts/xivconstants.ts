import {JobData, LevelStats, RawStatKey, RawStats} from "./geartypes";

export const MATERIA_SLOTS_MAX = 5;
export const MATERIA_LEVEL_MIN_RELEVANT = 7;
export const MATERIA_LEVEL_MAX_NORMAL = 10;
export const MATERIA_LEVEL_MAX_OVERMELD = 9;
export const LEVEL_MAX: SupportedLevel = 90;

export type JobName = 'WHM' | 'SGE';

export type RaceName = 'Duskwight' | 'Wildwood'

export const SupportedLevels = [80, 90] as const;
export type SupportedLevel = typeof SupportedLevels[number];

export const EMPTY_STATS = new RawStats();


export const JOB_DATA: Record<JobName, JobData> = {
    'WHM': {
        mainStat: 'mind',
        role: 'Healer',
        jobStatMulipliers: new RawStats({
            hp: 105,
            vitality: 100,
            strength: 55,
            dexterity: 105,
            intelligence: 105,
            mind: 115
        }),
        traitMulti: level => 1.3,
        // traits: [
        //     (stats) => stats.traitMulti
        // ]
        irrelevantSubstats: ['skillspeed', 'tenacity'],
    },
    'SGE': {
        mainStat: 'mind',
        role: 'Healer',
        jobStatMulipliers: new RawStats({
            hp: 105,
            vitality: 100,
            strength: 60,
            dexterity: 100,
            intelligence: 115,
            mind: 115
        }),
        traitMulti: level => 1.3,
        irrelevantSubstats: ['skillspeed', 'tenacity'],
    },
}

export const RACE_STATS: Record<RaceName, RawStats> = {
    'Duskwight': new RawStats({
        vitality: -1,
        intelligence: 3,
        mind: 1
    }),
    'Wildwood': new RawStats({
        dexterity: 3,
        vitality: -1,
        intelligence: 2,
        mind: -1
    })
}

export const LEVEL_STATS: Record<SupportedLevel, LevelStats> = {
    80: {
        baseMainStat: 340,
        baseSubStat: 380,
        levelDiv: 1300,
        // TODO: this value is a guess
        hp: 2500
    },
    90: {
        baseMainStat: 390,
        baseSubStat: 400,
        levelDiv: 1900,
        hp: 3000
    }
}

/**
 * Main stats in current version of the game.
 */
export const REAL_MAIN_STATS: (RawStatKey)[] = ['strength', 'dexterity', 'intelligence', 'mind'];
// TODO: is Tenacity treated like this?
/**
 * Substats that are treated as main stats for stat calc purposes.
 */
export const FAKE_MAIN_STATS: (RawStatKey)[] = ['determination', 'piety', 'vitality'];
/**
 * Substats that get the substat-specific math treatment.
 */
export const SPECIAL_SUB_STATS: (RawStatKey)[] = ['crit', 'dhit', 'spellspeed', 'skillspeed', 'tenacity'];
export const ALL_SUB_STATS: (RawStatKey)[] = [...FAKE_MAIN_STATS, ...SPECIAL_SUB_STATS];

/**
 * Which substats can be granted by materia.
 *
 * If SE ever gives us main stat or vitality materia again, this will need to be updated.
 * // TODO: but this includes vitality?
 */
export const MateriaSubstats: (keyof RawStats)[] = [...ALL_SUB_STATS];

export const STAT_FULL_NAMES: Record<RawStatKey, string> = {
    crit: "Critical Hit",
    determination: "Determination",
    dexterity: "Dexterity",
    dhit: "Direct Hit",
    hp: "Hit Points",
    intelligence: "Intelligence",
    mind: "Mind",
    piety: "Piety",
    skillspeed: "Skill Speed",
    spellspeed: "Spell Speed",
    strength: "Strength",
    tenacity: "Tenacity",
    vitality: "Vitality",
    wdMag: "Weapon Damage (Magical)",
    wdPhys: "Weapon Damage (Physical)"
}

export const STAT_ABBREVIATIONS: Record<RawStatKey, string> = {
    crit: "CRT",
    determination: "DET",
    dexterity: "DEX",
    dhit: "DHT",
    hp: "HP",
    intelligence: "INT",
    mind: "MND",
    piety: "PIE",
    skillspeed: "SkS",
    spellspeed: "SpS",
    strength: "STR",
    tenacity: "TNC",
    vitality: "VIT",
    wdMag: "WDm",
    wdPhys: "WDp"
}

export function statById(id: number): keyof RawStats {
    switch (id) {
        case 1:
            return "strength";
        case 2:
            return "dexterity";
        case 3:
            return "vitality";
        case 4:
            return "intelligence";
        case 5:
            return "mind";
        case 6:
            return "piety";
        case 7:
            return "hp";
        case 19:
            return "tenacity";
        case 22:
            return "dhit";
        case 27:
            return "crit";
        case 44:
            return "determination";
        case 45:
            return "skillspeed";
        case 46:
            return "spellspeed";
        default:
            return undefined;
    }
}


export function getLevelStats(level: SupportedLevel) {
    if (level) {
        return LEVEL_STATS[level];
    }
    else {
        console.error("Invalid level!");
        return LEVEL_STATS[90];
    }
}

export function getClassJobStats(job: JobName) {
    return JOB_DATA[job];
}

export function getRaceStats(race: RaceName | undefined) {
    if (race) {
        return RACE_STATS[race];
    }
    else {
        return EMPTY_STATS;
    }
}
