import {EquippedItem} from "./gear";
import {JobName, SupportedLevel} from "./xivconstants";
export interface GearSlot {

}

export const GearSlots: Record<string, GearSlot> = {
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

    name: string;
}

export const EquipSlots: Record<string, EquipSlot> = {
    Weapon: {name: 'Weapon', gearSlot: GearSlots.Weapon},
    Head: {name: 'Head', gearSlot: GearSlots.Head},
    Body: {name: 'Body', gearSlot: GearSlots.Body},
    Hand: {name: 'Hand', gearSlot: GearSlots.Hand},
    Legs: {name: 'Legs', gearSlot: GearSlots.Legs},
    Feet: {name: 'Feet', gearSlot: GearSlots.Feet},
    Ears: {name: 'Ears', gearSlot: GearSlots.Ears},
    Neck: {name: 'Neck', gearSlot: GearSlots.Neck},
    Wrist: {name: 'Wrist', gearSlot: GearSlots.Wrist},
    RingLeft: {name: 'Left Ring', gearSlot: GearSlots.Ring},
    RingRight: {name: 'Right Ring', gearSlot: GearSlots.Ring}
}


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
    gcdPhys: number,
    /**
     * Magical GCD time
     */
    gcdMag: number,
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
    traitMulti: number;
    /**
     * Bonus added to det multiplier for automatic direct hits
     */
    autoDhBonus: number;
}

export interface MeldableMateriaSlot {
    materiaSlot: MateriaSlot;
    equippedMatiera: Materia | null;
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

    constructor(values: ({[K in RawStatKey]?: number} | undefined) = undefined) {
        if (values) {
            Object.assign(this, values);
        }
    }

}

export interface LevelStats {
    baseMainStat: number,
    baseSubStat: number,
    levelDiv: number,
    hp: number
}

export const REAL_MAIN_STATS = ['strength', 'dexterity', 'intelligence', 'mind'] as (keyof RawStats)[];
// TODO: Tenacity?
export const FAKE_MAIN_STATS: (keyof RawStats)[] = ['determination', 'piety', 'vitality']
export const SPECIAL_SUB_STATS: (keyof RawStats)[] = ['dexterity', 'crit', 'dhit', 'spellspeed', 'skillspeed', 'tenacity']

export const ROLES = ['Healer', 'Melee', 'Ranged', 'Caster', 'Tank'] as const;

export type RoleKey = typeof ROLES[number];

export type Mainstat = typeof REAL_MAIN_STATS[number];

// TODO: add a way of specifying which substats are relevant to the class
export interface JobData {
    jobStatMulipliers: RawStats,
    role: RoleKey,
    mainStat: Mainstat;
    traitMulti?: (level: number) => number;
    traits?: JobTrait[];
}

export interface JobTrait {
    minLevel?: number,
    maxLevel?: number,
    apply: (stats: ComputedSetStats) => void;
};

export class GearSlotItem {
    slot: EquipSlot;
    item: GearItem;
    slotName: string;
}

export class EquipmentSet {
    Weapon: EquippedItem | null;
    Head: EquippedItem | null;
    Body: EquippedItem | null;
    Hand: EquippedItem | null;
    Legs: EquippedItem | null;
    Feet: EquippedItem | null;
    Neck: EquippedItem | null;
    Wrist: EquippedItem | null;
    RingLeft: EquippedItem | null;
    RingRight: EquippedItem | null;
}

export interface MateriaSlot {
    maxGrade: number,
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
    job: JobName,
    level: SupportedLevel,
    sets: SetExport[],
    sims: SimExport[]
}

export type EquipSlotKeys = keyof EquipmentSet;

export interface SetExport {
    name: string,
    items: {
        [K in EquipSlotKeys]?: ItemSlotExport
    };
    food?: number
}

export interface ItemSlotExport {
    id: number,
    materia: ({ id: number } | undefined)[]
}

