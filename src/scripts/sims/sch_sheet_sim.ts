import {SimSettings, SimSpec} from "../simulation";
import {GcdAbility, OgcdAbility} from "./sim_types";
import {
    BaseMultiCycleSim,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleProcessor,
    Rotation
} from "./sim_processors";
import {Chain} from "./buffs";


const filler: GcdAbility = {
    type: 'gcd',
    name: "Broil",
    id: 16541,
    potency: 295,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
}

const chain: OgcdAbility = {
    type: 'ogcd',
    name: "Chain",
    id: 7436,
    activatesBuffs: [Chain],
    potency: null
}

const r2: GcdAbility = {
    type: 'gcd',
    name: "Ruin II",
    id: 17870,
    potency: 220,
    attackType: "Spell",
    gcd: 2.5,
}

const bio: GcdAbility = {
    type: 'gcd',
    name: "Biolysis",
    id: 16540,
    potency: 0,
    dot: {
        duration: 30,
        tickPotency: 70,
        // TODO verify
        id: 3089
    },
    attackType: "Spell",
    gcd: 2.5,
}

const ed: OgcdAbility = {
    type: 'ogcd',
    name: "Energy Drain",
    id: 167,
    potency: 100,
    attackType: "Ability"
}

export interface SchSheetSimResult extends CycleSimResult {
}

interface SchNewSheetSettings extends SimSettings {
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
}

export class SchSheetSim extends BaseMultiCycleSim<SchSheetSimResult, SchNewSheetSettings> {

    spec = schNewSheetSpec;
    displayName = schNewSheetSpec.displayName;
    shortName = "sch-sheet-sim";

    constructor(settings?: SchNewSheetSettingsExternal) {
        super(settings);
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
            apply(cp: MultiCycleProcessor) {
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
                    // We have the extra 3 from dissipation on 0 min, 4 min, 6 min, 10 min, etc
                    if (cycle.cycleNumber % 3 !== 1) {
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                    }
                    cycle.useUntil(filler, 30);
                    cycle.useGcd(bio);
                    cycle.useUntil(filler, 60);
                    cycle.useGcd(bio);

                    // If we're on the 3/9/15 diss, and there isn't enough time for another burst window, blow them immediately
                    if (cycle.cycleNumber % 3 === 1 && cp.remainingTime < 70) {
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                        cycle.useGcd(filler);
                        cycle.useOgcd(ed);
                    }

                    cycle.useUntil(filler, 90);
                    cycle.useGcd(bio);
                    cycle.useUntil(filler, 120);
                });


            }
        }]


    }

}
