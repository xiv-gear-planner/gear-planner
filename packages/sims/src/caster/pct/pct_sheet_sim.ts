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
import {animationLock} from "@xivgear/sims/ability_helpers";
import {PctGaugeManager} from "./pct_gauge";
import * as Actions from "./pct_actions";
import * as Buffs from "./pct_buffs";
import {PctCreatureMotif, PctGaugeState} from "./pct_types";
import {MAX_PALETTE, SUBTRACTIVE_PALETTE_COST} from "./pct_consts";

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

Holy in White is only used to line up Starry Muse or to avoid overcapping the palette gauge, since there is no
movement to account for.

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
 * How far ahead of the burst window we start planning the exact GCDs leading into it.
 */
const ENTRY_HORIZON = 10;

/**
 * Maximum number of GCDs to plan ahead when lining up the burst window.
 */
const MAX_ENTRY_DEPTH = 5;

/**
 * How far ahead of Starry Muse coming off cooldown the potion is used.
 */
const POTION_LEAD = 7;

/**
 * Motifs have a fixed recast.
 */
const MOTIF_RECAST = 4;

/**
 * The kinds of GCD which can be used while lining up the burst window.
 */
type EntryAction = 'subtractive' | 'aetherhue' | 'holy' | 'comet' | 'hammer' | 'motif';

const ENTRY_ACTIONS: readonly EntryAction[] = ['subtractive', 'aetherhue', 'holy', 'comet', 'hammer', 'motif'];

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
};

