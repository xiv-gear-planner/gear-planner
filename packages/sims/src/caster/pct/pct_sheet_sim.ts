import {Ability, Buff, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    AbilityUseResult,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation
} from "@xivgear/sims/cycle_sim";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseMultiCycleSim} from "@xivgear/sims/processors/sim_processors";
import {PotionOptions} from "@xivgear/sims/common/medicine";
import {StarryMuse} from "@xivgear/sims/buffs";
import {Swiftcast} from "@xivgear/sims/common/swiftcast";
import {PctGaugeManager} from "./pct_gauge";
import * as Actions from "./pct_actions";
import * as Buffs from "./pct_buffs";
import {PctCreatureMotif, PctGaugeState} from "./pct_types";

export interface PctSimResult extends CycleSimResult<PctGaugeState> {
}

export type PctOpener = '2nd-gcd' | '3rd-gcd';

export interface PctSettings extends SimSettings, PotionOptions {
    /**
     * Which opener to use. The 2nd GCD Starry opener is the standard one, the 3rd GCD Starry opener
     * starts with a Holy in White before the first motif.
     */
    opener: PctOpener;
}

export interface PctSettingsExternal extends ExternalCycleSettings<PctSettings> {
}

export const pctSpec: SimSpec<PctSim, PctSettingsExternal> = {
    stub: "pct-sheet-sim",
    displayName: "PCT Sim",
    description: `Simulates a level 100 Pictomancer rotation.

Uses The Balance's 2nd GCD (or optionally 3rd GCD) Starry opener, then a priority-based rotation which keeps
Starry Muse, Striking Muse and the Living Muses on cooldown, paints motifs as they are needed, and holds
Comet in Black and portraits for the Starry Muse window.

If a potion is enabled, it is used in the opener and again in each burst window where it is available.`,
    makeNewSimInstance: function (): PctSim {
        return new PctSim();
    },
    loadSavedSimInstance: function (exported: PctSettingsExternal) {
        return new PctSim(exported);
    },
    supportedJobs: ['PCT'],
    supportedLevels: [100],
    isDefaultSim: true,
    maintainers: [{
        name: 'Quantumly',
        contact: [{
            type: 'discord',
            discordTag: 'quantumly',
            discordUid: '126321762483830785',
        }],
    }],
};

/**
 * How far ahead of Starry Muse coming off cooldown we start treating the rotation as "burst prep", i.e. we
 * stop spending resources which are better spent inside the buff window.
 */
const BURST_PREP_WINDOW = 20;

/**
 * How far ahead of Starry Muse coming off cooldown we stop using Subtractive Palette from the gauge, since the
 * free one from Starry Muse would overwrite any remaining stacks.
 */
const PRE_BURST_WINDOW = 12;

/**
 * How far ahead of Starry Muse coming off cooldown we hold a portrait (Mog of the Ages / Retribution of the
 * Madeen) so that it lands inside the buff window. Portraits are produced every other Living Muse, i.e. roughly
 * every 80 seconds, so holding for up to this long gets one into nearly every two-minute window.
 */
const PORTRAIT_HOLD_WINDOW = 60;

