import {
    FAKE_MAIN_STATS,
    JobName,
    MAIN_STATS,
    MateriaSubstat,
    RaceName,
    SPECIAL_SUB_STATS,
    SupportedLevel
} from "./xivconstants";

import {RawBonusStats, StatModification, StatPreModifications} from "./xivstats";
import {TranslatableString} from "@xivgear/i18n/translation";
import {SpecialStatType} from "@xivgear/data-api-client/dataapi";

export interface DisplayGearSlotInfo {

}

// Slots that we display. 2H and 1H weapons are both just considered 'weapons'.
// In addition, a body piece that takes up the head slot as well (or all the left-hand slots) will still just be
// a body.
export const DisplayGearSlots = ['Weapon', 'OffHand', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'Ring'] as const;
export type DisplayGearSlotKey = typeof DisplayGearSlots[number];
// Slots that an item actually occupies. 2H and 1H weapons are distinct here.
// TODO: since we have implemented EquipSlotMap, this can be used in significantly fewer places.
// In fact, it is already technically wrong for things like Vermilion Cloak, which is equipped to body+head, but it
// isn't a huge practical concern because it only used in Eureka, where its ilvl of 300 does not get synced down.
// "Normal" slots
export const NormalOccGearSlots = [
    'Weapon2H', 'Weapon1H', 'OffHand', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'Ring',
] as const;
export type NormalOccGearSlotKey = typeof NormalOccGearSlots[number];
// Unusual slots - not displayed as much in the UI
export const SpecialOccGearSlots = [
    'ChestHead', 'ChestHeadLegsFeet', 'ChestLegsFeet', 'ChestLegsGloves', 'HeadChestHandsLegsFeet', 'LegsFeet',
] as const;
// All slots
export const OccGearSlots = [...NormalOccGearSlots, ...SpecialOccGearSlots] as const;
export type OccGearSlotKey = typeof OccGearSlots[number];

// For future use, in the event that these actually require properties
export const DisplayGearSlotMapping: Record<DisplayGearSlotKey, DisplayGearSlotInfo> = {
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
    Ring: {},
} as const;

export interface EquipSlot {
    get gearSlot(): DisplayGearSlotKey;

    slot: keyof EquipmentSet;

    name: string;
}

