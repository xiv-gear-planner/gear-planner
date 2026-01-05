import {GearsetGenerationRequest, JobContext} from "../workers/worker_types";
import {MicroSetExport} from "@xivgear/xivmath/geartypes";

export type GearsetGenerationJobContext = JobContext<GearsetGenerationRequest, GearsetGenerationUpdate, 'done'>;
export type GearsetGenerationSetsUpdate = {
    type: 'sets',
    sets: MicroSetExport[],
}
export type GearsetGenerationStatusUpdate = {
    type: 'status',
    phase: number,
    subPhase?: {
        phase: number,
        phaseMax: number,
    }
    count: number,
}
export type MeldSolvingStatusUpdate = {
    done: number,
    total: number,
}
export type GearsetGenerationUpdate = GearsetGenerationSetsUpdate | GearsetGenerationStatusUpdate;
