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

export interface GearSlot {

}

export const GearSlots = ['Weapon', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'Ring'] as const;
export type GearSlotKey = typeof GearSlots[number];

// For future use, in the event that these actually require properties
export const GearSlotInfo: Record<GearSlotKey, GearSlot> = {
    Weapon: {},
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
    get gearSlot(): GearSlot;

    slot: keyof EquipmentSet;

    name: string;
}

export const EquipSlots = ['Weapon', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight'] as const;

export type EquipSlotKey = typeof EquipSlots[number];

export const EquipSlotInfo: Record<EquipSlotKey, EquipSlot> = {
    Weapon: {slot: 'Weapon', name: 'Weapon', gearSlot: GearSlotInfo.Weapon},
    Head: {slot: 'Head', name: 'Head', gearSlot: GearSlotInfo.Head},
    Body: {slot: 'Body', name: 'Body', gearSlot: GearSlotInfo.Body},
    Hand: {slot: 'Hand', name: 'Hand', gearSlot: GearSlotInfo.Hand},
    Legs: {slot: 'Legs', name: 'Legs', gearSlot: GearSlotInfo.Legs},
    Feet: {slot: 'Feet', name: 'Feet', gearSlot: GearSlotInfo.Feet},
    Ears: {slot: 'Ears', name: 'Ears', gearSlot: GearSlotInfo.Ears},
    Neck: {slot: 'Neck', name: 'Neck', gearSlot: GearSlotInfo.Neck},
    Wrist: {slot: 'Wrist', name: 'Wrist', gearSlot: GearSlotInfo.Wrist},
    RingLeft: {slot: 'RingLeft', name: 'Left Ring', gearSlot: GearSlotInfo.Ring},
    RingRight: {slot: 'RingRight', name: 'Right Ring', gearSlot: GearSlotInfo.Ring}
} as const;

type KeyOfType<T, V> = keyof {
    [K in keyof T as T[K] extends V ? K : never]: any
};


export interface XivItem {
    name: string;
    id: number;
    iconUrl: URL;
}

export interface XivCombatItem extends XivItem {
    stats: RawStats;
}

export interface GearItem extends XivCombatItem {
    gearSlot: GearSlot;
    ilvl: number;
    primarySubstat: keyof RawStats | null;
    secondarySubstat: keyof RawStats | null;
    substatCap: number;
    materiaSlots: MateriaSlot[];
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
    gcdPhys(baseGcd: number): number,

    /**
     * Magical GCD time
     */
    gcdMag(baseGcd: number): number,

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
     * TODO not implemented yet
     */
    sksDotMulti: number,
    /**
     * Multiplier from weapon damage.
     */
    wdMulti: number,
    /**
     * Multiplier from main stat.
     */
    mainStatMulti: number
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

// TODO: add a way of specifying which substats are relevant to the class
export interface JobData {
    jobStatMulipliers: RawStats,
    role: RoleKey,
    mainStat: Mainstat;
    traitMulti?: (level: number, attackType: AttackType) => number;
    traits?: JobTrait[];
    irrelevantSubstats?: Substat[];
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

// Ignoring MP and doh/dol stats
export type XivApiStat =
    'Vitality'
    | 'Strength'
    | 'Dexterity'
    | 'Intelligence'
    | 'Mind'
    | 'HP'
    | 'Piety'
    | 'CriticalHit'
    | 'DirectHitRate'
    | 'Determination'
    | 'Tenacity'
    | 'SpellSpeed'
    | 'SkillSpeed';


export const xivApiStatToRawStatKey: Record<XivApiStat, RawStatKey> = {
    Vitality: "vitality",
    Strength: "strength",
    Dexterity: "dexterity",
    Intelligence: "intelligence",
    Mind: "mind",
    HP: "hp",
    Piety: "piety",
    CriticalHit: "crit",
    DirectHitRate: "dhit",
    Determination: "determination",
    Tenacity: "tenacity",
    SkillSpeed: "skillspeed",
    SpellSpeed: "spellspeed"
}

export interface SimExport {
    stub: string,
    settings: Object,
    name?: string
}

export interface SheetExport {
    name: string,
    saveKey: string,
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
    mfp?: MateriaSubstat[]
}

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
    level?: SupportedLevel
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
    statPrio: (MateriaSubstat)[];
    autoFillNewItem: boolean;

    callback(): void;

    fillEmpty(): void;

    fillAll(): void;
}

export interface ItemDisplaySettings {
    minILvl: number,
    maxILvl: number,
    minILvlFood: number,
    maxILvlFood: number,
}

export const AttackTypes = ['Unknown', 'Auto-attack', 'Spell', 'Weaponskill', 'Ability', 'Item'] as const;
export type AttackType = typeof AttackTypes[number];