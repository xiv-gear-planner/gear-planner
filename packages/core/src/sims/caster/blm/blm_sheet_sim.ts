import {Ability, SimSettings, SimSpec, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {combineBuffEffects} from "@xivgear/core/sims/sim_utils";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {formatDuration} from "@xivgear/util/strutils";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {BlmGauge} from "./blm_gauge";
import {BlmExtraData, BlmAbility, BlmGcdAbility, LeyLinesBuff, FirestarterBuff, BlmOgcdAbility, ThunderheadBuff} from "./blm_types";
import {sum} from "@xivgear/util/array_utils";
import * as Actions from './blm_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxInt} from "@xivgear/core/sims/common/potion";
import {fl} from "@xivgear/xivmath/xivmath";

export interface BlmSimResult extends CycleSimResult {

}

export interface BlmSettings extends SimSettings {
    // If we use potions (used every six minutes).
    usePotion: boolean;
    // If we use a pre-pull Ley Lines.
    prepullLL: boolean;
    // If we use the ST Flare opener.
    useFlareOpener: boolean;
    // If we transpose out of Astral Fire.
    transposeFromAstralFire: boolean;
    // If we transpose out of Umbral Ice (spend instants for it).
    transposeFromUmbralIce: boolean;
    // the length of the fight in seconds
    fightTime: number;
}

export interface BlmSettingsExternal extends ExternalCycleSettings<BlmSettings> {

}

export const blmSpec: SimSpec<BlmSim, BlmSettingsExternal> = {
    stub: "blm-sheet-sim",
    displayName: "BLM Sim",
    description: `Simulates a BLM rotation for level 100.
If potions are enabled, pots in the burst window every 6m (i.e. 0m, 6m, 12m, etc).
Defaults to simulating a killtime of 8m 30s (510s).`,
    makeNewSimInstance: function (): BlmSim {
        return new BlmSim();
    },
    loadSavedSimInstance: function (exported: BlmSettingsExternal) {
        return new BlmSim(exported);
    },
    supportedJobs: ['BLM'],
    supportedLevels: [100],
    isDefaultSim: true,
    maintainers: [{
        name: 'Rika',
        contact: [{
            type: 'discord',
            discordTag: 'syntheticglottalstop',
            discordUid: '1111309997482193017',
        }],
    }],
};

class BlmCycleProcessor extends CycleProcessor {
    gauge: BlmGauge;
    nextThunderTime: number = 0;
    nextPolyglotTime: number = 30;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new BlmGauge();
    }

    // Gets Fire/Ice spells with potency/cast time/MP cost adjusted for the current element.
    getBlmAbilityAdjusted(ability: BlmAbility): BlmAbility {
        let mods = {
            potency: ability.potency,
            cast: ability.cast ?? 0,
            mp: ability.mp ?? 0,
        };
        if (ability.element === 'fire') {
            mods.potency *= this.gauge.getFirePotencyMulti();
            mods.cast *= this.gauge.getFireCastMulti();
            if (typeof mods.mp === "number") {
                mods.mp *= this.gauge.getFireMpMulti();
            }
        }
        else if (ability.element === 'ice') {
            mods.potency *= this.gauge.getIcePotencyMulti();
            mods.cast *= this.gauge.getIceCastMulti();
            if (typeof mods.mp === "number") {
                mods.mp *= this.gauge.getIceMpMulti();
            }
        }
        // Enochian damage buff if Fire/Ice active.
        if (this.gauge.aspect !== 0) {
            if (this.stats.level >= 96) {
                mods.potency *= 1.27;
            }
            else if (this.stats.level >= 86) {
                mods.potency *= 1.22;
            }
            else if (this.stats.level >= 78) {
                mods.potency *= 1.15;
            }
            else if (this.stats.level >= 70) {
                mods.potency *= 1.10;
            }
        }
        return {...ability, ...mods};
    }

    getGcdWithLL(): number {
        return this.gcdTime(Actions.Xenoglossy);
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: BlmExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }
    
    override use(ability: Ability): AbilityUseResult {
        const abilityWithBuffs = this.beforeAbility(ability, this.getActiveBuffsFor(ability));
        const blmAbility = this.getBlmAbilityAdjusted(abilityWithBuffs as BlmAbility);

        // Handle MP costs.
        if (blmAbility.mp === 'flare') {
            if (this.gauge.umbralHearts > 0) {
                blmAbility.mp = fl(this.gauge.magicPoints / 3);
                this.gauge.umbralHearts = 0;
            }
            else {
                blmAbility.mp = 0;
            }
        }
        else if (blmAbility.mp === 'all') {
            blmAbility.mp = this.gauge.magicPoints;
        }
        else if (blmAbility.mp > 0 && blmAbility.element === 'fire' && this.gauge.umbralHearts > 0) {
            // MP multi is already done by getBlmAbilityAdjusted, we just consume umbral heart.
            this.gauge.umbralHearts -= 1;
        }
        this.gauge.magicPoints -= blmAbility.mp;

        // Handle MP regen. (ignore natural/lucid ticks, only ice spells)
        if (blmAbility.element === 'ice') {
            this.gauge.magicPoints += this.gauge.getIceMpGain();
        }

        // Handle Thunder refresh.
        if (blmAbility.name === "High Thunder") {
            this.nextThunderTime = this.nextGcdTime + 30 - blmAbility.appDelay - STANDARD_ANIMATION_LOCK - this.getGcdWithLL();
        }
        else if (blmAbility.name === "Thunder III") {
            this.nextThunderTime = this.nextGcdTime + 27 - blmAbility.appDelay;
        }

        // Update gauge from the ability itself
        if (blmAbility.updateGauge !== undefined) {
            blmAbility.updateGauge(this.gauge);
        }

        if (this.nextGcdTime > this.nextPolyglotTime) {
            this.nextPolyglotTime += 30;
            this.gauge.polyglot += 1;
        }

        return super.use(blmAbility);
    }

    inBurst(): boolean {
        const timeIntoTwoMinutes = this.currentTime % 120;

        // Seven seconds after every (i.e. 0:07, 2:07, etc) burst, buffs will be up,
        // and will remain up for twenty seconds.
        return 7 < timeIntoTwoMinutes && timeIntoTwoMinutes < 27;
    }

    // If the fight is ending within the next 12 seconds (to dump resources)
    fightEndingSoon(): boolean {
        return this.remainingTime < 12;
    }

    wouldOvercapPolygotFromAmplifierOrTimer(): boolean {
        const timeTwoGcds = this.getGcdWithLL() * 2;
        // From Amplifier
        if (this.cdTracker.statusOf(Actions.Amplifier).readyAt.relative < timeTwoGcds) {
            if (this.gauge.polyglot >= 3) {
                return true;
            }
        }
        // From Timer
        if (this.nextPolyglotTime - this.nextGcdTime < timeTwoGcds) {
            if (this.gauge.polyglot >= 3) {
                return true;
            }
        }
        return false;
    }

    shouldPot(): boolean {
        const sixMinutesInSeconds = 360;
        const timeInSixMinuteWindow = this.currentTime % sixMinutesInSeconds;
        return timeInSixMinuteWindow > 2.7 && timeInSixMinuteWindow < 22.7;
    }

    shouldRefreshDot(): boolean {
        return this.nextGcdTime >= this.nextThunderTime && this.remainingTime > 15;
    }

    isLeyLinesActive(): boolean {
        const buffs = this.getActiveBuffs();
        const circleOfPower = buffs.find(buff => buff.name === LeyLinesBuff.name);
        return circleOfPower !== undefined;
    }

    hasFirestarter(): boolean {
        const buffs = this.getActiveBuffs();
        const firestarter = buffs.find(buff => buff.name === FirestarterBuff.name);
        return firestarter !== undefined;
    }

    hasThunderhead(): boolean {
        const buffs = this.getActiveBuffs();
        const thunderhead = buffs.find(buff => buff.name === ThunderheadBuff.name);
        return thunderhead !== undefined;
    }
}

