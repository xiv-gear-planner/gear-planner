import {Ability, Buff, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseMultiCycleSim, RotationCacheKey} from "@xivgear/core/sims/processors/sim_processors";
import {FuryAbility, MnkAbility, MNKExtraData, MnkGcdAbility, Opener} from "./mnk_types";
import {MNKGauge as MnkGauge} from "./mnk_gauge";
import {Brotherhood, BrotherhoodBuff, CelestialRevolution, CoeurlForm, Demolish, DragonKick, ElixirBurst, FiresReply, FiresRumination, ForbiddenMeditation, FormShift, FormlessFist, LeapingOpo, MeditativeBrotherhood, OGCD_PRIORITY, OPO_ABILITIES, OpoForm, PerfectBalance, PerfectBalanceBuff, PhantomRush, PouncingCoeurl, RaptorForm, RiddleOfFire, RiddleOfFireBuff, RiddleOfWind, RisingPhoenix, RisingRaptor, SOLAR_WEAKEST_STRONGEST, SixSidedStar, TheForbiddenChakra, TwinSnakes, WindsReply, WindsRumination} from "./mnk_actions";
import {Brotherhood as BrotherhoodGlobalBuff} from "@xivgear/core/sims/buffs";
import {sum} from "@xivgear/util/array_utils";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";

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

    // this shouldn't be changed after first initialization
    private opener: Opener;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.gauge = new MnkGauge();
    }

    setOpener(o: Opener) {
        if (this.opener) {
            console.warn("Attempted to change opener state");
            return;
        }
        this.opener = o;
    }

    override use(ability: Ability): AbilityUseResult {
        let mnkAbility = ability as MnkAbility;
        if (mnkAbility.id === SixSidedStar.id) {
            // MARK SixSidedStar chakra potency generation
            mnkAbility = {
                ...mnkAbility,
                potency: SixSidedStar.potency + Math.floor(this.gauge.chakra) * 80,
            };
        }
        if (mnkAbility.updateGauge) {
            mnkAbility.updateGauge(this.gauge, this.getCurrentForm(), this.combatStarted);
        }
        return super.use(mnkAbility);
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
            const probableChakraGain = usedAbility.ability.id === LeapingOpo.id && usedAbility.buffs.find(buff => [PerfectBalanceBuff.statusId, FormlessFist.statusId, OpoForm.statusId].includes(buff.statusId))
                ? 1
                : this.stats.critChance + usedAbility.combinedEffects.critChanceIncrease;
            const brotherhoodChakra = usedAbility.buffs.find(buff => buff.statusId === BrotherhoodBuff.statusId)
                ? 1
                : 0;
            const meditativeBhChakra = usedAbility.buffs.find(buff => buff.statusId === MeditativeBrotherhood.statusId)
                // 20% chance * 7 party members * our gcd ratio to party member gcds (Hint's suggestion)
                ? .2 * 7 * (this.timeToExecuteNGcds(1) / 2.5)
                : 0;
            this.gauge.gainChakra(probableChakraGain + brotherhoodChakra + meditativeBhChakra);
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

        // Now that all mandatory weaves are done, switch to doStep to handle automatically using TFC
        this.doStep(this.chooseBlitz());
        // use this gcd specifically as doStep decides to re-enter perfect balance here which is fine but with
        // hardcoding costs us a formless gcd from fires reply
        this.useGcd(DragonKick);
        this.doStep(WindsReply);
        this.doStep(FiresReply);
        this.doStep(LeapingOpo);
        this.doStep(DragonKick);
        this.doStep(LeapingOpo);
        this.doStep(DragonKick);
        this.doStep(this.chooseBlitz());
        this.doStep(LeapingOpo);
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

        // Now that all mandatory weaves are done, switch to doStep to handle automatically using TFC
        this.doStep(this.chooseBlitz());
        // use this gcd specifically as doStep decides to re-enter perfect balance here which is fine but with
        // hardcoding costs us a formless gcd from fires reply
        this.useGcd(DragonKick);
        this.doStep(WindsReply);
        this.doStep(FiresReply);
        this.doStep(LeapingOpo);

        // manual PB because
        this.cleanupForms();
        this.useOgcd(PerfectBalance);
        this.doStep(DragonKick);
        this.doStep(LeapingOpo);
        this.doStep(DragonKick);
        this.doStep(this.chooseBlitz());
        this.doStep(LeapingOpo);
    }

    /** gcd may be supplied by openers that want to have ogcd + buff handling done automatically */
    doStep(gcd?: MnkGcdAbility) {
        const form = this.getCurrentForm();
        gcd ??= this.chooseGcd();
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
                if (this.gauge.emptyNadis) {
                    // if we have no nadis we need to make a decision based on our opener goals
                    switch (this.opener) {
                        case "LL":
                            // an LL opener will have be empty during the 2nd blitz of a 2m burst window
                            // should use another lunar blitz (for PR > EB)
                            // want a lunar nadi
                            return this.opo;
                            break;
                        case "SL":
                            // an SL opener will have be empty during the 1st blitz of a 2m burst window
                            // should start sequencing a solar lunar blitz (RP > EB)
                            return this.sequenceSolarNadi();
                            break;
                    }
                }

                // we have existing gauge state
                if (!this.gauge.solarNadi) {
                    return this.sequenceSolarNadi();
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

    private sequenceSolarNadi(): MnkGcdAbility {
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
            const riddleWillFitBlitz = this.getActiveBuffs(this.currentTime + this.timeToExecuteNGcds(4)).find(buff => buff.statusId === RiddleOfFireBuff.statusId);
            return form?.statusId !== PerfectBalanceBuff.statusId // not already building a blitz
                && (OPO_ABILITIES.includes(gcd.id) // just executed an opo ability
                    // the fight is about to end and we need to blitz + SSS
                    // this condition will skip a formless-fist opo
                    || this.remainingGcdTime <= this.cdTracker.statusOf(PerfectBalance).currentCharges * this.timeToExecuteNGcds(5))
                && riddleWillFitBlitz
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
            if (this.gauge.fullNadis && this.opener === "SL") {
                // look for a +1 opo instead of a -2-0 opo
                // TODO the -3 umm ackshually window takes dragon kick sequencing in to account
                return false;
            }
            return form?.statusId !== PerfectBalanceBuff.statusId // not already building a blitz
                && OPO_ABILITIES.includes(gcd.id) // just executed an opo ability
                && riddleStatus.readyAt.relative <= this.timeToExecuteNGcds(4) // Within 4 gcds of RoF coming off cooldown (allows our blitz to fall first gcd under RoF)
                && this.cdTracker.canUse(PerfectBalance);
        }
    }

    /*
     *  Returns how long it takes to execute N gcds
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

    /**
     * It is rotationally important for monk abilities to be recorded with all of their buffs, and simulateSimple
     * doesn't store those for other sims as an optimization. We don't get that optimization.
     * This is because chakra gain is important to our DPS, and at the time of writing this is only recorded based
     * on the Buffs that are snapshotted in addAbilityUse.
     */
    override async simulateSimple(set: CharacterGearSet): Promise<number> {
        return (await this.simulate(set)).mainDpsResult;
    }

    /**
     * Because monk has a probabilistic chakra generation, the rotation changes due to crit chance.
     * Preserving crit chance at the same GCD tier leads to inaccurate DPS estimates.
     * This means monk sim doesn't get to use the cache behavior much at all.
     */
    protected computeCacheKey(set: CharacterGearSet): RotationCacheKey {
        return [set.computedStats.weaponDelay, set.computedStats.skillspeed, set.computedStats.critChance];
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<MNKCycleProcessor>[] {
        return [
            {
                name: 'double lunar',
                cycleTime: 120,
                apply(cp: MNKCycleProcessor) {
                    cp.setOpener("LL");
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
                    cp.setOpener("SL");
                    cp.solarLunarOpener();
                    while (cp.remainingGcdTime > 0) {
                        cp.doStep();
                    }
                },
            },
        ];
    }
}
