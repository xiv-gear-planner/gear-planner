/* eslint-disable @typescript-eslint/no-explicit-any */
import {JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {SimSpec} from "@xivgear/core/sims/sim_types";

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
    return [...simSpecs,];
}

/**
 * Given a sim stub (see {@link SimSpec.stub}), return the actual sim spec.
 *
 * @param stub The sim spec stub
 */
export function getSimSpecByStub(stub: string): SimSpec<any, any> | undefined {
    return simSpecs.find(simSpec => simSpec.stub === stub);
}

/**
 * Get the default simulations for a new sheet for the given job and level.
 *
 * @param job The job
 * @param level The character level
 */
export function getDefaultSims(job: JobName, level: SupportedLevel): SimSpec<any, any>[] {
    let defaultSims = [...simSpecs.filter(spec => {
        if (spec.supportedJobs !== undefined && !spec.supportedJobs.includes(job)) {
            return false;
        }
        if (spec.supportedLevels !== undefined && !spec.supportedLevels.includes(level)) {
            return false;
        }
        return spec.isDefaultSim ?? false;
    }),];

    if (defaultSims.length > 1) {
        defaultSims = defaultSims.filter(spec => spec.stub !== 'pr-sim');
    }

    return defaultSims;
}


