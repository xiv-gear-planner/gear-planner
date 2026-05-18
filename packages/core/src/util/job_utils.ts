import {JOB_DATA, JobName, SupportedLevel, SupportedLevels} from "@xivgear/xivmath/xivconstants";

export function levelsForJob(job: JobName | null | undefined): readonly SupportedLevel[] {
    if (!job) {
        // Just assume a normal job if not specified
        job = 'SGE';
    }
    const jobData = JOB_DATA[job];
    return SupportedLevels.filter(level => level >= jobData.minLevel && level <= jobData.maxLevel);
}

/**
 * Given a job and optionally an already-selected level, provide an appropriate level to pre-select.
 *
 * @param job
 * @param currentLevel
 */
export function clampJobLevel(job: JobName | null | undefined, currentLevel: SupportedLevel | null) {
    // If no job, assume it's a non-limited job
    if (!job) {
        job = 'SGE';
    }
    const jobData = JOB_DATA[job];
    if (currentLevel === null || currentLevel > jobData.maxLevel) {
        return jobData.maxLevel;
    }
    if (currentLevel < jobData.minLevel) {
        return jobData.minLevel;
    }
    return currentLevel;
}
