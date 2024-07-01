import {Ability, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    AbilityUseResult,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";
import {gemdraught1mind} from "@xivgear/core/sims/common/potion";
import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";

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
    usePotion: boolean
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

class SageCycleProcessor extends CycleProcessor {
    constructor(settings: MultiCycleSettings) {
        super(settings);
    }

    useDotIfWorth() {
        if (this.remainingTime > 15) {
            this.use(eDosis);
        }
        else {
            this.use(filler);
        }
    }

    use(ability: Ability): AbilityUseResult {
        // If we are going to run out of time, blow any phlegma we might be holding
        if (ability === filler
            && this.remainingGcds(phlegma) <= 2
            && this.cdTracker.canUse(phlegma)) {
            return super.use(phlegma);
        }
        else {
            return super.use(ability);
        }
    }
}

export class SgeSheetSim extends BaseMultiCycleSim<SgeSheetSimResult, SgeNewSheetSettings, SageCycleProcessor> {

    spec = sgeNewSheetSpec;
    displayName = sgeNewSheetSpec.displayName;
    shortName = "sge-new-sheet-sim";

    constructor(settings?: SgeNewSheetSettingsExternal) {
        super('SGE', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): SageCycleProcessor {
        return new SageCycleProcessor(settings);
    }

    makeDefaultSettings(): SgeNewSheetSettings {
        return {
            usePotion: false
        };
    }

    makeCustomConfigInterface(settings: SgeNewSheetSettings, updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");
        const potCb = new FieldBoundCheckBox(settings, "usePotion");
        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }

    getRotationsToSimulate(): Rotation[] {
        const outer = this;
        return [{
            // Normal DoT
            cycleTime: 120,
            apply(cp: SageCycleProcessor) {
                // TODO: make a setting for this
                if (outer.settings.usePotion) {
                    cp.useOgcd(gemdraught1mind);
                }
                cp.useGcd(filler);
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.use(phlegma);
                    cycle.use(psyche);
                    cycle.use(phlegma);
                    cycle.useUntil(filler, 30);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60);
                    cp.useDotIfWorth();
                    cycle.use(phlegma);
                    cycle.use(psyche);
                    cycle.useUntil(filler, 90);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 'end');
                });

            }

        }, {
            // Dot early refresh
            cycleTime: 120,
            apply(cp: SageCycleProcessor) {
                // TODO: make a setting for this
                if (outer.settings.usePotion) {
                    cp.useOgcd(gemdraught1mind);
                }
                const DOT_CLIP_AMOUNT = 10;
                cp.useGcd(filler);
                cp.oneCycle(cycle => {
                    cp.useDotIfWorth();
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.use(phlegma);
                    cycle.use(psyche);
                    cycle.use(phlegma);
                    cycle.useUntil(filler, 30 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60 - DOT_CLIP_AMOUNT);
                    cycle.use(eDosis);
                    cycle.useUntil(filler, 60);
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.use(phlegma);
                    cycle.use(psyche);
                    cycle.useUntil(filler, 90 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 120 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 'end');
                });
                cp.remainingCycles(cycle => {
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.use(phlegma);
                    cycle.use(psyche);
                    cycle.use(phlegma);
                    cycle.useUntil(filler, 30 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.use(phlegma);
                    cycle.use(psyche);
                    cycle.useUntil(filler, 90 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 120 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 'end');
                });
            },
        }
            // , {
            //     // Dot late
            //     cycleTime: 120,
            //     apply(cp: SageCycleProcessor) {
            //         // TODO: make a setting for this
            //         if (this.usePotion) {
            //             cp.useOgcd(tincture8mind);
            //         }
            //         const DOT_CLIP_AMOUNT = 10;
            //         cp.useGcd(filler);
            //         cp.oneCycle(cycle => {
            //             cycle.use(eDosis);
            //             cycle.use(filler);
            //             cycle.use(filler);
            //             cycle.use(phlegma);
            //             cycle.use(psyche);
            //             cycle.use(phlegma);
            //             cycle.useUntil(filler, 30 - DOT_CLIP_AMOUNT);
            //             cycle.use(eDosis);
            //             cycle.useUntil(filler, 60 - DOT_CLIP_AMOUNT);
            //             cycle.use(eDosis);
            //             cycle.use(phlegma);
            //             cycle.use(psyche);
            //             cycle.useUntil(filler, 90 - DOT_CLIP_AMOUNT);
            //             cycle.use(eDosis);
            //             cycle.useUntil(filler, 120 - DOT_CLIP_AMOUNT);
            //             cycle.use(eDosis);
            //             cycle.useUntil(filler, 'end');
            //         });
            //         cp.remainingCycles(cycle => {
            //             cycle.use(filler);
            //             cycle.use(filler);
            //             cycle.use(filler);
            //             cycle.use(phlegma);
            //             cycle.use(psyche);
            //             cycle.use(phlegma);
            //             cycle.useUntil(filler, 30 - DOT_CLIP_AMOUNT);
            //             cycle.use(eDosis);
            //             cycle.useUntil(filler, 60 - DOT_CLIP_AMOUNT);
            //             cycle.use(eDosis);
            //             cycle.use(phlegma);
            //             cycle.use(psyche);
            //             cycle.useUntil(filler, 90 - DOT_CLIP_AMOUNT);
            //             cycle.use(eDosis);
            //             cycle.useUntil(filler, 120 - DOT_CLIP_AMOUNT);
            //             cycle.use(eDosis);
            //             cycle.useUntil(filler, 'end');
            //         });
            //     },
            // }
        ];
    }

}
