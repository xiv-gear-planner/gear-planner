import {CutoffMode} from "./cycle_sim";

export type CycleSettings = {
    totalTime: number,
    // not implemented yet
    cycles: number,
    which: 'totalTime' | 'cycles',
    useAutos: boolean,
    cutoffMode: CutoffMode
}
