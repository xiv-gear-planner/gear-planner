import {Ability, SimSettings, SimSpec, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {formatDuration} from "@xivgear/util/strutils";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {GnbGauge} from "./gnb_gauge";
import {GnbGcdAbility, GnbOgcdAbility, ReadyToBlastBuff, ReadyToRipBuff, NoMercyBuff, ReadyToTearBuff, ReadyToGougeBuff, ReadyToBreakBuff, ReadyToReignBuff, GnbExtraData, GnbAbility} from "./gnb_types";
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
    // If set, will make the rotation 'cheat' and assume that Gnashing
    // Fang and Double Down align perfectly with the GCD.
    // This will make the rotation consistent across sub-tiers of SKS.
    pretendThatMicroclipsDontExist: boolean;
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
        if (this._combo >= 3) this._combo = 0;
    }

    get gnashingFangCombo() {
        return this._gnashingFangCombo;
    };

    set gnashingFangCombo(newCombo) {
        this._gnashingFangCombo = newCombo;
        if (this._gnashingFangCombo >= 3) this._gnashingFangCombo = 0;
    }

    get bloodfestCombo() {
        return this._bloodfestCombo;
    };

    set bloodfestCombo(newCombo) {
        this._bloodfestCombo = newCombo;
        if (this._bloodfestCombo >= 3) this._bloodfestCombo = 0;
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

    isReadyToBlastBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const rtb = buffs.find(buff => buff.name === ReadyToBlastBuff.name);
        return rtb !== undefined;
    }

    isContinuationReady(): boolean {
        return this.isReadyToRipBuffActive() || this.isReadyToTearBuffActive() || this.isReadyToGougeBuffActive() || this.isReadyToBlastBuffActive();
    }

    wouldOvercapCartsFromUpcomingBloodfest(): boolean {
        if (this.stats.level < 76) {
            // We don't have Bloodfest unlocked.
            return false;
        }
        const carts = this.gauge.cartridges;
        const bloodfestOffCdRelative = this.cdTracker.statusOf(Actions.Bloodfest).readyAt.relative;
        const gcdSpeed = this.stats.gcdPhys(2.5);
        // Is Bloodfest coming up in N GCDs, where N is the number of carts we have?
        // We add the extra GCD minus the animation lock of Bloodfest as it could be weaved after
        const timeToSpendCarts = gcdSpeed * carts;
        const oneGcdMinusAnimationLock = gcdSpeed - STANDARD_ANIMATION_LOCK;
        return bloodfestOffCdRelative <= timeToSpendCarts + oneGcdMinusAnimationLock;
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
            pretendThatMicroclipsDontExist: true,
        };
    }

    willOvercapCartsNextGCD(cp: GnbCycleProcessor): boolean {
        return cp.gauge.cartridges === cp.gauge.maxCartridges && cp.rotationState.combo === 2;
    }

    shouldUseGCD(cp: GnbCycleProcessor, ability: GnbGcdAbility): boolean {
        const cooldown = cp.cdTracker.statusOfAt(ability, cp.nextGcdTime);
        const relativeCooldown = cooldown.readyAt.relative;
        const gcdSpeed = cp.stats.gcdPhys(2.5);
        // This check needs to be added for strange GCD tiers. It's better to microclip than let Gnashing
        // Fang and Double Down drift out of No Mercy.
        if (ability.id === Actions.DoubleDown.id && !(cp.getNoMercyDuration() > 0)) {
            // Double Down will naturally be faster than No Mercy at faster speeds, but
            // we always want it to be in No Mercy.
            return false;
        }
        // If No Mercy isn't up AND it's coming up next GCD, we should wait a GCD.
        if (ability.id === Actions.GnashingFang.id && (!(cp.getNoMercyDuration() > 0) &&  cp.cdTracker.statusOfAt(Actions.NoMercy, cp.nextGcdTime + gcdSpeed).readyToUse)) {
            return false;
        }

        // (gcdSpeed / 20) is the potential amount it could be delayed by.
        const shouldUseGCD = relativeCooldown === 0  || relativeCooldown <= (gcdSpeed / 20);
        if (shouldUseGCD) {
            // We are microclipping
            if (relativeCooldown > 0) {
                cp.advanceTo(cooldown.readyAt.absolute);
            }
        }
        return shouldUseGCD;
    }

    // Gets the next GCD to use in the GNB rotation.
    // Note: this is stateful, and updates combos to the next combo.
    getGCDToUse(cp: GnbCycleProcessor): GnbGcdAbility {
        const noMercyDuration = cp.getNoMercyDuration();
        // If we have less than thirty seconds, but still enough time to do our bigger attacks, use Sonic Break as soon as possible.
        const timeRemaining =  cp.totalTime - cp.currentTime;
        if (cp.isReadyToBreakBuffActive() && (timeRemaining < 30) && (noMercyDuration > 0 && timeRemaining > cp.stats.gcdPhys(2.5) * 4)) {
            return Actions.SonicBreak;
        }

        // Start Gnashing Fang combo
        if (cp.gauge.cartridges >= Actions.GnashingFang.cartridgeCost && this.shouldUseGCD(cp, Actions.GnashingFang)) {
            return cp.getGnashingFangComboToUse();
        }

        if (cp.stats.level >= 90) {
            if (cp.gauge.cartridges >= Actions.DoubleDown.cartridgeCost && this.shouldUseGCD(cp, Actions.DoubleDown)) {
                return Actions.DoubleDown;
            }
        }

        // If we're at level 100 (and have the Bloodfest combo) we want to spend carts early.
        // Otherwise, we just don't want to overcap.
        if (cp.stats.level >= 100) {
            if (cp.gauge.cartridges >= 1 && cp.wouldOvercapCartsFromUpcomingBloodfest()) {
                return Actions.BurstStrike;
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

        // If we have Bloodfest unlocked
        if (cp.stats.level >= 76) {
            // Spend carts if Bloodfest is waiting for us.
            if (noMercyDuration > 0 && cp.haveCartsAndBloodfestIsOffCooldown()) {
                return Actions.BurstStrike;
            }
        }

        if (cp.isReadyToBreakBuffActive()) {
            return Actions.SonicBreak;
        }

        // Start or continue Bloodfest Combo at a higher priority if we only have that many GCDs left, since it's our biggest
        if (noMercyDuration > 0 && (cp.isReadyToReignBuffActive() || cp.isBloodfestComboActive()) && timeRemaining < cp.stats.gcdPhys(2.5) * (4 - cp.rotationState.bloodfestCombo)) {
            return cp.getBloodfestComboToUse();
        }

        // Continue Gnashing Fang combo
        if (cp.isGnashingFangComboActive()) {
            return cp.getGnashingFangComboToUse();
        }

        const lionHeartNext = cp.rotationState.bloodfestCombo === 2;
        const twoPlusGCDsLeftInNoMercy = noMercyDuration >= (cp.nextGcdTime - cp.currentTime) + cp.stats.gcdPhys(2.5);
        // Dump resources if in burst at a higher priority than Bloodfest combo if we have time to finish our Bloodfest combo.
        // This means that Continuation will stay in No Mercy.
        if (lionHeartNext && twoPlusGCDsLeftInNoMercy && cp.gauge.cartridges > numberOfCartSpendingGcdsUpBeforeNoMercyExpires) {
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

        // If No Mercy is up after this GCD and we will only get 8 GCDs in the upcoming No Mercy, then we
        // can use Burst Strike beforehand for a buffed Hypervelocity.
        // We check level since there will be Burst Strike GCDs in sub 100 GNB, whereas there won't for 100 GNB.
        if (cp.stats.level >= 100) {
            const readyAt = cp.cdTracker.statusOf(Actions.NoMercy).readyAt;
            // Is No Mercy coming up after this GCD?
            if (readyAt.absolute <= cp.nextGcdTime + cp.stats.gcdPhys(2.5) - STANDARD_ANIMATION_LOCK) {
                // Will we only get 8 GCDs in it?
                // The 9 here counts:
                // - The immediately following GCD (not in No Mercy)
                // - The 8 GCDs we'll get in No Mercy
                // We check Ready To Reign to make sure it's a 2m burst. Otherwise the Burst Strike
                // we're about to use would go in the No Mercy fully.
                const aboutToStart2mBurst = cp.gauge.cartridges === 3 && cp.isReadyToReignBuffActive();
                if (readyAt.relative + NoMercyBuff.duration <= cp.stats.gcdPhys(2.5) * 9 && aboutToStart2mBurst) {
                    return Actions.BurstStrike;
                }
            }
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
        if (cp.isContinuationReady()) {
            const continuation: GnbOgcdAbility = cp.getActiveContinuationAction();
            // Should always be defined, but just in case.
            if (continuation) {
                // Prefer using No Mercy -> Continuation if possible
                if (cp.canUseOgcdsWithoutClipping([Actions.NoMercy, continuation] )) {
                    this.use(cp, Actions.NoMercy);
                    this.use(cp, continuation);

                }
                // Then, prioritize Continuation -> No Mercy
                else if (cp.canUseWithoutClipping(continuation)) {
                    this.use(cp, continuation);
                }
            }
        }

        if (cp.canUseWithoutClipping(Actions.NoMercy)) {
            this.use(cp, Actions.NoMercy);
        }

        if (cp.canUseWithoutClipping(Actions.BowShock)) {
            this.use(cp, Actions.BowShock);
        }

        if (cp.canUseWithoutClipping(cp.blastingZoneAbility)) {
            this.use(cp, cp.blastingZoneAbility);
        }

        // We need the cartridge check even though we unload carts before Bloodfest just in case
        // our GCD is at Solid Barrel before Bloodfest comes up. In this case, we intentionally drift
        // Bloodfest slightly.
        // Bloodfest is unlocked at level 76.
        if (cp.stats.level >= 76) {
            if (cp.canUseWithoutClipping(Actions.Bloodfest) && cp.gauge.cartridges === 0) {
                this.use(cp, Actions.Bloodfest);
            }
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

        if (this.settings.pretendThatMicroclipsDontExist) {
            const gcd = cp.stats.gcdPhys(2.5);
            if (gnbAbility.name === Actions.GnashingFang.name || gnbAbility.name === Actions.DoubleDown.name) {
                // Note: this pushes us forward the ability's animation lock.
                // For e.g. Gnashing Fang at 2.48 (29.85 CD) the cooldown without having
                // the animation lock re-added will be 29.25.
                const result = cp.use(ability);
                const animationLock = gnbAbility.animationLock ?? STANDARD_ANIMATION_LOCK;
                const cooldown = cp.cdTracker.statusOf(gnbAbility).readyAt.relative + animationLock;
                const cooldownWithoutMicroclips = (gnbAbility.cooldown.time / cp.gcdBase) * gcd;
                // e.g. for 2.48 this will be:
                // 29.76 - 29.85 = -0.09
                // which will effectively 'fix' the cooldown as if it was the ideal speed.
                cp.cdTracker.modifyCooldown(gnbAbility, cooldownWithoutMicroclips - cooldown);
                return result;
            }
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


    // For GCD Speeds >=2.48
    private useSlowOpener(cp: GnbCycleProcessor) {
        cp.advanceTo(STANDARD_ANIMATION_LOCK);
        this.use(cp, Actions.LightningShot);
        this.use(cp, Actions.Bloodfest);
        this.use(cp, cp.getComboToUse());
        cp.advanceForLateWeave([potionMaxStr]);
        this.use(cp, potionMaxStr);
        this.use(cp, Actions.BurstStrike);
        this.use(cp, Actions.NoMercy);
        this.use(cp, Actions.Hypervelocity);
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
    }

    private useFastOpener(cp: GnbCycleProcessor) {
        cp.advanceTo(STANDARD_ANIMATION_LOCK);
        this.use(cp, Actions.LightningShot);
        this.use(cp, Actions.Bloodfest);
        this.use(cp, cp.getComboToUse());
        cp.advanceForLateWeave([potionMaxStr]);
        this.use(cp, potionMaxStr);
        this.use(cp, cp.getComboToUse());
        cp.advanceForLateWeave([Actions.NoMercy]);
        this.use(cp, Actions.NoMercy);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.JugularRip);
        this.use(cp, Actions.BowShock);
        this.use(cp, Actions.DoubleDown);
        this.use(cp, Actions.BlastingZone);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.AbdomenTear);
        this.use(cp, cp.getGnashingFangComboToUse());
        this.use(cp, Actions.EyeGouge);
        this.use(cp, cp.getBloodfestComboToUse());
        this.use(cp, cp.getBloodfestComboToUse());
        this.use(cp, cp.getBloodfestComboToUse());
        this.use(cp, Actions.BurstStrike);
        this.use(cp, Actions.Hypervelocity);
        this.use(cp, Actions.SonicBreak);
    }

    private useOpener(cp: GnbCycleProcessor, gcd: number) {
        if (cp.stats.level === 100) {
            if (gcd >= 2.48) {
                this.useSlowOpener(cp);
            }
            else {
                this.useFastOpener(cp);
            }
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
        const settings = { ...this.settings };
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
