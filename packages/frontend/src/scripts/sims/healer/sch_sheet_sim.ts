import {Chain} from "@xivgear/core/sims/buffs";
import {GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";


const filler: GcdAbility = {
    type: 'gcd',
    name: "Broil IV",
    id: 25865,
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
};

const chain: OgcdAbility = {
    type: 'ogcd',
    name: "Chain Strategem",
    id: 7436,
    activatesBuffs: [Chain],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 120
    }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const r2: GcdAbility = {
    type: 'gcd',
    name: "Ruin II",
    id: 17870,
    potency: 220,
    attackType: "Spell",
    gcd: 2.5,
};

const bio: GcdAbility = {
    type: 'gcd',
    name: "Biolysis",
    id: 16540,
    potency: 0,
    dot: {
        duration: 30,
        tickPotency: 75,
        // TODO verify
        id: 3089
    },
    attackType: "Spell",
    gcd: 2.5,
};

const baneful: OgcdAbility = {
    type: 'ogcd',
    name: "Baneful Impaction",
    id: 37012,
    potency: 0,
    dot: {
        duration: 15,
        tickPotency: 140,
        // TODO verify
        id: 3883
    },
    attackType: "Ability"
};

const ed: OgcdAbility = {
    type: 'ogcd',
    name: "Energy Drain",
    id: 167,
    potency: 100,
    attackType: "Ability"
};

export interface SchSheetSimResult extends CycleSimResult {
}

export interface SchNewSheetSettings extends SimSettings {
    rezPerMin: number,
    gcdHealsPerMin: number,
    edPerMin: number,
    r2PerMin: number,
}

export interface SchNewSheetSettingsExternal extends ExternalCycleSettings<SchNewSheetSettings> {
}

export const schNewSheetSpec: SimSpec<SchSheetSim, SchNewSheetSettingsExternal> = {
    displayName: "SCH Sim",
    loadSavedSimInstance(exported: SchNewSheetSettingsExternal) {
        return new SchSheetSim(exported);
    },
    makeNewSimInstance(): SchSheetSim {
        return new SchSheetSim();
    },
    stub: "sch-sheet-sim",
    supportedJobs: ['SCH'],
    isDefaultSim: true
};

export class SchSheetSim extends BaseMultiCycleSim<SchSheetSimResult, SchNewSheetSettings> {

    spec = schNewSheetSpec;
    displayName = schNewSheetSpec.displayName;
    shortName = "sch-sheet-sim";
    manuallyActivatedBuffs = [Chain];

    constructor(settings?: SchNewSheetSettingsExternal) {
        super('SCH', settings);
    }

    makeDefaultSettings(): SchNewSheetSettings {
        return {
            rezPerMin: 0,
            gcdHealsPerMin: 0,
            edPerMin: 2,
            r2PerMin: 0,
        };
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: CycleProcessor) {
                // pre-pull
                cp.useGcd(filler);
                cp.remainingCycles(cycle => {
                    cycle.useGcd(bio);
                    cycle.useGcd(filler);
                    cycle.useGcd(filler);
                    cycle.useOgcd(chain);
                    cycle.useGcd(filler);
                    cycle.useOgcd(ed);
                    cycle.useGcd(filler);
                    cycle.useOgcd(ed);
                    cycle.useGcd(filler);
                    cycle.useOgcd(ed);
                    cycle.useGcd(filler); //Aetherflow for MP and refreshing EDs
                    cycle.useGcd(filler);
                    cycle.useOgcd(baneful);
                    cycle.useGcd(filler);
                    cycle.useOgcd(ed);
                    cycle.useGcd(filler);
                    cycle.useOgcd(ed);
                    cycle.useGcd(filler);
                    cycle.useOgcd(ed);
                    cycle.useUntil(filler, 30);
                    cycle.useGcd(bio);
                    cycle.useUntil(filler, 60);
                    cycle.useGcd(bio);

                    // If we're on the 3/9/15 diss, blow them immediately and AF right after
                    // OR if we're on the 5/11/17 minute aetherflow, blow them and diss right before buffs
                    if (cycle.cycleNumber % 3 === 1 || cycle.cycleNumber % 3 === 2) {
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                    }

                    cycle.useUntil(filler, 90);
                    cycle.useGcd(bio);
                    cycle.useUntil(filler, 'end');
                });


            }
        }]


    }

}