export const EquipSlots = ['Weapon', 'OffHand', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight'] as const;

export type EquipSlotKey = typeof EquipSlots[number];

export const EquipSlotInfo: Record<EquipSlotKey, EquipSlot> = {
    Weapon: {
        slot: 'Weapon',
        name: 'Weapon',
        gearSlot: 'Weapon',
    },
    OffHand: {
        slot: 'OffHand',
        name: 'Off-Hand',
        gearSlot: 'OffHand',
    },
    Head: {
        slot: 'Head',
        name: 'Head',
        gearSlot: 'Head',
    },
    Body: {
        slot: 'Body',
        name: 'Body',
        gearSlot: 'Body',
    },
    Hand: {
        slot: 'Hand',
        name: 'Hand',
        gearSlot: 'Hand',
    },
    Legs: {
        slot: 'Legs',
        name: 'Legs',
        gearSlot: 'Legs',
    },
    Feet: {
        slot: 'Feet',
        name: 'Feet',
        gearSlot: 'Feet',
    },
    Ears: {
        slot: 'Ears',
        name: 'Ears',
        gearSlot: 'Ears',
    },
    Neck: {
        slot: 'Neck',
        name: 'Neck',
        gearSlot: 'Neck',
    },
    Wrist: {
        slot: 'Wrist',
        name: 'Wrist',
        gearSlot: 'Wrist',
    },
    RingLeft: {
        slot: 'RingLeft',
        name: 'Left Ring',
        gearSlot: 'Ring',
    },
    RingRight: {
        slot: 'RingRight',
        name: 'Right Ring',
        gearSlot: 'Ring',
    },
} as const;

// type KeyOfType<T, V> = keyof {
//     [K in keyof T as T[K] extends V ? K : never]: any
// };

/**
 * The relationship between an item and a slot has three states:
 * 1. The item cannot be equipped in the slot, e.g. cannot equip a head item in the leg slot.
 * 2. The item can be equipped in the slot, e.g. a ring can be equipped to left right or right ring slot.
 * 3. The item cannot be equipped in the slot, but if equipped into its correct slot, will block this slot.
 * e.g. Vermilion Cloak.
 *
 * */
export type EquipSlotValue = 'none' | 'equip' | 'block';

/**
 * The relationship between an item and all slots.
 */
export type EquipSlotMap = {
    [K in EquipSlotKey]: EquipSlotValue;
} & {
    /**
     * Whether the item can be equipped to the slot. Usually this is only true for a single slot, but rings can
     * be equipped to both left and right ring slots.
     * @param slot
     */
    canEquipTo(slot: EquipSlotKey): boolean;
    /**
     * Get the list of slots which will be blocked from equipping items if this item is equipped.
     * e.g. Vermilion Cloak blocks the head slot despite being equipped to body slot.
     */
    getBlockedSlots(): EquipSlotKey[];
}


export interface XivItem {
    /**
     * Item name
     */
    name: string;
    /**
     * Item name, including translations
     */
    readonly nameTranslation: TranslatableString;
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
    displayGearSlot: DisplayGearSlotInfo;
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
     * equip level
     */
    equipLvl: number;
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
    syncedDownTo: number | null;
    isUnique: boolean;
    acquisitionType: GearAcquisitionSource;
    relicStatModel: RelicStatModel | undefined;
    isNqVersion: boolean;
    rarity: number;

    usableByJob(job: JobName): boolean;

    activeSpecialStat: SpecialStatType | null;

    readonly slotMapping: EquipSlotMap;
}

export interface FoodStatBonus {
    percentage: number,
    max: number,
}

export type FoodBonuses = {
    [K in RawStatKey]?: FoodStatBonus
}

export interface FoodItem extends XivItem {
    ilvl: number,
    bonuses: FoodBonuses,
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
    isHighGrade: boolean,
    /**
     * Materia can only be equipped to gear where the gear's ilvl >= the materia' ilvl.
     */
    ilvl: number
}

export interface ComputedSetStats extends RawStats {
    /**
     * Current level
     */
    readonly level: SupportedLevel,
    /**
     * Current level stats modifier
     */
    readonly levelStats: LevelStats,
    /**
     * Current class/job
     */
    readonly job: JobName,
    /**
     * Job modifier data
     */
    readonly jobStats: JobData,

    /**
     * Physical GCD time
     */
    gcdPhys(baseGcd: number, haste?: number): number,

    /**
     * Magical GCD time
     */
    gcdMag(baseGcd: number, haste?: number): number,

    /**
     * Combined haste value for a given attack type
     */
    haste(attackType: AttackType, buffHaste: number): number;

    /**
     * Compute the effective auto-attack delay. Assumes the attack has the type 'Auto-attack'.
     *
     * @param buffHaste The amount of haste from buffs.
     */
    effectiveAaDelay(buffHaste: number): number;

    /**
     * Crit chance. Ranges from 0 to 1.
     */
    readonly critChance: number,
    /**
     * Crit multiplier. 1.0 would be the base, e.g. +50% would be 1.5.
     */
    readonly critMulti: number,
    /**
     * Direct hit chance. Ranges from 0 to 1.
     */
    readonly dhitChance: number,
    /**
     * Direct hit multiplier. Fixed at 1.25.
     */
    readonly dhitMulti: number,
    /**
     * Multiplier from determination stat.
     */
    readonly detMulti: number,
    /**
     * Spell Speed DoT multiplier.
     */
    readonly spsDotMulti: number,
    /**
     * Skill Speed DoT multiplier.
     */
    readonly sksDotMulti: number,
    /**
     * Tenacity Multiplier
     */
    readonly tncMulti: number,
    /**
     * Tenacity incoming multiplier. e.g. 0.95 => 5% damage reduction.
     */
    readonly tncIncomingMulti: number,
    /**
     * Multiplier from weapon damage.
     */
    readonly wdMulti: number,
    /**
     * Pet action WD multiplier. Uses a slightly lower job modifier.
     */
    readonly wdMultiPetAction: number,
    /**
     * Multiplier from main stat.
     */
    readonly mainStatMulti: number
    /**
     * Like mainStatMulti, but for auto-attacks (since healers and casters use STR for autos but MND/INT for everything
     * else).
     */
    readonly aaStatMulti: number
    /**
     * Stats coming from the gear pre-party bonus. Important for some abilities' alternate
     * scalings (e.g. Living Shadow).
     */
    readonly gearStats: RawStats
    /**
     * Base main stat, multiplied by the job stat multiplier, plus racial bonus. For example, the main stat (e.g. 440 at level 100) multiplied by the
     * jobStatMultiplier (e.g. 1.05 at level 100) plus the racial stat (e.g. +3 for The Lost's strength). This is useful for being able to unwind
     * it later for abilities with different scaling, e.g. Living Shadow.
     */
    readonly baseMainStatPlusRace: number

    /**
     * Trait multiplier
     */
    traitMulti(attackType: AttackType): number;

    /**
     * Bonus added to det multiplier for automatic direct hits
     */
    readonly autoDhBonus: number;
    /**
     * Bonus added to crit multi by crit chance buffs when auto-critting.
     */
    readonly autoCritBuffMulti: number;
    /**
     * Bonus added to DH multi by DH chance buffs when auto-DHing.
     */
    readonly autoDhitBuffMulti: number;
    /**
     * MP Per Tick
     */
    readonly mpPerTick: number;
    /**
     * Like wdMulti, but for auto-attacks
     */
    readonly aaMulti: number;
    /**
     * Auto-attack delay
     */
    readonly aaDelay: number;

    /**
     * The damage taken ratio based on the defense stat. e.g. 0.95 would mean 5% damage reduction.
     */
    readonly defenseDamageTaken: number;

    /**
     * The damage taken ratio based on the magic defense stat. e.g. 0.95 would mean 5% damage reduction.
     */
    readonly magicDefenseDamageTaken: number;

    readonly effectiveFoodBonuses: RawStats;

    withModifications(modifications: StatModification, pre?: StatPreModifications): ComputedSetStats;
}

export interface MeldableMateriaSlot {
    materiaSlot: MateriaSlot;
    equippedMateria: Materia | null;
    locked: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
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
    weaponDelay: number,
    defenseMag: number;
    defensePhys: number;
    gearHaste: number;
}

export type RawStatKey = keyof RawStats;

/**
 * Stats that should not have ilvl caps applied
 */
export const NO_SYNC_STATS: RawStatKey[] = ['weaponDelay'];

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
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
    defenseMag: number = 0;
    defensePhys: number = 0;
    gearHaste: number = 0;

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
    mainStatPowerMod: {
        'other': number
    } & { [K in RoleKey]?: number }
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

/**
 * JobDataConst represents the subset of job-related data which we do not pull from Xivapi.
 * These are mostly manually curated.
 */
export interface JobDataConst {
    /**
     * The role of the job
     */
    readonly role: RoleKey,
    /**
     * The primary stat
     */
    readonly mainStat: Mainstat;
    /**
     * The primary stat as used for auto-attack calculations specifically
     */
    readonly autoAttackStat: Mainstat;
    /**
     * Optional function to apply a damage multiplication trait.
     */
    readonly traitMulti?: (level: number, attackType: AttackType) => number;
    /**
     * Optional list of stat-modifying traits
     */
    readonly traits?: readonly JobTrait[];
    /**
     * Substats which are completely irrelevant to this class, e.g. TNC on non-tanks
     */
    readonly irrelevantSubstats?: readonly Substat[];
    /**
     * True if this class uses 1H+Offhand rather than 2H weapons
     */
    readonly offhand?: boolean;
    // /**
    //  * Stat cap multipliers. e.g. Healers have a 10% VIT penalty, so it would be {'Vitality': 0.90}
    //  */
    // readonly itemStatCapMultipliers?: {
    //     [K in RawStatKey]?: number
    // };
    /**
     * Which BaseParam.MeldParam index to use for calculating stat caps.
     * Makes hardcoded itemStatCapMultipliers obsolete.
     * Since these only have numeric indices with no indication of which is which, it is derived from looking at gear
     * pieces of the same ilvl and comparing their stats across different jobs. However, there are many rows which are
     * identical for
     */
    readonly meldParamIndex: number;
    /**
     * Auto-attack potency amount
     */
    readonly aaPotency: number;
    /**
     * Substats which are NOT already in {@link irrelevantSubstats}, but which cannot be put onto custom relics.
     *
     * e.g. Healers and Tanks cannot put DHit on their custom relics.
     */
    readonly excludedRelicSubstats: readonly Substat[]

    /**
     * Override the GCD columns to display in the main gear table.
     *
     * You can specify multiple columns.
     *
     * Can return null to keep the defaults.
     */
    gcdDisplayOverrides?: (level: SupportedLevel) => (GcdDisplayOverride[]) | null;

    /**
     * The maximum level of the job.
     */
    readonly maxLevel: SupportedLevel;
}

export type GcdDisplayOverride = {
    /**
     * Very short label (e.g. 'GCD', 'PoM GCD', '3.5 GCD'
     */
    shortLabel: string,
    /**
     * Slightly longer label (e.g. '2.5s GCD', '2.5s GCD with PoM')
     */
    longLabel: string,
    /**
     * Longer description (e.g. '2.5 second GCD under Presence of Mind')
     */
    description: string,
    /**
     * The base GCD time to use for this calculation, typically 2.5
     */
    gcdTime: number,
    /**
     * The attack type to use for haste calculations (e.g. for NIN).
     */
    attackType: AttackType,
    /**
     * Additional buff haste to use for this calculation (e.g. for PoM)
     */
    buffHaste?: number,
    /**
     * Whether this calc uses SpS or SkS formula
     */
    basis: 'sks' | 'sps',
    /**
     * Whether this is the "Primary" GCD that should be used for things that
     * depend on a single GCD number, like materia auto-fill.
     *
     * You should not have multiple primaries, with one exception. You can have
     * a primary where basis === 'sks' and a primary where basis === 'sps'.
     */
    isPrimary?: boolean
}

export type JobMultipliers = {
    [K in typeof MAIN_STATS[number]]: number
} & {
    hp: number
}

/**
 * JobData is the combination of {@link JobDataConst} and other data pulled from Xivapi.
 */
export interface JobData extends JobDataConst {
    jobStatMultipliers: JobMultipliers,
}

export interface JobTrait {
    minLevel?: number,
    maxLevel?: number,
    apply: TraitFunc,
}

export type TraitFunc = (stats: RawBonusStats) => void;

export type GearSlotItem = {
    slot: EquipSlot;
    item: GearItem;
    slotId: keyof EquipmentSet;
}

export class EquipmentSet implements Record<EquipSlotKey, EquippedItem | null> {
    Weapon: EquippedItem | null = null;
    OffHand: EquippedItem | null = null;
    Head: EquippedItem | null = null;
    Body: EquippedItem | null = null;
    Hand: EquippedItem | null = null;
    Legs: EquippedItem | null = null;
    Feet: EquippedItem | null = null;
    Ears: EquippedItem | null = null;
    Neck: EquippedItem | null = null;
    Wrist: EquippedItem | null = null;
    RingLeft: EquippedItem | null = null;
    RingRight: EquippedItem | null = null;
}

export function cloneEquipmentSet(set: EquipmentSet) {
    const out = new EquipmentSet();
    EquipSlots.forEach(slot => {
        const equipped = set[slot];
        if (equipped) {
            out[slot] = equipped.clone();
        }
    });
    return out;
}

export interface MateriaSlot {
    maxGrade: number,
    allowsHighGrade: boolean,
    ilvl: number
}


export interface SimExport {
    stub: string,
    settings: object,
    name?: string
}

// TODO: further split this up. API vs Local should have different types.
/**
 * Represents an exported set. Many of the fields fill the same role as the fields
 * on GearPlanSheet.
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
    race: RaceName | undefined,
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
    // /**
    //  * Whether to auto-fill materia into newly selected items (Materia Fill New Items).
    //  */
    // mfni?: boolean,
    /**
     * What to do with materia slots on newly-selected items
     */
    mfm?: MateriaFillMode,
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
    /**
     * Custom items
     */
    customItems?: CustomItemExport[],
    /**
     * Custom foods
     */
    customFoods?: CustomFoodExport[],

    /**
     * Unix timestamp
     */
    timestamp?: number,

    /**
     * True if this is a multi-job sheet (within a single role)
     */
    isMultiJob?: boolean,

    specialStats?: string | null,
}

