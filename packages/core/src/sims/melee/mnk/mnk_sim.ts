import { Ability, Buff, GcdAbility, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";
import { MnkAbility, MNKExtraData, MnkGcdAbility } from "./mnk_types";
import { MNKGauge as MnkGauge } from "./mnk_gauge";
import { Brotherhood, CoeurlForm, Demolish, DragonKick, ElixirBurst, FiresReply, FiresRumination, FormlessFist, LeapingOpo, OPO_ABILITIES, OpoForm, PerfectBalance, PerfectBalanceBuff, PhantomRush, PouncingCoeurl, RaptorForm, RiddleOfFire, RiddleOfFireBuff, RiddleOfWind, RisingPhoenix, RisingRaptor, TheForbiddenChakra, TwinSnakes, WindsReply, WindsRumination } from "./mnk_actions";

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
    isDefaultSim: false,
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
            a.updateGauge(this.gauge, this.getCurrentForm());
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
        const form = this.getCurrentForm();
        console.log(this.currentTime, form, this.gauge);
        const gcd = this.chooseGcd();
        this.useGcd(gcd);
        if (gcd.id === FiresReply.id) {
            this.removeBuff(OpoForm);
            this.removeBuff(RaptorForm);
            this.removeBuff(CoeurlForm);
        }
        if (form?.statusId === PerfectBalanceBuff.statusId) {
            this.removeBuff(OpoForm);
            this.removeBuff(RaptorForm);
            this.removeBuff(CoeurlForm);
        }
        if (this.shouldEnterBlitz(gcd, form)) {
            this.useOgcd(PerfectBalance);
            this.removeBuff(OpoForm);
            this.removeBuff(RaptorForm);
            this.removeBuff(CoeurlForm);
        }
        if (this.cdTracker.canUse(Brotherhood) && this.canUseWithoutClipping(Brotherhood)) {
            this.useOgcd(Brotherhood);
        }
        if (this.cdTracker.canUse(RiddleOfFire) && this.canUseWithoutClipping(RiddleOfFire)) {
            this.useOgcd(RiddleOfFire);
        }
        if (this.cdTracker.canUse(RiddleOfWind) && this.canUseWithoutClipping(RiddleOfWind)) {
            this.useOgcd(RiddleOfWind);
        }
    }

    chooseGcd(): MnkGcdAbility {
        if (this.getActiveBuffs().find(buff => buff.statusId === WindsRumination.statusId)) {
            return WindsReply;
        }
        switch (this.getCurrentForm()?.statusId) {
            case OpoForm.statusId:
            case FormlessFist.statusId:
                if (this.gauge.opoFury) {
                    return LeapingOpo;
                }
                return DragonKick;
            case RaptorForm.statusId:
                if (this.getActiveBuffs().find(buff => buff.statusId === FiresRumination.statusId)) {
                    return FiresReply;
                }
                if (this.gauge.raptorFury) {
                    return RisingRaptor;
                }
                return TwinSnakes;
            case CoeurlForm.statusId:
                if (this.gauge.coeurlFury) {
                    return PouncingCoeurl;
                }
                return Demolish;
            case PerfectBalanceBuff.statusId:
                if (!this.gauge.lunarNadi || this.gauge.solarNadi) {
                    // do an oporot of some kind
                    if (this.gauge.opoFury) {
                        return LeapingOpo;
                    } else {
                        return DragonKick;
                    }
                } else {
                    // building a solar nadi
                    if (this.gauge.beastChakra.length === 0) {
                        // attempt to sequence our least potent gcds out of RoF
                        if (!this.gauge.opoFury) {
                            return DragonKick;
                        } else if (!this.gauge.coeurlFury) {
                            return Demolish;
                        } else if (!this.gauge.raptorFury) {
                            return TwinSnakes;
                        } else if (this.gauge.coeurlFury) {
                            return PouncingCoeurl;
                        } else if (this.gauge.raptorFury) {
                            return RisingRaptor;
                        } else {
                            // autocrit bootshine lets go
                            return LeapingOpo;
                        }
                    } else if (this.gauge.beastChakra.length === 1) {
                        // attempt to sequence the next least potent gcd
                        if (this.gauge.beastChakra.includes('opo')) {
                            if (!this.gauge.coeurlFury) {
                                return Demolish;
                            } else if (!this.gauge.raptorFury) {
                                return TwinSnakes;
                            } else if (this.gauge.coeurlFury) {
                                return PouncingCoeurl;
                            } else {
                                return RisingRaptor;
                            }
                        } else if (this.gauge.beastChakra.includes('raptor')) {
                            if (!this.gauge.opoFury) {
                                return DragonKick;
                            } else if (!this.gauge.coeurlFury) {
                                return Demolish;
                            } else if (this.gauge.coeurlFury) {
                                return PouncingCoeurl;
                            } else {
                                // autocrit bootshine lets go
                                return LeapingOpo;
                            }
                        } else {
                            // this.gauge.beastChakra.includes('coeurl')
                            if (!this.gauge.opoFury) {
                                return DragonKick;
                            } else if (!this.gauge.raptorFury) {
                                return TwinSnakes;
                            } else if (this.gauge.raptorFury) {
                                return RisingRaptor;
                            } else {
                                // autocrit bootshine lets go
                                return LeapingOpo;
                            }
                        }
                    } else if (this.gauge.beastChakra.length === 2) {
                        const all = new Set(['opo', 'raptor', 'coeurl']);
                        this.gauge.beastChakra.forEach(chakra => all.delete(chakra));
                        if (all.has('opo')) {
                            if (this.gauge.opoFury) {
                                // need opo
                                return LeapingOpo;
                            }
                            return DragonKick;
                        } else if (all.has('raptor')) {
                            // need raptor
                            if (this.gauge.raptorFury) {
                                return RisingRaptor;
                            }
                            return TwinSnakes;
                        } else {
                            // need coeurl
                            if (this.gauge.coeurlFury) {
                                return PouncingCoeurl;
                            }
                            return Demolish;
                        }
                    }
                }
            default:
                if (this.gauge.beastChakra.length === 3) {
                    // formless with a blitz ready
                    const s = new Set(this.gauge.beastChakra);
                    if (s.size === 1) {
                        if (this.gauge.lunarNadi && this.gauge.solarNadi) {
                            return PhantomRush;
                        }
                        return ElixirBurst;
                    }
                    return RisingPhoenix;
                }
                console.warn("Infinite looping with no form")
                // formless DK but this should never happen
                return DragonKick;
        }
    }

    getCurrentForm(): Buff {
        return this.getActiveBuffs().find(b => {
            return b.statusId !== undefined && [OpoForm.statusId, RaptorForm.statusId, CoeurlForm.statusId, FormlessFist.statusId, PerfectBalanceBuff.statusId].includes(b.statusId);
        });
    }

    shouldEnterBlitz(gcd: GcdAbility, form: Buff): boolean {
        const riddleReady = this.cdTracker.statusOf(RiddleOfFire).readyAt.relative;
        return OPO_ABILITIES.includes(gcd.id) // just executed an opo ability
            && form.statusId !== PerfectBalanceBuff.statusId // not already building a blitz
            && (riddleReady <= 7 // Within 3 gcds of RoF coming off cooldown
                // OR we're already in RoF and there's enough remaining time to land a blitz inside the current window
                || this.getActiveBuffs(this.currentTime + this.fourGcdTime).find(buff => buff.statusId === RiddleOfFireBuff.statusId))
            && this.cdTracker.canUse(PerfectBalance)
    }

    /*
     *  Returns how long it takes to execute 4 gcds
     */
    get fourGcdTime(): number {
        return this.gcdTime(DragonKick) * 4;
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
                while (cp.remainingTime - cp.nextGcdTime > 0) {
                    cp.doStep();
                }
            }
        },
        {
            name: 'solar lunar',
            cycleTime: 120,
            apply(cp: MNKCycleProcessor) {
                cp.solarLunarOpener();
                while (cp.remainingTime - cp.nextGcdTime > 0) {
                    cp.doStep();
                }
            }
        }];
    }
}
