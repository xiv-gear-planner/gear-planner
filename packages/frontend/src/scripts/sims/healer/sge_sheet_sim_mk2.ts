import {GcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";
import {tincture8mind} from "@xivgear/core/sims/common/potion";

/**
 * Used for all 360p filler abilities
 */
const filler: GcdAbility = {
    type: 'gcd',
    name: "Dosis III",
    potency: 360,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24312
};

const eDosis: GcdAbility = {
    type: 'gcd',
    name: "Eukrasian Dosis III",
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
};

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
};

const psyche: OgcdAbility = {
    type: 'ogcd',
    name: "Psyche",
    id: 37033,
    potency: 600,
    attackType: "Ability",
    cooldown: {
        time: 60
    }
};

export interface SgeSheetSimResult extends CycleSimResult {
}

export interface SgeNewSheetSettings extends SimSettings {
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
    isDefaultSim: true,
    description: 'Simulates the standard SGE 2-minute rotation.'
};

export class SgeSheetSim extends BaseMultiCycleSim<SgeSheetSimResult, SgeNewSheetSettings> {

    spec = sgeNewSheetSpec;
    displayName = sgeNewSheetSpec.displayName;
    shortName = "sge-new-sheet-sim";
    usePotion = false;

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
                // TODO: make a setting for this
                if (this.usePotion) {
                    cp.useOgcd(tincture8mind);
                }
                cp.useGcd(filler);
                cp.remainingCycles(cycle => {
                    cycle.use(eDosis);
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.use(phlegma);
                    cycle.use(psyche);
                    cycle.use(phlegma);
                    cycle.useUntil(filler, 30);
                    cycle.use(eDosis);
                    cycle.useUntil(filler, 60);
                    cycle.use(eDosis);
                    cycle.use(phlegma);
                    cycle.use(psyche);
                    cycle.useUntil(filler, 90);
                    cycle.use(eDosis);
                    cycle.useUntil(filler, 'end');
                });

            }

        }];
    }

}
