import {CharacterGearSet} from "./gear";

export interface SimResult {
    mainDpsResult: number;
}

export interface Simulation<X extends SimResult> {

    shortName: string;
    displayName: string;

    simulate(set: CharacterGearSet): SimResult;

}

export const dummySim: Simulation<SimResult> = {
    shortName: "dummysim",
    displayName: "Dummy Sim",
    simulate(set: CharacterGearSet): SimResult {
        return {mainDpsResult: 10000 + set.computedStats.critChance * 10000};
    }
}

export interface SimCurrentResult<X extends SimResult> {
    result: X | undefined,
    status: 'Done' | 'Running' | 'Not Run' | 'Stale';
}