import {
    FAKE_MAIN_STATS,
    JobName,
    MAIN_STATS,
    MateriaSubstat,
    RaceName,
    SPECIAL_SUB_STATS,
    SupportedLevel
} from "./xivconstants";
import {CustomItemExport} from "@xivgear/core/gear";

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

// type KeyOfType<T, V> = keyof {
//     [K in keyof T as T[K] extends V ? K : never]: any
// };


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
     * Base haste value for a given attack type
     */
    haste(attackType: AttackType): number;

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
     * Tenacity incoming multiplier. e.g. 0.95 => 5% damage reduction.
     */
    tncIncomingMulti: number,
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
    /**
     * Auto-attack delay
     */
    aaDelay: number;
}

export interface MeldableMateriaSlot {
    materiaSlot: MateriaSlot;
    equippedMateria: Materia | null;
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
    weaponDelay: number
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
    /**
     * Stat cap multipliers. e.g. Healers have a 10% VIT penalty, so it would be {'Vitality': 0.90}
     */
    readonly itemStatCapMultipliers?: {
        [K in RawStatKey]?: number
    };
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
     * Additional haste to use for this calculation (e.g. for PoM)
     */
    haste?: number,
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
    /**
     * Custom items
     */
    customItems?: CustomItemExport[]
}

export interface SheetStatsExport extends SheetExport {
    sets: SetStatsExport[],
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

export type SetDisplaySettingsExport = {
    hiddenSlots: EquipSlotKey[]
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
                    equippedMateria: null
                })
            }
        }
        else {
            this.melds = [...melds];
        }
        if (gearItem.isCustomRelic) {
            this.relicStats = {};
        }
    }
}

