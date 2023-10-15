import {JobName} from "../xivconstants";
import {Buff} from "./sim_types";

export type BuffSettings = {
    jobs: JobName[],
    buffs: Buff[]
}