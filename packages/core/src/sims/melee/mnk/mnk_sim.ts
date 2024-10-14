import { Ability, Buff, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";
import { MnkAbility, MNKExtraData } from "./mnk_types";
import { MNKGauge as MnkGauge } from "./mnk_gauge";
import { Brotherhood, CoeurlForm, Demolish, DragonKick, ElixirBurst, FiresReply, FiresRumination, FormlessFist, LeapingOpo, OGCD_PRIORITY, OPO_ABILITIES, OpoForm, PerfectBalance, PerfectBalanceBuff, PhantomRush, PouncingCoeurl, RaptorForm, RiddleOfFire, RiddleOfFireBuff, RiddleOfWind, RisingPhoenix, RisingRaptor, SOLAR_WEAKEST_STRONGEST, TheForbiddenChakra, TwinSnakes, WindsReply, WindsRumination } from "./mnk_actions";
import { sum } from "../../../util/array_utils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";

export interface MnkSimResult extends CycleSimResult { }

export interface MnkSettings extends SimSettings { }

export interface MnkSettingsExternal extends ExternalCycleSettings<MnkSettings> { }

export const mnkSpec: SimSpec<MnkSim, MnkSettingsExternal> = {
    stub: 'mnk-sim',
    displayName: 'MNK Sim',
    description: 'Simulates a monk rotation at level 100',
    makeNewSimInstance: function(): MnkSim {
        return new MnkSim();
    },
    loadSavedSimInstance: function(exported: MnkSettingsExternal) {
        return new MnkSim(exported);
    },
    supportedJobs: ['MNK'],
    supportedLevels: [100],
    isDefaultSim: true,
};

class MNKCycleProcessor extends CycleProcessor {
    gauge: MnkGauge;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new MnkGauge();
    }

    use(ability: Ability): AbilityUseResult {
        const a = ability as MnkAbility;
        if (a.updateGauge) {
            a.updateGauge(this.gauge);
        }
        return super.use(ability);
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: MNKExtraData = {
            gauge: this.gauge.getGaugeState(),
        };
        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    // 5s DK opener
    doubleLunarOpener() {
        this.useGcd(DragonKick);
        this.useOgcd(PerfectBalance);
        this.useGcd(LeapingOpo);
        this.useGcd(DragonKick);
        this.useOgcd(Brotherhood);
        this.useOgcd(RiddleOfFire);
        this.useGcd(LeapingOpo);
        this.useOgcd(TheForbiddenChakra);
        this.useOgcd(RiddleOfWind);
        this.useGcd(ElixirBurst);
        this.useGcd(DragonKick);
        this.useGcd(WindsReply);
        this.useGcd(FiresReply);
        this.useGcd(LeapingOpo);
        this.useOgcd(PerfectBalance);
        this.useGcd(DragonKick);
        this.useGcd(LeapingOpo);
        this.useGcd(DragonKick);
        this.useGcd(ElixirBurst);
        this.useGcd(LeapingOpo);
    }

    // 5s DK opener
    solarLunarOpener() {
        this.useGcd(DragonKick);
        this.useOgcd(PerfectBalance);
        this.useGcd(TwinSnakes);
        this.useGcd(Demolish);
        this.useOgcd(Brotherhood);
        this.useOgcd(RiddleOfFire);
        this.useGcd(LeapingOpo);
        this.useOgcd(TheForbiddenChakra);
        this.useOgcd(RiddleOfWind);
        this.useGcd(ElixirBurst);
        this.useGcd(DragonKick);
        this.useGcd(WindsReply);
        this.useGcd(FiresReply);
        this.useGcd(LeapingOpo);
        this.useOgcd(PerfectBalance);
        this.useGcd(DragonKick);
        this.useGcd(LeapingOpo);
        this.useGcd(DragonKick);
        this.useGcd(ElixirBurst);
        this.useGcd(LeapingOpo);
    }

    // TODO implement logic to enter 1m and 2m burst windows appropriately
    doStep() {
        switch (this.getCurrentForm()) {
            case OpoForm:
            case FormlessFist:
                if (this.gauge.opoFury) {
                    this.useGcd(LeapingOpo);
                } else {
                    this.useGcd(DragonKick);
                }
                break;
            case RaptorForm:
                if (this.gauge.raptorFury) {
                    this.useGcd(RisingRaptor);
                } else {
                    this.useGcd(TwinSnakes);
                }
                break;
            case CoeurlForm:
                if (this.gauge.coeurlFury) {
                    this.useGcd(PouncingCoeurl);
                } else {
                    this.useGcd(Demolish);
                }
                break;
            case PerfectBalanceBuff:
                // pb decision tree
                break;
        }
    }

    getCurrentForm(): Buff {
        return this.getActiveBuffs().find(b => {
            if ([OpoForm.statusId, RaptorForm.statusId, CoeurlForm.statusId, FormlessFist.statusId, PerfectBalanceBuff.statusId].includes(b.statusId)) {
                return b;
            }
            return undefined;
        });
    }
}

export class MnkSim extends BaseMultiCycleSim<CycleSimResult, MnkSettings, MNKCycleProcessor> {
    spec = mnkSpec;
    shortName = 'mnk-sim';
    displayName = mnkSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        cutoffMode: "prorate-gcd",
        totalTime: (8 * 60),
        cycles: 0,
        which: 'totalTime',
    };

    constructor(settings?: MnkSettingsExternal) {
        super('MNK', settings);
    }

    override makeDefaultSettings(): MnkSettings {
        return {}
    }

    protected createCycleProcessor(settings: MultiCycleSettings): MNKCycleProcessor {
        return new MNKCycleProcessor({
            ...settings,
        });
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<MNKCycleProcessor>[] {
        return [{
            name: 'double lunar',
            cycleTime: 120,
            apply(cp: MNKCycleProcessor) {
                cp.doubleLunarOpener();
                while (cp.remainingTime > 0) {
                    cp.doStep();
                }
            }
        },
        {
            name: 'solar lunar',
            cycleTime: 120,
            apply(cp: MNKCycleProcessor) {
                cp.solarLunarOpener();
                while (cp.remainingTime > 0) {
                    cp.doStep();
                }
            }
        }];
    }
}
