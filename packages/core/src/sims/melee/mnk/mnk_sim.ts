import { Ability, Buff, GcdAbility, OgcdAbility, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";
import { FuryAbility, MnkAbility, MNKExtraData, MnkGcdAbility } from "./mnk_types";
import { MNKGauge as MnkGauge } from "./mnk_gauge";
import { Brotherhood, CoeurlForm, Demolish, DragonKick, ElixirBurst, FiresReply, FiresRumination, ForbiddenMeditation, FormShift, FormlessFist, LeapingOpo, OGCD_PRIORITY, OPO_ABILITIES, OpoForm, PerfectBalance, PerfectBalanceBuff, PhantomRush, PouncingCoeurl, RaptorForm, RiddleOfFire, RiddleOfFireBuff, RiddleOfWind, RisingPhoenix, RisingRaptor, SOLAR_WEAKEST_STRONGEST, TheForbiddenChakra, TwinSnakes, WindsReply, WindsRumination } from "./mnk_actions";
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
    isDefaultSim: false,
};

class MNKCycleProcessor extends CycleProcessor {
    gauge: MnkGauge;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new MnkGauge();
    }

    override use(ability: Ability): AbilityUseResult {
        const a = ability as MnkAbility;
        if (a.updateGauge) {
            a.updateGauge(this.gauge, this.getCurrentForm(), this.combatStarted);
        }
        return super.use(ability);
    }

    override useOgcd(ability: OgcdAbility): AbilityUseResult {
        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (this.canUseWithoutClipping(ability)) {
            const readyAt = this.cdTracker.statusOf(ability).readyAt.absolute;
            if (this.totalTime > readyAt) {
                this.advanceTo(readyAt);
            }
        }
        // Only try to use the Ogcd if it's ready.
        return this.cdTracker.canUse(ability) ? super.useOgcd(ability) : null;
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
        this.useGcd(ForbiddenMeditation);
        this.useGcd(FormShift);
        this.useGcd(DragonKick);
        this.cleanupForms();
        this.useOgcd(PerfectBalance);
        this.useGcd(LeapingOpo); this.cleanupForms();
        this.useGcd(DragonKick); this.cleanupForms();
        this.useOgcd(Brotherhood);
        this.useOgcd(RiddleOfFire);
        this.useGcd(LeapingOpo); this.cleanupForms();
        this.useOgcd(TheForbiddenChakra);
        this.useOgcd(RiddleOfWind);
        this.useGcd(ElixirBurst);
        this.useGcd(DragonKick);
        this.useGcd(WindsReply);
        this.useGcd(FiresReply);
        this.useGcd(LeapingOpo);
        this.cleanupForms();
        this.useOgcd(PerfectBalance);
        this.useGcd(DragonKick); this.cleanupForms();
        this.useGcd(LeapingOpo); this.cleanupForms();
        this.useGcd(DragonKick); this.cleanupForms();
        this.useGcd(ElixirBurst);
        this.useGcd(LeapingOpo);
    }

    // 5s DK opener
    solarLunarOpener() {
        this.useGcd(ForbiddenMeditation);
        this.useGcd(FormShift);
        this.useGcd(DragonKick);
        this.cleanupForms();
        this.useOgcd(PerfectBalance);
        this.useGcd(TwinSnakes); this.cleanupForms();
        this.useGcd(Demolish); this.cleanupForms();
        this.useOgcd(Brotherhood);
        this.useOgcd(RiddleOfFire);
        this.useGcd(LeapingOpo); this.cleanupForms();
        this.useOgcd(TheForbiddenChakra);
        this.useOgcd(RiddleOfWind);
        this.useGcd(RisingPhoenix);
        this.useGcd(DragonKick);
        this.useGcd(WindsReply);
        this.useGcd(FiresReply);
        this.useGcd(LeapingOpo);
        this.cleanupForms();
        this.useOgcd(PerfectBalance);
        this.useGcd(DragonKick); this.cleanupForms();
        this.useGcd(LeapingOpo); this.cleanupForms();
        this.useGcd(DragonKick); this.cleanupForms();
        this.useGcd(ElixirBurst);
        this.useGcd(LeapingOpo);
    }

    doStep() {
        const form = this.getCurrentForm();
        const gcd = this.chooseGcd();
        this.useGcd(gcd);
        if (gcd.id === FiresReply.id) {
            this.removeBuff(OpoForm);
            this.removeBuff(RaptorForm);
            this.removeBuff(CoeurlForm);
        }
        if (form?.statusId === PerfectBalanceBuff.statusId) {
            this.cleanupForms();
        }
        if (this.shouldEnterBlitz(gcd, form)) {
            this.useOgcd(PerfectBalance);
            this.cleanupForms();
        }

        const ogcdsAvailable: OgcdAbility[] = OGCD_PRIORITY.filter((ogcd: OgcdAbility) => this.cdTracker.canUse(ogcd, this.nextGcdTime))
        ogcdsAvailable.forEach(ogcd => {
            if (this.canUseWithoutClipping(ogcd)) {
                if (ogcd.id === RiddleOfFire.id) {
                    this.advanceForLateWeave([ogcd]);
                }
                this.useOgcd(ogcd);
            }
        })
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
                // Tell the actor to use FiresReply after an opo
                // TODO FiresReply could be dropped if there isn't an Opo executed in its duration
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
                // Prefer to check if we need a solar nadi so that 2m windows sequence RP or PR first.
                if (!this.gauge.solarNadi) {
                    const gcd: FuryAbility = SOLAR_WEAKEST_STRONGEST
                        // remove abilities that don't generate the beast chakra we need
                        .filter((gcd: FuryAbility) => !this.gauge.beastChakra.includes(gcd.fury))
                        // remove abilities that we shouldn't use due to overcap/lack of balls
                        .filter((gcd: FuryAbility) => {
                            switch (gcd.fury) {
                                case "opo":
                                    if (gcd.buildsFury) {
                                        return this.gauge.opoFury == 0;
                                    } else {
                                        return this.gauge.opoFury != 0;
                                    }
                                case "raptor":
                                    if (gcd.buildsFury) {
                                        return this.gauge.raptorFury == 0;
                                    } else {
                                        return this.gauge.raptorFury != 0;
                                    }
                                case "coeurl":
                                    if (gcd.buildsFury) {
                                        return this.gauge.coeurlFury == 0;
                                    } else {
                                        return this.gauge.coeurlFury != 0;
                                    }
                            }
                        })
                        .shift();
                    if (!gcd) {
                        console.warn(`${this.currentTime} Building a solar nadi but couldn't choose a fury type to build`, this.gauge);
                        return DragonKick;
                    }
                    return gcd;
                } else {
                    // want a lunar nadi
                    if (this.gauge.opoFury) {
                        return LeapingOpo;
                    } else {
                        return DragonKick;
                    }
                }
            default:
                if (this.gauge.beastChakra.length === 3) {
                    // formless with a blitz ready
                    if (this.gauge.lunarNadi && this.gauge.solarNadi) {
                        // regardless of correct execution (Celestial Revolution) we get a phantom rush
                        return PhantomRush;
                    }

                    // TODO implement CelestialRevolution even though it should never be executed.
                    const s = new Set(this.gauge.beastChakra);
                    if (s.size === 1) {
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

    /** Any time perfect balance is used these buffs also need to be removed after every GCD */
    cleanupForms() {
        this.removeBuff(FormlessFist);
        this.removeBuff(OpoForm);
        this.removeBuff(RaptorForm);
        this.removeBuff(CoeurlForm);
    }

    shouldEnterBlitz(gcd: GcdAbility, form: Buff): boolean {
        const riddleReady = this.cdTracker.statusOf(RiddleOfFire).readyAt.relative;
        return OPO_ABILITIES.includes(gcd.id) // just executed an opo ability
            && form.statusId !== PerfectBalanceBuff.statusId // not already building a blitz
            && (riddleReady <= 7 // Within 3 gcds of RoF coming off cooldown
                // OR we're already in RoF and there's enough remaining time to land a blitz inside the current window
                || this.getActiveBuffs(this.currentTime + this.timeToExecuteNGcds(4)).find(buff => buff.statusId === RiddleOfFireBuff.statusId))
            && this.cdTracker.canUse(PerfectBalance)
    }

    /*
     *  Returns how long it takes to execute 4 gcds
     */
    timeToExecuteNGcds(n: number): number {
        return this.gcdTime(DragonKick) * n;
    }

    /** Advances to as late as possible.
     * NOTE: I'm adding an extra 20ms to each animation lock to make sure we don't hit anything that's impossible to achieve ingame.
     * Stolen from drk/rpr/vpr sim
     */
    advanceForLateWeave(weaves: OgcdAbility[]) {
        const pingAndServerDelayAdjustment = 0.02;
        const totalAnimLock = sum(weaves.map(ability => (ability.animationLock ?? STANDARD_ANIMATION_LOCK) + pingAndServerDelayAdjustment));
        const remainingtime = this.nextGcdTime - this.currentTime;

        if (totalAnimLock > remainingtime) {
            return;
        }

        this.advanceTo(this.currentTime + (remainingtime - totalAnimLock));
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
        return [
            {
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
            }
        ];
    }
}
