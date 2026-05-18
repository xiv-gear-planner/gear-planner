/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    CURRENT_MAX_LEVEL,
    JOB_DATA,
    JobName,
    SupportedLevel,
    SupportedLevels,
    TYPICAL_MIN_LEVEL
} from "@xivgear/xivmath/xivconstants";
import {SimSpec} from "@xivgear/core/sims/sim_types";
import {SimResult, SimSettings, Simulation} from "./sim_types";

const simSpecs: SimSpec<any, any>[] = [];

/**
 * Register a sim into the library
 *
 * @param simSpec The sim spec to register
 */
export function registerSim(simSpec: SimSpec<any, any>) {
    simSpecs.push(simSpec);
}

/**
 * Get all registered sim specs
 */
export function getRegisteredSimSpecs() {
    return [...simSpecs];
}

/**
 * Given a sim stub (see {@link SimSpec.stub}), return the actual sim spec.
 *
 * @param stub The sim spec stub
 */
export function getSimSpecByStub(stub: string): AnySimSpec | undefined {
    return simSpecs.find(simSpec => simSpec.stub === stub);
}

export type AnySimSpec = SimSpec<Simulation<SimResult, SimSettings, unknown>, unknown>;

/**
 * Get the default simulations for a new sheet for the given job and level.
 *
 * @param job The job
 * @param level The character level
 */
export function getDefaultSims(job: JobName, level: SupportedLevel): AnySimSpec[] {
    if (simSpecs.length === 0) {
        // TODO: just have a flag for whether it registered or not
        console.warn('No simulations are registered - possible race condition');
    }
    let defaultSims = [...simSpecs.filter(spec => {
        if (spec.supportedJobs !== undefined && !spec.supportedJobs.includes(job)) {
            return false;
        }
        if (!effectiveSupportedLevels(spec).includes(level)) {
            return false;
        }
        return spec.isDefaultSim ?? false;
    })];

    if (defaultSims.length > 1) {
        defaultSims = defaultSims.filter(spec => spec.stub !== 'pr-sim');
    }

    return defaultSims;
}

export function effectiveSupportedLevels(spec: AnySimSpec): SupportedLevel[] {
    // Use explicit values first
    if (spec.supportedLevels) {
        return spec.supportedLevels;
    }
    // If the sim defines supported jobs, use those jobs. If it supports multiple,
    if (spec.supportedJobs && spec.supportedJobs.length > 0) {
        const minLevel = Math.min(...spec.supportedJobs.map(job => JOB_DATA[job].minLevel));
        const maxLevel = Math.max(...spec.supportedJobs.map(job => JOB_DATA[job].maxLevel));
        return SupportedLevels.filter(lvl => lvl >= minLevel && lvl <= maxLevel);
    }
    // Otherwise, fall back to defaults
    return SupportedLevels.filter(lvl => lvl >= TYPICAL_MIN_LEVEL && lvl <= CURRENT_MAX_LEVEL);
}