type EntryStep = {
    state: EntryState,
    /**
     * Whether Subtractive Palette has to be weaved before this GCD.
     */
    usedPalette: boolean,
    /**
     * Whether the GCD is instant, i.e. leaves room for a double weave.
     */
    instant: boolean,
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
        return this.starryReadyAt() + 5 < this.totalTime;
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
     * How many Living Muse charges will be available after the given number of seconds, if none are used.
     */
    livingMuseChargesIn(time: number): number {
        const muse = this.leveled(Actions.PomMuse);
        const untilCapped = this.cdTracker.statusOf(muse).cappedAt.relative;
        const missing = Math.ceil(Math.max(0, untilCapped - time) / muse.cooldown.time);
        return Math.max(0, muse.cooldown.charges - missing);
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
        this.use(cp, Swiftcast);
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
        if (!gauge.starryCanvas) {
            motifs.push(Actions.StarryMotif);
        }
        if (!gauge.hammerCanvas
            && !cp.hasBuff(Buffs.HammerTimeBuff, cp.gcdDecisionTime)
            && cp.readyWithin(Actions.StrikingMuse, untilStarry + 10)) {
            motifs.push(Actions.HammerMotif);
        }
        if (gauge.creatureCanvas === null && cp.readyWithin(Actions.PomMuse, untilStarry + 10)) {
            motifs.push(Actions.CreatureMotifs[gauge.nextCreature]);
        }
        return motifs;
    }

    /**
     * Apply one GCD to the planning state.
     *
     * @param state The state before the GCD
     * @param action The kind of GCD
     * @param durations The recast of each kind of GCD
     * @param canWeavePalette Whether Subtractive Palette can be weaved before this GCD
     * @returns The resulting step, or null if the GCD cannot be used in this state
     */
    private applyEntryAction(state: EntryState, action: EntryAction, durations: Record<EntryAction, number>,
                             canWeavePalette: boolean): EntryStep | null {
        const next: EntryState = {
            ...state,
            time: state.time + durations[action],
        };
        let usedPalette = false;
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
                        cost += 0.3;
                    }
                }
                break;
            case 'holy':
                if (next.monochrome || next.paint < 1) {
                    return null;
                }
                next.paint -= 1;
                instant = true;
                // All else being equal, prefer something which generates gauge.
                cost += 0.03;
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
                if (next.motifs < 1) {
                    return null;
                }
                next.motifs -= 1;
                break;
        }
        return {
            state: next,
            usedPalette: usedPalette,
            instant: instant,
            cost: cost,
        };
    }

    /**
     * How undesirable it is to weave Starry Muse after a GCD which leaves us in the given state. Expressed in
     * seconds of Starry Muse delay which would be an acceptable price for avoiding it.
     *
     * The ideal is to have Subtractive Palette stacks left, so that the window starts with a hardcast subtractive
     * spell, as well as a Comet in Black after which the free Subtractive Palette can be weaved.
     *
     * @param state The state after the last GCD before the window
     * @param instant Whether that GCD was instant
     */
    private entryPenalty(state: EntryState, instant: boolean): number {
        let penalty = 0;
        if (state.motifs > 0) {
            penalty += 20;
        }
        if (state.stacks > 0) {
            // Will there be black paint once the stacks have been used?
            const castsUntilMagenta = 3 - state.hue;
            if (!state.monochrome || (state.paint < 1 && castsUntilMagenta > state.stacks)) {
                return penalty + 1.5;
            }
            // Two stacks left means that two Comets and the two strongest subtractive spells fit in the window.
            switch (state.stacks) {
                case 2:
                    return penalty;
                case 1:
                    return penalty + 0.02;
                default:
                    return penalty + 0.04;
            }
        }
        // After an instant GCD, Subtractive Palette and Starry Muse can be double weaved.
        if (instant && state.palette >= SUBTRACTIVE_PALETTE_COST && !state.monochrome) {
            return penalty + 0.04;
        }
        // Otherwise the window has to start with an instant GCD, to weave the free Subtractive Palette.
        return penalty + 3;
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
        if (earliest - start > ENTRY_HORIZON) {
            return null;
        }
        const instantRecast = cp.gcdTime(Actions.Holy);
        const durations: Record<EntryAction, number> = {
            subtractive: cp.gcdTime(Actions.Cyan),
            aetherhue: cp.gcdTime(Actions.Red),
            holy: instantRecast,
            comet: cp.gcdTime(Actions.Comet),
            hammer: instantRecast,
            motif: MOTIF_RECAST,
        };
        const initial: EntryState = {
            time: start,
            stacks: cp.buffStacks(Buffs.SubtractivePaletteBuff, start),
            palette: gauge.palette,
            paint: gauge.paint,
            monochrome: gauge.monochrome,
            hue: cp.aetherhue(start),
            hammers: cp.buffStacks(Buffs.HammerTimeBuff, start),
            motifs: this.pendingBurstMotifs(cp).length,
        };
        const canWeavePaletteNow = cp.canWeave(Actions.SubtractivePalette);
        const result: { plan: EntryPlan | null, cost: number } = {
            plan: null,
            cost: Number.MAX_VALUE,
        };
        const search = (state: EntryState, plan: EntryPlan | null, cost: number, depth: number) => {
            for (const action of ENTRY_ACTIONS) {
                const step = this.applyEntryAction(state, action, durations, depth > 0 || canWeavePaletteNow);
                if (step === null) {
                    continue;
                }
                const stepPlan: EntryPlan = plan ?? {
                    first: action,
                    paletteBeforeFirst: step.usedPalette,
                };
                const stepCost = cost + step.cost;
                if (step.state.time >= earliest) {
                    // Starry Muse gets weaved after this GCD. The sooner, the better.
                    const total = step.state.time + stepCost + this.entryPenalty(step.state, step.instant);
                    if (total < result.cost) {
                        result.plan = stepPlan;
                        result.cost = total;
                    }
                }
                else if (depth + 1 < MAX_ENTRY_DEPTH) {
                    search(step.state, stepPlan, stepCost, depth + 1);
                }
            }
        };
        search(initial, null, 0, 0);
        return result.plan;
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
            case 'holy':
                return Actions.Holy;
            case 'comet':
                return Actions.Comet;
            case 'hammer':
                return cp.nextHammer() ?? cp.nextAetherhueSpell(false);
            case 'motif':
                return this.pendingBurstMotifs(cp)[0] ?? cp.nextAetherhueSpell(false);
        }
    }

    /**
     * Whether Subtractive Palette can be used from the gauge now, and still have 50 gauge banked again by the time
     * the next burst window needs it.
     */
    private canSpendPalette(cp: PctCycleProcessor): boolean {
        const gauge = cp.gaugeManager;
        if (!cp.burstComing()) {
            return true;
        }
        const untilStarry = cp.timeUntilStarry();
        const subtractiveRecast = cp.gcdTime(Actions.Cyan);
        const instantRecast = cp.gcdTime(Actions.Holy);
        // Three subtractive spells and a Comet in Black
        let needed = 4 * subtractiveRecast;
        // Then, getting back to 50 gauge, with a little time to spare for the lead-up to the window. If there
        // would still be 50 gauge left, then it does not matter if the subtractive spells run into the lead-up.
        const paletteAfter = gauge.palette - SUBTRACTIVE_PALETTE_COST;
        if (paletteAfter < SUBTRACTIVE_PALETTE_COST) {
            needed += cp.rgbCastsToGain(SUBTRACTIVE_PALETTE_COST - paletteAfter) * cp.gcdTime(Actions.Red);
            needed += subtractiveRecast;
        }
        // Motifs for the window: Starry Sky, the hammer, and one for each Living Muse charge until then
        let motifs = 0;
        if (!gauge.starryCanvas) {
            motifs++;
        }
        if (!gauge.hammerCanvas) {
            motifs++;
        }
        motifs += Math.max(0, cp.livingMuseChargesIn(untilStarry) - (gauge.creatureCanvas === null ? 0 : 1));
        // Hammer combos which will happen before the window
        let hammers = cp.buffStacks(Buffs.HammerTimeBuff);
        if (hammers === 0 && cp.wantStrikingMuse()) {
            hammers = 3;
            if (gauge.hammerCanvas) {
                motifs++;
            }
        }
        needed += motifs * MOTIF_RECAST + hammers * instantRecast;
        return untilStarry > needed;
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
     */
    private chooseOgcd(cp: PctCycleProcessor, plan: EntryPlan | null): OgcdAbility | null {
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
            if (gauge.creatureCanvas !== null && cp.wantCreatureMuse() && cp.canWeave(Actions.PomMuse)) {
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
        if (gauge.hammerCanvas && cp.wantStrikingMuse() && cp.canWeave(Actions.StrikingMuse)) {
            return Actions.StrikingMuse;
        }
        if (gauge.portrait !== null && cp.wantPortrait() && cp.canWeave(Actions.Mog)) {
            return gauge.portrait === 'mog' ? Actions.Mog : Actions.Madeen;
        }
        if (gauge.creatureCanvas !== null
            && cp.wantCreatureMuse()
            && !cp.museWouldOverwritePortrait(gauge.creatureCanvas)
            && cp.canWeave(Actions.PomMuse)) {
            return Actions.CreatureMuses[gauge.creatureCanvas];
        }
        // Subtractive Palette from the gauge, as long as 50 gauge can be banked again in time for the burst window.
        if (plan === null
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
    private useOgcds(cp: PctCycleProcessor, plan: EntryPlan | null) {
        for (let i = 0; i < MAX_WEAVES; i++) {
            const ability = this.chooseOgcd(cp, plan);
            if (ability === null || this.use(cp, ability) === 'none') {
                return;
            }
        }
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
        if (stacks > 0) {
            return cp.nextAetherhueSpell(true);
        }
        if (gauge.hasBlackPaint) {
            return Actions.Comet;
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
        const plan = this.planBurstEntry(cp);
        this.useOgcds(cp, plan);
        if (cp.remainingGcdTime <= 0) {
            return;
        }
        this.use(cp, this.chooseGcd(cp, plan));
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
