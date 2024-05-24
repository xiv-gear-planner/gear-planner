import {GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";
import {BuffSettingsExport} from "@xivgear/core/sims/common/party_comp_settings";

const filler: GcdAbility = {
    type: 'gcd',
    name: "Glare",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
};

const dia: GcdAbility = {
    type: 'gcd',
    name: "Dia",
    potency: 65,
    dot: {
        id: 1871,
        tickPotency: 65,
        duration: 30
    },
    attackType: "Spell",
    gcd: 2.5,
};

const assize: OgcdAbility = {
    type: 'ogcd',
    name: "Assize",
    potency: 400,
    attackType: "Ability"
};

const pom: OgcdAbility = {
    type: 'ogcd',
    name: 'Presence of Mind',
    potency: null,
    activatesBuffs: [
        {
            name: "Presence of Mind",
            selfOnly: true,
            duration: 15,
            effects: {
                haste: 20,
            },
        }
    ],
    attackType: "Ability"
};

const misery: GcdAbility = {
    type: 'gcd',
    name: "Afflatus Misery",
    potency: 1240,
    attackType: "Spell",
    gcd: 2.5,
};

const lily: GcdAbility = {
    type: 'gcd',
    name: "Afflatus Rapture",
    potency: 0,
    attackType: "Spell",
    gcd: 2.5,
};

export interface WhmSheetSimResult extends CycleSimResult {
}

export interface WhmNewSheetSettings extends SimSettings {
    rezPerMin: number,
    med2PerMin: number,
    cure3PerMin: number,

}

export interface WhmNewSheetSettingsExternal extends ExternalCycleSettings<WhmNewSheetSettings> {
    buffConfig: BuffSettingsExport;
}

export const whmNewSheetSpec: SimSpec<WhmSheetSim, WhmNewSheetSettingsExternal> = {
    displayName: "WHM New Sim",
    loadSavedSimInstance(exported: WhmNewSheetSettingsExternal) {
        return new WhmSheetSim(exported);
    },
    makeNewSimInstance(): WhmSheetSim {
        return new WhmSheetSim();
    },
    stub: "whm-new-sheet-sim",
    supportedJobs: ['WHM'],
    isDefaultSim: true
};

export class WhmSheetSim extends BaseMultiCycleSim<WhmSheetSimResult, WhmNewSheetSettings> {

    makeDefaultSettings(): WhmNewSheetSettings {
        return {
            rezPerMin: 0,
            med2PerMin: 0,
            cure3PerMin: 0,
        };
    }

    spec = whmNewSheetSpec;
    displayName = whmNewSheetSpec.displayName;
    shortName = "whm-new-sheet-sim";

    constructor(settings?: WhmNewSheetSettingsExternal) {
        super('WHM', settings);
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: CycleProcessor) {
                cp.use(filler);
                cp.remainingCycles(cycle => {
                    cycle.use(dia);
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.useOgcd(pom);
                    cycle.use(filler);
                    cycle.use(assize);
                    if (cycle.cycleNumber > 0) {
                        cycle.use(misery);
                    }
                    cycle.useUntil(filler, 30);
                    cycle.use(dia);
                    cycle.use(lily); //3 lilys out of buffs to make up for misery in buffs, actual placement isn't specific
                    cycle.use(lily);
                    cycle.use(lily);
                    cycle.useUntil(filler, 50);
                    cycle.use(assize);
                    cycle.useUntil(filler, 60);
                    cycle.use(dia);
                    cycle.useUntil(filler, 70);
                    cycle.use(misery);
                    cycle.useUntil(filler, 90);
                    cycle.use(dia);
                    cycle.use(assize);
                    if (cycle.cycleNumber > 1) {
                        cycle.use(lily);
                        cycle.use(lily);
                        cycle.use(lily);
                    }
                    cycle.useUntil(filler, 'end');
                });
            }

        }];
    }
}