class PctCycleProcessor extends CycleProcessor<PctGaugeManager> {

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
    }

    override createGaugeManager(): PctGaugeManager {
        return new PctGaugeManager(this.stats.level);
    }

    override use(ability: Ability): AbilityUseResult {
        // Subtractive Palette is free while Subtractive Spectrum is active.
        if (ability.id === Actions.SubtractivePalette.id && this.hasBuff(Buffs.SubtractiveSpectrumBuff)) {
            return super.use(Actions.FreeSubtractivePalette);
        }
        return super.use(ability);
    }

    /**
     * The time at which the next GCD would actually be used. Decisions about which GCD to use should query buffs
     * at this time rather than the current time, since buffs can be applied (or expire) in between.
     */
    get gcdDecisionTime(): number {
        return Math.max(this.nextGcdTime, this.currentTime);
    }

    getBuff(buff: Buff, time: number = this.currentTime): Buff | undefined {
        return this.getActiveBuffs(time).find(b => b.statusId === buff.statusId);
    }

    hasBuff(buff: Buff, time: number = this.currentTime): boolean {
        return this.getBuff(buff, time) !== undefined;
    }

    buffStacks(buff: Buff, time: number = this.currentTime): number {
        return this.getBuff(buff, time)?.stacks ?? 0;
    }

    /**
     * Whether we are inside the Starry Muse window.
     *
     * @param time The time to check. Defaults to the current time.
     */
    inBurst(time: number = this.currentTime): boolean {
        return this.hasBuff(StarryMuse, time);
    }

    /**
     * Time until Starry Muse comes off cooldown. Zero if it is ready.
     */
    timeUntilStarry(): number {
        return this.cdTracker.statusOf(Actions.StarryMuseAction).readyAt.relative;
    }

    /**
     * Whether Starry Muse will be ready soon, so resources should be held for the burst window.
     */
    burstSoon(): boolean {
        return !this.inBurst() && this.timeUntilStarry() < BURST_PREP_WINDOW;
    }

    /**
     * Whether the fight will end before the given amount of time passes. Used to stop painting motifs
     * which could never be used.
     */
    fightEndsWithin(time: number): boolean {
        return this.remainingTime < time;
    }

    /**
     * The ability with its level modifiers applied. Cooldown queries must use this, since traits change the
     * number of charges.
     */
    leveled<X extends Ability>(ability: X): X {
        return this.applyLevelModifiers(ability) as X;
    }

    charges(ability: OgcdAbility): number {
        return this.cdTracker.statusOf(this.leveled(ability)).currentCharges;
    }

    /**
     * Whether an oGCD will have a charge available within the given number of seconds.
     */
    readyWithin(ability: OgcdAbility, time: number): boolean {
        return this.cdTracker.statusOf(this.leveled(ability)).readyAt.relative <= time;
    }

    /**
     * Whether an oGCD is ready now.
     */
    readyNow(ability: OgcdAbility): boolean {
        return this.isReady(this.leveled(ability));
    }

    /**
     * Whether an oGCD can be weaved before the next GCD without clipping it.
     */
    canWeave(ability: OgcdAbility): boolean {
        return this.canUseWithoutClipping(this.leveled(ability));
    }

    /**
     * The next spell of the RGB (or CMY) combo, based on the Aetherhues status.
     */
    nextAetherhueSpell(subtractive: boolean): GcdAbility {
        const time = this.gcdDecisionTime;
        if (this.hasBuff(Buffs.AetherhuesBMBuff, time)) {
            return subtractive ? Actions.Magenta : Actions.Blue;
        }
        else if (this.hasBuff(Buffs.AetherhuesGYBuff, time)) {
            return subtractive ? Actions.Yellow : Actions.Green;
        }
        else {
            return subtractive ? Actions.Cyan : Actions.Red;
        }
    }

    /**
     * The next hammer combo step, based on the remaining Hammer Time stacks.
     */
    nextHammer(): GcdAbility | null {
        const stacks = this.buffStacks(Buffs.HammerTimeBuff, this.gcdDecisionTime);
        if (stacks <= 0) {
            return null;
        }
        return Actions.HammerCombo[Actions.HammerCombo.length - Math.min(stacks, Actions.HammerCombo.length)];
    }

    /**
     * Whether we want to use Striking Muse now (assuming the hammer motif is painted). We want one usage in each
     * burst window, and the other roughly a minute later. Outside of that, only use it if we would otherwise
     * overcap charges.
     */
    wantStrikingMuse(): boolean {
        if (this.hasBuff(Buffs.HammerTimeBuff)) {
            return false;
        }
        const charges = this.charges(Actions.StrikingMuse);
        if (charges <= 0) {
            return false;
        }
        return this.inBurst() || charges >= 2 || this.timeUntilStarry() > 45;
    }

    /**
     * Whether we want to use the Living Muse now (assuming a creature motif is painted). Hold it for the burst
     * window when the window is close, unless charges would cap.
     */
    wantCreatureMuse(): boolean {
        const charges = this.charges(Actions.PomMuse);
        if (charges <= 0) {
            return false;
        }
        return this.inBurst() || charges >= 3 || !this.burstSoon();
    }

    /**
     * Whether we want to use the available portrait now. Portraits are held for the burst window if it is
     * close enough, so that nearly every window gets a Mog or Madeen.
     */
    wantPortrait(): boolean {
        if (this.gaugeManager.portrait === null) {
            return false;
        }
        return this.inBurst() || this.timeUntilStarry() > PORTRAIT_HOLD_WINDOW;
    }

    /**
     * Whether using the given creature muse would overwrite a portrait that we are holding for the burst window.
     */
    museWouldOverwritePortrait(motif: PctCreatureMotif): boolean {
        return (motif === 'wing' || motif === 'maw')
            && this.gaugeManager.portrait !== null
            && !this.wantPortrait();
    }
}

