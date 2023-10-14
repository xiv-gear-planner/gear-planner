import {JobName} from "../xivconstants";
import {Buff} from "./buffs";

export type BuffSettings = {
    jobs: JobName[],
    buffs: Buff[]
}