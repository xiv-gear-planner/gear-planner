import {EquippedItem, RelicStats} from "./gear";
import {
    FAKE_MAIN_STATS,
    JobName,
    MAIN_STATS,
    MateriaSubstat,
    RaceName,
    SPECIAL_SUB_STATS,
    SupportedLevel
} from "./xivconstants";
import {RelicStatModel} from "./relicstats/relicstats";

export interface DisplayGearSlot {

}

// Slots that we display. 2H and 1H weapons are both just considered 'weapons'.
// In addition, a body piece that takes up the head slot as well (or all the left-hand slots) will still just be
// a body.
export const DisplayGearSlots = ['Weapon', 'OffHand', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'Ring'] as const;
export type DisplayGearSlotKey = typeof DisplayGearSlots[number];
// Slots that an item actually occupies. 2H and 1H weapons are distinct here.
// TODO: this stuff *could* be XIVAPI-ified later, which would especially be useful if SE adds more gear that blocks out
// other slots. It seems to return a '1' for the primary slot, and a '-1' for blocked slots.
export const OccGearSlots = ['Weapon2H', 'Weapon1H', 'OffHand', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'Ring'] as const;
export type OccGearSlotKey = typeof OccGearSlots[number];

// For future use, in the event that these actually require properties
export const DisplayGearSlotInfo: Record<DisplayGearSlotKey, DisplayGearSlot> = {
    Weapon: {},
    OffHand: {},
    Head: {},
    Body: {},
    Hand: {},
    Legs: {},
    Feet: {},
    Ears: {},
    Neck: {},
    Wrist: {},
    Ring: {}
} as const;

export interface EquipSlot {
    get gearSlot(): DisplayGearSlot;

    slot: keyof EquipmentSet;

    name: string;
}

