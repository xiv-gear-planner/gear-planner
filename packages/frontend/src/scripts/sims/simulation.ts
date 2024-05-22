import {JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {potRatioSimSpec} from "./common/potency_ratio";
import {SimSpec} from "@xivgear/core/sims/sim_types";

let simSpecs: SimSpec<any, any>[] = [];

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
    return [potRatioSimSpec, ...simSpecs.filter(spec => {
        if (spec.supportedJobs !== undefined && !spec.supportedJobs.includes(job)) {
            return false;
        }
        if (spec.supportedLevels !== undefined && !spec.supportedLevels.includes(level)) {
            return false;
        }
        return spec.isDefaultSim ?? false;
    })];
}

/**
 * Basic implementation of {@link Simulation.makeResultDisplay} for sims which do not actually
 * have any settings.
 */
export function noSimSettings() {
    const outerDiv = document.createElement("div");
    const header = document.createElement("h1");
    header.textContent = "No Settings for This Simulation";
    outerDiv.replaceChildren(header);
    return outerDiv;
}