export type SheetModificationKey = number;

export type SheetModificationRecord = [version: number, key: SheetModificationKey];

export type LocalSheetMetadata = {
    /**
     * The current numeric version of the sheet. Should be incremented upon modifications.
     */
    currentVersion: number,
    /**
     * The version of the sheet that was last uploaded to the server. Zero if it has never been uploaded.
     */
    lastSyncedVersion: number,
    /**
     * The version of the sheet that the server is confirmed to have. Zero if the server does not have it.
     */
    serverVersion: number,
    /**
     * The sort order of the sheet. Null indicates that the sheet should use the default sort order.
     */
    sortOrder: number | null,
    /**
     * True if the sheet has some kind of sync conflict.
     */
    hasConflict: boolean,
    /**
     * True if the user data sync process should force push to the server.
     */
    forcePush: boolean,
    /**
     * True if the sheet is deleted from the server.
     */
    serverDeleted: boolean,
    /**
     * True if the sheet was deleted locally.
     */
    localDeleted: boolean,

    summary: SheetSummary,

    unsyncedModifications?: SheetModificationRecord[],
}

export type SheetSummary = {
    job: JobName,
    name: string,
    multiJob: boolean,
    level: SupportedLevel,
    isync?: number | undefined,
}

export const DEFAULT_SHEET_METADATA: Readonly<Omit<LocalSheetMetadata, 'summary'>> = {
    currentVersion: 1,
    lastSyncedVersion: 0,
    serverVersion: 0,
    sortOrder: null,
    hasConflict: false,
    forcePush: false,
    serverDeleted: false,
    localDeleted: false,
} as const;

