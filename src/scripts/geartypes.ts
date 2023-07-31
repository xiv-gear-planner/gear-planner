import {ComputedSetStats} from "./gear";

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

export type GearStatKey = keyof RawStats;


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

    constructor(values: ({[K in GearStatKey]?: number} | undefined) = undefined) {
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