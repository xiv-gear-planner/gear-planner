import {SimSettings, SimSpec, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleContext, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";

const fast: GcdAbility = {
    id: 9,
    type: 'gcd',
    name: "Fast Blade",
    potency: 220,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true
}

const riot: GcdAbility = {
    id: 15,
    type: 'gcd',
    name: "Riot Blade",
    potency: 330,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true
}

const royal: GcdAbility = {
    id: 3539,
    type: 'gcd',
    name: "Royal Authority",
    potency: 440,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true
}

const atone: GcdAbility = {
    id: 16460,
    type: 'gcd',
    name: "Atonement",
    potency: 440,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true
}

const supp: GcdAbility = {
    id: 36918,
    type: 'gcd',
    name: "Supplication",
    potency: 460,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true
}

const sep: GcdAbility = {
    id: 36919,
    type: 'gcd',
    name: "Sepulchre",
    potency: 480,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true
}

const hs: GcdAbility = {
    id: 7384,
    type: 'gcd',
    name: "Holy Spirit",
    potency: 470,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true
}

const goring: GcdAbility = {
    id: 3538,
    type: 'gcd',
    name: "Goring Blade",
    potency: 700,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true
}

const conf: GcdAbility = {
    id: 16459,
    type: 'gcd',
    name: "Confiteor",
    potency: 940,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true
}

const faith: GcdAbility = {
    id: 25748,
    type: 'gcd',
    name: "Blade of Faith",
    potency: 740,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true
}

const truth: GcdAbility = {
    id: 25749,
    type: 'gcd',
    name: "Blade of Truth",
    potency: 840,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true
}

const valor: GcdAbility = {
    id: 25750,
    type: 'gcd',
    name: "Blade of Valor",
    potency: 940,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true
}

const cos: OgcdAbility = {
    id: 23,
    type: 'ogcd',
    name: "Circle of Scorn",
    potency: 140,
    dot: {
        id: 248,
        duration: 15,
        tickPotency: 30
    },
    attackType: "Ability"
}

const exp: OgcdAbility = {
    id: 25747,
    type: 'ogcd',
    name: "Expiacion",
    potency: 450,
    attackType: "Ability"
}

const int: OgcdAbility = {
    id: 16461,
    type: 'ogcd',
    name: "Intervene",
    potency: 150,
    attackType: "Ability"
}

const imp: OgcdAbility = {
    id: 36921,
    type: 'ogcd',
    name: "Imperator",
    potency: 580,
    attackType: "Ability"
}

const honor: OgcdAbility = {
    id: 36922,
    type: 'ogcd',
    name: "Blade of Honor",
    potency: 1000,
    attackType: "Ability"
}

const fof: OgcdAbility = {
    id: 20,
    type: 'ogcd',
    name: "Fight or Flight",
    potency: null,
    attackType: "Ability",
    activatesBuffs: [
        {
            statusId: 76,
            name: "Fight or Flight",
            selfOnly: true,
            duration: 20,
            effects: {
                dmgIncrease: 0.25
            }
        }
    ]
}

interface GcdState {
    hasDivineMight: boolean,
    swordOathStacks: number, // sword oath stacks technically an old concept but w/e
    comboProgress: number // 0, 1, or 2
}

function useNextAtone(cycle: CycleContext, state: GcdState): void {
    switch (state.swordOathStacks) {
    case 3:
        cycle.use(atone)
        break;
    case 2:
        cycle.use(supp);
        break;
    case 1:
        cycle.use(sep);
        break;
    default:
        console.log("oops, something went wrong with atones")
        state.swordOathStacks = 0;
    }

    state.swordOathStacks -= 1;
}

function useBurst(cycle: CycleContext): void {
    cycle.use(fof);
    cycle.use(imp);
    cycle.use(conf);
    cycle.use(cos);
    cycle.use(exp);
    cycle.use(faith);
    cycle.use(int);
    cycle.use(int);
    cycle.use(truth);
    cycle.use(valor);
    cycle.use(honor);
    cycle.use(goring);
}

function useBurstFillerGcds(cycle: CycleContext, numFillers: number, state: GcdState): void {
    for (let i = 0; i < numFillers; ++i) {
        if (state.swordOathStacks > 0 && state.swordOathStacks <= (numFillers - i)) {
            // if enough gcds to get to sepulchre, prioritize that
            useNextAtone(cycle, state);
        } else if (state.hasDivineMight) {
            cycle.use(hs);
            state.hasDivineMight = false;
        } else if (state.swordOathStacks > 0) {
            // use remaining atones to fill
            useNextAtone(cycle, state);
        } else {
            switch (state.comboProgress) {
            case 0:
                cycle.use(fast);
                break;
            case 1:
                cycle.use(riot);
                break;
            case 2:
                cycle.use(royal);
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
        } else if (state.comboProgress === 2) {
            if (state.swordOathStacks === 2) {
                // supplication
                useNextAtone(cycle, state);
            } else if (state.hasDivineMight) {
                cycle.use(hs);
                state.hasDivineMight = false;
            } else if (state.swordOathStacks > 0) {
                // sepulchre
                useNextAtone(cycle, state);
            } else {
                cycle.use(royal);
                state.hasDivineMight = true;
                state.swordOathStacks = 3;
                state.comboProgress = 0;
            }
        } else {
            cycle.use(state.comboProgress === 0 ? fast : riot);
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
    isDefaultSim: true
}

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
                cp.useGcd(fast);
                cp.useGcd(riot);
                cp.useGcd(royal);

                cp.remainingCycles((cycle) => {
                    const state: GcdState = {
                        hasDivineMight: true,
                        swordOathStacks: 3,
                        comboProgress: 0 // 0, 1, or 2
                    }

                    for (let i = 0; i < 7; ++i) {
                        useBurst(cycle);
                        useBurstFillerGcds(cycle, 3, state);
                        useFillerGcds(cycle, 5, state);
                        cycle.use(cos);
                        cycle.use(exp);
                        useFillerGcds(cycle, 11, state);
                    }
                });
            }

        }];
    }
}