export type CustomItemExport = {
    ilvl: number;
    equipLvl: number;
    largeMateriaSlots: number;
    smallMateriaSlots: number;
    materiaGrade: number;
    name: string;
    fakeId: number;
    slot: NormalOccGearSlotKey;
    isUnique: boolean;
    stats: RawStats;
    respectCaps: boolean;
}

export type CustomFoodExport = {
    ilvl: number;
    name: string;
    fakeId: number;
    vitalityBonus: FoodStatBonus;
    primaryStat: Substat | null;
    primaryStatBonus: FoodStatBonus;
    secondaryStat: Substat | null;
    secondaryStatBonus: FoodStatBonus;
}


export type RelicStatMemoryExport = {
    [p: number]: RelicStats;
};


export type SlotMateriaMemoryExport = [item: number, materiaIds: number[], locked?: boolean[]];

export type MateriaMemoryExport = {
    [slot in EquipSlotKey]?: SlotMateriaMemoryExport[]
};

export interface SheetStatsExport extends SheetExport {
    sets: SetStatsExport[],
}

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
    items: ItemsSlotsExport,
    /**
     * Equipped food (by item ID)
     */
    food?: number,
    /**
     * When a relic is de-selected, its former stats are remembered here so that they can be recalled if the
     * relic is selected again. They keys are item IDs, and the values are {@link RelicStats}.
     */
    relicStatMemory?: RelicStatMemoryExport;
    /**
     * When an item is de-selected, its former materia are remembered so that they can later be automatically
     * re-equipped based on settings. They keys are slot names (so that left/right ring can be differentiated),
     * and the values are lists of tuples of [item ID, [materia 0, materia 1, ... materia n]]
     */
    materiaMemory?: MateriaMemoryExport;
    /**
     * Indicates that this set is a separator rather than an actual set
     */
    isSeparator?: boolean,
    /**
     * For multi-class sheets, each set can have a different job.
     */
    jobOverride?: JobName | null,
}

