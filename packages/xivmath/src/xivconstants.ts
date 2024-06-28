import {
    GearAcquisitionSource,
    ItemDisplaySettings,
    JobDataConst,
    LevelItemInfo,
    LevelStats,
    PartyBonusAmount,
    RawStatKey,
    RawStats
} from "./geartypes";

/**
 * Maximum number of materia slots on any item.
 */
export const MATERIA_SLOTS_MAX = 5;
/**
 * Minimum level of materia that we would ever consider relevant.
 */
export const MATERIA_LEVEL_MIN_RELEVANT = 5;
/**
 * Max supported materia level.
 */
export const MATERIA_LEVEL_MAX_NORMAL = 10;
/**
 * Max supported materia level for overmeld slots.
 */
export const MATERIA_LEVEL_MAX_OVERMELD = 9;

/**
 * The unmodified GCD time of a typical GCD skill
 */
export const NORMAL_GCD = 2.5;
/**
 * Highest standard GCD
 */
export const MAX_GCD = NORMAL_GCD;

/**
 * Highest ilvl for the foreseeable future
 */
export const MAX_ILVL = 999;

/**
 * How many stat points by which a materia is allowed to overcap before it is
 * considered an overcap. e.g. if we have a +36 materia, and we only have 34 points
 * until the cap, consider that okay.
 */
export const MATERIA_ACCEPTABLE_OVERCAP_LOSS = 2;

export const STANDARD_ANIMATION_LOCK = 0.6;

export const CAST_SNAPSHOT_PRE = 0.5;
export const CASTER_TAX = 0.1;

export const STANDARD_APPLICATION_DELAY = 0.6;
// TODO: find actual value
export const AUTOATTACK_APPLICATION_DELAY = 0.6;

/**
 * Supported Jobs.
 */
export type JobName
    = 'WHM' | 'SGE' | 'SCH' | 'AST'
    | 'PLD' | 'WAR' | 'DRK' | 'GNB'
    | 'DRG' | 'MNK' | 'NIN' | 'SAM' | 'RPR' | 'VPR'
    | 'BRD' | 'MCH' | 'DNC'
    | 'BLM' | 'SMN' | 'RDM' | 'BLU' | 'PCT';

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
export const SupportedLevels = [70, 80, 90, 100] as const;
export const CURRENT_MAX_LEVEL: SupportedLevel = 100;
export type SupportedLevel = typeof SupportedLevels[number];


// TODO: block modifications to this
/**
 * Empty stats object.
 */
export const EMPTY_STATS = new RawStats();

/**
 * Melee (including healer/caster, and DNC for some reason) auto-attack potency
 */
export const MELEE_AUTO_POTENCY = 90;
/**
 * BRD/MCH auto-attack potency
 */
export const RANGE_AUTO_POTENCY = 80;

const STANDARD_HEALER: JobDataConst = {
    role: 'Healer',
    mainStat: 'mind',
    autoAttackStat: 'strength',
    irrelevantSubstats: ['skillspeed', 'tenacity'],
    traitMulti: (level, attackType) => attackType === 'Auto-attack' ? 1.0 : 1.3, // Maim and Mend II
    itemStatCapMultipliers: {
        'vitality': 0.90
    },
    aaPotency: MELEE_AUTO_POTENCY,
    excludedRelicSubstats: ['dhit'],
} as const;

const STANDARD_TANK: JobDataConst = {
    role: 'Tank',
    mainStat: 'strength',
    autoAttackStat: 'strength',
    irrelevantSubstats: ['spellspeed', 'piety'],
    // traitMulti: TODO: Tank Mastery?
    aaPotency: MELEE_AUTO_POTENCY,
    excludedRelicSubstats: ['dhit'],
} as const;

const STANDARD_MELEE: JobDataConst = {
    role: 'Melee',
    mainStat: 'strength',
    autoAttackStat: 'strength',
    irrelevantSubstats: ['spellspeed', 'tenacity', 'piety'],
    aaPotency: MELEE_AUTO_POTENCY,
    excludedRelicSubstats: [],
} as const;

