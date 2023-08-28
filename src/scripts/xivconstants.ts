import {JobDataConst, JobTrait, LevelItemInfo, LevelStats, RawStatKey, RawStats} from "./geartypes";

/**
 * Maximum number of materia slots on any item.
 */
export const MATERIA_SLOTS_MAX = 5;
/**
 * Minimum level of materia that we would ever consider relevant.
 */
export const MATERIA_LEVEL_MIN_RELEVANT = 7;
/**
 * Max supported materia level.
 */
export const MATERIA_LEVEL_MAX_NORMAL = 10;
/**
 * Max supported materia level for overmeld slots.
 */
export const MATERIA_LEVEL_MAX_OVERMELD = 9;

/**
 * Supported Jobs.
 */
export type JobName
    = 'WHM' | 'SGE' | 'SCH' | 'AST'
    | 'PLD' | 'WAR' | 'DRK' | 'GNB'
    | 'DRG' | 'MNK' | 'NIN' | 'SAM' | 'RPR'
    | 'BRD' | 'MCH' | 'DNC'
    | 'BLM' | 'SMN' | 'RDM' | 'BLU';

/**
 * All clans/races.
 *
 * TODO: migrate these to be the same names on XIVAPI so that race states can be auto pulled
 */
export type RaceName = 'Duskwight' | 'Wildwood'
    | 'Raen' | 'Xaela'
    | 'Veena' | 'Rava'
    | 'Helion' | 'The Lost'
    | 'Hellsguard' | 'Sea Wolf'
    | 'Seekers of the Sun' | 'Keepers of the Moon'
    | 'Midlander' | 'Highlander'
    | 'Dunesfolk' | 'Plainsfolk'

/**
 * Supported levels.
 */
export const SupportedLevels = [80, 90] as const;
export type SupportedLevel = typeof SupportedLevels[number];

// TODO: block modifications to this
/**
 * Empty stats object.
 */
export const EMPTY_STATS = new RawStats();

const STANDARD_HEALER = {
    mainStat: 'mind',
    role: 'Healer',
    irrelevantSubstats: ['skillspeed', 'tenacity'],
    traitMulti: level => 1.3,
} as const;

const STANDARD_TANK = {
    mainStat: 'strength',
    role: 'Tank',
    irrelevantSubstats: ['spellspeed', 'piety'],
    traits: [{
        apply(stats) {
            return stats.vitality += 29;
        }
    }] as JobTrait[],
} as const;

const STANDARD_MELEE = {
    mainStat: 'strength',
    role: 'Melee',
    irrelevantSubstats: ['spellspeed', 'tenacity', 'piety'],
} as const;

const STANDARD_RANGED = {
    role: 'Ranged',
    mainStat: 'dexterity',
    irrelevantSubstats: ['spellspeed', 'tenacity', 'piety']
} as const;

const STANDARD_CASTER = {
    role: "Caster",
    mainStat: "intelligence",
    irrelevantSubstats: ['skillspeed', 'tenacity', 'piety'],
} as const;


/**
 * Job-specific data items.
 *
 * TODO: PLD/RDM weirdness
 */
export const JOB_DATA: Record<JobName, JobDataConst> = {
    // Healers
    WHM: STANDARD_HEALER,
    SGE: STANDARD_HEALER,
    SCH: STANDARD_HEALER,
    AST: STANDARD_HEALER,
    // Tanks
    PLD: {
        ...STANDARD_TANK,
        // irrelevantSubstats: ['piety'],
        offhand: true
    },
    WAR: STANDARD_TANK,
    DRK: STANDARD_TANK,
    GNB: STANDARD_TANK,
    // Melee
    DRG: STANDARD_MELEE,
    MNK: STANDARD_MELEE,
    NIN: {
        ...STANDARD_MELEE,
        mainStat: "dexterity"
    },
    SAM: STANDARD_MELEE,
    RPR: STANDARD_MELEE,
    // Ranged
    BRD: STANDARD_RANGED,
    MCH: STANDARD_RANGED,
    DNC: STANDARD_RANGED,
    // Caster
    BLM: STANDARD_CASTER,
    SMN: STANDARD_CASTER,
    RDM: {
        ...STANDARD_CASTER,
        // irrelevantSubstats: ['skillspeed', 'tenacity', 'piety'],
    },
    BLU: STANDARD_CASTER,
}


/**
 * Clan/race-specific stats
 *
 * TODO: All of this can be xivapi
 */