export type ItemsSlotsExport = {
    [K in EquipSlotKey]?: ItemSlotExport
};

/**
 * Type that represents a single set exported as a top-level sheet.
 */
export interface SetExportExternalSingle extends SetExport {
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
     * Only for standalone use - Custom items
     */
    customItems?: CustomItemExport[],
    /**
     * Only for standalone use - Custom foods
     */
    customFoods?: CustomFoodExport[],
    /**
     * Party bonus percentage (0-5)
     */
    partyBonus?: PartyBonusAmount,
    /**
     * The character clan (e.g. Wildwood or Duskwight) of the sheet.
     */
    race?: RaceName,
    /**
     * Unix timestamp
     */
    timestamp?: number,

    specialStats?: string | null,
}

/**
 * Special version of {@link SetExport} that comes from the /fulldata/ endpoint.
 */
export interface SetStatsExport extends SetExport {
    computedStats: ComputedSetStats
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
        id: number,
        locked?: boolean,
    } | undefined)[],
    /**
     * If this is a relic, represents the current stats of the relic.
     */
    relicStats?: RelicStatsExport,
    /**
     * Force this to be an NQ item instead of HQ if available.
     */
    forceNq?: boolean,
}

export type RelicStatsExport = {
    [K in Substat]?: number
}

export type PartyBonusAmount = 0 | 1 | 2 | 3 | 4 | 5;