export const EquipSlots = ['Weapon', 'OffHand', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight'] as const;

export type EquipSlotKey = typeof EquipSlots[number];

export const EquipSlotInfo: Record<EquipSlotKey, EquipSlot> = {
    Weapon: {
        slot: 'Weapon',
        name: 'Weapon',
        gearSlot: DisplayGearSlotInfo.Weapon
    },
    OffHand: {
        slot: 'OffHand',
        name: 'Off-Hand',
        gearSlot: DisplayGearSlotInfo.OffHand
    },
    Head: {
        slot: 'Head',
        name: 'Head',
        gearSlot: DisplayGearSlotInfo.Head
    },
    Body: {
        slot: 'Body',
        name: 'Body',
        gearSlot: DisplayGearSlotInfo.Body
    },
    Hand: {
        slot: 'Hand',
        name: 'Hand',
        gearSlot: DisplayGearSlotInfo.Hand
    },
    Legs: {
        slot: 'Legs',
        name: 'Legs',
        gearSlot: DisplayGearSlotInfo.Legs
    },
    Feet: {
        slot: 'Feet',
        name: 'Feet',
        gearSlot: DisplayGearSlotInfo.Feet
    },
    Ears: {
        slot: 'Ears',
        name: 'Ears',
        gearSlot: DisplayGearSlotInfo.Ears
    },
    Neck: {
        slot: 'Neck',
        name: 'Neck',
        gearSlot: DisplayGearSlotInfo.Neck
    },
    Wrist: {
        slot: 'Wrist',
        name: 'Wrist',
        gearSlot: DisplayGearSlotInfo.Wrist
    },
    RingLeft: {
        slot: 'RingLeft',
        name: 'Left Ring',
        gearSlot: DisplayGearSlotInfo.Ring
    },
    RingRight: {
        slot: 'RingRight',
        name: 'Right Ring',
        gearSlot: DisplayGearSlotInfo.Ring
    }
} as const;

type KeyOfType<T, V> = keyof {
    [K in keyof T as T[K] extends V ? K : never]: any
};


export interface XivItem {
    /**
     * Item name
     */
    name: string;
    /**
     * Item ID
     */
    id: number;
    /**
     * Item icon URL
     */
    iconUrl: URL;
}

export interface XivCombatItem extends XivItem {
    /**
     * The effective stats
     */
    stats: RawStats;
}

export interface GearItem extends XivCombatItem {
    /**
     * Which gear slot to populate in the UI
     */
    displayGearSlot: DisplayGearSlot;
    /**
     * Which gear slot to populate in the UI
     */
    displayGearSlotName: DisplayGearSlotKey;
    /**
     * Which gear slot the item occupies - different from the above, as 2H and 1H weapons are treated differently here
     */
    occGearSlotName: OccGearSlotKey;
    /**
     * ilvl
     */
    ilvl: number;
    /**
     * The primary substat
     */
    primarySubstat: keyof RawStats | null;
    /**
     * The secondary substat
     */
    secondarySubstat: keyof RawStats | null;
    statCaps: {
        [K in RawStatKey]?: number
    };
    /**
     * Materia slots on the item. When downsynced, this is replaced with an empty list.
     */
    materiaSlots: MateriaSlot[];
    /**
     * Whether this is a custom relic with editable stats
     */
    isCustomRelic: boolean;
    /**
     * If this item is synced down, keep the unsynced version here.
     */
    unsyncedVersion: GearItem;
    isSyncedDown: boolean;
    isUnique: boolean;
    acquisitionType: GearAcquisitionSource;
    relicStatModel: RelicStatModel | undefined;
}

export interface StatBonus {
    percentage: number,
    max: number,
}

export interface FoodItem extends XivItem {
    ilvl: number,
    bonuses: {
        [K in RawStatKey]?: StatBonus
    },
    primarySubStat: RawStatKey | undefined,
    secondarySubStat: RawStatKey | undefined
}

export interface Materia extends XivCombatItem {
    /**
     * The stat given by the materia
     */
    primaryStat: RawStatKey,
    /**
     * The value of the stat given by the materia
     */
    primaryStatValue: number,
    /**
     * The tier of the materia (e.g. materia IX = 9)
     */
    materiaGrade: number,
    /**
     * If the materia cannot be overmelded into all of the slots,
     * i.e. true for 6/8/10, false for 5/7/9 etc.
     */
    isHighGrade: boolean
}

export interface ComputedSetStats extends RawStats {
    /**
     * Current level
     */
    level: number,
    /**
     * Current level stats modifier
     */
    levelStats: LevelStats,
    /**
     * Current class/job
     */
    job: JobName,
    /**
     * Job modifier data
     */
    jobStats: JobData,

    /**
     * Physical GCD time
     */
    gcdPhys(baseGcd: number, haste?: number): number,

    /**
     * Magical GCD time
     */
    gcdMag(baseGcd: number, haste?: number): number,

    /**
     * Crit chance. Ranges from 0 to 1.
     */
    critChance: number,
    /**
     * Crit multiplier. 1.0 would be the base, e.g. +50% would be 1.5.
     */
    critMulti: number,
    /**
     * Direct hit chance. Ranges from 0 to 1.
     */
    dhitChance: number,
    /**
     * Direct hit multiplier. Fixed at 1.25.
     */
    dhitMulti: number,
    /**
     * Multiplier from determination stat.
     */
    detMulti: number,
    /**
     * Spell Speed DoT multiplier.
     */
    spsDotMulti: number,
    /**
     * Skill Speed DoT multiplier.
     */
    sksDotMulti: number,
    /**
     * Tenacity Multiplier
     */
    tncMulti: number,
    /**
     * Multiplier from weapon damage.
     */
    wdMulti: number,
    /**
     * Multiplier from main stat.
     */
    mainStatMulti: number
    /**
     * Like mainStatMulti, but for auto-attacks (since healers and casters use STR for autos but MND/INT for everything
     * else).
     */
    aaStatMulti: number

    /**
     * Trait multiplier
     */
    traitMulti(attackType: AttackType): number;

    /**
     * Bonus added to det multiplier for automatic direct hits
     */
    autoDhBonus: number;
    /**
     * MP Per Tick
     */
    mpPerTick: number;
    /**
     * Like wdMulti, but for auto-attacks
     */
    aaMulti: number;
}

export interface MeldableMateriaSlot {
    materiaSlot: MateriaSlot;
    equippedMateria: Materia | null;
}

export interface RawStats {
    hp: number,
    vitality: number,
    strength: number,
    dexterity: number,
    intelligence: number,
    mind: number,
    piety: number,
    crit: number,
    dhit: number,
    determination: number,
    tenacity: number,
    spellspeed: number,
    skillspeed: number,
    wdPhys: number,
    wdMag: number,
    weaponDelay: number
}

export type RawStatKey = keyof RawStats;

/**
 * Stats that should not have ilvl caps applied
 */
export const NO_SYNC_STATS: RawStatKey[] = ['weaponDelay'];

export class RawStats implements RawStats {
    hp: number = 0;
    vitality: number = 0;
    strength: number = 0;
    dexterity: number = 0;
    intelligence: number = 0;
    mind: number = 0;
    piety: number = 0;
    crit: number = 0;
    dhit: number = 0;
    determination: number = 0;
    tenacity: number = 0;
    skillspeed: number = 0;
    spellspeed: number = 0;
    wdPhys: number = 0;
    wdMag: number = 0;
    weaponDelay: number = 0;

    constructor(values: ({ [K in RawStatKey]?: number } | undefined) = undefined) {
        if (values) {
            Object.assign(this, values);
        }
    }

}

export interface LevelStats {
    level: number,
    baseMainStat: number,
    baseSubStat: number,
    levelDiv: number,
    hp: number,
    hpScalar:
        ({
            'other': number
        } & { [K in RoleKey]?: number })
        | { [K in RoleKey]: number },
    // You can specify either 'default' and a non-exhaustive list, or an exhaustive list (i.e. every role).
    mainStatPowerMod:
        ({
            'other': number
        } & { [K in RoleKey]?: number })
        | { [K in RoleKey]: number },
}


export interface LevelItemInfo {
    minILvl: number,
    maxILvl: number,
    defaultIlvlSync?: number,
    minILvlFood: number,
    maxILvlFood: number,
    minMateria: number,
    maxMateria: number,
    defaultDisplaySettings: ItemDisplaySettings
}


export const ROLES = ['Healer', 'Melee', 'Ranged', 'Caster', 'Tank'] as const;

export type RoleKey = typeof ROLES[number];

export type Mainstat = typeof MAIN_STATS[number];
export type Substat = (typeof FAKE_MAIN_STATS[number] | typeof SPECIAL_SUB_STATS[number]);

export interface JobDataConst {
    readonly role: RoleKey,
    readonly mainStat: Mainstat;
    readonly autoAttackStat: Mainstat;
    readonly traitMulti?: (level: number, attackType: AttackType) => number;
    readonly traits?: readonly JobTrait[];
    readonly irrelevantSubstats?: readonly Substat[];
    readonly offhand?: boolean;
    readonly itemStatCapMultipliers?: {
        [K in RawStatKey]?: number
    };
    readonly aaPotency: number
}

export type JobMultipliers = {
    [K in typeof MAIN_STATS[number]]: number
} & {
    hp: number
}

export interface JobData extends JobDataConst {
    jobStatMultipliers: JobMultipliers,
}

export interface JobTrait {
    minLevel?: number,
    maxLevel?: number,
    apply: (stats: ComputedSetStats) => void;
}

export class GearSlotItem {
    slot: EquipSlot;
    item: GearItem;
    slotId: keyof EquipmentSet;
}

export class EquipmentSet {
    Weapon: EquippedItem | null;
    OffHand: EquippedItem | null;
    Head: EquippedItem | null;
    Body: EquippedItem | null;
    Hand: EquippedItem | null;
    Legs: EquippedItem | null;
    Feet: EquippedItem | null;
    Ears: EquippedItem | null;
    Neck: EquippedItem | null;
    Wrist: EquippedItem | null;
    RingLeft: EquippedItem | null;
    RingRight: EquippedItem | null;
}

export interface MateriaSlot {
    maxGrade: number,
    allowsHighGrade: boolean
}


export interface SimExport {
    stub: string,
    settings: Object,
    name?: string
}

/**
 * Represents an exported set. Many of the fields fill the same role as the fields
 * on {@link GearPlanSheet}.
 *
 * Some of the fields are only relevant for local saves, while others are only relevant
 * for external (API) saves.
 */
export interface SheetExport {
    /**
     * Name of the sheet.
     */
    name: string,
    /**
     * Description of the gear set. May be multi-line.
     */
    description?: string,
    /**
     * Local only: the key used to save the sheet in localStorage
     */
    saveKey?: string,
    /**
     * The character clan (e.g. Wildwood or Duskwight) of the sheet.
     */
    race: RaceName,
    /**
     * Party bonus percentage (0-5)
     */
    partyBonus: PartyBonusAmount,
    /**
     * The job abbreviation for the sheet.
     */
    job: JobName,
    /**
     * The level of the sheet (90, 80, etc)
     */
    level: SupportedLevel,
    /**
     * The gear sets on the sheet.
     */
    sets: SetExport[],
    /**
     * The simulations on this sheet.
     */
    sims: SimExport[],
    /**
     * Settings regarding which items to display
     */
    itemDisplaySettings?: ItemDisplaySettings,
    // Keeping these abbreviated so exports don't become unnecessarily large
    /**
     * Whether to auto-fill materia into newly selected items (Materia Fill New Items).
     */
    mfni?: boolean,
    /**
     * The materia auto-fill priority
     */
    mfp?: MateriaSubstat[],
    /**
     * The target GCD for materia auto-fill
     */
    mfMinGcd?: number,
    /**
     * If ilvl sync is enabled, this represents what level the sheet should be synced to
     */
    ilvlSync?: number,
}

// TODO: split into internal and external version?
/**
 * Represents an exported set. Note that in addition to some fields only being applicable to internal vs external
 * usage, some fields may be present based on whether this set was exported as a standalone individual set, or as
 * part of a full sheet.
 *
 * If it is an individual sheet export, then several of the properties that would normally live at the sheet level
 * will instead be here (such as job and level).
 */
export interface SetExport {
    /**
     * Name of the gear set.
     */
    name: string,
    /**
     * Description of the gear set. May be multi-line.
     */
    description?: string,
    /**
     * Equipped items (and their materia and/or relic stats)
     */
    items: {
        [K in EquipSlotKey]?: ItemSlotExport
    };
    /**
     * Equipped food (by item ID)
     */
    food?: number,
    // We don't care about job/level for internal usage, since
    // those are properties of the sheet. It's strictly to
    // prevent/warn on importing the wrong job, as well as for
    // importing individual sets.
    /**
     * Only for standalone use - the job of this set. Same as {@link SheetExport#job}.
     */
    job?: JobName,
    /**
     * Only for standalone use - the character level of the set. Same as {@link SheetExport#level}.
     */
    level?: SupportedLevel,
    /**
     * Only for standalone use - the ilvl sync of the set (if enabled). Same as {@link SheetExport#level}.
     */
    ilvlSync?: number,
    /**
     * Only for standalone use - the simulations to include with the set. Same as {@link SheetExport#sims}.
     */
    sims?: SimExport[],
    /**
     * When a relic is de-selected, its former stats are remembered here so that they can be recalled if the
     * relic is selected again. They keys are item IDs, and the values are {@link RelicStats}.
     */
    relicStatMemory?: {
        [p: number]: RelicStats
    };
}

// noinspection JSUnusedGlobalSymbols
/**
 * Represents an item that can be saved/retrieved from the API.
 *
 * This can be a full sheet containing multiple sheets, or an individual set.
 * See the docs for each item for more details.
 */
export type TopLevelExport = SheetExport | SetExport;

/**
 * Represents an item.
 */
export interface ItemSlotExport {
    /**
     * Item ID
     */
    id: number,
    /**
     * Materia equipped in the slot
     */
    materia: ({
        /**
         * The item ID of this materia. -1 indicates no materia equipped in this slot.
         */
        id: number
    } | undefined)[],
    /**
     * If this is a relic, represents the current stats of the relic.
     */
    relicStats?: {
        [K in Substat]?: number
    }
}

export type PartyBonusAmount = 0 | 1 | 2 | 3 | 4 | 5;


export interface MateriaAutoFillController {
    readonly prio: MateriaAutoFillPrio;
    autoFillNewItem: boolean;

    callback(): void;

    fillEmpty(): void;

    fillAll(): void;
}

export interface MateriaAutoFillPrio {
    statPrio: (MateriaSubstat)[];
    minGcd: number;
}

export interface ItemDisplaySettings {
    minILvl: number,
    maxILvl: number,
    minILvlFood: number,
    maxILvlFood: number,
    higherRelics: boolean
}

export const AttackTypes = ['Unknown', 'Auto-attack', 'Spell', 'Weaponskill', 'Ability', 'Item'] as const;
export type AttackType = typeof AttackTypes[number];


export interface GeneralStat {
    stat: number,
}

export interface MultiplierStat extends GeneralStat {
    multiplier: number
}

export interface ChanceStat extends GeneralStat {
    chance: number,
    multiplier: number
}

export interface GcdStat extends GeneralStat {
    gcd: number,
    multiplier: number
}

export interface TickStat extends GeneralStat {
    perTick: number
}

export type GearAcquisitionSource =
    'raid'
    | 'tome' | 'augtome'
    | 'crafted' | 'augcrafted'
    | 'relic'
    | 'dungeon'
    | 'normraid'
    | 'extrial'
    | 'ultimate'
    | 'artifact'
    | 'alliance'
    | 'other';