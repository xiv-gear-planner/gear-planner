import {JobStats, LevelStats, RawStats} from "./geartypes";

export const MATERIA_SLOTS_MAX = 5;
export const MATERIA_LEVEL_MIN_RELEVANT = 7;
export const MATERIA_LEVEL_MAX_NORMAL = 10;
export const MATERIA_LEVEL_MAX_OVERMELD = 9;
export const LEVEL_MAX = 90;

export type JobName = 'WHM' | 'SGE';

export type RaceName = 'Duskwight' | 'Wildwood'

export type SupportedLevels = 80 | 90;

export const EMPTY_STATS = new RawStats();

export const BASE_STATS = new RawStats({
    strength: 20,
    intelligence: 20,
    mind: 20,
    dexterity: 20,
    vitality: 20,
})

const JOB_STATS: Record<JobName, JobStats> = {
    'WHM': {
        mainStat: 'mind',
        stats: new RawStats({
            hp: 105,
            vitality: 100,
            strength: 55,
            dexterity: 105,
            intelligence: 105,
            mind: 115
        })
    },
    'SGE': {
        mainStat: 'mind',
        stats: new RawStats({
            hp: 105,
            vitality: 100,
            strength: 60,
            dexterity: 100,
            intelligence: 115,
            mind: 115
        })
    },
}

const RACE_STATS: Record<RaceName, RawStats> = {
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

const LEVEL_STATS: Record<SupportedLevels, LevelStats> = {
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


export function sksToGcd(sks: number): number {
    return 2.6
}

export function spsToGcd(baseGcd: number, levelStats: LevelStats, sps: number): number {
    return Math.round((100) * ((baseGcd * 1000 * (1000 - Math.round(130 * (sps - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000) / 1000)) / 100;
}

export function critChance(levelStats: LevelStats, crit: number) {
    return Math.floor(200 * (crit - levelStats.baseSubStat) / levelStats.levelDiv + 50) / 1000.0;
}

export function critDmg(levelStats: LevelStats, crit: number) {
    // return 1 + Math.floor(200 * (crit - levelStats.baseSubStat) / levelStats.levelDiv + 400) / 1000;
    return (1400 + Math.floor(200 * (crit - levelStats.baseSubStat) / levelStats.levelDiv)) / 1000.0;
}

export function dhitChance(levelStats: LevelStats, dhit: number) {
    // return 1 + Math.floor((550 * dhit - levelStats.baseSubStat) / levelStats.levelDiv) / 1000;
    return Math.floor(550 * (dhit - levelStats.baseSubStat) / levelStats.levelDiv) / 1000.0;
}

export function dhitDmg(levelStats: LevelStats, dhit: number) {
    return 1.25;
}

export function detDmg(levelStats: LevelStats, det: number) {
    return (1000 + Math.floor(140 * (det - levelStats.baseMainStat) / levelStats.levelDiv)) / 1000.0;
}

export function getLevelStats(level: SupportedLevels) {
    if (level) {
        return LEVEL_STATS[level];
    }
    else {
        console.error("Invalid level!");
        return LEVEL_STATS[90];
    }
}

export function getJobStats(job: JobName) {
    return JOB_STATS[job];
}

export function getRaceStats(race: RaceName | undefined) {
    if (race) {
        return RACE_STATS[race];
    }
    else {
        return EMPTY_STATS;
    }
}