/**
 * MateriaAutoFillController is the interface for bulk materia actions and some
 * settings related to them.
 */
export type MateriaAutoFillController = {
    readonly prio: MateriaAutoFillPrio;
    autoFillMode: MateriaFillMode;

    /**
     * callback() should be called after changing settings to ensure they get saved.
     */
    callback(): void;

    /**
     * Fill empty slots according to priority.
     */
    fillEmpty(): void;

    /**
     * Fill all slots according to priority, overwriting existing materia if needed.
     */
    fillAll(): void;

    /**
     * Lock all filled slots.
     */
    lockFilled(): void;

    /**
     * Lock all empty slots.
     */
    lockEmpty(): void;

    /**
     * Unlock all slots.
     */
    unlockAll(): void;

    /**
     * Unequip materia in unlocked slots.
     */
    unequipUnlocked(): void;
}

export interface MateriaAutoFillPrio {
    statPrio: (MateriaSubstat)[];
    minGcd: number;
}

export const MATERIA_FILL_MODES = ['leave_empty', 'autofill', 'retain_slot_else_prio', 'retain_item_else_prio', 'retain_slot', 'retain_item'] as const;
export type MateriaFillMode = typeof MATERIA_FILL_MODES[number];

export interface ItemDisplaySettings {
    /**
     * Min ilvl for gear items
     */
    minILvl: number,
    /**
     * Max ilvl for gear items
     */
    maxILvl: number,
    /**
     * Min ilvl for food items
     */
    minILvlFood: number,
    /**
     * Max ilvl for food items
     */
    maxILvlFood: number,
    /**
     * Show relics which exceed {@link #maxILvl}
     */
    higherRelics: boolean,
    /**
     * Show NQ items in addition to their HQ counterparts
     */
    showNq: boolean,
    /**
     * Show food with only one relevant stat
     */
    showOneStatFood: boolean,
}

export const AttackTypes = ['Unknown', 'Auto-attack', 'Spell', 'Weaponskill', 'Ability', 'Item'] as const;
export type AttackType = typeof AttackTypes[number];


/**
 * Base interface for a stat value
 */
export interface GeneralStat {
    stat: number,
}

/**
 * Stat with an outgoing damage multiplier
 */
export interface MultiplierStat extends GeneralStat {
    multiplier: number
}

/**
 * Stat that provides a
 */
export interface MitigationStat extends GeneralStat {
    incomingMulti: number
}

/**
 * Stat with an RNG-based multiplier (crit/dh)
 */
export interface ChanceStat extends GeneralStat {
    chance: number,
    multiplier: number
}

/**
 * Stat that provides a multiplier and also a mitigation
 */
export interface MultiplierMitStat extends MultiplierStat, MitigationStat {
}

/**
 * Stat that affects GCD times + DoT multiplier (sks/sps)
 */
export interface GcdStat extends GeneralStat, MultiplierStat {
    gcd: number,
}

/**
 * Stat that affects the amount of a resource that a tick provides (piety)
 */
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
    | 'criterion'
    | 'other'
    | 'custom';

export type GearSetIssue = {
    readonly severity: 'warning' | 'error',
    readonly description: string,
    readonly affectedSlots?: EquipSlotKey[]
}

export type GearSetResult = {
    readonly computedStats: ComputedSetStats,
    readonly issues: readonly GearSetIssue[]
}

export type CollapsibleSlot = EquipSlotKey | 'food';

export type SetDisplaySettingsExport = {
    hiddenSlots: CollapsibleSlot[]
}

export type BaseRelicStatModel = {
    /**
     * Validate an item according to this relic model.
     * Returns a list of validation errors. An empty list implies success.
     *
     * @param item The item
     * @param statToReport Specify this to report issues specific to one stat. Messages may be tailored to one stat,
     * and validation issues will only be reported if that particular stat is actually contributing to the problem.
     */
    validate(item: EquippedItem, statToReport?: Substat): GearSetIssue[]
}

/**
 * Relic stat model for Endwalker-style relics, where you have X 'large' stats, and Y 'small' stats.
 */
export type EwRelicStatModel = BaseRelicStatModel & {
    type: 'ewrelic'
    /**
     * The stat value of the 'large' stats (typically the stat cap).
     */
    largeValue: number
    /**
     * The stat value of the 'small' stats.
     */
    smallValue: number
    /**
     * The maximum number of large stats.
     */
    numLarge: number
    /**
     * The maximum number of small stats.
     */
    numSmall: number
}

