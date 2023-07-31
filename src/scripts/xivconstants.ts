import {JobData, LevelStats, RawStats} from "./geartypes";

export const MATERIA_SLOTS_MAX = 5;
export const MATERIA_LEVEL_MIN_RELEVANT = 7;
export const MATERIA_LEVEL_MAX_NORMAL = 10;
export const MATERIA_LEVEL_MAX_OVERMELD = 9;
export const LEVEL_MAX : SupportedLevel = 90;

export type JobName = 'WHM' | 'SGE';

export type RaceName = 'Duskwight' | 'Wildwood'

export const SupportedLevels = [80, 90] as const;
export type SupportedLevel = typeof SupportedLevels[number];

export const EMPTY_STATS = new RawStats();


export const JOB_DATA: Record<JobName, JobData> = {
    'WHM': {
        mainStat: 'mind',
        role: 'Healer',
        jobStatMulipliers: new RawStats({
            hp: 105,
            vitality: 100,
            strength: 55,
            dexterity: 105,
            intelligence: 105,
            mind: 115
        }),
        traitMulti: level => 1.3,
        // traits: [
        //     (stats) => stats.traitMulti
        // ]
    },
    'SGE': {
        mainStat: 'mind',
        role: 'Healer',
        jobStatMulipliers: new RawStats({
            hp: 105,
            vitality: 100,
            strength: 60,
            dexterity: 100,
            intelligence: 115,
            mind: 115
        }),
        traitMulti: level => 1.3,
    },
}

export const RACE_STATS: Record<RaceName, RawStats> = {
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

export const LEVEL_STATS: Record<SupportedLevel, LevelStats> = {
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

export function getLevelStats(level: SupportedLevel) {
    if (level) {
        return LEVEL_STATS[level];
    }
    else {
        console.error("Invalid level!");
        return LEVEL_STATS[90];
    }
}

export function getJobStats(job: JobName) {
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