const STANDARD_RANGED: JobDataConst = {
    role: 'Ranged',
    mainStat: 'dexterity',
    autoAttackStat: 'dexterity',
    irrelevantSubstats: ['spellspeed', 'tenacity', 'piety'],
    traitMulti: (level, attackType) => attackType === 'Auto-attack' ? 1.0 : 1.2, // Increased Action Damage II
    aaPotency: RANGE_AUTO_POTENCY,
    excludedRelicSubstats: [],
} as const;

const STANDARD_CASTER: JobDataConst = {
    role: 'Caster',
    mainStat: 'intelligence',
    autoAttackStat: 'strength',
    irrelevantSubstats: ['skillspeed', 'tenacity', 'piety'],
    traitMulti: (level, attackType) => attackType === 'Auto-attack' ? 1.0 : 1.3, // Maim and Mend II
    itemStatCapMultipliers: {
        'vitality': 0.90
    },
    aaPotency: MELEE_AUTO_POTENCY,
    excludedRelicSubstats: [],
} as const;


/**
 * Job-specific data items.
 *
 * TODO: PLD/RDM weirdness
 */
export const JOB_DATA: Record<JobName, JobDataConst> = {
    // Healers
    WHM: {
        ...STANDARD_HEALER,
        gcdDisplayOverrides() {
            return [{
                shortLabel: 'GCD',
                longLabel: '2.5s GCD',
                description: 'Standard 2.5s GCD recast time',
                gcdTime: 2.5,
                attackType: 'Spell',
                haste: 0,
                basis: 'sps',
            }, {
                shortLabel: 'PoM GCD',
                longLabel: '2.5s GCD with PoM',
                description: '2.5s GCD recast time under Presence of Mind',
                gcdTime: 2.5,
                attackType: 'Spell',
                haste: 20,
                basis: 'sps',
            }]
        }
    },
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
    MNK: {
        ...STANDARD_MELEE,
        traits: [{
            apply: stats => {
                const oldHaste = stats.haste;
                stats.haste = attackType => oldHaste(attackType)
                    + ((attackType === 'Weaponskill'
                        || attackType === 'Spell'
                        || attackType === 'Auto-attack')
                        ? 20 : 0);
            }
        }]
    },
    NIN: {
        ...STANDARD_MELEE,
        mainStat: "dexterity",
        traits: [{
            apply: stats => {
                const oldHaste = stats.haste;
                stats.haste = attackType => oldHaste(attackType)
                    + ((attackType === 'Weaponskill' || attackType === 'Auto-attack') ? 15 : 0);
            }
        }
        ]
    },
    SAM: STANDARD_MELEE,
    RPR: STANDARD_MELEE,
    VPR: {
        ...STANDARD_MELEE,
        mainStat: 'dexterity'
    },
    // Ranged
    BRD: STANDARD_RANGED,
    MCH: STANDARD_RANGED,
    DNC: {
        ...STANDARD_RANGED,
        aaPotency: MELEE_AUTO_POTENCY
    },
    // Caster
    BLM: STANDARD_CASTER,
    SMN: STANDARD_CASTER,
    RDM: {
        ...STANDARD_CASTER,
        // irrelevantSubstats: ['skillspeed', 'tenacity', 'piety'],
    },
    BLU: {
        ...STANDARD_CASTER,
        traitMulti: (level, attackType) => attackType === 'Auto-attack' ? 1.0 : 1.5, // Maim and Mend V
    },
    PCT: STANDARD_CASTER
};


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
};

/**
 * Level-specific stat modifiers
 */
