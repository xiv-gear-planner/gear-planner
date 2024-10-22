import { Ability, Buff, GcdAbility, OgcdAbility, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";
import { FuryAbility, MnkAbility, MNKExtraData, MnkGcdAbility } from "./mnk_types";
import { MNKGauge as MnkGauge } from "./mnk_gauge";
import { Brotherhood, BrotherhoodBuff, CelestialRevolution, CoeurlForm, Demolish, DragonKick, ElixirBurst, FiresReply, FiresRumination, ForbiddenMeditation, FormShift, FormlessFist, LeapingOpo, OGCD_PRIORITY, OPO_ABILITIES, OpoForm, PerfectBalance, PerfectBalanceBuff, PhantomRush, PouncingCoeurl, RaptorForm, RiddleOfFire, RiddleOfFireBuff, RiddleOfWind, RisingPhoenix, RisingRaptor, SOLAR_WEAKEST_STRONGEST, SixSidedStar, TheForbiddenChakra, TwinSnakes, WindsReply, WindsRumination } from "./mnk_actions";
import { Brotherhood as BrotherhoodGlobalBuff } from "@xivgear/core/sims/buffs";
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
        if (usedAbility.ability.type === 'gcd' && this.combatStarted) {
            const probableChakraGain = usedAbility.ability.id === LeapingOpo.id && usedAbility.buffs.find(buff => [PerfectBalanceBuff.statusId, OpoForm.statusId].includes(buff.statusId))
                ? 1
                : this.stats.critChance + usedAbility.combinedEffects.critChanceIncrease;
            const brotherhoodChakra = usedAbility.buffs.find(buff => buff.statusId === BrotherhoodBuff.statusId)
                ? 1
                : 0;
            this.gauge.chakra += probableChakraGain + brotherhoodChakra;
        }
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
        this.useGcd(this.chooseBlitz());
        this.useGcd(DragonKick);
        this.useGcd(WindsReply);
        this.useGcd(FiresReply);
        this.useGcd(LeapingOpo);
        this.cleanupForms();
        this.useOgcd(PerfectBalance);
        this.useGcd(DragonKick); this.cleanupForms();
        this.useGcd(LeapingOpo); this.cleanupForms();
        this.useGcd(DragonKick); this.cleanupForms();
        this.useGcd(this.chooseBlitz());
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
        this.useGcd(this.chooseBlitz());
        this.useGcd(DragonKick);
        this.useGcd(WindsReply);
        this.useGcd(FiresReply);
        this.useGcd(LeapingOpo);
        this.cleanupForms();
        this.useOgcd(PerfectBalance);
        this.useGcd(DragonKick); this.cleanupForms();
        this.useGcd(LeapingOpo); this.cleanupForms();
        this.useGcd(DragonKick); this.cleanupForms();
        this.useGcd(this.chooseBlitz());
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

        const ogcdsAvailable: OgcdAbility[] = OGCD_PRIORITY.filter((ogcd: OgcdAbility) => {
            if (ogcd.id === TheForbiddenChakra.id) {
                return this.gauge.chakra >= 5 && this.cdTracker.canUse(ogcd, this.nextGcdTime);
            }
            return this.cdTracker.canUse(ogcd, this.nextGcdTime);
        });
        ogcdsAvailable.forEach(ogcd => {
            if (this.canUseWithoutClipping(ogcd)) {
                if (ogcd.id === RiddleOfFire.id) {
                    // TODO implement RoF holding
                    this.advanceForLateWeave([ogcd]);
                }
                this.useOgcd(ogcd);
            }
        });
    }

    get opo(): MnkGcdAbility {
        if (this.gauge.opoFury) {
            return LeapingOpo;
        }
        return DragonKick;
    }
    get raptor(): MnkGcdAbility {
        if (this.gauge.raptorFury) {
            return RisingRaptor;
        }
        return TwinSnakes;
    }

    get coeurl(): MnkGcdAbility {
        if (this.gauge.coeurlFury) {
            return PouncingCoeurl;
        }
        return Demolish;
    }

    chooseGcd(): MnkGcdAbility {
        if (this.getActiveBuffs().find(buff => buff.statusId === WindsRumination.statusId)) {
            return WindsReply;
        }
        if (this.remainingGcds(DragonKick) <= 1) {
            // last GCD of a fight
            return SixSidedStar;
        }
        switch (this.getCurrentForm()?.statusId) {
            case OpoForm.statusId:
            case FormlessFist.statusId:
                return this.opo;
            case RaptorForm.statusId:
                // Tell the actor to use FiresReply after an opo
                // TODO FiresReply could be dropped if there isn't an Opo executed in its duration
                if (this.getActiveBuffs().find(buff => buff.statusId === FiresRumination.statusId)) {
                    return FiresReply;
                }
                return this.raptor;
            case CoeurlForm.statusId:
                return this.coeurl;
            case PerfectBalanceBuff.statusId:
                /* TODO this conditional does not optimally sequence a 0 nadi naked blitz at the end of the fight
                 * it picks a lunar solar window when a double lunar would have higher expected potency at 100
                 */

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
                                        return this.gauge.opoFury === 0;
                                    }
                                    else {
                                        return this.gauge.opoFury !== 0;
                                    }
                                case "raptor":
                                    if (gcd.buildsFury) {
                                        return this.gauge.raptorFury === 0;
                                    }
                                    else {
                                        return this.gauge.raptorFury !== 0;
                                    }
                                case "coeurl":
                                    if (gcd.buildsFury) {
                                        return this.gauge.coeurlFury === 0;
                                    }
                                    else {
                                        return this.gauge.coeurlFury !== 0;
                                    }
                            }
                        })
                        .shift();
                    if (!gcd) {
                        console.warn(`${this.currentTime} Building a solar nadi but couldn't choose a fury type to build`, this.gauge);
                        return DragonKick;
                    }
                    return gcd;
                }
                else {
                    // want a lunar nadi
                    return this.opo;
                }
            default:
                if (this.gauge.beastChakra.length === 3) {
                    // formless with a blitz ready
                    return this.chooseBlitz();
                }
                console.warn("Infinite looping with no form");
                // formless DK but this should never happen
                return DragonKick;
        }
    }

    chooseBlitz(): MnkGcdAbility {
        if (this.gauge.lunarNadi && this.gauge.solarNadi) {
            // regardless of correct execution (Celestial Revolution) we get a phantom rush
            return PhantomRush;
        }

        const s = new Set(this.gauge.beastChakra);
        switch (s.size) {
            case 1:
                return ElixirBurst;
            case 2:
                return CelestialRevolution;
            case 3:
                return RisingPhoenix;
        }
        console.warn(`${this.currentTime} failed to select a blitz, choosing celestial revolution for punishment.`);
        return CelestialRevolution;
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
        const riddleActive = this.getActiveBuffs().find(buff => buff.statusId === RiddleOfFireBuff.statusId);
        const riddleStatus = this.cdTracker.statusOf(RiddleOfFire);
        if (riddleActive) {
            // we are in a burst window
            return form?.statusId !== PerfectBalanceBuff.statusId // not already building a blitz
                && (OPO_ABILITIES.includes(gcd.id) // just executed an opo ability
                    // the fight is about to end and we need to blitz + SSS
                    // this condition will skip a formless-fist opo
                    || this.remainingGcdTime <= this.cdTracker.statusOf(PerfectBalance).currentCharges * this.timeToExecuteNGcds(5))
                && this.cdTracker.canUse(PerfectBalance);
        }
        else if (riddleStatus.readyAt.absolute >= this.totalTime) {
            // riddle won't be back before the end of the fight, we should do a naked blitz
            return form?.statusId !== PerfectBalanceBuff.statusId // not already building a blitz
                && ((OPO_ABILITIES.includes(gcd.id) // just executed an opo ability
                    // the fight is about to end and we need to blitz + SSS
                    // this condition will skip a formless-fist opo
                    || this.remainingGcdTime <= this.cdTracker.statusOf(PerfectBalance).currentCharges * this.timeToExecuteNGcds(5))
                    && this.cdTracker.canUse(PerfectBalance));
        }
        else {
            // riddle will be back or is currently off cooldown
            return form?.statusId !== PerfectBalanceBuff.statusId // not already building a blitz
                && OPO_ABILITIES.includes(gcd.id) // just executed an opo ability
                // TODO odd minute lunar nadi windows should look for a +1 opo not a -3 thru 0 opo
                && riddleStatus.readyAt.relative <= this.timeToExecuteNGcds(3) // Within 3 gcds of RoF coming off cooldown
                && this.cdTracker.canUse(PerfectBalance);
        }
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
    cycleSettings: CycleSettings = this.defaultCycleSettings();
    manuallyActivatedBuffs = [BrotherhoodGlobalBuff];

    constructor(settings?: MnkSettingsExternal) {
        super('MNK', settings);
    }

    override makeDefaultSettings(): MnkSettings {
        return {};
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
                    while (cp.remainingGcdTime > 0) {
                        cp.doStep();
                    }
                },
            },
            {
                name: 'solar lunar',
                cycleTime: 120,
                apply(cp: MNKCycleProcessor) {
                    cp.solarLunarOpener();
                    while (cp.remainingGcdTime > 0) {
                        cp.doStep();
                    }
                },
            },
        ];
    }
}