/**
 * Relic stat model for pre-EW relics, where you get to allocate stats as you wish as
 * long as the total remains below a cap, and no individual stat goes over the normal
 * stat cap.
 */
export type CustomRelicStatModel = BaseRelicStatModel & {
    type: 'customrelic'
    /**
     * The cap for total stats.
     */
    totalCap: number
}

/**
 * Generic model for all unknown relics. The only validation performed is that no individual stat
 * is over the stat cap.
 */
export type UnknownRelicStatModel = BaseRelicStatModel & {
    type: 'unknown'
}

export type PartialRelicStatModel = EwRelicStatModel | CustomRelicStatModel | UnknownRelicStatModel

/**
 * Final type for relic stat models.
 */
export type RelicStatModel = PartialRelicStatModel & {
    excludedStats: readonly Substat[]
}

export type RelicStats = {
    [K in Substat]?: number
}

/**
 * EquippedItem represents an item as it is actually equipped, not just a base item. Thus includes customizations such
 * as equipped materia, materia locking, and custom relic stats.
 */
export class EquippedItem {

    gearItem: GearItem;
    melds: MeldableMateriaSlot[];
    relicStats?: RelicStats;

    constructor(gearItem: GearItem, melds: MeldableMateriaSlot[] | undefined = undefined) {
        this.gearItem = gearItem;
        if (melds === undefined) {
            this.melds = [];
            for (const materiaSlot of gearItem.materiaSlots) {
                this.melds.push({
                    materiaSlot: materiaSlot,
                    equippedMateria: null,
                    locked: false,
                });
            }
        }
        else {
            this.melds = [...melds];
        }
        if (gearItem.isCustomRelic) {
            this.relicStats = {};
        }
    }

    /**
     * Clone creates a deep clone of this EquippedItem.
     */
    clone(): EquippedItem {
        const out = new EquippedItem(
            this.gearItem
        );
        // Deep clone the materia slots
        this.melds.forEach((slot, index) => {
            if (index >= out.melds.length) {
                return;
            }
            out.melds[index].equippedMateria = slot.equippedMateria;
            out.melds[index].locked = slot.locked;
        });
        if (this.relicStats !== undefined && out.relicStats !== undefined) {
            Object.assign(out.relicStats, this.relicStats);
        }
        return out;
    }
}

/**
 * Represents different overrides to values used in calculating damage.
 * This can and should be extended for other things that are specially overriden
 * by abilities in the future.
 */
export type ScalingOverrides = {
    /**
     * Main stat multiplier. Overriden by abilities like Living Shadow and Bunshin.
     */
    mainStatMulti: number,
    /**
     * Weapon damage multiplier. Overriden by pet abilities and abilities with alternate
     * actors, e.g. Earthly Star, Living Shadow, Queen, SMN abilities.
     */
    wdMulti: number,
}

// TODO: look at Int16Array and friends to see if this can be compressed further
// Idea:
/*
MicroSetExport has a single TypedArray, where we store items in a flat structure.
e.g. [slot1slotId, slot1itemId, slot1materiaCount, slot1materia1id, ... slot1materiaNid, slot2slotId, ... etc]
Could even take it a step further and pack multiple sets into one big array.
 */

/**
 * MicroSetExport is a minimal analog to {@link SetExport} which contains the bare minimum information
 * needed for brute force solving. This is useful for reducing memory usage. These are meant to be very dense in
 * terms of memory, so they use hacks like adding 0.5 to item IDs to signify an NQ item.
 */
export type MicroSetExport = MicroSlotExport[];

export type FoodMicroSlotExport = [slot: "food", foodId: number];
// The itemId in this case has 0.5 added to it to indicate an NQ item
export type NormalItemMicroSlotExport = [slot: EquipSlotKey, itemId: number, ...materiaIds: (number | null)[]];
export type RelicItemMicroSlotExport = [slot: EquipSlotKey, itemId: number, "relic", relicStats: RelicStatsExport];
export type MicroSlotExport = FoodMicroSlotExport | NormalItemMicroSlotExport | RelicItemMicroSlotExport;

export type IlvlSyncInfo = {
    readonly ilvl: number;
    substatCap(slot: OccGearSlotKey, statsKey: RawStatKey): number;
}