export class PctSim extends BaseMultiCycleSim<PctSimResult, PctSettings, PctCycleProcessor> {
    spec = pctSpec;
    shortName = "pct-sheet-sim";
    displayName = pctSpec.displayName;
    manuallyActivatedBuffs = [StarryMuse];

    constructor(settings?: PctSettingsExternal) {
        super('PCT', settings);
    }

    makeDefaultSettings(): PctSettings {
        return {
            usePotion: 'auto',
            opener: '2nd-gcd',
        };
    }

    protected createCycleProcessor(settings: MultiCycleSettings): PctCycleProcessor {
        return new PctCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    /**
     * Use an ability, fast-forwarding to when an oGCD is ready if it can still be used without clipping.
     */
    use(cp: PctCycleProcessor, ability: Ability | undefined): AbilityUseResult {
        if (!ability) {
            return 'none';
        }
        if (cp.remainingGcdTime <= 0) {
            return 'none';
        }
        if (ability.type === 'ogcd') {
            const leveled = cp.leveled(ability);
            const readyAt = cp.cdTracker.statusOf(leveled).readyAt.absolute;
            if (readyAt > cp.currentTime && cp.canUseWithoutClipping(leveled)) {
                cp.advanceTo(readyAt);
            }
        }
        return cp.use(ability);
    }

    /**
     * Use the equipped potion, if any.
     */
    usePotion(cp: PctCycleProcessor): AbilityUseResult {
        return this.use(cp, cp.medicinePotion);
    }

    private useStandardOpener(cp: PctCycleProcessor) {
        // Pre-pull: paint all three canvases, then hardcast Rainbow Drip so that it lands on the pull.
        this.use(cp, Actions.StarryMotif);
        this.use(cp, Actions.HammerMotif);
        this.use(cp, Actions.PomMotif);
        this.use(cp, Actions.RainbowDrip);
        this.usePotion(cp);
        this.use(cp, Actions.PomMuse);
        this.use(cp, Actions.StrikingMuse);
        this.use(cp, Actions.WingMotif);
        this.use(cp, Actions.StarryMuseAction);
        this.use(cp, Actions.SubtractivePalette);
        this.use(cp, Actions.HammerStamp);
        this.use(cp, Actions.Cyan);
        this.use(cp, Actions.Yellow);
        this.use(cp, Actions.Magenta);
        this.use(cp, Actions.Comet);
        this.use(cp, Actions.WingedMuse);
        this.use(cp, Actions.Mog);
        this.use(cp, Actions.StarPrism);
        this.use(cp, Actions.HammerBrush);
        this.use(cp, Actions.PolishingHammer);
        this.use(cp, Actions.RainbowDrip);
        this.use(cp, Swiftcast);
        this.use(cp, Actions.Red);
        this.use(cp, Actions.Green);
    }

    private useThirdGcdOpener(cp: PctCycleProcessor) {
        // Pre-pull: paint all three canvases, then hardcast Rainbow Drip so that it lands on the pull.
        this.use(cp, Actions.StarryMotif);
        this.use(cp, Actions.HammerMotif);
        this.use(cp, Actions.PomMotif);
        this.use(cp, Actions.RainbowDrip);
        this.use(cp, Actions.StrikingMuse);
        this.use(cp, Actions.Holy);
        this.usePotion(cp);
        this.use(cp, Actions.PomMuse);
        this.use(cp, Actions.WingMotif);
        this.use(cp, Actions.StarryMuseAction);
        this.use(cp, Actions.SubtractivePalette);
        this.use(cp, Actions.HammerStamp);
        this.use(cp, Actions.Cyan);
        this.use(cp, Actions.Yellow);
        this.use(cp, Actions.Magenta);
        this.use(cp, Actions.Comet);
        this.use(cp, Actions.WingedMuse);
        this.use(cp, Actions.Mog);
        this.use(cp, Actions.StarPrism);
        this.use(cp, Actions.HammerBrush);
        this.use(cp, Actions.PolishingHammer);
        this.use(cp, Actions.RainbowDrip);
        this.use(cp, Swiftcast);
        this.use(cp, Actions.Red);
        this.use(cp, Actions.ClawMotif);
        this.use(cp, Actions.ClawedMuse);
    }

    private useOpener(cp: PctCycleProcessor) {
        if (this.settings.opener === '3rd-gcd') {
            this.useThirdGcdOpener(cp);
        }
        else {
            this.useStandardOpener(cp);
        }
    }

    /**
     * Pick the highest priority oGCD that we would like to use right now, or null if there is none.
     *
     * @param cp The cycle processor
     * @returns The oGCD, and whether it is allowed to clip the GCD.
     */
    private chooseOgcd(cp: PctCycleProcessor): [OgcdAbility, boolean] | null {
        const gauge = cp.gaugeManager;
        // Starry Muse is the top priority, and is worth a small clip.
        if (gauge.starryCanvas && (cp.readyNow(Actions.StarryMuseAction) || cp.canWeave(Actions.StarryMuseAction))) {
            return [Actions.StarryMuseAction, true];
        }
        // The free Subtractive Palette from Starry Muse. Wait until any existing black paint has been used, otherwise
        // the Monochrome Tones it grants would be wasted.
        if (cp.hasBuff(Buffs.SubtractiveSpectrumBuff) && !gauge.monochrome) {
            return [Actions.SubtractivePalette, false];
        }
        // Potion in burst, or right before it.
        if (cp.medicinePotion
            && cp.canWeave(cp.medicinePotion)
            && (cp.inBurst() || cp.timeUntilStarry() <= 4)) {
            return [cp.medicinePotion, false];
        }
        // Striking Muse
        if (gauge.hammerCanvas && cp.wantStrikingMuse() && cp.canWeave(Actions.StrikingMuse)) {
            return [Actions.StrikingMuse, false];
        }
        // Mog / Madeen
        if (gauge.portrait !== null && cp.wantPortrait() && cp.canWeave(Actions.Mog)) {
            return [gauge.portrait === 'mog' ? Actions.Mog : Actions.Madeen, false];
        }
        // Living Muse
        if (gauge.creatureCanvas !== null
            && cp.wantCreatureMuse()
            && !cp.museWouldOverwritePortrait(gauge.creatureCanvas)
            && cp.canWeave(Actions.PomMuse)) {
            return [Actions.CreatureMuses[gauge.creatureCanvas], false];
        }
        // Subtractive Palette from gauge. Don't overwrite existing stacks, don't waste the Monochrome Tones if black
        // paint is still held, and don't use it right before a burst window, since the free one from Starry Muse
        // would overwrite the stacks. Overcapping the gauge is worse than any of those, though.
        if (gauge.palette >= 50
            && !cp.inBurst()
            && !cp.hasBuff(Buffs.SubtractivePaletteBuff)
            && (gauge.palette >= 100 || (!gauge.monochrome && cp.timeUntilStarry() > PRE_BURST_WINDOW))) {
            return [Actions.SubtractivePalette, false];
        }
        return null;
    }

    /**
     * Weave as many oGCDs as we can without clipping.
     */
    private useOgcds(cp: PctCycleProcessor) {
        // Two weaves is the normal maximum; a third attempt covers the case where the first was a clipping Starry Muse.
        for (let i = 0; i < 3; i++) {
            const choice = this.chooseOgcd(cp);
            if (choice === null) {
                return;
            }
            const [ability, allowClip] = choice;
            if (!allowClip && !cp.canWeave(ability)) {
                return;
            }
            if (this.use(cp, ability) === 'none') {
                return;
            }
        }
    }

    private chooseBurstGcd(cp: PctCycleProcessor): GcdAbility {
        const gauge = cp.gaugeManager;
        const time = cp.gcdDecisionTime;
        if (cp.hasBuff(Buffs.RainbowBrightBuff, time)) {
            return Actions.RainbowDrip;
        }
        // Comet first, so that the free Subtractive Palette can grant a second black paint.
        if (gauge.hasBlackPaint) {
            return Actions.Comet;
        }
        // Thunder in Magenta and Rainbow Drip both generate paint, so make room if needed.
        if (gauge.hasWhitePaint && gauge.paint >= 5) {
            return Actions.Holy;
        }
        // Subtractive spells while they are hasted, but make the last Hyperphantasia stack go to Star Prism (which
        // is also hasted and is the strongest spell), so that Rainbow Drip and the hammer combo still fit in the
        // window. Any leftover Subtractive stacks are used after the hammers.
        const hyperStacks = cp.buffStacks(Buffs.HyperphantasiaBuff, time);
        const saveLastStack = hyperStacks === 1 && cp.hasBuff(Buffs.StarstruckBuff, time);
        if (cp.hasBuff(Buffs.SubtractivePaletteBuff, time) && hyperStacks > 0 && !saveLastStack) {
            return cp.nextAetherhueSpell(true);
        }
        if (cp.hasBuff(Buffs.StarstruckBuff, time)) {
            return Actions.StarPrism;
        }
        const hammer = cp.nextHammer();
        if (hammer !== null) {
            return hammer;
        }
        if (cp.hasBuff(Buffs.SubtractivePaletteBuff, time)) {
            return cp.nextAetherhueSpell(true);
        }
        return cp.nextAetherhueSpell(false);
    }

    private chooseNormalGcd(cp: PctCycleProcessor): GcdAbility {
        const gauge = cp.gaugeManager;
        const endingSoon = cp.fightEndsWithin(12);
        const time = cp.gcdDecisionTime;
        if (cp.hasBuff(Buffs.RainbowBrightBuff, time)) {
            return Actions.RainbowDrip;
        }
        // Don't let Hammer Time expire.
        const hammer = cp.nextHammer();
        if (hammer !== null) {
            return hammer;
        }
        // Star Prism left over from a burst window (e.g. if the window was cut short).
        if (cp.hasBuff(Buffs.StarstruckBuff, time)) {
            return Actions.StarPrism;
        }
        // Never overcap paint: spend it before anything else generates more.
        if (gauge.paint >= 5) {
            return gauge.hasBlackPaint ? Actions.Comet : Actions.Holy;
        }
        if (!endingSoon) {
            // Starry Sky Motif needs to be ready when Starry Muse comes off cooldown.
            if (!gauge.starryCanvas
                && cp.timeUntilStarry() <= 30
                && !cp.fightEndsWithin(cp.timeUntilStarry() + 10)) {
                return Actions.StarryMotif;
            }
            // Hammer Motif, if we will want Striking Muse soon.
            if (!gauge.hammerCanvas
                && !cp.hasBuff(Buffs.HammerTimeBuff, time)
                && cp.readyWithin(Actions.StrikingMuse, 15)
                && (cp.wantStrikingMuse() || cp.burstSoon())) {
                return Actions.HammerMotif;
            }
            // Creature Motif, if a Living Muse charge is available or nearly so.
            if (gauge.creatureCanvas === null && cp.readyWithin(Actions.PomMuse, 10)) {
                return Actions.CreatureMotifs[gauge.nextCreature];
            }
        }
        // Subtractive spells are the best filler.
        if (cp.hasBuff(Buffs.SubtractivePaletteBuff, time)) {
            return cp.nextAetherhueSpell(true);
        }
        if (gauge.hasBlackPaint) {
            return Actions.Comet;
        }
        // Dump remaining paint at the end of the fight.
        if (gauge.hasWhitePaint && endingSoon) {
            return Actions.Holy;
        }
        return cp.nextAetherhueSpell(false);
    }

    private chooseGcd(cp: PctCycleProcessor): GcdAbility {
        if (cp.inBurst(cp.gcdDecisionTime)) {
            return this.chooseBurstGcd(cp);
        }
        return this.chooseNormalGcd(cp);
    }

    /**
     * One step of the rotation: weave any oGCDs which are wanted, then use the next GCD.
     */
    private rotationStep(cp: PctCycleProcessor) {
        this.useOgcds(cp);
        if (cp.remainingGcdTime <= 0) {
            return;
        }
        this.use(cp, this.chooseGcd(cp));
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<PctCycleProcessor>[] {
        const outer = this;
        return [{
            cycleTime: 120,
            apply(cp: PctCycleProcessor) {
                outer.useOpener(cp);
                cp.remainingCycles(() => {
                    outer.rotationStep(cp);
                });
            },
        }];
    }
}
