import {SimSettings, SimSpec} from "../simulation";
import {GcdAbility} from "./sim_types";
import {
    BaseMultiCycleSim,
    CycleSimResult,
    ExternalCycleSettings,
    CycleProcessor,
    Rotation
} from "./sim_processors";

/**
 * Used for all 330p filler abilities
 */
const filler: GcdAbility = {
    type: 'gcd',
    name: "Filler",
    potency: 330,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24312
}

const eDosis: GcdAbility = {
    type: 'gcd',
    name: "E.Dosis",
    potency: 0,
    dot: {
        id: 2864,
        duration: 30,
        tickPotency: 75
    },
    attackType: "Spell",
    fixedGcd: true,
    gcd: 2.5,
    // TODO: can this be modeled in a more accurate way? it doesn't break anything but isn't nice to work with
    cast: 1.5,
    id: 24314,
}

const phlegma: GcdAbility = {
    type: 'gcd',
    name: "Phlegma",
    potency: 600,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24313,
    cooldown: {
        time: 40.0,
        charges: 2
    }
}

export interface SgeSheetSimResult extends CycleSimResult {
}

interface SgeNewSheetSettings extends SimSettings {
    rezPerMin: number,
    diagPerMin: number,
    progPerMin: number,
    eDiagPerMin: number,
    eProgPerMin: number,
    toxPerMin: number

}

export interface SgeNewSheetSettingsExternal extends ExternalCycleSettings<SgeNewSheetSettings> {
}

export const sgeNewSheetSpec: SimSpec<SgeSheetSim, SgeNewSheetSettingsExternal> = {
    displayName: "SGE Sim Mk.II",
    loadSavedSimInstance(exported: SgeNewSheetSettingsExternal) {
        return new SgeSheetSim(exported);
    },
    makeNewSimInstance(): SgeSheetSim {
        return new SgeSheetSim();
    },
    stub: "sge-sheet-sim-mk2",
    supportedJobs: ['SGE'],
    isDefaultSim: true
}

export class SgeSheetSim extends BaseMultiCycleSim<SgeSheetSimResult, SgeNewSheetSettings> {

    spec = sgeNewSheetSpec;
    displayName = sgeNewSheetSpec.displayName;
    shortName = "sge-new-sheet-sim";

    constructor(settings?: SgeNewSheetSettingsExternal) {
        super('SGE', settings);
    }

    makeDefaultSettings(): SgeNewSheetSettings {
        return {
            rezPerMin: 0,
            diagPerMin: 0,
            progPerMin: 0,
            eDiagPerMin: 0,
            eProgPerMin: 0, // TODO: pick reasonable defaults
            toxPerMin: 0
        };
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: CycleProcessor) {
                cp.useGcd(filler);
                cp.remainingCycles(cycle => {
                    // TODO: improve this logic
                    /*
                    DoT only worth it over an extra dosis if you have at least 13.2 seconds left on fight (on average).
                    Make sure last Phlegma is dumped before fight ends.
                    Make custom CycleProcessor with methods such as:
                    - Use DoT when worth it
                    - Use one Phlegma if available
                    - Use both Phlegmas if available
                     */
                    // Worth dotting if
                    cycle.use(eDosis);
                    cycle.use(filler);
                    cycle.use(filler);
                    while (cycle.elapsedTime < 25) {
                        if (cp.cdTracker.canUse(phlegma)) {
                            cycle.use(phlegma);
                        }
                        else {
                            cycle.use(filler);
                        }
                    }
                    cycle.useUntil(filler, 30);
                    cycle.use(eDosis);
                    cycle.useUntil(filler, 60);
                    cycle.use(eDosis);
                    while (cycle.elapsedTime < 85) {
                        if (cp.cdTracker.canUse(phlegma)) {
                            cycle.use(phlegma);
                        }
                        else {
                            cycle.use(filler);
                        }
                    }
                    cycle.useUntil(filler, 90);
                    cycle.use(eDosis);
                    cycle.useUntil(filler, 'end');
                });

            }

        }];
    }

}
