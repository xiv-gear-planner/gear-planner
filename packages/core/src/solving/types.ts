import {GearsetGenerationRequest, JobContext} from "../workers/worker_types";
import {MicroSetExport} from "@xivgear/xivmath/geartypes";

export type GearsetGenerationJobContext = JobContext<GearsetGenerationRequest, GearsetGenerationUpdate, 'done'>;

/**
 * Update that fires when the meld solver has a new batch of possible sets to report back.
 */
export type GearsetGenerationSetsUpdate = {
    type: 'sets',
    sets: MicroSetExport[],
}

//
//
/**
 * This fires when the meld solver has either it a new phase, or made significant progress within
 * a specific phase.
 */
export type GearsetGenerationStatusUpdate = {
    type: 'status',
    /**
     * The overall (top-level) phase
     */
    phase: 0 | 1 | 2 | 3 | 4,
    /**
     * The progress within a specific phase (phase / phaseMax).
     *
     * Has different meanings depending on the exact phase.
     */
    subPhase?: {
        phase: number,
        phaseMax: number,
    }
    /**
     * The number of combinations found in this specific phase. May increase as we generate possibilities,
     * or decrease as we eliminate redundant possibilities.
     */
    count: number,
}

/**
 * The status update used specifically for when we have finished with generation and have started simming.
 */
export type MeldSolvingStatusUpdate = {
    done: number,
    total: number,
}

export type GearsetGenerationUpdate = GearsetGenerationSetsUpdate | GearsetGenerationStatusUpdate;
