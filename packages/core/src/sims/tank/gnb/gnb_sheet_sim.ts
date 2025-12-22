import {Ability, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    AbilityUseResult,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    PreDmgAbilityUseRecordUnf,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {formatDuration} from "@xivgear/util/strutils";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {GnbGauge} from "./gnb_gauge";
import {
    BloodfestBuff,
    GnbAbility,
    GnbExtraData,
    GnbGcdAbility,
    GnbOgcdAbility,
    NoMercyBuff,
    ReadyToBlastBuff,
    ReadyToBreakBuff,
    ReadyToGougeBuff,
    ReadyToReignBuff,
    ReadyToRipBuff,
    ReadyToTearBuff
} from "./gnb_types";
import {sum} from "@xivgear/util/array_utils";
import * as Actions from './gnb_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxStr} from "@xivgear/core/sims/common/potion";

export interface GnbSimResult extends CycleSimResult {

}

export interface GnbSettings extends SimSettings {
    // If we use potions (used every six minutes).
    usePotion: boolean;
    // the length of the fight in seconds
    fightTime: number;
    // If the sim should do the unrealistic gcd clip tech for 2.49/2.48.
    // While a gain, it's unfeasible to do in-game for 2.49 and not practical
    // to do in a real fight for 2.48.
    unrealisticGcdClipRotation: boolean;
}

export interface GnbSettingsExternal extends ExternalCycleSettings<GnbSettings> {

}

export const gnbSpec: SimSpec<GnbSim, GnbSettingsExternal> = {
    stub: "gnb-sheet-sim",
    displayName: "GNB Sim",
    description: `Simulates a GNB rotation for level 100/90/80/70.
If potions are enabled, pots in the burst window every 6m (i.e. 0m, 6m, 12m, etc).
Defaults to simulating a killtime of 8m 30s (510s).`,
    makeNewSimInstance: function (): GnbSim {
        return new GnbSim();
    },
    loadSavedSimInstance: function (exported: GnbSettingsExternal) {
        return new GnbSim(exported);
    },
    supportedJobs: ['GNB'],
    supportedLevels: [100, 90, 80, 70],
    isDefaultSim: true,
    maintainers: [{
        name: 'Violet Stardust',
        contact: [{
            type: 'discord',
            discordTag: 'violet.stardust',
            discordUid: '194908170030809098',
        }],
    }],
};

class RotationState {
    private _combo: number = 0;
    private _gnashingFangCombo: number = 0;
    private _bloodfestCombo: number = 0;

    get combo() {
        return this._combo;
    };

    set combo(newCombo) {
        this._combo = newCombo;
        if (this._combo >= 3) {
            this._combo = 0;
        }
    }

    get gnashingFangCombo() {
        return this._gnashingFangCombo;
    };

    set gnashingFangCombo(newCombo) {
        this._gnashingFangCombo = newCombo;
        if (this._gnashingFangCombo >= 3) {
            this._gnashingFangCombo = 0;
        }
    }

    get bloodfestCombo() {
        return this._bloodfestCombo;
    };

    set bloodfestCombo(newCombo) {
        this._bloodfestCombo = newCombo;
        if (this._bloodfestCombo >= 3) {
            this._bloodfestCombo = 0;
        }
    }
}

class GnbCycleProcessor extends CycleProcessor {
    gauge: GnbGauge;
    rotationState: RotationState;
    blastingZoneAbility: GnbOgcdAbility;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new GnbGauge(this.stats.level);
        this.rotationState = new RotationState();

        if (this.stats.level >= 80) {
            this.blastingZoneAbility = Actions.BlastingZone;
        }
        else {
            this.blastingZoneAbility = Actions.DangerZone;
        }
    }

    /** Advances to as late as possible.
     * NOTE: I'm adding an extra 20ms to each animation lock to make sure we don't hit anything that's impossible to achieve ingame.
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

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: GnbExtraData = {
            gauge: this.gauge.getGaugeState(),
            noMercyDuration: 0,
        };

        const noMercy = usedAbility.buffs.find(buff => buff.name === NoMercyBuff.name);
        const buffData = noMercy && this.getActiveBuffData(noMercy, usedAbility.usedAt);
        if (buffData) {
            extraData.noMercyDuration = buffData.end - usedAbility.usedAt;
        }


        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    getNoMercyDuration(): number {
        let noMercyDuration = 0;
        const buffs = [...this.getActiveBuffs(this.currentTime)];
        const noMercy = buffs.find(buff => buff.name === NoMercyBuff.name);
        const buffData = noMercy && this.getActiveBuffData(noMercy, this.currentTime);
        if (buffData) {
            noMercyDuration = buffData.end - this.currentTime;
        }
        return noMercyDuration;
    }

    inPotBurst(): boolean {
        let potDuration = 0;
        const buffs = [...this.getActiveBuffs(this.currentTime)];
        const potBuff = buffs.find(buff => buff.name === "Medicated");
        const buffData = potBuff && this.getActiveBuffData(potBuff, this.currentTime);
        if (buffData) {
            potDuration = buffData.end - this.currentTime;
        }

        // Make sure we're not spending carts pre-No Mercy
        const noMercyDone = this.cdTracker.statusOf(Actions.NoMercy).readyAt.relative > 20;
        return potDuration > 0 && noMercyDone;
    }

    comboActions: GnbGcdAbility[] = [Actions.KeenEdge, Actions.BrutalShell, Actions.SolidBarrel];
    getComboToUse() {
        return this.comboActions[this.rotationState.combo++];
    }

    isGnashingFangComboActive(): boolean {
        return this.rotationState.gnashingFangCombo !== 0;
    }

    gnashingFangComboActions: GnbGcdAbility[] = [Actions.GnashingFang, Actions.SavageClaw, Actions.WickedTalon];
    getGnashingFangComboToUse() {
        return this.gnashingFangComboActions[this.rotationState.gnashingFangCombo++];
    }

    isBloodfestComboActive(): boolean {
        return this.rotationState.bloodfestCombo !== 0;
    }

    bloodfestComboActions: GnbGcdAbility[] = [Actions.ReignOfBeasts, Actions.NobleBlood, Actions.LionHeart];
    getBloodfestComboToUse() {
        return this.bloodfestComboActions[this.rotationState.bloodfestCombo++];
    }

    // If the fight is ending within the next 12 seconds (to dump resources)
    fightEndingSoon(): boolean {
        return this.currentTime > (this.totalTime - 12);
    }

    isReadyToBreakBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const rtb = buffs.find(buff => buff.name === ReadyToBreakBuff.name);
        return rtb !== undefined;
    }

    isReadyToReignBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const rtr = buffs.find(buff => buff.name === ReadyToReignBuff.name);
        return rtr !== undefined;
    }

    isReadyToRipBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const rtr = buffs.find(buff => buff.name === ReadyToRipBuff.name);
        return rtr !== undefined;
    }

    isReadyToTearBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const rtt = buffs.find(buff => buff.name === ReadyToTearBuff.name);
        return rtt !== undefined;
    }

    isReadyToGougeBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const rtg = buffs.find(buff => buff.name === ReadyToGougeBuff.name);
        return rtg !== undefined;
    }

    isBloodfestBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const bloodfest = buffs.find(buff => buff.name === BloodfestBuff.name);
        return bloodfest !== undefined;
    }


    isReadyToBlastBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const rtb = buffs.find(buff => buff.name === ReadyToBlastBuff.name);
        return rtb !== undefined;
    }

    isContinuationReady(): boolean {
        return this.isReadyToRipBuffActive() || this.isReadyToTearBuffActive() || this.isReadyToGougeBuffActive() || this.isReadyToBlastBuffActive();
    }

    haveCartsAndBloodfestIsOffCooldown(): boolean {
        const carts = this.gauge.cartridges;
        const bloodfestOffCdRelative = this.cdTracker.statusOf(Actions.Bloodfest).readyAt.relative;
        return carts >= 1 && bloodfestOffCdRelative === 0;
    }

    getActiveContinuationAction(): GnbOgcdAbility {
        if (this.isReadyToRipBuffActive()) {
            return Actions.JugularRip;

        }
        if (this.isReadyToTearBuffActive()) {
            return Actions.AbdomenTear;

        }
        if (this.isReadyToGougeBuffActive()) {
            return Actions.EyeGouge;

        }
        if (this.isReadyToBlastBuffActive()) {
            return Actions.Hypervelocity;

        }
        return undefined;
    }

    shouldPot(): boolean {
        const sixMinutesInSeconds = 360;
        const isSixMinuteWindow = this.currentTime % sixMinutesInSeconds < 20;
        return isSixMinuteWindow;
    }
}

export class GnbSim extends BaseMultiCycleSim<GnbSimResult, GnbSettings, GnbCycleProcessor> {
    spec = gnbSpec;
    shortName = "gnb-sheet-sim";
    displayName = gnbSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: this.settings.fightTime,
        cycles: 0,
        which: 'totalTime',
        cutoffMode: 'prorate-gcd',
    };

    constructor(settings?: GnbSettingsExternal) {
        super('GNB', settings);
        if (this.cycleSettings && settings && settings.cycleSettings) {
            this.cycleSettings.totalTime = settings.cycleSettings.totalTime;
        }
    }

    protected createCycleProcessor(settings: MultiCycleSettings): GnbCycleProcessor {
        return new GnbCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    override makeDefaultSettings(): GnbSettings {
        return {
            usePotion: true,
            // 8 minutes and 30s, or 510 seconds
            // This is chosen since it's two pots, five bursts,
            // and is somewhat even between the two main GCDs.
            fightTime: (8 * 60) + 30,
            unrealisticGcdClipRotation: false,
        };
    }

    willOvercapCartsNextGCD(cp: GnbCycleProcessor): boolean {
        const maxCarts = cp.isBloodfestBuffActive() ? cp.gauge.maxCartridges * 2 : cp.gauge.maxCartridges;
        return cp.gauge.cartridges === maxCarts && cp.rotationState.combo === 2;
    }

    // Gets the next GCD to use in the GNB rotation.
    // Note: this is stateful, and updates combos to the next combo.
    getGCDToUse(cp: GnbCycleProcessor): GnbGcdAbility {
        const noMercyDuration = cp.getNoMercyDuration();
        // If we have less than thirty seconds, but still enough time to do our bigger attacks, use Sonic Break as soon as possible.
        const timeRemaining = cp.totalTime - cp.currentTime;
        if (cp.isReadyToBreakBuffActive() && (timeRemaining < 30) && (noMercyDuration > 0 && timeRemaining > cp.stats.gcdPhys(2.5) * 4)) {
            return Actions.SonicBreak;
        }

        // Double Down logic
        if (cp.stats.level >= 90) {
            if (cp.gauge.cartridges >= Actions.DoubleDown.cartridgeCost && cp.getNoMercyDuration() > 0) {
                if (cp.cdTracker.statusOfAt(Actions.DoubleDown, cp.nextGcdTime).readyToUse) {
                    return Actions.DoubleDown;
                }

                // Should we microclip for Double Down?
                const relativeCooldown = cp.cdTracker.statusOfAt(Actions.DoubleDown, cp.nextGcdTime).readyAt.relative;
                const shouldUseGCD = relativeCooldown === 0 || relativeCooldown <= (cp.stats.gcdPhys(2.5) / 20);
                if (shouldUseGCD) {
                // We are microclipping
                    if (relativeCooldown > 0) {
                        cp.advanceTo(cp.cdTracker.statusOf(Actions.DoubleDown).readyAt.absolute);
                        return Actions.DoubleDown;
                    }
                }
            }
        }

        // Start Gnashing Fang combo in No Mercy
        if (cp.getNoMercyDuration() > 0 && !cp.isGnashingFangComboActive()) {
            if (cp.cdTracker.statusOfAt(Actions.GnashingFang, cp.nextGcdTime).readyToUse) {
                if (cp.gauge.cartridges >= Actions.GnashingFang.cartridgeCost
                    // Gnashing and Lionheart break each other, so wait until we're finished the Lionheart combo to start it
                    && !cp.isBloodfestComboActive()
                ) {
                    return cp.getGnashingFangComboToUse();
                }
            }
        }

        if (this.settings.unrealisticGcdClipRotation) {
            if (cp.stats.level === 100) {
                // 2.49 / 2.48 Opti Zone
                // We're at Wicked Talon. We should clip our GCD for No Mercy
                if (cp.isGnashingFangComboActive() && cp.rotationState.gnashingFangCombo === 2 && cp.stats.gcdPhys(2.5) < 2.5) {
                    // This check checks whether or not a small amount of clipping would be possible to fit a 9 GCD NM after intentionally
                    // clipping your GCD. Practically speaking, this only applies to 2.49 and 2.48.
                    if (cp.cdTracker.statusOf(Actions.NoMercy).readyAt.relative < cp.nextGcdTime - cp.currentTime) {
                        cp.advanceTo(cp.cdTracker.statusOf(Actions.NoMercy).readyAt.absolute);
                        cp.use(Actions.NoMercy);
                        return cp.getGnashingFangComboToUse();
                    }
                }
            }
        }

        // Dump carts, so long as we're not about to miss cart spending GCDs in burst if we do.
        // This only really comes up at edge case GCDs, but there's no reason not to account for it.
        const gnashingFangCd = cp.cdTracker.statusOf(Actions.GnashingFang).readyAt.relative;
        const doubleDownCd = cp.cdTracker.statusOf(Actions.DoubleDown).readyAt.relative;
        let numberOfCartSpendingGcdsUpBeforeNoMercyExpires = 0;
        if (gnashingFangCd < noMercyDuration) {
            numberOfCartSpendingGcdsUpBeforeNoMercyExpires++;
        }
        if (cp.stats.level >= 90) {
            if (doubleDownCd < noMercyDuration) {
                numberOfCartSpendingGcdsUpBeforeNoMercyExpires++;
            }
        }

        if (cp.isReadyToBreakBuffActive()) {
            return Actions.SonicBreak;
        }

        // Start or continue Bloodfest Combo at a higher priority if we only have that many GCDs left, since it's our biggest potency
        if ((cp.isReadyToReignBuffActive() || cp.isBloodfestComboActive()) && timeRemaining < cp.stats.gcdPhys(2.5) * (3 - cp.rotationState.bloodfestCombo)) {
            return cp.getBloodfestComboToUse();
        }

        // Continue Gnashing Fang combo
        if (cp.isGnashingFangComboActive()) {
            return cp.getGnashingFangComboToUse();
        }

        const lionHeartNext = cp.rotationState.bloodfestCombo === 2;
        const twoPlusGCDsLeftInNoMercy = noMercyDuration >= (cp.nextGcdTime - cp.currentTime) + cp.stats.gcdPhys(2.5);
        const threePlusGCDsLeftInNoMercy = noMercyDuration >= (cp.nextGcdTime - cp.currentTime) + cp.stats.gcdPhys(2.5) + cp.stats.gcdPhys(2.5);
        const exactlyTwoGCDsLeftInNoMercy = twoPlusGCDsLeftInNoMercy && !threePlusGCDsLeftInNoMercy;
        // Dump resources if in burst at a higher priority than Bloodfest combo if we have time to finish our Bloodfest combo.
        // This means that Continuation will stay in No Mercy.
        if (lionHeartNext && exactlyTwoGCDsLeftInNoMercy && cp.gauge.cartridges > numberOfCartSpendingGcdsUpBeforeNoMercyExpires) {
            return Actions.BurstStrike;
        }

        // Start or continue Bloodfest Combo
        if (noMercyDuration > 0 && (cp.isReadyToReignBuffActive() || cp.isBloodfestComboActive())) {
            return cp.getBloodfestComboToUse();
        }

        // Dump resources if in burst
        if (noMercyDuration > 0 && cp.gauge.cartridges > numberOfCartSpendingGcdsUpBeforeNoMercyExpires) {
            return Actions.BurstStrike;
        }

        // Pre-No Mercy Gnashing logic:
        if (cp.stats.level === 100
            && !cp.isGnashingFangComboActive()
            && cp.cdTracker.statusOf(Actions.GnashingFang).readyToUse) {
            const readyAt = cp.cdTracker.statusOf(Actions.NoMercy).readyAt;
            const gcdSpeed = cp.stats.gcdPhys(2.5);
            // Force gcd clip for 9 GCD No Mercy at 2.48 and 2.49.
            // We don't want any of the other behaviour, we want to literally do this every single time.
            const forceGcdClipForNineGcdNoMercy = this.settings.unrealisticGcdClipRotation && (gcdSpeed === 2.48 || gcdSpeed === 2.49);
            if (forceGcdClipForNineGcdNoMercy) {
                if (readyAt.absolute <= (cp.nextGcdTime + gcdSpeed * 2)) {
                    return cp.getGnashingFangComboToUse();
                }
            }
            else {
                // Special Gnashing logic: 9 GCD No Mercy
                // Is No Mercy coming up after two GCDs?
                if (readyAt.absolute <= cp.nextGcdTime + (cp.stats.gcdPhys(2.5) * 2)) {
                    // The 11 here counts:
                    // - Two immediately following GCDs (not in No Mercy)
                    // - The 9 GCDs we'll get in No Mercy
                    if (readyAt.relative + NoMercyBuff.duration <= cp.stats.gcdPhys(2.5) * 11) {
                        return cp.getGnashingFangComboToUse();
                    }
                }

                // Special Gnashing logic: 8 GCD No Mercy
                // Is No Mercy coming up after three GCDs?
                if (readyAt.absolute <= cp.nextGcdTime + (cp.stats.gcdPhys(2.5) * 3)) {
                    // The 11 here counts:
                    // - Three immediately following GCD (not in No Mercy)
                    // - The 8 GCDs we'll get in No Mercy
                    if (readyAt.relative + NoMercyBuff.duration <= cp.stats.gcdPhys(2.5) * 11) {
                        return cp.getGnashingFangComboToUse();
                    }
                }
            }
        }

        // We've somehow managed to have Bloodfest combo up out of No Mercy. This shouldn't happen but just in case,
        // this prevents us holding it until the next No Mercy, breaking the rules of the game.
        if (cp.isBloodfestComboActive()) {
            console.warn(`[GNB Sim][${formatDuration(cp.currentTime)}] attempted to use Bloodfest combo out of No Mercy (bug in rotation logic)`);
            return cp.getBloodfestComboToUse();
        }


        if (this.willOvercapCartsNextGCD(cp)) {
            return Actions.BurstStrike;
        }

        if (cp.fightEndingSoon() && cp.gauge.cartridges >= 1) {
            return Actions.BurstStrike;
        }

        // Last priority, use 123 combo
        return cp.getComboToUse();
    }

    // Uses GNB actions as part of a rotation.
    useGnbRotation(cp: GnbCycleProcessor) {
        ////////
        ///oGCDs
        ////////
        let activeContinuation: GnbOgcdAbility = undefined;
        if (cp.isContinuationReady()) {
            activeContinuation = cp.getActiveContinuationAction();
            // Should always be defined, but just in case.
            if (activeContinuation) {
                // Prefer using No Mercy -> Continuation if possible
                // Except for Abdomen Tear, since it means we'll be going for a 9 GCD NM.
                if (cp.canUseOgcdsWithoutClipping([Actions.NoMercy, activeContinuation]) && activeContinuation.id !== Actions.AbdomenTear.id) {
                    this.use(cp, Actions.NoMercy);
                    this.use(cp, activeContinuation);
                }
                // Then, prioritize Continuation -> No Mercy
                else if (cp.canUseWithoutClipping(activeContinuation)) {
                    this.use(cp, activeContinuation);
                }
            }
        }

        if (activeContinuation?.id === Actions.AbdomenTear.id) {
            if (cp.canUseWithoutClipping(Actions.NoMercy)) {
                cp.advanceForLateWeave([Actions.NoMercy]);
                this.use(cp, Actions.NoMercy);
            }
        }

        if (cp.canUseWithoutClipping(Actions.NoMercy)) {
            this.use(cp, Actions.NoMercy);
        }

        const shouldBloodFest = cp.stats.level >= 76 && cp.gauge.cartridges === 0;
        const ogcdsToCheck = shouldBloodFest
            ? [Actions.Bloodfest, Actions.BowShock, cp.blastingZoneAbility]
            : [Actions.BowShock, cp.blastingZoneAbility];
        const ogcds = cp.getTopTwoPriorityOgcds(ogcdsToCheck);
        if (ogcds.length === 2) {
            this.use(cp, ogcds[0]);
            this.use(cp, ogcds[1]);
        }

        // Bloodfest is unlocked at level 76.
        if (cp.stats.level >= 76) {
            if (cp.canUseWithoutClipping(Actions.Bloodfest)) {
                this.use(cp, Actions.Bloodfest);
            }
        }

        if (cp.canUseWithoutClipping(Actions.BowShock)) {
            this.use(cp, Actions.BowShock);
        }

        if (cp.canUseWithoutClipping(cp.blastingZoneAbility)) {
            this.use(cp, cp.blastingZoneAbility);
        }

        if (cp.shouldPot() && cp.canUseWithoutClipping(potionMaxStr)) {
            this.use(cp, potionMaxStr);
        }

        ////////
        ////GCDs
        ////////
        // If we don't have time to use a GCD, return early.
        if (cp.remainingGcdTime <= 0) {
            return;
        }

        this.use(cp, (this.getGCDToUse(cp)));
    }

    use(cp: GnbCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        const gnbAbility = ability as GnbAbility;

        // Log when we try to use more gauge than what we currently have
        if (gnbAbility.cartridgeCost > cp.gauge.cartridges) {
            console.warn(`[GNB Sim][${formatDuration(cp.currentTime)}] Attempted to use ${gnbAbility.name} when you only have ${cp.gauge.cartridges} carts`);
            return null;
        }

        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (ability.type === 'ogcd' && cp.canUseWithoutClipping(ability)) {
            const readyAt = cp.cdTracker.statusOf(ability).readyAt.absolute;
            if (cp.totalTime > readyAt) {
                cp.advanceTo(readyAt);
            }
        }

        // Only use potion if enabled in settings
        if (!this.settings.usePotion && ability.name.includes("of Strength")) {
            return null;
        }

        // Update gauge
        if (gnbAbility.updateCartridges !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }
            gnbAbility.updateCartridges(cp.gauge);
        }

        return cp.use(ability);
    }

    private useOpener70(cp: GnbCycleProcessor) {
        cp.advanceTo(STANDARD_ANIMATION_LOCK);
        this.use(cp, Actions.LightningShot);
        this.use(cp, cp.getComboToUse());
        cp.advanceForLateWeave([potionMaxStr]);
        this.use(cp, potionMaxStr);
        this.use(cp, cp.getComboToUse());
        cp.advanceForLateWeave([Actions.NoMercy]);
        this.use(cp, Actions.NoMercy);
        this.use(cp, cp.getComboToUse());
        this.use(cp, Actions.DangerZone);
        this.use(cp, Actions.BowShock);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.JugularRip);
        this.use(cp, Actions.SonicBreak);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.AbdomenTear);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.EyeGouge);
    }

    private useOpener8090(cp: GnbCycleProcessor) {
        const gcd = cp.stats.gcdPhys(2.5);
        cp.advanceTo(STANDARD_ANIMATION_LOCK);
        this.use(cp, Actions.LightningShot);
        this.use(cp, cp.getComboToUse());
        if (gcd <= 2.47) {
            this.use(cp, cp.getComboToUse());
            cp.advanceForLateWeave([potionMaxStr]);
            this.use(cp, potionMaxStr);
            this.use(cp, cp.getComboToUse());
            cp.advanceForLateWeave([Actions.NoMercy]);
            this.use(cp, Actions.NoMercy);
            this.use(cp, cp.getGnashingFangComboToUse());
            this.use(cp, Actions.BowShock);
            this.use(cp, Actions.JugularRip);
            this.use(cp, Actions.SonicBreak);
            this.use(cp, Actions.BlastingZone);
            this.use(cp, Actions.Bloodfest);
        }
        else {
            cp.advanceForLateWeave([potionMaxStr]);
            this.use(cp, potionMaxStr);
            this.use(cp, cp.getComboToUse());
            this.use(cp, Actions.NoMercy);
            this.use(cp, Actions.Bloodfest);
            this.use(cp, cp.getGnashingFangComboToUse());
            this.use(cp, Actions.JugularRip);
            this.use(cp, Actions.SonicBreak);
            this.use(cp, Actions.BlastingZone);
            this.use(cp, Actions.BowShock);
        }
        if (cp.stats.level >= 90) {
            this.use(cp, Actions.DoubleDown);
        }
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.AbdomenTear);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.EyeGouge);
    }

    private useLevel100Opener(cp: GnbCycleProcessor,  gcd: number) {
        cp.advanceTo(STANDARD_ANIMATION_LOCK);
        this.use(cp, Actions.LightningShot);
        this.use(cp, Actions.Bloodfest);
        this.use(cp, cp.getComboToUse());
        this.use(cp, cp.getComboToUse());
        if (gcd === 2.50) {
            this.use(cp, Actions.NoMercy);
            cp.advanceForLateWeave([potionMaxStr]);
            this.use(cp, potionMaxStr);
        }
        else {
            cp.advanceForLateWeave([potionMaxStr, Actions.NoMercy]);
            this.use(cp, potionMaxStr);
            this.use(cp, Actions.NoMercy);
        }
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.JugularRip);
        this.use(cp, Actions.BowShock);
        this.use(cp, Actions.DoubleDown);
        this.use(cp, Actions.BlastingZone);
        this.use(cp, Actions.SonicBreak);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.AbdomenTear);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.EyeGouge);
        this.use(cp, cp.getBloodfestComboToUse());
        this.use(cp, cp.getBloodfestComboToUse());
        this.use(cp, cp.getBloodfestComboToUse());
        this.use(cp, cp.getComboToUse());
        this.use(cp, cp.getGnashingFangComboToUse());
    }

    private useOpener(cp: GnbCycleProcessor, gcd: number) {
        if (cp.stats.level === 100) {
            this.useLevel100Opener(cp, gcd);
        }
        else if (cp.stats.level >= 80 && cp.stats.level <= 90) {
            this.useOpener8090(cp);
        }
        else {
            this.useOpener70(cp);
        }
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<GnbCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const settings = {...this.settings};
        const outer = this;

        console.log(`[GNB Sim] Running Rotation for ${gcd} GCD...`);
        console.log(`[GNB Sim] Settings configured: ${JSON.stringify(settings)}`);
        return [{
            cycleTime: 120,
            apply(cp: GnbCycleProcessor) {
                outer.useOpener(cp, gcd);

                cp.remainingCycles(() => {
                    outer.useGnbRotation(cp);
                });
            },
        }];
    }
}
