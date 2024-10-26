import { Ability, SimSettings, SimSpec, OgcdAbility } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { combineBuffEffects } from "@xivgear/core/sims/sim_utils";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { formatDuration } from "@xivgear/core/util/strutils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { Darkside, DrkGauge } from "./drk_gauge";
import { DrkExtraData, DrkAbility, DrkGcdAbility, ScornBuff, SaltedEarthBuff, DeliriumBuff, BloodWeaponBuff, DrkOgcdAbility } from "./drk_types";
import { sum } from "@xivgear/core/util/array_utils";
import * as Actions from './drk_actions';
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";
import { potionMaxStr } from "@xivgear/core/sims/common/potion";

export interface DrkSimResult extends CycleSimResult {

}

export interface DrkSettings extends SimSettings {
    // If we use potions (used every six minutes).
    usePotion: boolean;
    // If we use a pre-pull TBN.
    prepullTBN: boolean;
    // the length of the fight in seconds
    fightTime: number;
    // TODO: should we add a prepull Shadowstride option? Would be nice to compare on differing killtimes
}

export interface DrkSettingsExternal extends ExternalCycleSettings<DrkSettings> {

}

export const drkSpec: SimSpec<DrkSim, DrkSettingsExternal> = {
    stub: "drk-sheet-sim",
    displayName: "DRK Sim",
    description: `Simulates a DRK rotation for level 100/90/80/70.
If potions are enabled, pots in the burst window every 6m (i.e. 0m, 6m, 12m, etc).
Defaults to simulating a killtime of 8m 30s (510s).`,
    makeNewSimInstance: function (): DrkSim {
        return new DrkSim();
    },
    loadSavedSimInstance: function (exported: DrkSettingsExternal) {
        return new DrkSim(exported);
    },
    supportedJobs: ['DRK'],
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

// LivingShadowAbilityUsageTime is a type representing two things:
// - a Living Shadow ability
// - the time it should go off at
// This should be further enhanced to only include abilities where the
// actor is Living Shadow, once that has been implemented for correct stats.
type LivingShadowAbilityUsageTime = {
    // The Living Shadow ability to use
    ability: DrkAbility,
    // The time to use the ability at
    usageTime: number,
}

class RotationState {
    private _combo: number = 0;
    private _deliriumCombo: number = 0;

    get combo() {
        return this._combo;
    };
    get deliriumCombo() {
        return this._deliriumCombo;
    };

    set combo(newCombo) {
        this._combo = newCombo;
        if (this._combo >= 3) this._combo = 0;
    }

    set deliriumCombo(newCombo) {
        this._deliriumCombo = newCombo;
        if (this._deliriumCombo >= 3) this._deliriumCombo = 0;
    }
}

class DrkCycleProcessor extends CycleProcessor {
    gauge: DrkGauge;
    rotationState: RotationState;
    mpTicks = 0;
    // livingShadowAbilityUsages tracks which remaining Living Shadow abilities we have
    // upcoming. It's implemented this way so that the entries and buffs are correct
    // on the timeline.
    livingShadowAbilityUsages: LivingShadowAbilityUsageTime[] = [];

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new DrkGauge();
        this.rotationState = new RotationState();
    }

    // Gets the DRK ability with Blood Weapon's blood and MP additions
    // added to it.
    getDrkAbilityWithBloodWeapon(ability: DrkAbility): DrkAbility {
        return this.beforeAbility(ability, this.getActiveBuffsFor(ability));
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

    applyLivingShadowAbility(abilityUsage: LivingShadowAbilityUsageTime) {
        const buffs = [...this.getActiveBuffs(abilityUsage.usageTime)];
        let darksideDuration = 0;
        // Get what the the Darkside duration would be at this
        // point of time, for visualization in the UI
        const darkside = buffs.find(buff => buff.name === Darkside.name);
        const buffData = darkside && this.getActiveBuffData(darkside, abilityUsage.usageTime);
        if (buffData) {
            darksideDuration = Math.round(buffData.end - abilityUsage.usageTime);
        }

        // However, Darkside does not apply to Living Shadow abilities, so
        // we should remove it.
        const filteredBuffs = buffs.filter(buff => {
            return buff.name !== Darkside.name && buff.name !== BloodWeaponBuff.name && buff.name !== DeliriumBuff.name && buff.name !== ScornBuff.name;
        });

        this.addAbilityUse({
            usedAt: abilityUsage.usageTime,
            ability: abilityUsage.ability,
            buffs: filteredBuffs,
            combinedEffects: combineBuffEffects(filteredBuffs),
            totalTimeTaken: 0,
            appDelay: abilityUsage.ability.appDelay,
            appDelayFromStart: abilityUsage.ability.appDelay,
            castTimeFromStart: 0,
            snapshotTimeFromStart: 0,
            lockTime: 0,
        }, darksideDuration);
    }


    // Optional darkside duration so that it can be given manually (what it 'would be')
    // for abilities where it doesn't apply (Living Shadow's abilities).
    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf, darksideDuration = 0) {
        // Add gauge data to this record for the UI
        const extraData: DrkExtraData = {
            gauge: this.gauge.getGaugeState(),
            darksideDuration: darksideDuration,
        };

        const darkside = usedAbility.buffs.find(buff => buff.name === Darkside.name);
        const buffData = darkside && this.getActiveBuffData(darkside, usedAbility.usedAt);
        if (buffData) {
            extraData.darksideDuration = Math.round(buffData.end - usedAbility.usedAt);
        }

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    comboActions: DrkGcdAbility[] = [Actions.HardSlash, Actions.SyphonStrike, Actions.Souleater];
    getComboToUse() {
        return this.comboActions[this.rotationState.combo++];
    }

    deliriumComboActions: DrkGcdAbility[] = [Actions.ScarletDelirium, Actions.Comeuppance, Actions.Torcleaver];
    getDeliriumComboToUse() {
        if (this.stats.level < 100) {
            return Actions.Bloodspiller;
        }
        return this.deliriumComboActions[this.rotationState.deliriumCombo++];
    }

    inBurst(): boolean {
        const timeIntoTwoMinutes = this.currentTime % 120;

        // Seven seconds after every (i.e. 0:07, 2:07, etc) burst, buffs will be up,
        // and will remain up for twenty seconds.
        return 7 < timeIntoTwoMinutes && timeIntoTwoMinutes < 27;
    }

    // If the fight is ending within the next 12 seconds (to dump resources)
    fightEndingSoon(): boolean {
        return this.currentTime > (this.totalTime - 12);
    }

    isDeliriumActive(): boolean {
        const buffs = this.getActiveBuffs();
        const delirium = buffs.find(buff => buff.name === DeliriumBuff.name);
        return delirium !== undefined;
    }

    wouldOvercapBloodInUpcomingDelirium(): boolean {
        // Is Delirium coming up?
        if (this.cdTracker.statusOf(Actions.Delirium).readyAt.relative < (this.stats.gcdPhys(2.5) * 2)) {
            // Are we about to get to a blood value that would cause Delirium to overcap?
            if (this.gauge.bloodGauge >= 80 || (this.gauge.bloodGauge >= 70 && this.rotationState.combo === 2)) {
                return true;
            }
        }
        return false;
    }

    getEdgeAction(): DrkOgcdAbility {
        if (this.stats.level < 74) {
            return Actions.EdgeOfDarkness;
        }
        return Actions.EdgeOfShadow;
    }

    isBloodWeaponActive(): boolean {
        const buffs = this.getActiveBuffs();
        const bloodWeapon = buffs.find(buff => buff.name === BloodWeaponBuff.name);
        return bloodWeapon !== undefined;
    }

    getDarksideDuration(): number {
        let darksideDuration = 0;
        const buffs = this.getActiveBuffs();
        const darkside = buffs.find(buff => buff.name === Darkside.name);
        const buffData = darkside && this.getActiveBuffData(darkside, this.currentTime);
        if (buffData) {
            darksideDuration = Math.round(buffData.end - this.currentTime);
        }
        return darksideDuration;
    }

    shouldPot(): boolean {
        const sixMinutesInSeconds = 360;
        const timeInSixMinuteWindow = this.currentTime % sixMinutesInSeconds;
        return timeInSixMinuteWindow > 2.7 && timeInSixMinuteWindow < 22.7;
    }

    shouldUseTBN(): boolean {
        const timeIntoTwoMinutes = this.currentTime % 120;
        const timeUntilNextBurst = 120 - timeIntoTwoMinutes;
        return timeUntilNextBurst < 22 && !this.gauge.darkArts && this.gauge.magicPoints >= 3000;
    }

    isScornActive(): boolean {
        return this.getActiveBuffData(ScornBuff, this.currentTime)?.buff?.duration > 0;
    }

    isSaltedEarthActive(): boolean {
        return this.getActiveBuffData(SaltedEarthBuff, this.currentTime)?.buff?.duration > 0;
    }
}

export class DrkSim extends BaseMultiCycleSim<DrkSimResult, DrkSettings, DrkCycleProcessor> {
    spec = drkSpec;
    shortName = "drk-sheet-sim";
    displayName = drkSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: this.settings.fightTime,
        cycles: 0,
        which: 'totalTime',
        cutoffMode: 'prorate-gcd',
    };

    constructor(settings?: DrkSettingsExternal) {
        super('DRK', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): DrkCycleProcessor {
        return new DrkCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    override makeDefaultSettings(): DrkSettings {
        return {
            usePotion: true,
            prepullTBN: true,
            // 8 minutes and 30s, or 510 seconds
            // This is chosen since it's two pots, five bursts,
            // and is somewhat even between the two main GCDs.
            fightTime: (8 * 60) + 30,
        };
    }

    // applyLivingShadowAbilities should be called before and after each ability
    // usage to ensure that Living Shadow abilities are correctly positioned on the timeline.
    private applyLivingShadowAbilities(cp: DrkCycleProcessor) {
        if (cp.livingShadowAbilityUsages && cp.livingShadowAbilityUsages.length > 0) {
            const usedAbilities = [];
            cp.livingShadowAbilityUsages.forEach((abilityUsage, index) => {
                if (abilityUsage.usageTime <= cp.currentTime) {
                    cp.applyLivingShadowAbility(abilityUsage);
                    usedAbilities.push(index);
                }
            });
            usedAbilities.forEach(indexToRemove => {
                cp.livingShadowAbilityUsages.splice(indexToRemove, 1);
            });
        }
    }

    // Gets the next GCD to use in the DRK rotation.
    // Note: this is stateful, and updates combos to the next combo.
    getGCDToUse(cp: DrkCycleProcessor): DrkGcdAbility {
        // Not overcapping blood for an upcoming Delirium a higher priority than Disesteem.
        // This is only really needed for unrealistically high GCD speeds, but it doesn't
        // affect reasonable GCD speeds in any way.
        if (!cp.isDeliriumActive() && cp.wouldOvercapBloodInUpcomingDelirium()) {
            return Actions.Bloodspiller;
        }

        if (cp.inBurst() && cp.isScornActive()) {
            return Actions.Disesteem;
        }

        // If Delirium is active, this must be higher priority than Bloodspillers
        // since we can't use Bloodspillers via Blood.
        if (cp.isDeliriumActive()) {
            return cp.getDeliriumComboToUse();
        }

        // Avoid overcapping blood:
        if (cp.wouldOvercapBloodInUpcomingDelirium()) {
            return Actions.Bloodspiller;
        }

        if (cp.inBurst() && cp.gauge.bloodGauge >= 50){
            return Actions.Bloodspiller;
        }

        // Dump blood before the end of the fight.
        if (cp.fightEndingSoon() && cp.gauge.bloodGauge >= 50) {
            return Actions.Bloodspiller;
        }

        // Next GCD is Souleater
        if (cp.gauge.bloodGauge >= 90 && cp.rotationState.combo === 2) {
            return Actions.Bloodspiller;
        }

        // Last priority, use combo
        return cp.getComboToUse();
    }

    // Uses DRK actions as part of a rotation.
    useDrkRotation(cp: DrkCycleProcessor) {
        ////////
        ///oGCDs
        ////////
        // Higher priority than any other oGCD: avoid overcap of mana
        // Edge of Shadow / Edge of Darkness
        const edgeAction = cp.getEdgeAction();
        const nextGCDSyphonStrike = cp.rotationState.combo === 1;
        // lateWeaveDelirium is true if we could use Delirium later but before the next GCD
        const lateWeaveDelirium = cp.canUseWithoutClipping(Actions.Delirium) && cp.totalTime > cp.cdTracker.statusOf(Actions.Delirium).readyAt.absolute;
        if ((cp.gauge.magicPoints >= 8400) && (nextGCDSyphonStrike || cp.isBloodWeaponActive() || cp.isDeliriumActive() || lateWeaveDelirium)) {
            if (cp.canUseWithoutClipping(edgeAction)) {
                this.use(cp, edgeAction);
            }
        }
        if (cp.gauge.magicPoints >= 9200 && (nextGCDSyphonStrike || cp.isBloodWeaponActive() || cp.isDeliriumActive() || lateWeaveDelirium)) {
            if (cp.canUseWithoutClipping(edgeAction)) {
                this.use(cp, edgeAction);
            }
        }
        if (cp.gauge.magicPoints >= 9800) {
            if (cp.canUseWithoutClipping(edgeAction)) {
                this.use(cp, edgeAction);
            }
        }

        if (cp.stats.level >= 80) {
            if (cp.canUseWithoutClipping(Actions.LivingShadow)) {
                this.use(cp, Actions.LivingShadow);
            }
        }

        if (cp.shouldPot() && cp.canUseWithoutClipping(potionMaxStr)) {
            this.use(cp, potionMaxStr);
        }

        if (cp.stats.level >= 90) {
            if (cp.inBurst() && cp.canUseWithoutClipping(Actions.Shadowbringer)) {
                this.use(cp, Actions.Shadowbringer);
            }
        }

        if (cp.canUseWithoutClipping(Actions.Delirium)) {
            this.use(cp, Actions.Delirium);
        }

        // Refresh Darkside if required
        if (cp.getDarksideDuration() < 5 && cp.canUseWithoutClipping(edgeAction) && (cp.gauge.magicPoints >= 3000 || cp.gauge.darkArts)) {
            this.use(cp, edgeAction);
        }

        if (cp.isSaltedEarthActive() && cp.canUseWithoutClipping(Actions.SaltAndDarkness)) {
            this.use(cp, Actions.SaltAndDarkness);
        }

        if (cp.canUseWithoutClipping(Actions.SaltedEarth)) {
            this.use(cp, Actions.SaltedEarth);
        }

        if (cp.canUseWithoutClipping(Actions.CarveAndSpit)) {
            this.use(cp, Actions.CarveAndSpit);
        }

        if (cp.shouldUseTBN() && cp.canUseWithoutClipping(Actions.TheBlackestNight)) {
            this.use(cp, Actions.TheBlackestNight);
        }

        // Last priority oGCD: send all available Edges in burst
        if (cp.inBurst()) {
            if (cp.canUseWithoutClipping(edgeAction) && (cp.gauge.magicPoints >= 3000 || cp.gauge.darkArts)) {
                this.use(cp, edgeAction);
            }
        }

        // Dump resources if fight ending soon
        if (cp.fightEndingSoon()) {
            if (cp.canUseWithoutClipping(edgeAction) && (cp.gauge.magicPoints >= 3000 || cp.gauge.darkArts)) {
                this.use(cp, edgeAction);
            }

            if (cp.stats.level >= 90) {
                if (cp.canUseWithoutClipping(Actions.Shadowbringer)) {
                    this.use(cp, Actions.Shadowbringer);
                }
            }
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

    useLivingShadow(cp: DrkCycleProcessor) {
        // After 6.8 delay, it does the following rotation with
        // 2.18 seconds between each.
        // Abyssal Drain
        // Shadowstride (no damage)
        // Flood of Shadow (Shadowbringer at level 90+)
        // Edge of Shadow
        // Bloodspiller
        // Carve and Spit (Disesteem at level 100)
        const livingShadowDelay = 6.8;
        const livingShadowDelayBetweenAbilities = 2.18;
        cp.livingShadowAbilityUsages.push({
            // Abyssal Drain
            ability: cp.applyLevelModifiers(Actions.LivingShadowAbyssalDrain),
            usageTime: cp.currentTime + livingShadowDelay,
        });
        // We could skip this, since it does no damage,
        // but it makes the timeline more accurate to reality, so that's nice.
        cp.livingShadowAbilityUsages.push({
            // Shadowstride
            ability: Actions.LivingShadowShadowstride,
            usageTime: cp.currentTime + livingShadowDelay + 1 * livingShadowDelayBetweenAbilities,
        });
        const secondAbility = cp.stats.level === 80 ? Actions.LivingShadowFloodOfShadow : Actions.LivingShadowShadowbringer;
        cp.livingShadowAbilityUsages.push({
            // Flood of Shadow (80) or Shadowbringer (90+)
            ability: cp.applyLevelModifiers(secondAbility),
            usageTime: cp.currentTime + livingShadowDelay + 2 * livingShadowDelayBetweenAbilities,
        });
        cp.livingShadowAbilityUsages.push({
            // Edge of Shadow
            ability: cp.applyLevelModifiers(Actions.LivingShadowEdgeOfShadow),
            usageTime: cp.currentTime + livingShadowDelay + 3 * livingShadowDelayBetweenAbilities,
        });
        cp.livingShadowAbilityUsages.push({
            // Bloodspiller
            ability: cp.applyLevelModifiers(Actions.LivingShadowBloodspiller),
            usageTime: cp.currentTime + livingShadowDelay + 4 * livingShadowDelayBetweenAbilities,
        });
        const fifthAbility = cp.stats.level < 100 ? Actions.LivingShadowCarveAndSpit : Actions.LivingShadowDisesteem;
        cp.livingShadowAbilityUsages.push({
            // Carve And Spit (<100) or Disesteem (100)
            ability: cp.applyLevelModifiers(fifthAbility),
            usageTime: cp.currentTime + livingShadowDelay + 5 * livingShadowDelayBetweenAbilities,
        });
    }

    use(cp: DrkCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        const drkAbility = ability as DrkAbility;

        // Add 200 mp every ~3sish. Very imperfect, but it'll do for now.
        // In the future, MP should probably be refactored into the base processor.
        // We use Math.floor to be pessimistic, i.e. worst case mana ticks.
        const expectedMPTicks = Math.floor(Math.round(cp.currentTime) / 3);
        const differenceInMPTicks = expectedMPTicks - cp.mpTicks;
        if (differenceInMPTicks > 0) {
            cp.mpTicks += differenceInMPTicks;
            cp.gauge.magicPoints += differenceInMPTicks * 200;
        }

        // If we try to use Living Shadow, do it properly
        if (ability.id === Actions.LivingShadow.id) {
            this.useLivingShadow(cp);
        }

        // Apply Living Shadow abilities before attempting to use an ability
        // AND before we move the timeline for that ability.
        this.applyLivingShadowAbilities(cp);

        // Log when we try to use more gauge than what we currently have
        if (!cp.isDeliriumActive() && drkAbility.id === Actions.Bloodspiller.id && cp.gauge.bloodGauge < 50) {
            console.warn(`[DRK Sim][${formatDuration(cp.currentTime)}] Attempted to use Bloodspiller when you only have ${cp.gauge.bloodGauge} blood`);
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

        // Update gauges
        const abilityWithBloodWeapon = cp.getDrkAbilityWithBloodWeapon(ability);
        // If we're attempting to use Bloodspiller with Delirium active, we're pre-level 100, and
        // Bloodspillers are free.
        if (cp.isDeliriumActive() && drkAbility.id === Actions.Bloodspiller.id) {
            // Do not spend Blood for Deliriums.
            // Manually update Blood gauge instead if Blood Weapon is active.
            if (cp.isBloodWeaponActive()) {
                cp.gauge.bloodGauge += 10;
            }
        }
        else {
            if (abilityWithBloodWeapon.updateBloodGauge !== undefined) {
                // Prevent gauge updates showing incorrectly on autos before this ability
                if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                    cp.advanceTo(cp.nextGcdTime);
                }
                abilityWithBloodWeapon.updateBloodGauge(cp.gauge);
            }
        }

        if (abilityWithBloodWeapon.updateMP !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }
            abilityWithBloodWeapon.updateMP(cp.gauge);
        }


        // Apply Living Shadow abilities before attempting to use an ability
        // AND after we move the timeline for that ability.
        this.applyLivingShadowAbilities(cp);

        return cp.use(ability);
    }

    private useLevel80OrBelowOpener(cp: DrkCycleProcessor, prepullTBN: boolean) {
        if (prepullTBN) {
            this.use(cp, Actions.TheBlackestNight);
            cp.advanceTo(3 - STANDARD_ANIMATION_LOCK);
            // Hacky out of combat mana tick.
            // TODO: Refactor this once MP is handled in a more core way
            cp.gauge.magicPoints += 600;
        }
        else {
            cp.advanceTo(1 - STANDARD_ANIMATION_LOCK);
        }
        this.use(cp, Actions.Unmend);
        cp.advanceForLateWeave([potionMaxStr]);
        this.use(cp, potionMaxStr);
        this.use(cp, Actions.HardSlash);
        this.use(cp, cp.getEdgeAction());
        if (cp.stats.level >= 80) {
            this.use(cp, Actions.LivingShadow);
        }
        this.use(cp, Actions.SyphonStrike);
        this.use(cp, Actions.Souleater);
        this.use(cp, Actions.Delirium);
        this.use(cp, cp.getComboToUse());
        this.use(cp, Actions.SaltedEarth);
        this.use(cp, cp.getEdgeAction());
        this.use(cp, Actions.Bloodspiller);
        this.use(cp, cp.getEdgeAction());
        this.use(cp, Actions.Bloodspiller);
        this.use(cp, Actions.CarveAndSpit);
        this.use(cp, cp.getEdgeAction());
        this.use(cp, Actions.Bloodspiller);
        if (prepullTBN) {
            this.use(cp, cp.getEdgeAction());
        }
        this.use(cp, Actions.Bloodspiller);
        if (!prepullTBN) {
            // Without the extra mana, do two filler GCDs before the Edge of Shadow.
            // This is a worst-case scenario mana wise, in reality it may be possible
            // to get the Edge in after the Hard Slash.
            this.use(cp, cp.getComboToUse());
            this.use(cp, cp.getComboToUse());
            this.use(cp, cp.getEdgeAction());
        }
    }

    private useLevel90Opener(cp: DrkCycleProcessor, prepullTBN: boolean) {
        if (prepullTBN) {
            this.use(cp, Actions.TheBlackestNight);
            cp.advanceTo(3 - STANDARD_ANIMATION_LOCK);
            // Hacky out of combat mana tick.
            // TODO: Refactor this once MP is handled in a more core way
            cp.gauge.magicPoints += 600;
        }
        else {
            cp.advanceTo(1 - STANDARD_ANIMATION_LOCK);
        }
        this.use(cp, Actions.Unmend);
        cp.advanceForLateWeave([potionMaxStr]);
        this.use(cp, potionMaxStr);
        this.use(cp, Actions.HardSlash);
        this.use(cp, Actions.EdgeOfShadow);
        this.use(cp, Actions.LivingShadow);
        this.use(cp, Actions.SyphonStrike);
        this.use(cp, Actions.Souleater);
        this.use(cp, Actions.Delirium);
        this.use(cp, cp.getComboToUse());
        this.use(cp, Actions.SaltedEarth);
        this.use(cp, Actions.EdgeOfShadow);
        this.use(cp, Actions.Bloodspiller);
        this.use(cp, Actions.Shadowbringer);
        this.use(cp, Actions.EdgeOfShadow);
        this.use(cp, Actions.Bloodspiller);
        this.use(cp, Actions.CarveAndSpit);
        this.use(cp, Actions.EdgeOfShadow);
        this.use(cp, Actions.Bloodspiller);
        this.use(cp, Actions.Shadowbringer);
        if (prepullTBN) {
            this.use(cp, Actions.EdgeOfShadow);
        }
        this.use(cp, Actions.Bloodspiller);
        this.use(cp, Actions.SaltAndDarkness);
        if (!prepullTBN) {
            // Without the extra mana, do two filler GCDs before the Edge of Shadow.
            // This is a worst-case scenario mana wise, in reality it may be possible
            // to get the Edge in after the Hard Slash.
            this.use(cp, cp.getComboToUse());
            this.use(cp, cp.getComboToUse());
            this.use(cp, Actions.EdgeOfShadow);
        }
    }

    private useLevel100Opener(cp: DrkCycleProcessor, prepullTBN: boolean) {
        if (prepullTBN) {
            this.use(cp, Actions.TheBlackestNight);
            cp.advanceTo(3 - STANDARD_ANIMATION_LOCK);
            // Hacky out of combat mana tick.
            // TODO: Refactor this once MP is handled in a more core way
            cp.gauge.magicPoints += 600;
        }
        else {
            cp.advanceTo(1 - STANDARD_ANIMATION_LOCK);
        }
        this.use(cp, Actions.Unmend);
        cp.advanceForLateWeave([potionMaxStr]);
        this.use(cp, potionMaxStr);
        this.use(cp, Actions.HardSlash);
        this.use(cp, Actions.EdgeOfShadow);
        this.use(cp, Actions.LivingShadow);
        this.use(cp, Actions.SyphonStrike);
        this.use(cp, Actions.Souleater);
        this.use(cp, Actions.Delirium);
        this.use(cp, Actions.Disesteem);
        this.use(cp, Actions.SaltedEarth);
        this.use(cp, Actions.EdgeOfShadow);
        this.use(cp, Actions.ScarletDelirium);
        this.use(cp, Actions.Shadowbringer);
        this.use(cp, Actions.EdgeOfShadow);
        this.use(cp, Actions.Comeuppance);
        this.use(cp, Actions.CarveAndSpit);
        this.use(cp, Actions.EdgeOfShadow);
        this.use(cp, Actions.Torcleaver);
        this.use(cp, Actions.Shadowbringer);
        if (prepullTBN) {
            this.use(cp, Actions.EdgeOfShadow);
        }
        this.use(cp, Actions.Bloodspiller);
        this.use(cp, Actions.SaltAndDarkness);
        if (!prepullTBN) {
            // Without the extra mana, do two filler GCDs before the Edge of Shadow.
            // This is a worst-case scenario mana wise, in reality it may be possible
            // to get the Edge in after the Hard Slash.
            this.use(cp, cp.getComboToUse());
            this.use(cp, cp.getComboToUse());
            this.use(cp, Actions.EdgeOfShadow);
        }
    }

    private useOpener(cp: DrkCycleProcessor, prepullTBN: boolean) {
        if (cp.stats.level === 100) {
            this.useLevel100Opener(cp, prepullTBN);
        }
        else if (cp.stats.level === 90) {
            this.useLevel90Opener(cp, prepullTBN);
        }
        else {
            this.useLevel80OrBelowOpener(cp, prepullTBN);
        }
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<DrkCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const settings = { ...this.settings };
        const outer = this;

        console.log(`[DRK Sim] Running Rotation for ${gcd} GCD...`);
        console.log(`[DRK Sim] Settings configured: ${JSON.stringify(settings)}`);
        return [{
            cycleTime: 120,
            apply(cp: DrkCycleProcessor) {
                outer.useOpener(cp, settings.prepullTBN);

                cp.remainingCycles(() => {
                    outer.useDrkRotation(cp);
                });
            },
        }];
    }
}