export const RACE_STATS: Record<RaceName, RawStats> = {
    // Elezen
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
    }),
    // Miqo
    "Seekers of the Sun": new RawStats({
        strength: 2,
        dexterity: 3,
        intelligence: -1,
        mind: -1,
    }),
    "Keepers of the Moon": new RawStats({
        strength: -1,
        dexterity: 2,
        vitality: -2,
        intelligence: 1,
        mind: 3,
    }),
    // Roe
    "Sea Wolf": new RawStats({
        strength: 2,
        dexterity: -1,
        vitality: 3,
        intelligence: -2,
        mind: 1,
    }),
    Hellsguard: new RawStats({
        strength: 0,
        dexterity: -2,
        vitality: 3,
        intelligence: 0,
        mind: 2,
    }),
    // Hroth
    "The Lost": new RawStats({
        strength: 3,
        dexterity: -3,
        vitality: 3,
        intelligence: -3,
        mind: 3,
    }),
    Helion: new RawStats({
        strength: 3,
        dexterity: -3,
        vitality: 3,
        intelligence: -3,
        mind: 3,
    }),
    // Hyur
    Highlander: new RawStats({
        strength: 3,
        dexterity: 0,
        vitality: 2,
        intelligence: -2,
        mind: 0,
    }),
    Midlander: new RawStats({
        strength: 2,
        dexterity: -1,
        vitality: 0,
        intelligence: 3,
        mind: -1,
    }),
    // Lala
    Plainsfolk: new RawStats({
        strength: -1,
        dexterity: 3,
        vitality: -1,
        intelligence: 2,
        mind: 0,
    }),
    Dunesfolk: new RawStats({
        strength: -1,
        dexterity: 1,
        vitality: -2,
        intelligence: 2,
        mind: 3,
    }),
    // Viera
    Rava: new RawStats({
        strength: 0,
        dexterity: 3,
        vitality: -2,
        intelligence: 1,
        mind: 1,
    }),
    Veena: new RawStats({
        strength: -1,
        dexterity: 0,
        vitality: -1,
        intelligence: 3,
        mind: 2,
    }),
    // Au Ra
    Xaela: new RawStats({
        strength: 3,
        dexterity: 0,
        vitality: 2,
        intelligence: 0,
        mind: -2,
    }),
    Raen: new RawStats({
        strength: -1,
        dexterity: 2,
        vitality: -1,
        intelligence: 0,
        mind: 3,
    }),
}

/**
 * Level-specific stat modifiers
 */
export const LEVEL_STATS: Record<SupportedLevel, LevelStats> = {
    80: {
        level: 80,
        baseMainStat: 340,
        baseSubStat: 380,
        levelDiv: 1300,
        // TODO: this value is a guess
        hp: 2500,
        mainStatPowerMod: {
            Tank: 115,
            other: 165,
        }
    },
    90: {
        level: 90,
        baseMainStat: 390,
        baseSubStat: 400,
        levelDiv: 1900,
        hp: 3000,
        mainStatPowerMod: {
            Tank: 156,
            other: 195,
        }
    }
}

/**
 * Numbers governing the minimum/maximum item levels to request from xivapi, as well as default display settings.
 */
export const LEVEL_ITEMS: Record<SupportedLevel, LevelItemInfo> = {
    80: {
        minILvl: 380,
        maxILvl: 475,
        // TODO check food levels
        minILvlFood: 380,
        maxILvlFood: 475,
        minMateria: 7,
        maxMateria: 8,
        defaultDisplaySettings: {
            minILvl: 450,
            maxILvl: 475,
            minILvlFood: 440,
            maxILvlFood: 475,
        }
    },
    90: {
        minILvl: 570,
        maxILvl: 999,
        // TODO check food levels
        minILvlFood: 570,
        maxILvlFood: 999,
        minMateria: 7,
        maxMateria: 10,
        defaultDisplaySettings: {
            minILvl: 640,
            maxILvl: 999,
            minILvlFood: 640,
            maxILvlFood: 999
        }
    }
}

// Level 70 data
// export const MainstatModifier {
//     tank: {
//         70: number = 105,
//         80: number = 115,
//         90: number = 156
//     }
//     non-tank: {
//         70: number = 125,
//         80: number = 165,
//         90: number = 195
//     }
// }

/**
 * Main stats in current version of the game.
 */
export const MAIN_STATS = ['strength', 'dexterity', 'intelligence', 'mind'] as const;
// TODO: is Tenacity treated like this?
/**
 * Substats that are treated as main stats for stat calc purposes.
 */
export const FAKE_MAIN_STATS = ['vitality', 'determination', 'piety'] as const;
/**
 * Substats that get the substat-specific math treatment.
 */
export const SPECIAL_SUB_STATS = ['crit', 'dhit', 'spellspeed', 'skillspeed', 'tenacity'] as const;
/**
 * All sub-stats
 */
export const ALL_SUB_STATS = [...FAKE_MAIN_STATS, ...SPECIAL_SUB_STATS] as const;
// export const ALL_SUB_STATS: ((typeof FAKE_MAIN_STATS[number]) | (typeof SPECIAL_SUB_STATS[number]))[] = [...FAKE_MAIN_STATS, ...SPECIAL_SUB_STATS] as const;
/**
 * All stats
 */
export const ALL_STATS = [...MAIN_STATS, ...ALL_SUB_STATS] as const;

// TODO: make everything use this
let statDisplayTmp: RawStatKey[] = ['vitality', ...MAIN_STATS, 'crit', 'dhit', 'determination', 'spellspeed', 'skillspeed', 'piety', 'tenacity'];
ALL_STATS.forEach(stat => {
    if (!statDisplayTmp.includes(stat)) {
        statDisplayTmp.push(stat);
    }
});

export const STAT_DISPLAY_ORDER: RawStatKey[] = [...statDisplayTmp];

/**
 * Which substats can be granted by materia.
 *
 * If SE ever gives us main stat or vitality materia again, this will need to be updated.
 */
export const MateriaSubstats: (Exclude<typeof ALL_SUB_STATS[number], 'vitality'>)[] = ['crit', 'dhit', 'determination', 'spellspeed', 'skillspeed', 'piety', 'tenacity'];
export type MateriaSubstat = typeof MateriaSubstats[number];

/**
 * Full display names for every stat
 */
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

/**
 * Abbreviations for every stat
 */
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

/**
 * Convert from a BaseParam ID to the actual stat.
 *
 * @param id The ID
 * @returns The stat key
 */
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
