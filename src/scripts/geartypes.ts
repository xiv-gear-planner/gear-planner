import {EquippedItem} from "./gear";
import {
    FAKE_MAIN_STATS,
    JobName,
    MateriaSubstat,
    RaceName,
    MAIN_STATS,
    SPECIAL_SUB_STATS,
    SupportedLevel
} from "./xivconstants";

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
    Weapon: {slot: 'Weapon', name: 'Weapon', gearSlot: DisplayGearSlotInfo.Weapon},
    OffHand: {slot: 'OffHand', name: 'Off-Hand', gearSlot: DisplayGearSlotInfo.OffHand},
    Head: {slot: 'Head', name: 'Head', gearSlot: DisplayGearSlotInfo.Head},
    Body: {slot: 'Body', name: 'Body', gearSlot: DisplayGearSlotInfo.Body},
    Hand: {slot: 'Hand', name: 'Hand', gearSlot: DisplayGearSlotInfo.Hand},
    Legs: {slot: 'Legs', name: 'Legs', gearSlot: DisplayGearSlotInfo.Legs},
    Feet: {slot: 'Feet', name: 'Feet', gearSlot: DisplayGearSlotInfo.Feet},
    Ears: {slot: 'Ears', name: 'Ears', gearSlot: DisplayGearSlotInfo.Ears},
    Neck: {slot: 'Neck', name: 'Neck', gearSlot: DisplayGearSlotInfo.Neck},
    Wrist: {slot: 'Wrist', name: 'Wrist', gearSlot: DisplayGearSlotInfo.Wrist},
    RingLeft: {slot: 'RingLeft', name: 'Left Ring', gearSlot: DisplayGearSlotInfo.Ring},
    RingRight: {slot: 'RingRight', name: 'Right Ring', gearSlot: DisplayGearSlotInfo.Ring}
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
    // You can specify either 'default' and a non-exhaustive list, or an exhaustive list (i.e. every role).
    mainStatPowerMod:
        ({ 'other': number } & { [K in RoleKey]?: number })
        | { [K in RoleKey]: number }
}


export interface LevelItemInfo {
    minILvl: number,
    maxILvl: number,
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

export interface SheetExport {
    name: string,
    saveKey?: string,
    race: RaceName,
    partyBonus: PartyBonusAmount,
    job: JobName,
    level: SupportedLevel,
    sets: SetExport[],
    sims: SimExport[],
    itemDisplaySettings?: ItemDisplaySettings,
    // Keeping these abbreviated so exports don't become unnecessarily large
    // Materia fill new items
    mfni?: boolean,
    // Materia fill priority
    mfp?: MateriaSubstat[],
    mfMinGcd?: number,
    ilvlSync?: number,
    description?: string,
}

// TODO: split into internal and external version?
export interface SetExport {
    name: string,
    items: {
        [K in EquipSlotKey]?: ItemSlotExport
    };
    food?: number,
    // We don't care about job/level for internal usage, since
    // those are properties of the sheet. It's strictly to
    // prevent/warn on importing the wrong job, as well as for
    // importing individual sets.
    job?: JobName,
    level?: SupportedLevel,
    ilvlSync?: number,
    description?: string,
    sims?: SimExport[],
}

export interface ItemSlotExport {
    id: number,
    materia: ({ id: number } | undefined)[],
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
