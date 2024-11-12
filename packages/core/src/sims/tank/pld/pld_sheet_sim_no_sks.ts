import {SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleContext, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import * as Actions from "./pld_actions_no_sks";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";

interface GcdState {
    hasDivineMight: boolean,
    swordOathStacks: number, // sword oath stacks technically an old concept but w/e
    comboProgress: number // 0, 1, or 2
}

function useNextAtone(cycle: CycleContext, state: GcdState): void {
    switch (state.swordOathStacks) {
        case 3:
            cycle.use(Actions.atone);
            break;
        case 2:
            cycle.use(Actions.supp);
            break;
        case 1:
            cycle.use(Actions.sep);
            break;
        default:
            console.log("oops, something went wrong with atones");
            state.swordOathStacks = 0;
    }

    state.swordOathStacks -= 1;
}

function useBurst(cycle: CycleContext): void {
    cycle.use(Actions.fof);
    cycle.use(Actions.imp);
    cycle.use(Actions.conf);
    cycle.use(Actions.cos);
    cycle.use(Actions.exp);
    cycle.use(Actions.faith);
    cycle.use(Actions.int);
    cycle.use(Actions.int);
    cycle.use(Actions.truth);
    cycle.use(Actions.valor);
    cycle.use(Actions.honor);
    cycle.use(Actions.goring);
}

function useBurstFillerGcds(cycle: CycleContext, numFillers: number, state: GcdState): void {
    for (let i = 0; i < numFillers; ++i) {
        if (state.swordOathStacks > 0 && state.swordOathStacks <= (numFillers - i)) {
            // if enough gcds to get to sepulchre, prioritize that
            useNextAtone(cycle, state);
        }
        else if (state.hasDivineMight) {
            cycle.use(Actions.hs);
            state.hasDivineMight = false;
        }
        else if (state.swordOathStacks > 0) {
            // use remaining atones to fill
            useNextAtone(cycle, state);
        }
        else {
            switch (state.comboProgress) {
                case 0:
                    cycle.use(Actions.fast);
                    break;
                case 1:
                    cycle.use(Actions.riot);
                    break;
                case 2:
                    cycle.use(Actions.royal);
                    state.hasDivineMight = true;
                    state.swordOathStacks = 3;
                    break;
            }
            state.comboProgress += 1;
            state.comboProgress %= 3;
        }
    }
}

function useFillerGcds(cycle: CycleContext, numFillers: number, state: GcdState): void {
    for (let i = 0; i < numFillers; ++i) {
        if (state.swordOathStacks === 3) {
            // prioritize spending the first atone to enable the ideal fof
            useNextAtone(cycle, state);
        }
        else if (state.comboProgress === 2) {
            if (state.swordOathStacks === 2) {
                // supplication
                useNextAtone(cycle, state);
            }
            else if (state.hasDivineMight) {
                cycle.use(Actions.hs);
                state.hasDivineMight = false;
            }
            else if (state.swordOathStacks > 0) {
                // sepulchre
                useNextAtone(cycle, state);
            }
            else {
                cycle.use(Actions.royal);
                state.hasDivineMight = true;
                state.swordOathStacks = 3;
                state.comboProgress = 0;
            }
        }
        else {
            cycle.use(state.comboProgress === 0 ? Actions.fast : Actions.riot);
            state.comboProgress += 1;
            state.comboProgress %= 3;
        }
    }
}

export interface PldSheetSimResult extends CycleSimResult {
}

interface PldSheetSettings extends SimSettings {
}

export interface PldSheetSettingsExternal extends ExternalCycleSettings<PldSheetSettings> {
}

export const pldSheetSpec: SimSpec<PldSheetSim, PldSheetSettingsExternal> = {
    stub: "pld-sheet-sim",
    displayName: "PLD Sim (sks not fully supported)",
    makeNewSimInstance(): PldSheetSim {
        return new PldSheetSim();
    },
    loadSavedSimInstance(exported: PldSheetSettingsExternal) {
        return new PldSheetSim(exported);
    },
    supportedJobs: ['PLD'],
    isDefaultSim: false,
};

export class PldSheetSim extends BaseMultiCycleSim<PldSheetSimResult, PldSheetSettings> {

    makeDefaultSettings(): PldSheetSettings {
        return {};
    }

    spec = pldSheetSpec;
    displayName = pldSheetSpec.displayName;
    shortName = pldSheetSpec.stub;

    constructor(settings?: PldSheetSettingsExternal) {
        super('PLD', settings);
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 420,
            apply(cp: CycleProcessor) {
                cp.useGcd(Actions.fast);
                cp.useGcd(Actions.riot);
                cp.useGcd(Actions.royal);

                cp.remainingCycles((cycle) => {
                    const state: GcdState = {
                        hasDivineMight: true,
                        swordOathStacks: 3,
                        comboProgress: 0, // 0, 1, or 2
                    };

                    for (let i = 0; i < 7; ++i) {
                        useBurst(cycle);
                        useBurstFillerGcds(cycle, 3, state);
                        useFillerGcds(cycle, 5, state);
                        cycle.use(Actions.cos);
                        cycle.use(Actions.exp);
                        useFillerGcds(cycle, 11, state);
                    }
                });
            },

        }];
    }
}