export const LEVEL_STATS: Record<SupportedLevel, LevelStats> = {
    70: {
        level: 70,
        baseMainStat: 292,
        baseSubStat: 364,
        levelDiv: 900,
        hp: 1700,
        hpScalar: {
            Tank: 18.8,
            other: 14,
        },
        mainStatPowerMod: {
            Tank: 105,
            other: 125,
        },
    },
    80: {
        level: 80,
        baseMainStat: 340,
        baseSubStat: 380,
        levelDiv: 1300,
        hp: 2000,
        hpScalar: {
            Tank: 26.6,
            other: 18.8,
        },
        mainStatPowerMod: {
            Tank: 115,
            other: 165,
        },
    },
    90: {
        level: 90,
        baseMainStat: 390,
        baseSubStat: 400,
        levelDiv: 1900,
        hp: 3000,
        hpScalar: {
            Tank: 34.6,
            other: 24.3,
        },
        mainStatPowerMod: {
            Tank: 156,
            other: 195,
        }
    },
    // DAWNTRAIL TODO: replace with real values once known
    100: {
        level: 100,
        // Tentative guess
        baseMainStat: 440,
        // Updated
        baseSubStat: 420,
        // Updated
        levelDiv: 2780,
        // Verified
        hp: 4000,
        hpScalar: {
            Tank: 43,
            other: 30.1,
        },
        mainStatPowerMod: {
            // Verified per Mahdi
            Tank: 190,
            // Tentative guess
            other: 225,
        }
    }
};

/**
 * Numbers governing the minimum/maximum item levels to request from xivapi, as well as default display settings.
 */
export const LEVEL_ITEMS: Record<SupportedLevel, LevelItemInfo> = {
    70: {
        minILvl: 290,
        maxILvl: 999,
        defaultIlvlSync: 405,
        minILvlFood: 250,
        // No reason to cap food - it isn't level-bound.
        // You can use 90 food at 70.
        maxILvlFood: 999,
        minMateria: 5,
        maxMateria: 6,
        defaultDisplaySettings: {
            minILvl: 380,
            maxILvl: 405,
            minILvlFood: 640,
            maxILvlFood: 999,
            higherRelics: true
        }
    },
    80: {
        minILvl: 430,
        maxILvl: 999,
        defaultIlvlSync: 535,
        minILvlFood: 380,
        maxILvlFood: 999,
        minMateria: 7,
        maxMateria: 8,
        defaultDisplaySettings: {
            // Defaults appropriate for TEA since it is the most common reason to be making
            // a level 80 gear set.
            // There is a BLU-specific override since BLU's only level 80 weapons are 530,
            // see below.
            minILvl: 450,
            maxILvl: 475,
            minILvlFood: 640,
            maxILvlFood: 999,
            higherRelics: true
        }
    },
    // DAWNTRAIL TODO: cap off level 90 items
    90: {
        // Would expect 570, but it has those 560 scaling artifacts
        minILvl: 560,
        maxILvl: 999,
        minILvlFood: 570,
        maxILvlFood: 999,
        minMateria: 7,
        maxMateria: 10,
        defaultDisplaySettings: {
            minILvl: 640,
            maxILvl: 999,
            minILvlFood: 640,
            maxILvlFood: 999,
            higherRelics: true
        }
    },
    // DAWNTRAIL TODO: replace with real values once known
    100: {
        minILvl: 640,
        maxILvl: 999,
        minILvlFood: 570,
        maxILvlFood: 999,
        minMateria: 9,
        maxMateria: 12,
        defaultDisplaySettings: {
            minILvl: 700,
            maxILvl: 999,
            minILvlFood: 640,
            maxILvlFood: 999,
            higherRelics: true
        }
    }
};

const BLU_80_ITEM_DISPLAY = {
    ...LEVEL_ITEMS[80].defaultDisplaySettings,
    minILvl: 520,
    maxILvl: 535
} satisfies ItemDisplaySettings;

export function getDefaultDisplaySettings(level: SupportedLevel, job: JobName): ItemDisplaySettings {
    if (job === 'BLU' && level === 80) {
        return BLU_80_ITEM_DISPLAY;
    }
    return LEVEL_ITEMS[level].defaultDisplaySettings;
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
export const MAIN_STATS = ['strength', 'dexterity', 'intelligence', 'mind', 'vitality'] as const;
// TODO: It's hacky to declare hp like this, but oh well.
/**
 * Substats that are treated as main stats for stat calc purposes.
 */
export const FAKE_MAIN_STATS = ['determination', 'piety'] as const;
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
const statDisplayTmp: RawStatKey[] = ['vitality', ...MAIN_STATS, 'crit', 'dhit', 'determination', 'spellspeed', 'skillspeed', 'piety', 'tenacity'];
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
/**
 * Like MateriaSubstats, but in the order that makes the most sense for auto-fill.
 *
 * SkS/SpS are first because they realistically need to be in order for GCD-targeted auto-fill to work.
 */
export const DefaultMateriaFillPrio: (Exclude<typeof ALL_SUB_STATS[number], 'vitality'>)[] = ['spellspeed', 'skillspeed', 'crit', 'dhit', 'determination', 'piety', 'tenacity'];
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
    wdPhys: "Weapon Damage (Physical)",
    weaponDelay: "Auto-Attack Delay"
};

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
    wdPhys: "WDp",
    weaponDelay: "Dly"
};

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

