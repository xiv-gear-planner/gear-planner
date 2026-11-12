import {Ability, Buff, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {abilityToDamageNew, combineBuffEffects, noBuffEffects} from "@xivgear/core/sims/sim_utils";
import {CAST_SNAPSHOT_PRE, CASTER_TAX, STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
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
import {animationLock} from "@xivgear/sims/ability_helpers";
import {PctGaugeManager} from "./pct_gauge";
import * as Actions from "./pct_actions";
import * as Buffs from "./pct_buffs";
import {CREATURE_MOTIFS, PctCreatureMotif, PctGaugeState, PctPortrait} from "./pct_types";
import {MAX_PAINT, MAX_PALETTE, SUBTRACTIVE_PALETTE_COST} from "./pct_consts";

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

Uses The Balance's 2nd GCD (or optionally 3rd GCD) Starry opener. After that, the filler is priority-based, and each
Starry Muse window is set up the way The Balance recommends: Subtractive Palette is banked and used before Starry Muse,
the window starts with a hardcast subtractive spell, and nine GCDs are fit inside the buff, with a portrait and a
Living Muse.

50 palette gauge is always kept in reserve for the next window. To line Starry Muse up with its cooldown, the sim
varies how many subtractive spells and creature motifs go before the window. Since there is no movement to account
for, Holy in White is only used at the end of the fight. Swiftcast is used when it gets a spell into a raid buff or
potion which it would otherwise miss.

The last minute of the fight is planned out so that the gauge and paint are used up, and no motif is painted unless it
pays off before the end.

If a potion is enabled, it is used in the opener and again right before each burst window where it is available.`,
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
 * How far ahead of Starry Muse coming off cooldown we hold Retribution of the Madeen so that it lands inside the
 * buff window. Fanged Muse comes up roughly 80 seconds before the windows it can be held for, and holding the
 * portrait costs nothing as long as it is used before the next Winged Muse.
 */
const MADEEN_HOLD_WINDOW = 90;

/**
 * Like {@link MADEEN_HOLD_WINDOW}, but for Mog of the Ages. This is shorter so that a Mog is not held through
 * a period where a Madeen could have been lined up instead.
 */
const MOG_HOLD_WINDOW = 60;

/**
 * Extra time, on top of the animation lock, which must be left before the next GCD in order to weave an oGCD.
 * Real animation locks are 0.62-0.67s plus latency rather than the nominal 0.6s. This prevents things like double
 * weaving after a hasted Star Prism, or weaving after a hasted hardcast, neither of which is possible in practice.
 */
const WEAVE_MARGIN = 0.1;

/**
 * The most oGCDs we will weave between two GCDs.
 */
const MAX_WEAVES = 2;

/**
 * The longest allowed time between using Starry Muse and the start of the following GCD. Nine GCDs take about
 * 19.3s from the start of the first to the start of the last, so Starry Muse has to be weaved late in order for the
 * ninth to still be buffed.
 */
const STARRY_MAX_LEAD = 1.25;

/**
 * How far ahead of the burst window we start planning the exact GCDs leading into it. The further ahead, the more
 * combinations of GCD lengths there are to choose from, and so the closer Starry Muse can be lined up.
 */
const ENTRY_HORIZON = 24;

/**
 * How many seconds of Starry Muse delay it is considered to be worth to avoid overcapping the palette gauge when
 * lining up the burst window.
 */
const ENTRY_OVERCAP_COST = 1.5;

/**
 * How many seconds of Starry Muse delay it is considered to be worth to have a portrait (Mog of the Ages or
 * Retribution of the Madeen) inside the burst window. This is high enough that a portrait is never given up.
 */
const ENTRY_NO_PORTRAIT_COST = 10;

/**
 * How far ahead of Starry Muse coming off cooldown we stop using Living Muse charges as they come up. From then on,
 * the lead-up to the burst window decides whether a banked charge is used before the window or after it, since
 * that moves a four second motif to one side or the other.
 */
const MUSE_HOLD_WINDOW = 60;

/**
 * How far ahead of Starry Muse coming off cooldown the potion is used.
 */
const POTION_LEAD = 7;

/**
 * How much of the fight has to be left when Starry Muse comes off cooldown for the burst window to be worth setting
 * up. With less than this, too little of the window fits to make up for the motifs painted for it and for what gets
 * held back for it, so the rest of the fight is treated as its end instead.
 */
const MIN_BURST_LENGTH = 20;

/**
 * If the fight ends less than this long after Starry Muse comes off cooldown, then the burst window is all that is
 * left of the fight: the nine GCDs of the window take about 22 seconds, and anything which was saved for after it
 * needs a few more GCDs on top of that.
 */
const LAST_BURST_ONLY = 30;

/**
 * Like {@link LAST_BURST_ONLY}, but for palette gauge which is left over going into the window. This is longer, since
 * the stacks from the free Subtractive Palette have to be used up after the window before any more gauge can be
 * spent.
 */
const LAST_BURST_GAUGE = 40;

/**
 * How far before the end of the fight the remaining GCDs get planned out, so that resources are used up rather
 * than left over. A Living Muse charge takes 40 seconds to come back, so this has to be long enough to see whether
 * a Pom or Claw Motif can still be followed up by the Wing or Maw Motif which gives the portrait.
 */
const ENDING_HORIZON = 60;

/**
 * At the end of the fight, how much potency a Pom or Claw Motif must gain over not painting it if it does not lead
 * to a portrait. Without the portrait, the Living Muse is worth about as much as the filler which the motif
 * replaces, so it could otherwise get painted just because of how the last GCD happens to line up with the end.
 */
const ENDING_NO_PORTRAIT_COST = 300;

/**
 * The kinds of GCD which can be used while lining up the burst window.
 */
type EntryAction = 'subtractive' | 'aetherhue' | 'comet' | 'hammer' | 'motif';

// In order of preference, if they work out equally well
const ENTRY_ACTIONS: readonly EntryAction[] = ['hammer', 'motif', 'subtractive', 'comet', 'aetherhue'];

/**
 * A lightweight copy of the state which matters when lining up the burst window.
 */
type EntryState = {
    /**
     * When the next GCD starts
     */
    time: number,
    /**
     * Subtractive Palette stacks
     */
    stacks: number,
    palette: number,
    paint: number,
    monochrome: boolean,
    /**
     * Position in the aetherhue combo: 0 = Fire/Blizzard next, 1 = Aero/Stone next, 2 = Water/Thunder next.
     */
    hue: number,
    /**
     * Remaining Hammer Time stacks
     */
    hammers: number,
    /**
     * Motifs which still need to be painted for the window
     */
    motifs: number,
    /**
     * Creature motifs which can optionally be painted on top of that, by using a banked Living Muse charge before
     * the window rather than after it.
     */
    extraMotifs: number,
};

/**
 * How long a kind of GCD takes: its recast, and how much of that is spent casting or animation locked.
 */
type EntryTiming = {
    recast: number,
    lock: number,
};

type EntryStep = {
    state: EntryState,
    /**
     * Whether Subtractive Palette has to be weaved before this GCD.
     */
    usedPalette: boolean,
    /**
     * Whether this is an optional extra creature motif.
     */
    usedExtraMotif: boolean,
    /**
     * Whether the GCD is instant, i.e. leaves room for a double weave.
     */
    instant: boolean,
    /**
     * How long there is to weave between the GCD's cast or animation lock and the next GCD.
     */
    weaveTime: number,
    cost: number,
};

/**
 * The next GCD to use when lining up the burst window.
 */
type EntryPlan = {
    first: EntryAction,
    /**
     * Whether Subtractive Palette should be weaved before that GCD.
     */
    paletteBeforeFirst: boolean,
    /**
     * Whether a banked Living Muse charge should be used before the window, with another creature motif painted
     * afterwards for the muse which goes inside the window.
     */
    museBeforeBurst: boolean,
};

/**
 * The kinds of GCD which can be used at the end of the fight.
 */
type EndingAction = 'hammer' | 'comet' | 'subtractive' | 'holy' | 'aetherhue' | 'hammerMotif' | 'creatureMotif';

/**
 * A lightweight copy of the state which matters when planning the end of the fight.
 */
type EndingState = {
    /**
     * When the next GCD starts
     */
    time: number,
    /**
     * How many oGCDs can still be weaved before that GCD
     */
    weaves: number,
    /**
     * Subtractive Palette stacks
     */
    stacks: number,
    palette: number,
    paint: number,
    monochrome: boolean,
    /**
     * Position in the aetherhue combo: 0 = Fire/Blizzard next, 1 = Aero/Stone next, 2 = Water/Thunder next.
     */
    hue: number,
    /**
     * Remaining Hammer Time stacks
     */
    hammers: number,
    hammerCanvas: boolean,
    /**
     * Index of the painted creature motif in the creature sequence, or -1 if the canvas is empty.
     */
    creature: number,
    /**
     * Index of the next creature motif to paint.
     */
    nextCreature: number,
    portrait: PctPortrait | null,
    /**
     * When the portrait cooldown (shared by Mog of the Ages and Retribution of the Madeen) is ready.
     */
    portraitReadyAt: number,
    livingCharges: number,
    /**
     * When the next Living Muse charge comes back. Infinity if charges are capped.
     */
    livingNextAt: number,
    strikingCharges: number,
    /**
     * When the next Striking Muse charge comes back. Infinity if charges are capped.
     */
    strikingNextAt: number,
};

type EndingStep = {
    state: EndingState,
    /**
     * Expected damage of the GCD and of the oGCDs weaved after it
     */
    gained: number,
    /**
     * Whether Subtractive Palette has to be weaved before this GCD.
     */
    usedPalette: boolean,
};

/**
 * When motifs get painted at the end of the fight: once their muse is ready, early enough that the motif is done
 * right as the muse comes off cooldown, or only between subtractive spells. The muse and the portrait take up weave
 * slots, which Subtractive Palette does not need while its stacks are still up.
 */
type EndingMotifTiming = 'ready' | 'early' | 'stacks';

const ENDING_MOTIF_TIMINGS: readonly EndingMotifTiming[] = ['ready', 'early', 'stacks'];

/**
 * What to still fit in before the end of the fight.
 */
type EndingTargets = {
    /**
     * How many more times to use Subtractive Palette
     */
    palettes: number,
    hammerMotifs: number,
    creatureMotifs: number,
    motifTiming: EndingMotifTiming,
};

/**
 * The next GCD to use at the end of the fight.
 */
type EndingPlan = {
    first: EndingAction,
    /**
     * Whether Subtractive Palette should be weaved before that GCD.
     */
    paletteBeforeFirst: boolean,
};

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
        // Rainbow Drip under Rainbow Bright. Its recast is not a normal 2.5s GCD: it is the usual spell speed
        // adjusted recast of Rainbow Drip, minus 3.5 seconds.
        if (ability.id === Actions.RainbowDrip.id && this.hasBuff(Buffs.RainbowBrightBuff, this.gcdDecisionTime)) {
            const recast = Math.round((this.gcdTime(Actions.RainbowDrip) - 3.5) * 100) / 100;
            const enhanced: GcdAbility = {
                ...Actions.RainbowDrip,
                cast: 0,
                gcd: recast,
                fixedGcd: true,
            };
            return super.use(enhanced);
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
     * The time at which Starry Muse comes off cooldown. The current time if it is ready.
     */
    starryReadyAt(): number {
        return this.cdTracker.statusOf(Actions.StarryMuseAction).readyAt.absolute;
    }

    /**
     * Whether there will be another Starry Muse window before the fight ends.
     */
    burstComing(): boolean {
        return this.starryReadyAt() + MIN_BURST_LENGTH < this.totalTime;
    }

    /**
     * Whether the fight ends during the next burst window or soon after it, so that things left over after the
     * window go unused.
     *
     * @param within How long after Starry Muse comes off cooldown the fight has to end for this to be the case
     */
    fightEndsAfterBurst(within: number = LAST_BURST_ONLY): boolean {
        return this.burstComing() && this.totalTime - this.starryReadyAt() < within;
    }

    /**
     * Whether Starry Muse will be ready soon, so resources should be held for the burst window.
     */
    burstSoon(): boolean {
        return !this.inBurst() && this.burstComing() && this.timeUntilStarry() < BURST_PREP_WINDOW;
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
     * When the next charge of an oGCD comes back. Infinity if its charges are capped.
     */
    nextChargeAt(ability: OgcdAbility): number {
        const leveled = this.leveled(ability);
        const cooldown = leveled.cooldown;
        const status = this.cdTracker.statusOf(leveled);
        const missing = (cooldown.charges ?? 1) - status.currentCharges;
        if (missing <= 0) {
            return Number.POSITIVE_INFINITY;
        }
        return status.cappedAt.absolute - (missing - 1) * cooldown.time;
    }

    /**
     * Whether an oGCD will have a charge available within the given number of seconds.
     */
    readyWithin(ability: OgcdAbility, time: number): boolean {
        return this.cdTracker.statusOf(this.leveled(ability)).readyAt.relative <= time;
    }

    /**
     * Whether an oGCD can be weaved before the next GCD without clipping it, with a realistic margin.
     *
     * @param ability The oGCD
     * @param weavesAfter How many more oGCDs need to fit after this one
     */
    canWeave(ability: OgcdAbility, weavesAfter: number = 0): boolean {
        const leveled = this.leveled(ability);
        const readyAt = this.cdTracker.statusOf(leveled).readyAt.absolute;
        const lockTime = animationLock(leveled) * (1 + weavesAfter);
        return readyAt <= this.totalTime && readyAt + lockTime + WEAVE_MARGIN <= this.nextGcdTime;
    }

    /**
     * Position in the aetherhue combo: 0 = Fire/Blizzard next, 1 = Aero/Stone next, 2 = Water/Thunder next.
     */
    aetherhue(time: number = this.gcdDecisionTime): number {
        if (this.hasBuff(Buffs.AetherhuesBMBuff, time)) {
            return 2;
        }
        else if (this.hasBuff(Buffs.AetherhuesGYBuff, time)) {
            return 1;
        }
        return 0;
    }

    /**
     * The next spell of the RGB (or CMY) combo, based on the Aetherhues status.
     */
    nextAetherhueSpell(subtractive: boolean): GcdAbility {
        switch (this.aetherhue()) {
            case 2:
                return subtractive ? Actions.Magenta : Actions.Blue;
            case 1:
                return subtractive ? Actions.Yellow : Actions.Green;
            default:
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
     * How many RGB casts it takes to generate the given amount of palette gauge.
     */
    rgbCastsToGain(palette: number): number {
        if (palette <= 0) {
            return 0;
        }
        const castsUntilBlue = 3 - this.aetherhue();
        return castsUntilBlue + (Math.ceil(palette / 25) - 1) * 3;
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
        return this.inBurst() || !this.burstComing() || charges >= 2 || this.timeUntilStarry() > 45;
    }

    /**
     * Whether we want to use the Living Muse now (assuming a creature motif is painted). When the burst window is
     * getting close, charges are banked instead, unless they would cap.
     */
    wantCreatureMuse(): boolean {
        const charges = this.charges(Actions.PomMuse);
        if (charges <= 0) {
            return false;
        }
        return this.inBurst() || charges >= 3 || !this.burstComing() || this.timeUntilStarry() >= MUSE_HOLD_WINDOW;
    }

    /**
     * How many Living Muse charges will be available after the given number of seconds, if none are used.
     */
    livingMuseChargesIn(time: number): number {
        const muse = this.leveled(Actions.PomMuse);
        const untilCapped = this.cdTracker.statusOf(muse).cappedAt.relative;
        const missing = Math.ceil(Math.max(0, untilCapped - time) / muse.cooldown.time);
        return Math.max(0, muse.cooldown.charges - missing);
    }

    /**
     * Whether we want to use the available portrait now. Portraits are held for the burst window if it is
     * close enough. Madeen is held for longer than Mog, which results in Madeen being used in most windows.
     */
    wantPortrait(): boolean {
        const portrait = this.gaugeManager.portrait;
        if (portrait === null) {
            return false;
        }
        if (this.inBurst() || !this.burstComing()) {
            return true;
        }
        return this.timeUntilStarry() > (portrait === 'madeen' ? MADEEN_HOLD_WINDOW : MOG_HOLD_WINDOW);
    }

    /**
     * Whether using the given creature muse would overwrite a portrait which has not been used yet.
     */
    museWouldOverwritePortrait(motif: PctCreatureMotif): boolean {
        return (motif === 'wing' || motif === 'maw') && this.gaugeManager.portrait !== null;
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
            // Starry Muse is weaved late, so that nine GCDs fit inside its duration.
            if (ability.id === Actions.StarryMuseAction.id) {
                const latestStart = cp.nextGcdTime - STARRY_MAX_LEAD;
                if (latestStart > cp.currentTime) {
                    cp.advanceTo(latestStart);
                }
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

    /**
     * The part of the opener which is common to both variants, starting with Wing Motif.
     */
    private useOpenerBurst(cp: PctCycleProcessor) {
        this.use(cp, Actions.WingMotif);
        this.use(cp, Actions.StarryMuseAction);
        this.use(cp, Actions.HammerStamp);
        this.use(cp, Actions.SubtractivePalette);
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
        this.use(cp, Actions.Red);
        this.use(cp, Actions.Swiftcast);
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
        this.useOpenerBurst(cp);
        // Swiftcast gets this into the potion.
        this.use(cp, Actions.Green);
    }

    private useThirdGcdOpener(cp: PctCycleProcessor) {
        // Pre-pull: paint all three canvases, then hardcast Rainbow Drip so that it lands on the pull.
        this.use(cp, Actions.StarryMotif);
        this.use(cp, Actions.HammerMotif);
        this.use(cp, Actions.PomMotif);
        this.use(cp, Actions.RainbowDrip);
        // Striking Muse can only be used in combat, i.e. once Rainbow Drip has landed.
        if (cp.currentTime < 0) {
            cp.advanceTo(0);
        }
        this.use(cp, Actions.StrikingMuse);
        this.use(cp, Actions.Holy);
        this.usePotion(cp);
        this.use(cp, Actions.PomMuse);
        this.useOpenerBurst(cp);
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
     * The motifs which still have to be painted before the next burst window, so that it has Starry Muse, a hammer
     * combo and a Living Muse.
     */
    private pendingBurstMotifs(cp: PctCycleProcessor): GcdAbility[] {
        const gauge = cp.gaugeManager;
        const untilStarry = cp.timeUntilStarry();
        const motifs: GcdAbility[] = [];
        if (!gauge.hammerCanvas
            && !cp.hasBuff(Buffs.HammerTimeBuff, cp.gcdDecisionTime)
            && cp.readyWithin(Actions.StrikingMuse, untilStarry + 10)) {
            motifs.push(Actions.HammerMotif);
        }
        if (!gauge.starryCanvas) {
            motifs.push(Actions.StarryMotif);
        }
        // If the fight ends right after the window, a Pom or Claw Motif is not worth painting for it, since there
        // is no time left for the Wing or Maw Motif which would give the portrait.
        const leadsNowhere = cp.fightEndsAfterBurst() && (gauge.nextCreature === 'pom' || gauge.nextCreature === 'claw');
        if (gauge.creatureCanvas === null && !leadsNowhere && cp.readyWithin(Actions.PomMuse, untilStarry + 10)) {
            motifs.push(Actions.CreatureMotifs[gauge.nextCreature]);
        }
        return motifs;
    }

    /**
     * Apply one GCD to the planning state.
     *
     * @param state The state before the GCD
     * @param action The kind of GCD
     * @param timings The recast and cast/lock time of each kind of GCD
     * @param canWeavePalette Whether Subtractive Palette can be weaved before this GCD
     * @returns The resulting step, or null if the GCD cannot be used in this state
     */
    private applyEntryAction(state: EntryState, action: EntryAction, timings: Record<EntryAction, EntryTiming>,
                             canWeavePalette: boolean): EntryStep | null {
        const timing = timings[action];
        const next: EntryState = {
            ...state,
            time: state.time + timing.recast,
        };
        let usedPalette = false;
        let usedExtraMotif = false;
        let instant = false;
        let cost = 0;
        switch (action) {
            case 'subtractive':
                if (next.stacks === 0) {
                    // Needs Subtractive Palette first. Using it with black paint still held would waste that paint.
                    if (!canWeavePalette || next.palette < SUBTRACTIVE_PALETTE_COST || next.monochrome) {
                        return null;
                    }
                    next.palette -= SUBTRACTIVE_PALETTE_COST;
                    next.stacks = 3;
                    next.monochrome = true;
                    usedPalette = true;
                }
                next.stacks -= 1;
                next.hue = (next.hue + 1) % 3;
                if (next.hue === 0) {
                    next.paint += 1;
                }
                break;
            case 'aetherhue':
                // RGB cannot be cast under Subtractive Palette
                if (next.stacks > 0) {
                    return null;
                }
                next.hue = (next.hue + 1) % 3;
                if (next.hue === 0) {
                    next.paint += 1;
                    next.palette += 25;
                    if (next.palette > MAX_PALETTE) {
                        next.palette = MAX_PALETTE;
                        // Wasted gauge
                        cost += ENTRY_OVERCAP_COST;
                    }
                }
                break;
            case 'comet':
                if (!next.monochrome || next.paint < 1) {
                    return null;
                }
                next.paint -= 1;
                next.monochrome = false;
                instant = true;
                break;
            case 'hammer':
                if (next.hammers < 1) {
                    return null;
                }
                next.hammers -= 1;
                instant = true;
                break;
            case 'motif':
                if (next.motifs > 0) {
                    next.motifs -= 1;
                }
                else if (next.extraMotifs > 0) {
                    next.extraMotifs -= 1;
                    usedExtraMotif = true;
                }
                else {
                    return null;
                }
                break;
        }
        return {
            state: next,
            usedPalette: usedPalette,
            usedExtraMotif: usedExtraMotif,
            instant: instant,
            weaveTime: timing.recast - timing.lock,
            cost: cost,
        };
    }

    /**
     * How undesirable it is to weave Starry Muse after a GCD which leaves us in the given state. The penalty is
     * expressed in seconds of Starry Muse delay which would be an acceptable price for avoiding it.
     *
     * The ideal is to have Subtractive Palette stacks left, so that the window starts with a hardcast subtractive
     * spell, as well as a Comet in Black after which the free Subtractive Palette can be weaved.
     *
     * @param state The state after the last GCD before the window
     * @param instant Whether that GCD was instant
     * @returns The penalty, and whether Subtractive Palette would have to be weaved together with Starry Muse
     */
    private entryOutcome(state: EntryState, instant: boolean): { penalty: number, doubleWeave: boolean } {
        const single = (penalty: number) => ({
            penalty: penalty,
            doubleWeave: false,
        });
        let penalty = 0;
        // Everything for the window has to be painted, and a hammer combo from earlier has to be finished first:
        // Striking Muse is used again inside the window, so that the whole combo is buffed.
        if (state.motifs > 0 || state.hammers > 0) {
            penalty += 20;
        }
        if (state.stacks > 0) {
            // Will there be black paint once the stacks have been used?
            const castsUntilMagenta = 3 - state.hue;
            if (!state.monochrome || (state.paint < 1 && castsUntilMagenta > state.stacks)) {
                return single(penalty + 1.5);
            }
            // Two stacks left means that two Comets and the two strongest subtractive spells fit in the window.
            switch (state.stacks) {
                case 2:
                    return single(penalty);
                case 1:
                    return single(penalty + 0.02);
                default:
                    return single(penalty + 0.04);
            }
        }
        // After an instant GCD, Subtractive Palette and Starry Muse can be double weaved.
        if (instant && state.palette >= SUBTRACTIVE_PALETTE_COST && !state.monochrome) {
            return {
                penalty: penalty + 0.04,
                doubleWeave: true,
            };
        }
        // Otherwise the window has to start with an instant GCD, to weave the free Subtractive Palette.
        return single(penalty + 3);
    }

    /**
     * Work out which GCDs to use in the lead-up to the burst window. The goals are for Starry Muse to be used as
     * soon as it comes off cooldown, weaved late into a GCD, and for the first GCD after it to be a hardcast
     * subtractive spell. Since GCDs have different lengths (2.5s for RGB, Holy in White and hammers, 3.3s for
     * subtractive spells and Comet in Black, 4s for motifs), the right combination lines up a GCD boundary with
     * the cooldown.
     *
     * @returns The plan, or null if it is too early to plan the next window (or Starry Muse can already be weaved)
     */
    private planBurstEntry(cp: PctCycleProcessor): EntryPlan | null {
        const gauge = cp.gaugeManager;
        const start = cp.gcdDecisionTime;
        if (!cp.burstComing() || cp.inBurst(start)) {
            return null;
        }
        // Starry Muse is about to be weaved, so there is nothing left to plan.
        if (gauge.starryCanvas && cp.canWeave(Actions.StarryMuseAction)) {
            return null;
        }
        // The earliest that the first GCD of the window can start
        const earliest = cp.starryReadyAt() + animationLock(Actions.StarryMuseAction) + WEAVE_MARGIN;
        if (earliest - cp.gcdDecisionTime > ENTRY_HORIZON) {
            return null;
        }
        const noEffects = combineBuffEffects([]);
        const hardcast = (ability: GcdAbility): EntryTiming => ({
            recast: cp.gcdTime(ability),
            lock: cp.castTime(ability, noEffects) + CASTER_TAX,
        });
        const instant = (ability: GcdAbility): EntryTiming => ({
            recast: cp.gcdTime(ability),
            lock: STANDARD_ANIMATION_LOCK,
        });
        const timings: Record<EntryAction, EntryTiming> = {
            subtractive: hardcast(Actions.Cyan),
            aetherhue: hardcast(Actions.Red),
            comet: instant(Actions.Comet),
            hammer: instant(Actions.HammerStamp),
            motif: hardcast(Actions.StarryMotif),
        };
        const starryReady = cp.starryReadyAt();
        const weaveLock = animationLock(Actions.StarryMuseAction);
        const initial: EntryState = {
            time: start,
            stacks: cp.buffStacks(Buffs.SubtractivePaletteBuff, start),
            palette: gauge.palette,
            paint: gauge.paint,
            monochrome: gauge.monochrome,
            hue: cp.aetherhue(start),
            hammers: cp.buffStacks(Buffs.HammerTimeBuff, start),
            motifs: this.pendingBurstMotifs(cp).length,
            extraMotifs: this.canUseMuseBeforeBurst(cp) ? 1 : 0,
        };
        // Every window should have a portrait. If none is held, and the next Living Muse does not produce one,
        // then that muse has to go before the window, so that the one after it (which does) goes inside.
        const nextMuse = gauge.creatureCanvas ?? gauge.nextCreature;
        const portraitNeedsMuse = gauge.portrait === null && (nextMuse === 'pom' || nextMuse === 'claw');
        const gaugeUselessAfter = cp.fightEndsAfterBurst(LAST_BURST_GAUGE);
        // Outcome of a step, including the best way to continue after it
        type Outcome = { cost: number, extraMotif: boolean };
        const memo = new Map<string, Outcome>();
        const stepOutcome = (step: EntryStep): Outcome => {
            if (step.state.time >= earliest) {
                // Starry Muse gets weaved after this GCD. What matters is how soon it can actually be used: as late
                // as possible in the weave window, but no later than is needed for nine GCDs to fit.
                const outcome = this.entryOutcome(step.state, step.instant);
                const weaveTime = step.weaveTime - (outcome.doubleWeave ? weaveLock : 0);
                const usedAt = Math.max(starryReady, step.state.time - Math.min(weaveTime, STARRY_MAX_LEAD));
                const portraitPenalty = portraitNeedsMuse && step.state.extraMotifs > 0 ? ENTRY_NO_PORTRAIT_COST : 0;
                // If the fight ends right after the window, gauge which is left over going into it is wasted.
                const leftover = step.state.palette - (outcome.doubleWeave ? SUBTRACTIVE_PALETTE_COST : 0);
                const wastedPenalty = gaugeUselessAfter ? Math.floor(leftover / SUBTRACTIVE_PALETTE_COST) * ENTRY_OVERCAP_COST : 0;
                return {
                    cost: step.cost + usedAt + outcome.penalty + portraitPenalty + wastedPenalty,
                    extraMotif: step.usedExtraMotif,
                };
            }
            const rest = bestFrom(step.state);
            return {
                cost: step.cost + rest.cost,
                extraMotif: step.usedExtraMotif || rest.extraMotif,
            };
        };
        const bestFrom = (state: EntryState): Outcome => {
            const key = [state.time.toFixed(2), state.stacks, state.palette, state.paint, state.monochrome ? 1 : 0,
                state.hue, state.hammers, state.motifs, state.extraMotifs].join('|');
            const known = memo.get(key);
            if (known !== undefined) {
                return known;
            }
            let best: Outcome = {
                cost: Number.MAX_VALUE,
                extraMotif: false,
            };
            for (const action of ENTRY_ACTIONS) {
                const step = this.applyEntryAction(state, action, timings, true);
                if (step !== null) {
                    const outcome = stepOutcome(step);
                    if (outcome.cost < best.cost) {
                        best = outcome;
                    }
                }
            }
            memo.set(key, best);
            return best;
        };
        const canWeaveNow = cp.canWeave(Actions.SubtractivePalette);
        let plan: EntryPlan | null = null;
        let planCost = Number.MAX_VALUE;
        for (const action of ENTRY_ACTIONS) {
            const step = this.applyEntryAction(initial, action, timings, canWeaveNow);
            if (step === null) {
                continue;
            }
            const outcome = stepOutcome(step);
            if (outcome.cost < planCost) {
                planCost = outcome.cost;
                plan = {
                    first: action,
                    paletteBeforeFirst: step.usedPalette,
                    museBeforeBurst: outcome.extraMotif,
                };
            }
        }
        return plan;
    }

    /**
     * Whether a Living Muse charge could be used in the lead-up to the burst window, while still leaving one for
     * the window itself.
     */
    private canUseMuseBeforeBurst(cp: PctCycleProcessor): boolean {
        const gauge = cp.gaugeManager;
        if (cp.charges(Actions.PomMuse) < 1 || cp.livingMuseChargesIn(cp.timeUntilStarry()) < 2) {
            return false;
        }
        const motif = gauge.creatureCanvas ?? gauge.nextCreature;
        // If the fight ends right after the window, then the motif painted afterwards has to be one which gives a
        // portrait, or it would be for nothing.
        if (cp.fightEndsAfterBurst() && (motif === 'wing' || motif === 'maw')) {
            return false;
        }
        return !cp.museWouldOverwritePortrait(motif);
    }

    /**
     * The GCD to use for a step of the burst entry plan.
     */
    private entryGcd(cp: PctCycleProcessor, action: EntryAction): GcdAbility {
        switch (action) {
            case 'subtractive':
                return cp.nextAetherhueSpell(true);
            case 'aetherhue':
                return cp.nextAetherhueSpell(false);
            case 'comet':
                return Actions.Comet;
            case 'hammer':
                return cp.nextHammer() ?? cp.nextAetherhueSpell(false);
            case 'motif':
                return this.pendingBurstMotifs(cp)[0]
                    ?? cp.nextAetherhueSpell(cp.buffStacks(Buffs.SubtractivePaletteBuff, cp.gcdDecisionTime) > 0);
        }
    }

    /**
     * Whether the remaining GCDs of the fight should be planned out: there is no more burst window to save
     * anything for, and the end is close enough to see all the way to it.
     */
    private isEnding(cp: PctCycleProcessor): boolean {
        const start = cp.gcdDecisionTime;
        return !cp.burstComing()
            && !cp.inBurst()
            && !cp.inBurst(start)
            && cp.totalTime - start <= ENDING_HORIZON;
    }

    /**
     * Work out which GCD to use next at the end of the fight. Nothing is worth anything once the fight is over, so
     * the goal is to spend the gauge on as many subtractive spells as will fit, use up the paint, and only paint
     * motifs which pay for themselves in time: a hammer motif needs most of its combo to fit, and a creature motif
     * needs its Living Muse, as well as the portrait in the case of a Pom or Claw Motif.
     *
     * This is done by playing out the rest of the fight for every combination of how many more times to use
     * Subtractive Palette, and how many more hammer and creature motifs to paint, and going with whichever does the
     * most damage.
     *
     * @returns The plan, or null if there is nothing to plan
     */
    private planEnding(cp: PctCycleProcessor): EndingPlan | null {
        const gauge = cp.gaugeManager;
        const start = cp.gcdDecisionTime;
        const totalTime = cp.totalTime;
        // Whatever is left over from the burst window goes first. These are the strongest GCDs there are.
        if (cp.hasBuff(Buffs.RainbowBrightBuff, start) || cp.hasBuff(Buffs.StarstruckBuff, start)) {
            return null;
        }
        // Everything is valued by its expected damage rather than its potency, since the hammer combo always
        // crits and direct hits.
        const noEffects = noBuffEffects();
        const damage = (ability: Ability) => abilityToDamageNew(cp.stats, cp.leveled(ability), noEffects).directDamage?.expected ?? 0;
        const rgbDamage = [Actions.Red, Actions.Green, Actions.Blue].map(damage);
        const cmyDamage = [Actions.Cyan, Actions.Yellow, Actions.Magenta].map(damage);
        const hammerDamage = Actions.HammerCombo.map(damage);
        const cometDamage = damage(Actions.Comet);
        const holyDamage = damage(Actions.Holy);
        const livingDamage = damage(Actions.PomMuse);
        const portraitDamage: Record<PctPortrait, number> = {
            mog: damage(Actions.Mog),
            madeen: damage(Actions.Madeen),
        };
        const noPortraitCost = ENDING_NO_PORTRAIT_COST * rgbDamage[0] / cp.leveled(Actions.Red).potency;
        const recasts: Record<EndingAction, number> = {
            hammer: cp.gcdTime(Actions.HammerStamp),
            comet: cp.gcdTime(Actions.Comet),
            subtractive: cp.gcdTime(Actions.Cyan),
            holy: cp.gcdTime(Actions.Holy),
            aetherhue: cp.gcdTime(Actions.Red),
            hammerMotif: cp.gcdTime(Actions.HammerMotif),
            creatureMotif: cp.gcdTime(Actions.PomMotif),
        };
        const living = cp.leveled(Actions.PomMuse).cooldown;
        const striking = cp.leveled(Actions.StrikingMuse).cooldown;
        const portraitCooldown = cp.leveled(Actions.Mog).cooldown.time;
        const weaveLock = STANDARD_ANIMATION_LOCK + WEAVE_MARGIN;
        const givesPortrait = (creature: number) => CREATURE_MOTIFS[creature] === 'wing' || CREATURE_MOTIFS[creature] === 'maw';

        /**
         * Use the oGCDs which are available in the gap before the next GCD. Returns the damage gained.
         */
        const weave = (state: EndingState): number => {
            // The latest that an oGCD can come off cooldown and still be weaved
            const deadline = state.time - weaveLock;
            while (state.livingNextAt <= deadline) {
                state.livingCharges += 1;
                state.livingNextAt = state.livingCharges < (living.charges ?? 1) ? state.livingNextAt + living.time : Number.POSITIVE_INFINITY;
            }
            while (state.strikingNextAt <= deadline) {
                state.strikingCharges += 1;
                state.strikingNextAt = state.strikingCharges < (striking.charges ?? 1) ? state.strikingNextAt + striking.time : Number.POSITIVE_INFINITY;
            }
            let gained = 0;
            if (state.weaves > 0 && state.hammerCanvas && state.hammers === 0 && state.strikingCharges > 0) {
                state.weaves -= 1;
                state.hammerCanvas = false;
                state.hammers = Actions.HammerCombo.length;
                state.strikingCharges -= 1;
                if (state.strikingNextAt === Number.POSITIVE_INFINITY) {
                    state.strikingNextAt = deadline + striking.time;
                }
            }
            if (state.weaves > 0 && state.portrait !== null && state.portraitReadyAt <= deadline) {
                state.weaves -= 1;
                // Makes up for what was taken off when the Pom or Claw Motif was painted
                gained += portraitDamage[state.portrait] + noPortraitCost;
                state.portrait = null;
                state.portraitReadyAt = deadline + portraitCooldown;
            }
            if (state.weaves > 0 && state.creature >= 0 && state.livingCharges > 0
                && !(givesPortrait(state.creature) && state.portrait !== null)) {
                state.weaves -= 1;
                gained += livingDamage;
                if (givesPortrait(state.creature)) {
                    state.portrait = CREATURE_MOTIFS[state.creature] === 'wing' ? 'mog' : 'madeen';
                }
                state.nextCreature = (state.creature + 1) % CREATURE_MOTIFS.length;
                state.creature = -1;
                state.livingCharges -= 1;
                if (state.livingNextAt === Number.POSITIVE_INFINITY) {
                    state.livingNextAt = deadline + living.time;
                }
            }
            return gained;
        };

        /**
         * Apply one GCD, as well as the oGCDs which get weaved after it. Returns null if the GCD cannot be used.
         */
        const apply = (state: EndingState, action: EndingAction): EndingStep | null => {
            // Hammer Time has to be used up before it runs out, and nothing else is as strong anyway.
            if (state.hammers > 0 && action !== 'hammer') {
                return null;
            }
            const next: EndingState = {
                ...state,
            };
            let gained = 0;
            let usedPalette = false;
            let instant = false;
            switch (action) {
                case 'hammer':
                    if (next.hammers < 1) {
                        return null;
                    }
                    gained = hammerDamage[hammerDamage.length - next.hammers];
                    next.hammers -= 1;
                    instant = true;
                    break;
                case 'comet':
                    if (!next.monochrome || next.paint < 1) {
                        return null;
                    }
                    gained = cometDamage;
                    next.paint -= 1;
                    next.monochrome = false;
                    instant = true;
                    break;
                case 'holy':
                    if (next.monochrome || next.paint < 1) {
                        return null;
                    }
                    gained = holyDamage;
                    next.paint -= 1;
                    instant = true;
                    break;
                case 'subtractive':
                    if (next.stacks === 0) {
                        if (next.weaves < 1 || next.palette < SUBTRACTIVE_PALETTE_COST || next.monochrome) {
                            return null;
                        }
                        next.palette -= SUBTRACTIVE_PALETTE_COST;
                        next.stacks = 3;
                        next.monochrome = true;
                        usedPalette = true;
                    }
                    gained = cmyDamage[next.hue];
                    next.stacks -= 1;
                    next.hue = (next.hue + 1) % 3;
                    if (next.hue === 0) {
                        next.paint = Math.min(next.paint + 1, MAX_PAINT);
                    }
                    break;
                case 'aetherhue':
                    if (next.stacks > 0) {
                        return null;
                    }
                    gained = rgbDamage[next.hue];
                    next.hue = (next.hue + 1) % 3;
                    if (next.hue === 0) {
                        next.paint = Math.min(next.paint + 1, MAX_PAINT);
                        next.palette = Math.min(next.palette + 25, MAX_PALETTE);
                    }
                    break;
                case 'hammerMotif':
                    if (next.hammerCanvas || (next.strikingCharges < 1 && next.strikingNextAt >= totalTime)) {
                        return null;
                    }
                    next.hammerCanvas = true;
                    break;
                case 'creatureMotif':
                    if (next.creature >= 0 || (next.livingCharges < 1 && next.livingNextAt >= totalTime)) {
                        return null;
                    }
                    next.creature = next.nextCreature;
                    if (!givesPortrait(next.creature)) {
                        gained -= noPortraitCost;
                    }
                    break;
            }
            const recast = recasts[action];
            // The last GCD only counts for as much of it as fits before the end of the fight
            gained *= Math.min(1, (totalTime - state.time) / recast);
            next.time = state.time + recast;
            // Nothing can be used once the last GCD has started
            if (next.time < totalTime) {
                next.weaves = instant ? MAX_WEAVES : 1;
                gained += weave(next);
            }
            return {
                state: next,
                gained: gained,
                usedPalette: usedPalette,
            };
        };

        const paletteUsable = !cp.hasBuff(Buffs.SubtractivePaletteBuff) && !gauge.monochrome;
        const initial: EndingState = {
            time: start,
            weaves: paletteUsable && cp.canWeave(Actions.SubtractivePalette) ? 1 : 0,
            stacks: cp.buffStacks(Buffs.SubtractivePaletteBuff, start),
            palette: gauge.palette,
            paint: gauge.paint,
            monochrome: gauge.monochrome,
            hue: cp.aetherhue(start),
            hammers: cp.buffStacks(Buffs.HammerTimeBuff, start),
            hammerCanvas: gauge.hammerCanvas,
            creature: gauge.creatureCanvas === null ? -1 : CREATURE_MOTIFS.indexOf(gauge.creatureCanvas),
            nextCreature: CREATURE_MOTIFS.indexOf(gauge.nextCreature),
            portrait: gauge.portrait,
            portraitReadyAt: cp.cdTracker.statusOf(cp.leveled(Actions.Mog)).readyAt.absolute,
            livingCharges: cp.charges(Actions.PomMuse),
            livingNextAt: cp.nextChargeAt(Actions.PomMuse),
            strikingCharges: cp.charges(Actions.StrikingMuse),
            strikingNextAt: cp.nextChargeAt(Actions.StrikingMuse),
        };
        const motifRecast = recasts.creatureMotif;
        /**
         * The next GCD when working towards the given number of Subtractive Palette uses and motifs.
         */
        const pick = (state: EndingState, targets: EndingTargets): EndingAction => {
            if (state.hammers > 0) {
                return 'hammer';
            }
            // Motifs are painted when their muse can be used straight away
            const museDeadline = targets.motifTiming === 'early' ? state.time + motifRecast - weaveLock : state.time;
            const motifsAllowed = targets.motifTiming !== 'stacks' || state.stacks > 0;
            if (motifsAllowed && targets.hammerMotifs > 0 && !state.hammerCanvas
                && (state.strikingCharges > 0 || state.strikingNextAt <= museDeadline)) {
                return 'hammerMotif';
            }
            if (motifsAllowed && targets.creatureMotifs > 0 && state.creature < 0
                && (state.livingCharges > 0 || state.livingNextAt <= museDeadline)
                && !(givesPortrait(state.nextCreature) && state.portrait !== null && state.portraitReadyAt > museDeadline)) {
                return 'creatureMotif';
            }
            // Comet in Black before the subtractive spells: it is stronger, and if the fight ends before everything
            // has been used, it is better for a subtractive spell to be the one which is left over.
            if (state.monochrome && state.paint > 0) {
                return 'comet';
            }
            if (state.stacks > 0) {
                return 'subtractive';
            }
            const whitePaint = !state.monochrome && state.paint > 0;
            if (targets.palettes > 0) {
                if (state.palette >= SUBTRACTIVE_PALETTE_COST) {
                    if (state.weaves > 0 && !state.monochrome) {
                        return 'subtractive';
                    }
                    return whitePaint ? 'holy' : 'aetherhue';
                }
                return 'aetherhue';
            }
            return whitePaint ? 'holy' : 'aetherhue';
        };
        /**
         * Play out the rest of the fight for the given targets.
         */
        const playOut = (targets: EndingTargets): { value: number, plan: EndingPlan } | null => {
            const remaining = {
                ...targets,
            };
            let state = initial;
            let value = 0;
            let plan: EndingPlan | null = null;
            while (state.time < totalTime) {
                const action = pick(state, remaining);
                const step = apply(state, action);
                if (step === null) {
                    return null;
                }
                switch (action) {
                    case 'hammerMotif':
                        remaining.hammerMotifs -= 1;
                        break;
                    case 'creatureMotif':
                        remaining.creatureMotifs -= 1;
                        break;
                    case 'subtractive':
                        if (step.usedPalette) {
                            remaining.palettes -= 1;
                        }
                        break;
                }
                plan ??= {
                    first: action,
                    paletteBeforeFirst: step.usedPalette,
                };
                value += step.gained;
                state = step.state;
            }
            return plan === null ? null : {
                value: value,
                plan: plan,
            };
        };
        let plan: EndingPlan | null = null;
        let planValue = Number.NEGATIVE_INFINITY;
        // Fewer motifs first, so that a motif is only painted if it is actually better
        for (let creatureMotifs = 0; creatureMotifs <= 3; creatureMotifs++) {
            for (let hammerMotifs = 0; hammerMotifs <= 2; hammerMotifs++) {
                for (let palettes = 4; palettes >= 0; palettes--) {
                    for (const motifTiming of ENDING_MOTIF_TIMINGS) {
                        // The timing makes no difference if there are no motifs
                        if (motifTiming !== 'ready' && creatureMotifs + hammerMotifs === 0) {
                            continue;
                        }
                        const result = playOut({
                            palettes: palettes,
                            hammerMotifs: hammerMotifs,
                            creatureMotifs: creatureMotifs,
                            motifTiming: motifTiming,
                        });
                        if (result !== null && result.value > planValue) {
                            planValue = result.value;
                            plan = result.plan;
                        }
                    }
                }
            }
        }
        return plan;
    }

    /**
     * The GCD to use for a step of the ending plan.
     */
    private endingGcd(cp: PctCycleProcessor, action: EndingAction): GcdAbility {
        switch (action) {
            case 'hammer':
                return cp.nextHammer() ?? cp.nextAetherhueSpell(false);
            case 'comet':
                return Actions.Comet;
            case 'holy':
                return Actions.Holy;
            case 'subtractive':
                return cp.nextAetherhueSpell(true);
            case 'aetherhue':
                return cp.nextAetherhueSpell(false);
            case 'hammerMotif':
                return Actions.HammerMotif;
            case 'creatureMotif':
                return Actions.CreatureMotifs[cp.gaugeManager.nextCreature];
        }
    }

    /**
     * Whether Subtractive Palette can be used from the gauge now. 50 gauge is always kept in reserve for the next
     * burst window, so that the window can start with a hardcast subtractive spell.
     */
    private canSpendPalette(cp: PctCycleProcessor): boolean {
        if (!cp.burstComing()) {
            return true;
        }
        return cp.gaugeManager.palette - SUBTRACTIVE_PALETTE_COST >= SUBTRACTIVE_PALETTE_COST;
    }

    /**
     * Whether using Swiftcast on the given GCD would let it snapshot a raid buff or potion which it would
     * otherwise miss, because the buff runs out during the cast.
     */
    private swiftcastHelps(cp: PctCycleProcessor, gcd: GcdAbility): boolean {
        if (gcd.potency === null || !gcd.cast) {
            return false;
        }
        const start = cp.gcdDecisionTime;
        // Already instant
        if (gcd.id === Actions.RainbowDrip.id && cp.hasBuff(Buffs.RainbowBrightBuff, start)) {
            return false;
        }
        const castTime = cp.castTime(gcd, combineBuffEffects(cp.getActiveBuffsFor(gcd, start)));
        const snapshot = start + Math.max(0, castTime - CAST_SNAPSHOT_PRE);
        const buffsAtSnapshot = cp.getActiveBuffs(snapshot);
        return cp.getActiveBuffs(start)
            .filter(buff => 'cooldown' in buff || buff.name === 'Medicated')
            .some(buff => !buffsAtSnapshot.some(other => other.statusId === buff.statusId));
    }

    /**
     * Whether it is time to use the potion.
     */
    private wantPotion(cp: PctCycleProcessor): boolean {
        if (cp.burstComing()) {
            return cp.timeUntilStarry() <= POTION_LEAD;
        }
        // No more burst windows, so just make sure that it gets used.
        return cp.fightEndsWithin(32);
    }

    /**
     * Pick the highest priority oGCD that we would like to weave right now, or null if there is none.
     *
     * @param cp The cycle processor
     * @param plan The burst entry plan, if we are in the lead-up to a burst window
     * @param ending Whether the end of the fight is being planned out
     */
    private chooseOgcd(cp: PctCycleProcessor, plan: EntryPlan | null, ending: boolean): OgcdAbility | null {
        const gauge = cp.gaugeManager;
        const potion = cp.medicinePotion;
        // Subtractive Palette cannot be used while its stacks are still up, and using it while black paint is held
        // would waste the Monochrome Tones.
        const paletteUsable = !cp.hasBuff(Buffs.SubtractivePaletteBuff) && !gauge.monochrome;
        const canWeavePalette = paletteUsable && cp.canWeave(Actions.SubtractivePalette);

        // Starry Muse. If we have no Subtractive Palette stacks for the window to start with, but there is room
        // for a double weave, use Subtractive Palette first.
        if (gauge.starryCanvas && cp.canWeave(Actions.StarryMuseAction)) {
            if (paletteUsable
                && gauge.palette >= SUBTRACTIVE_PALETTE_COST
                && cp.canWeave(Actions.SubtractivePalette, 1)) {
                return Actions.SubtractivePalette;
            }
            return Actions.StarryMuseAction;
        }
        // The free Subtractive Palette from Starry Muse
        if (canWeavePalette && cp.hasBuff(Buffs.SubtractiveSpectrumBuff)) {
            return Actions.SubtractivePalette;
        }
        if (cp.inBurst()) {
            if (gauge.hammerCanvas && cp.wantStrikingMuse() && cp.canWeave(Actions.StrikingMuse)) {
                return Actions.StrikingMuse;
            }
            // Normally the potion has already been used before the window
            if (potion && cp.canWeave(potion)) {
                return potion;
            }
            if (gauge.portrait !== null && cp.canWeave(Actions.Mog)) {
                return gauge.portrait === 'mog' ? Actions.Mog : Actions.Madeen;
            }
            if (gauge.creatureCanvas !== null
                && cp.wantCreatureMuse()
                && !cp.museWouldOverwritePortrait(gauge.creatureCanvas)
                && cp.canWeave(Actions.PomMuse)) {
                return Actions.CreatureMuses[gauge.creatureCanvas];
            }
            return null;
        }
        // Subtractive Palette as part of the lead-up to the burst window
        if (plan !== null && plan.paletteBeforeFirst && canWeavePalette) {
            return Actions.SubtractivePalette;
        }
        if (potion && this.wantPotion(cp) && cp.canWeave(potion)) {
            return potion;
        }
        // Striking Muse is not used in the lead-up to the burst window, since it is about to be used inside the
        // window, where the whole hammer combo gets buffed. At the end of the fight, there is nothing to hold it
        // for, so it is used as soon as it can be weaved, even if the charge only comes back during the weave.
        const wantStriking = ending ? !cp.hasBuff(Buffs.HammerTimeBuff) : cp.wantStrikingMuse();
        if (plan === null && gauge.hammerCanvas && wantStriking && cp.canWeave(Actions.StrikingMuse)) {
            return Actions.StrikingMuse;
        }
        if (gauge.portrait !== null && cp.wantPortrait() && cp.canWeave(Actions.Mog)) {
            return gauge.portrait === 'mog' ? Actions.Mog : Actions.Madeen;
        }
        // In the lead-up to the burst window, the plan decides whether a banked Living Muse charge is used. At the
        // end of the fight, it is used as soon as it can be weaved.
        const wantMuse = plan === null
            ? ending || cp.wantCreatureMuse()
            : plan.museBeforeBurst && cp.charges(Actions.PomMuse) > 0;
        if (gauge.creatureCanvas !== null
            && wantMuse
            && !cp.museWouldOverwritePortrait(gauge.creatureCanvas)
            && cp.canWeave(Actions.PomMuse)) {
            return Actions.CreatureMuses[gauge.creatureCanvas];
        }
        // Subtractive Palette from the gauge, as long as 50 gauge can be banked again in time for the burst window.
        // At the end of the fight, the ending plan decides when to use it instead.
        if (plan === null
            && !ending
            && canWeavePalette
            && gauge.palette >= SUBTRACTIVE_PALETTE_COST
            && this.canSpendPalette(cp)) {
            return Actions.SubtractivePalette;
        }
        return null;
    }

    /**
     * Weave the oGCDs which we want to use and which fit before the next GCD.
     */
    private useOgcds(cp: PctCycleProcessor, plan: EntryPlan | null, ending: boolean): number {
        for (let i = 0; i < MAX_WEAVES; i++) {
            const ability = this.chooseOgcd(cp, plan, ending);
            if (ability === null || this.use(cp, ability) === 'none') {
                return i;
            }
        }
        return MAX_WEAVES;
    }

    /**
     * Pick the next GCD inside the Starry Muse window. The window consists of nine GCDs: a hardcast subtractive
     * spell first, then Comet in Black and the free Subtractive Palette, with five aetherhue spells in total
     * (ending on Star Prism) to consume Hyperphantasia, and finally the hammer combo and Rainbow Drip.
     */
    private chooseBurstGcd(cp: PctCycleProcessor): GcdAbility {
        const gauge = cp.gaugeManager;
        const time = cp.gcdDecisionTime;
        const stacks = cp.buffStacks(Buffs.SubtractivePaletteBuff, time);
        const hyperStacks = cp.buffStacks(Buffs.HyperphantasiaBuff, time);
        const starstruck = cp.hasBuff(Buffs.StarstruckBuff, time);
        // The last Hyperphantasia stack goes to Star Prism, which is hasted and is the strongest spell.
        const saveLastStack = hyperStacks === 1 && starstruck;
        if (!saveLastStack) {
            // Subtractive Palette stacks from before the window. These have to be used up before the free
            // Subtractive Palette can be used.
            if (stacks > 0 && cp.hasBuff(Buffs.SubtractiveSpectrumBuff, time)) {
                return cp.nextAetherhueSpell(true);
            }
            // Comet in Black is the strongest of the hasted fillers, and leaves room for a double weave.
            if (gauge.hasBlackPaint && hyperStacks > 0) {
                return Actions.Comet;
            }
            if (stacks > 0 && hyperStacks > 0) {
                return cp.nextAetherhueSpell(true);
            }
        }
        if (starstruck) {
            return Actions.StarPrism;
        }
        const hammer = cp.nextHammer();
        if (hammer !== null) {
            return hammer;
        }
        if (cp.hasBuff(Buffs.RainbowBrightBuff, time)) {
            return Actions.RainbowDrip;
        }
        // Anything after that is at the very end of the window, where an instant spell is more likely to still
        // get the buff than a hardcast.
        if (gauge.hasBlackPaint) {
            return Actions.Comet;
        }
        if (stacks > 0) {
            return cp.nextAetherhueSpell(true);
        }
        return cp.nextAetherhueSpell(false);
    }

    /**
     * Pick the next GCD outside of the Starry Muse window and the lead-up to it.
     */
    private chooseNormalGcd(cp: PctCycleProcessor): GcdAbility {
        const gauge = cp.gaugeManager;
        const endingSoon = cp.fightEndsWithin(12);
        const time = cp.gcdDecisionTime;
        const stacks = cp.buffStacks(Buffs.SubtractivePaletteBuff, time);
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
        if (!endingSoon) {
            // Starry Sky Motif needs to be ready when Starry Muse comes off cooldown.
            if (!gauge.starryCanvas && cp.burstComing() && cp.timeUntilStarry() <= 30) {
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
        // Subtractive spells are the best filler. RGB cannot be used until these are gone anyway.
        if (stacks > 0) {
            return cp.nextAetherhueSpell(true);
        }
        if (gauge.hasBlackPaint) {
            return Actions.Comet;
        }
        const filler = cp.nextAetherhueSpell(false);
        if (gauge.hasWhitePaint) {
            // Holy in White is stronger than Fire and Aero, but generates no gauge. So, it is only worth using
            // if the gauge would be wasted anyway: if it would overcap, or if the fight ends before it gets used.
            const wouldOvercap = filler === Actions.Blue && gauge.palette + 25 > MAX_PALETTE;
            const paletteNeeded = SUBTRACTIVE_PALETTE_COST - gauge.palette;
            const timeToPalette = cp.rgbCastsToGain(paletteNeeded) * cp.gcdTime(Actions.Red);
            const gaugeUseless = !cp.burstComing() && cp.fightEndsWithin(timeToPalette + cp.gcdTime(Actions.Cyan));
            if (wouldOvercap || gaugeUseless || endingSoon) {
                return Actions.Holy;
            }
        }
        return filler;
    }

    private chooseGcd(cp: PctCycleProcessor, plan: EntryPlan | null): GcdAbility {
        if (cp.inBurst(cp.gcdDecisionTime)) {
            return this.chooseBurstGcd(cp);
        }
        if (plan !== null) {
            return this.entryGcd(cp, plan.first);
        }
        return this.chooseNormalGcd(cp);
    }

    /**
     * One step of the rotation: weave any oGCDs which are wanted, then use the next GCD.
     */
    private rotationStep(cp: PctCycleProcessor) {
        const ending = this.isEnding(cp);
        const plan = ending ? null : this.planBurstEntry(cp);
        let weaves = this.useOgcds(cp, plan, ending);
        if (cp.remainingGcdTime <= 0) {
            return;
        }
        const endingPlan = ending ? this.planEnding(cp) : null;
        let gcd: GcdAbility;
        if (endingPlan !== null) {
            if (endingPlan.paletteBeforeFirst && this.use(cp, Actions.SubtractivePalette) !== 'none') {
                weaves++;
            }
            gcd = this.endingGcd(cp, endingPlan.first);
        }
        else {
            gcd = this.chooseGcd(cp, plan);
        }
        // Swiftcast, if it gets this spell into a buff
        if (weaves < MAX_WEAVES && cp.canWeave(Actions.Swiftcast) && this.swiftcastHelps(cp, gcd)) {
            this.use(cp, Actions.Swiftcast);
        }
        this.use(cp, gcd);
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
                // The damage of the last GCD is counted up to the end of the fight, so the time which the damage
                // is divided by has to run up to the end as well. Otherwise, the clock stops when the last GCD's
                // animation lock or cast ends, and the DPS depends on whether that GCD happened to be instant.
                if (cp.currentTime < cp.totalTime) {
                    cp.advanceTo(cp.totalTime);
                }
            },
        }];
    }
}
