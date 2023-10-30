import {SimSettings, SimSpec} from "../simulation";
import {ComputedSetStats} from "../geartypes";
import {Buff, GcdAbility, OgcdAbility} from "./sim_types";
import {
    BaseMultiCycleSim,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleProcessor,
    Rotation
} from "./sim_processors";
import {sum} from "../util/array_utils";
import {BuffSettingsExport} from "./party_comp_settings";


const filler: GcdAbility = {
    type: 'gcd',
    name: "Glare",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
}

const dia: GcdAbility = {
    type: 'gcd',
    name: "Dia",
    potency: (30 / 3 * 65) + 65,
    attackType: "Spell",
    gcd: 2.5,
}

const assize: OgcdAbility = {
    type: 'ogcd',
    name: "Assize",
    potency: 400,
    attackType: "Ability"
}

const pom: OgcdAbility = {
    type: 'ogcd',
    name: 'Presence of Mind',
    potency: null,
    activatesBuffs: [
        {
            name: "Presence of Mind",
            job: "WHM",
            selfOnly: true,
            duration: 15,
            cooldown: 120,
            effects: {
                haste: 20,
            },
        }
    ]
}

const misery: GcdAbility = {
    type: 'gcd',
    name: "Afflatus Misery",
    potency: 1240,
    attackType: "Spell",
    gcd: 2.5,
}

const lily: GcdAbility = {
    type: 'gcd',
    name: "Afflatus Rapture",
    potency: 0,
    attackType: "Spell",
    gcd: 2.5,
}

export interface WhmSheetSimResult extends CycleSimResult {
}

interface WhmNewSheetSettings extends SimSettings {
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
}

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
        super(settings);
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: MultiCycleProcessor) {
                cp.use(filler);
                cp.remainingCycles(cycle => {

                    cp.use(dia);
                    cp.use(filler);
                    cp.use(filler);
                    cp.useOgcd(pom);
                    cp.use(filler);
                    cp.use(assize);
                    if (cycle.cycleNumber > 1) {
                        cp.use(misery);
                    }
                    cp.useUntil(filler, 30);
                    cp.use(dia);
                    cp.use(lily); //3 lilys out of buffs to make up for misery in buffs, actual placement isn't specific
                    cp.use(lily);
                    cp.use(lily);
                    cp.useUntil(filler, 50);
                    cp.use(assize);
                    cp.useUntil(filler, 60);
                    cp.use(dia);
                    cp.useUntil(filler, 70);
                    cp.use(misery);
                    cp.useUntil(filler, 90);
                    cp.use(dia);
                    cp.use(assize);
                    if (cycle.cycleNumber > 1) {
                        cp.use(lily);
                        cp.use(lily);
                        cp.use(lily);
                    }
                    cp.useUntil(filler, 120);
                });
            }

        }];
    }
}
