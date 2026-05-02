import {DataSelect, FieldBoundDataSelect} from "./util";
import {CURRENT_MAX_LEVEL, JOB_DATA, JobName, SupportedLevel, SupportedLevels} from "@xivgear/xivmath/xivconstants";
import {PropertyOfType} from "@xivgear/util/util_types";

export function levelLabel(item: SupportedLevel): string {
    if (item <= CURRENT_MAX_LEVEL) {
        return item.toString();
    }
    else {
        return item.toString() + ' (Preview)';
    }
}

export function fieldBoundLevelSelect<ObjType>(obj: ObjType, field: PropertyOfType<ObjType, SupportedLevel>): FieldBoundDataSelect<ObjType, SupportedLevel> {
    return new FieldBoundDataSelect(obj, field, levelLabel, [...SupportedLevels]);
}

export function levelSelect(callback: (level: SupportedLevel) => void, defaultLevel: SupportedLevel = CURRENT_MAX_LEVEL): DataSelect<SupportedLevel> {
    return new DataSelect<SupportedLevel>([...SupportedLevels], levelLabel, callback, defaultLevel);
}

export function jobBasedLevelSelect(callback: (level: SupportedLevel) => void, job: JobName, defaultLevel: SupportedLevel | null = null): DataSelect<SupportedLevel> {
    const levels = levelsForJob(job);
    const actualDefault = defaultLevel ?? levels[levels.length - 1];
    return new DataSelect<SupportedLevel>(levels, levelLabel, callback, actualDefault);
}

// TODO: move outside of UI package
export function levelsForJob(job: JobName | null | undefined): readonly SupportedLevel[] {
    if (!job) {
        // Just assume a normal job if not specified
        job = 'SGE';
    }
    const jobData = JOB_DATA[job];
    return SupportedLevels.filter(level => level >= jobData.minLevel && level <= jobData.maxLevel);
}

// TODO: move outside of UI package
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
