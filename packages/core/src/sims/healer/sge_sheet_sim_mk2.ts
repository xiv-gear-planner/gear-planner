import {Ability, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    AbilityUseResult,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {potionMaxMind} from "@xivgear/core/sims/common/potion";
import {rangeInc} from "@xivgear/util/array_utils";
import {animationLock} from "@xivgear/core/sims/ability_helpers";
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";

/**
 * Used for all 360p filler abilities
 */
const filler: GcdAbility = {
    type: 'gcd',
    name: "Dosis",
    potency: 300,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24283,
    levelModifiers: [{
        minLevel: 72,
        name: "Dosis II",
        potency: 320,
        id: 24306,
    }, {
        minLevel: 82,
        name: "Dosis III",
        id: 24312,
        potency: 330,
    }, {
        minLevel: 94,
        name: "Dosis III",
        id: 24312,
        potency: 380,
    }],
};

const eDosis: GcdAbility = {
    type: 'gcd',
    name: "Eukrasian Dosis",
    potency: 0,
    dot: {
        id: 2614,
        duration: 30,
        tickPotency: 40,
    },
    attackType: "Spell",
    fixedGcd: true,
    gcd: 2.5,
    // TODO: can this be modeled in a more accurate way? it doesn't break anything but isn't nice to work with
    cast: 1.5,
    id: 24293,
    levelModifiers: [
        {
            minLevel: 72,
            name: "Eukrasian Dosis II",
            dot: {
                id: 2615,
                duration: 30,
                tickPotency: 60,
            },
            id: 24308,
        },
        {
            minLevel: 82,
            name: "Eukrasian Dosis III",
            dot: {
                id: 2864,
                duration: 30,
                tickPotency: 80,
            },
            id: 24314,
        },
    ],
};

const phlegma: GcdAbility = {
    type: 'gcd',
    name: "Phlegma",
    potency: 400,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    // can be corrected to 24289 after #720
    id: 24313,
    cooldown: {
        time: 40.0,
        charges: 2,
    },
    levelModifiers: [
        {
            minLevel: 72,
            name: "Phlegma II",
            potency: 490,
            // can be correct to 24307 after #720
            id: 24313,
        },
        {
            minLevel: 82,
            name: "Phlegma III",
            potency: 600,
            id: 24313,
        }],
};

const psyche: OgcdAbility = {
    type: 'ogcd',
    name: "Psyche",
    id: 37033,
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 60,
    },
    levelModifiers: [{
        minLevel: 92,
        potency: 600,
    }],
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
    description: 'Simulates the standard SGE 2-minute rotation.',
    maintainers: [{
        name: 'Wynn',
        contact: [{
            type: 'discord',
            discordTag: 'xp',
            discordUid: '126517290098229249',
        }],
    }],

};

class SageCycleProcessor extends CycleProcessor {
    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cdEnforcementMode = 'delay';
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

    doEvenMinuteBurst() {
        this.use(phlegma);
        const latestPsycheTime = this.nextGcdTime - animationLock(psyche);
        this.advanceTo(Math.max(latestPsycheTime, this.currentTime));
        if (this.isReady(psyche)) {
            this.use(psyche);
            this.use(phlegma);
        }
        else {
            this.doOffMinuteBurst();
        }

    }

    doOffMinuteBurst() {
        while (true) {
            const canUse = this.canUseCooldowns(phlegma, [psyche]);
            if (canUse === 'yes') {
                this.use(phlegma);
                this.use(psyche);
                return;
            }
            else if (canUse === 'no') {
                this.use(filler);
            }
            else {
                return;
            }
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
            usePotion: false,
        };
    }

    getRotationsToSimulate(): Rotation[] {
        const outer = this;
        return [{
            name: 'Normal DoT',
            cycleTime: 120,
            apply(cp: SageCycleProcessor) {
                if (outer.settings.usePotion) {
                    cp.useOgcd(potionMaxMind);
                }
                cp.useGcd(filler);
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    cycle.use(filler);
                    cycle.use(filler);
                    cp.doEvenMinuteBurst();
                    cycle.useUntil(filler, 30);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60);
                    cp.useDotIfWorth();
                    cp.doOffMinuteBurst();
                    cycle.useUntil(filler, 90);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 'end');
                });
            },
        }, ...rangeInc(2, 20, 2).map(i => ({
            name: `DoT clip ${i}s`,
            cycleTime: 120,
            apply(cp: SageCycleProcessor) {
                if (outer.settings.usePotion) {
                    cp.useOgcd(potionMaxMind);
                }
                const DOT_CLIP_AMOUNT = i;
                cp.useGcd(filler);
                cp.oneCycle(cycle => {
                    cp.useDotIfWorth();
                    cycle.use(filler);
                    cycle.use(filler);
                    cp.doEvenMinuteBurst();
                    cycle.useUntil(filler, 30 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60 - DOT_CLIP_AMOUNT);
                    cycle.use(eDosis);
                    cycle.useUntil(filler, 60);
                    cp.doOffMinuteBurst();
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
                    // There is always one phlegma charge available at this point
                    cp.doEvenMinuteBurst();
                    cycle.useUntil(filler, 30 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 60 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cp.doOffMinuteBurst();
                    cycle.useUntil(filler, 90 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 120 - DOT_CLIP_AMOUNT);
                    cp.useDotIfWorth();
                    cycle.useUntil(filler, 'end');
                });
            },
        })),
        ];
    }

}