export const ARTIFACT_ITEM_LEVELS = [
    290,
    430,
    560,
];

export const BASIC_TOME_GEAR_ILVLS = [
    310,
    440,
    570,
    700
];

export const RAID_TIER_ILVLS = [
    340, 370, 400,
    470, 500, 530,
    600, 630, 660,
    730, 760, 790
] as const as readonly number[];

export function formatAcquisitionSource(source: GearAcquisitionSource): string | null {
    switch (source) {
        case "augtome":
            return "Aug. Tome";
        case "augcrafted":
            return "Aug. Crafted";
        case "normraid":
            return "Normal Raid";
        case "extrial":
            return "Extreme Trial";
        case "alliance":
            return "Alliance Raid";
        case "other":
            return null;
    }
    return source[0].toUpperCase() + source.substring(1);
}

/**
 * BLU intelligence stat to weapon damage modifier lookup table in [INT, WD] format
 */
const BLU_INT_WD = [
    [0, 12], [9, 13], [10, 14], [11, 15], [12, 16], [13, 18], [14, 20], [16, 21],
    [17, 22], [18, 23], [19, 24], [20, 26], [21, 27], [23, 28], [24, 29], [26, 30],
    [29, 31], [30, 32], [32, 33], [34, 34], [36, 35], [38, 36], [40, 37], [44, 38],
    [46, 39], [49, 40], [52, 41], [54, 42], [58, 43], [61, 44], [62, 46], [65, 47],
    [66, 48], [67, 49], [70, 50], [72, 51], [73, 52], [74, 53], [77, 54], [78, 55],
    [79, 56], [81, 57], [94, 58], [140, 59], [160, 60], [180, 61], [230, 62],
    [250, 63], [280, 64], [320, 65], [350, 66], [360, 67], [380, 68], [400, 69],
    [420, 70], [440, 71], [460, 72], [480, 73], [500, 74], [510, 75], [530, 76],
    [550, 77], [570, 78], [590, 79], [620, 80], [650, 81], [680, 82], [710, 83],
    [740, 84], [750, 85], [770, 86], [790, 87], [810, 88], [830, 89], [860, 90],
    [880, 91], [900, 92], [930, 93], [960, 94], [990, 95], [1030, 96], [1060, 97],
    [1080, 98], [1110, 99], [1140, 100], [1170, 101], [1200, 102], [1230, 103],
    [1260, 104], [1290, 105],
    // TODO: the following are predicted values for lvl90 BLU, will need to be verified
    [1340, 106], [1360, 107], [1390, 111], [1510, 113], [1590, 115], [1680, 117],
    [1780, 119], [1880, 121], [1980, 123], [2090, 125], [2200, 127], [2320, 129],
    [2410, 131]
] as const as readonly (readonly number[])[];

/**
 * Lookup a BLU weapon damage modifier value for a given intelligence stat value.
 *
 * @param gearIntStat Intelligence stat from gear only (excludes all modifiers).
 * @returns BLU weapon damage modifier.
 */
export function bluWdfromInt(gearIntStat: number): number {
    for (let i = 0; i < BLU_INT_WD.length; i++) {
        if (gearIntStat < BLU_INT_WD[i][0]) {
            return BLU_INT_WD[Math.max(0, i - 1)][1];
        }
    }
    return BLU_INT_WD[BLU_INT_WD.length - 1][1];
}

export const defaultItemDisplaySettings: ItemDisplaySettings = {
    minILvl: 640,
    maxILvl: 999,
    minILvlFood: 610,
    maxILvlFood: 999,
    higherRelics: true
} as const;

export const MAX_PARTY_BONUS: PartyBonusAmount = 5;