export class BlmSim extends BaseMultiCycleSim<BlmSimResult, BlmSettings, BlmCycleProcessor> {
    spec = blmSpec;
    shortName = "blm-sheet-sim";
    displayName = blmSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: false,
        totalTime: this.settings.fightTime,
        cycles: 0,
        which: 'totalTime',
        cutoffMode: 'prorate-gcd',
    };

    constructor(settings?: BlmSettingsExternal) {
        super('BLM', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): BlmCycleProcessor {
        return new BlmCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    override makeDefaultSettings(): BlmSettings {
        return {
            usePotion: true,
            prepullLL: false,
            useFlareOpener: false,
            transposeFromAstralFire: false,
            transposeFromUmbralIce: true,
            // 8 minutes and 30s, or 510 seconds
            // This is chosen since it's two pots, five bursts,
            // and is somewhat even between the two main GCDs.
            fightTime: (8 * 60) + 30,
        };
    }

    // Gets the next GCD to use in the BLM rotation.
    getGCDToUse(cp: BlmCycleProcessor): BlmGcdAbility {
        // Not overcapping Polyglot is highest priority.
        if (cp.wouldOvercapPolygotFromAmplifierOrTimer()) {
            return Actions.Xenoglossy;
        }

        // Refreshing Thunder is second highest priority.
        if (cp.shouldRefreshDot()) {
            if (cp.stats.level >= 94) {
                return Actions.HighThunder;
            }
            else {
                return Actions.Thunder3;
            }
        }

        // In Astral Fire
        if (cp.gauge.aspect > 0) {
            if (cp.gauge.aspect === +1) {
                // If AF1, use Fire 3 if we have Firestarter, otherwise Paradox to generate one.
                if (cp.hasFirestarter()) {
                    return Actions.Fire3;
                }
                else if (cp.gauge.paradox) {
                    return Actions.FireParadox;
                }
                else {
                    console.warn(`[BLM Sim] Using AF1 F3 without F3P, something went wrong.`);
                    return Actions.Fire3;
                }
            }
            else if (cp.gauge.aspect === +3) {
                // Priority is Blizzard 3, Flare star, Despair, Fire 4, Paradox.
                if (cp.gauge.magicPoints < 800) {
                    return Actions.Blizzard3;
                }
                else if (cp.gauge.astralSoul === 6) {
                    return Actions.FlareStar;
                }
                else if (cp.gauge.magicPoints <= 1600) {
                    return Actions.Despair;
                }
                else if (cp.gauge.astralSoul < 3) {
                    return Actions.Fire4;
                }
                else if (cp.gauge.paradox) {
                    return Actions.FireParadox;
                }
                else if (cp.gauge.astralSoul < 6) {
                    return Actions.Fire4;
                }
            }
            else {
                // Why are we in AF2?
                console.warn(`[BLM Sim] We are in AF${cp.gauge.aspect}, something went *really* wrong.`);
            }
        }

        // In Umbral Ice
        if (cp.gauge.aspect < 0) {
            if (cp.gauge.aspect > -3) {
                return Actions.Blizzard3;
            }
            else if (cp.gauge.umbralHearts < 3) {
                return Actions.Blizzard4;
            }
            else if (cp.gauge.paradox) {
                return Actions.IceParadox;
            }
            else {
                return Actions.Fire3;
            }
        }

        return Actions.Thunder3;
    }

    // Uses DRK actions as part of a rotation.
    useBlmRotation(cp: BlmCycleProcessor) {
        ////////
        ///oGCDs
        ////////

        if (cp.inBurst()) {
            if (cp.cdTracker.statusOf(Actions.Triplecast).readyToUse) {
                if (cp.canUseWithoutClipping(Actions.Triplecast)) {
                    this.use(cp, Actions.Triplecast);
                }
                else {
                    if (cp.gauge.polyglot > 0) {
                        this.use(cp, Actions.Xenoglossy);
                    }
                    this.use(cp, Actions.Triplecast);
                }
            }
            else {
                if (cp.gauge.polyglot > 0) {
                    this.use(cp, Actions.Xenoglossy);
                }
            }
        }

        if (cp.shouldPot() && cp.canUseWithoutClipping(potionMaxInt)) {
            this.use(cp, potionMaxInt);
        }

        if (cp.cdTracker.statusOf(Actions.Amplifier).readyToUse) {
            if (cp.canUseWithoutClipping(Actions.Amplifier)) {
                this.use(cp, Actions.Amplifier);
            }
            else {
                if (cp.gauge.polyglot > 0) {
                    this.use(cp, Actions.Xenoglossy);
                }
                this.use(cp, Actions.Amplifier);
            }
        }

        if (cp.cdTracker.statusOf(Actions.LeyLines).readyToUse) {
            if (cp.canUseWithoutClipping(Actions.LeyLines)) {
                this.use(cp, Actions.LeyLines);
            }
            else {
                if (cp.gauge.polyglot > 0) {
                    this.use(cp, Actions.Xenoglossy);
                }
                this.use(cp, Actions.LeyLines);
            }
        }

        // Dump resources in burst or if fight ending soon
        if (cp.inBurst() || cp.fightEndingSoon()) {
            if (cp.gauge.polyglot > 0) {
                this.use(cp, Actions.Xenoglossy);
            }
        }

        // End of fire phase is: no MP:
        if (cp.gauge.aspect === +3 && cp.gauge.magicPoints === 0) {
            // Use manafont if available
            if (cp.cdTracker.statusOf(Actions.Manafont).readyToUse) {
                if (cp.canUseWithoutClipping(Actions.Manafont)) {
                    this.use(cp, Actions.Manafont);
                }
                else {
                    if (cp.gauge.polyglot > 0) {
                        this.use(cp, Actions.Xenoglossy);
                    }
                    this.use(cp, Actions.Manafont);
                }
            }
            else if (this.settings.transposeFromAstralFire) {
                // Otherwise: do we have swift/triple? use them to transpose.
                if (cp.cdTracker.statusOf(Actions.Swiftcast).readyToUse) {
                    this.use(cp, Actions.Swiftcast);
                    if (cp.canUseWithoutClipping(Actions.Transpose)) {
                        if (cp.gauge.polyglot > 0) {
                            this.use(cp, Actions.Xenoglossy);
                        }
                        this.use(cp, Actions.Transpose);
                    }
                }
                else if (cp.cdTracker.statusOf(Actions.Triplecast).readyToUse) {
                    this.use(cp, Actions.Triplecast);
                    if (cp.canUseWithoutClipping(Actions.Transpose)) {
                        if (cp.gauge.polyglot > 0) {
                            this.use(cp, Actions.Xenoglossy);
                        }
                        this.use(cp, Actions.Transpose);
                    }
                }
            }
        }
       
        if (this.settings.transposeFromUmbralIce) {
            // End of ice phase is: no Paradox: transpose.
            if (cp.gauge.aspect === -3 && !cp.gauge.paradox) {
                if (cp.canUseWithoutClipping(Actions.Transpose)) {
                    if (cp.gauge.polyglot > 0) {
                        this.use(cp, Actions.Xenoglossy);
                    }
                    this.use(cp, Actions.Transpose);
                }
            }
        }

        // If we don't have time to use a GCD, return early.
        if (cp.remainingGcdTime <= 0) {
            return;
        }
        
        const gcdToUse = this.getGCDToUse(cp);
        this.use(cp, gcdToUse);
    }

    use(cp: BlmCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        const blmAbility = ability as BlmAbility;

        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (ability.type === 'ogcd' && cp.canUseWithoutClipping(ability)) {
            const readyAt = cp.cdTracker.statusOf(ability).readyAt.absolute;
            if (cp.totalTime > readyAt) {
                cp.advanceTo(readyAt);
            }
        }

        // Only use potion if enabled in settings
        if (!this.settings.usePotion && ability.name.includes("of Intelligence")) {
            return null;
        }

        return cp.use(ability);

        /*
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
        */
    }

    /*
    private useLevel80OrBelowOpener(cp: BlmCycleProcessor, prepullTBN: boolean) {
        if (prepullTBN) {
            this.use(cp, Actions.LeyLines);
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
        i
        f (!prepullTBN) {
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
    }*/

    private useLevel100Opener(cp: BlmCycleProcessor, prepullLL: boolean) {
        if (prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.HighThunder);
        this.use(cp, Actions.Swiftcast);
        this.use(cp, Actions.Amplifier);
        this.use(cp, Actions.Fire4);
        this.use(cp, potionMaxInt);
        if (!prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        for (let i = 0; i < 4; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Xenoglossy);
        this.use(cp, Actions.Manafont);
        this.use(cp, Actions.Fire4);
        this.use(cp, Actions.FlareStar);
        for (let i = 0; i < 2; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.HighThunder);
        for (let i = 0; i < 4; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.FlareStar);
        this.use(cp, Actions.Despair);
        this.use(cp, Actions.Transpose);
        this.use(cp, Actions.Triplecast);
        this.use(cp, Actions.Blizzard3);
        this.use(cp, Actions.Blizzard4);
        this.use(cp, Actions.IceParadox);
        this.use(cp, Actions.Transpose);
        this.use(cp, Actions.FireParadox);
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.LeyLines);
    }

    private useLevel100FlareOpener(cp: BlmCycleProcessor, prepullLL: boolean) {
        if (prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.HighThunder);
        this.use(cp, Actions.Swiftcast);
        this.use(cp, Actions.Amplifier);
        this.use(cp, Actions.Fire4);
        this.use(cp, potionMaxInt);
        if (!prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        this.use(cp, Actions.Fire4);
        this.use(cp, Actions.Xenoglossy);
        for (let i = 0; i < 2; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Despair);
        this.use(cp, Actions.Manafont);
        for (let i = 0; i < 2; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.FlareStar);
        this.use(cp, Actions.Fire4);
        this.use(cp, Actions.HighThunder);
        for (let i = 0; i < 3; i++){
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.FireParadox);
        this.use(cp,Actions.Triplecast);
        this.use(cp,Actions.Flare);
        this.use(cp,Actions.FlareStar);
        this.use(cp, Actions.Transpose);
        this.use(cp, Actions.Blizzard3);
        this.use(cp, Actions.Blizzard4);
        this.use(cp, Actions.IceParadox);
        this.use(cp, Actions.Transpose);
        this.use(cp, Actions.LeyLines);
        this.use(cp, Actions.Fire3);
    }

    private useOpener(cp: BlmCycleProcessor, prepullLL: boolean, useFlareOpener: boolean) {
        if (cp.stats.level === 100) {
            if (!useFlareOpener) {
                this.useLevel100Opener(cp, prepullLL);
            }
            else {
                this.useLevel100FlareOpener(cp, prepullLL);
            }
        }
        else if (cp.stats.level === 90) {
            //this.useLevel90Opener(cp, prepullTBN);
        }
        else {
            //this.useLevel80OrBelowOpener(cp, prepullTBN);
        }
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<BlmCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const settings = { ...this.settings };
        const outer = this;

        console.log(`[BLM Sim] Running Rotation for ${gcd} GCD...`);
        console.log(`[BLM Sim] Settings configured: ${JSON.stringify(settings)}`);
        return [{
            cycleTime: 120,
            apply(cp: BlmCycleProcessor) {
                outer.useOpener(cp, settings.prepullLL, settings.useFlareOpener);

                cp.remainingCycles(() => {
                    outer.useBlmRotation(cp);
                });
            },
        }];
    }
}
