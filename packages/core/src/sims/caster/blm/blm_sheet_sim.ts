import {Ability, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    AbilityUseResult,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {BlmGaugeManager} from "./blm_gauge";
import {BlmAbility, BlmGcdAbility, LeyLinesBuff, FirestarterBuff, ThunderheadBuff, TriplecastBuff, SwiftcastBuff} from "./blm_types";
import * as Actions from './blm_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxInt} from "@xivgear/core/sims/common/potion";

function formatTime(time: number) {
    const negative = time < 0;
    // noinspection AssignmentToFunctionParameterJS
    time = Math.abs(time);
    const minute = Math.floor(time / 60);
    const second = time % 60;
    return (`${negative ? '-' : ''}${minute}:${second.toFixed(2).padStart(5, '0')}`);
}

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
    displayName: "BLM Rotation Sim",
    description: `Simulates a BLM rotation for levels 100/90/80/70.
If potions are enabled, pots in the burst window every 6m (i.e. 0m, 6m, 12m, etc).
Defaults to simulating a killtime of 8m 30s (510s) and consistent use of AF1 F3P.

The transpose settings are ignored for levels 80/70.
At level 70, the sim does not care anymore about clipping GCDs.

Summary of cooldown drift and GCD clips at the end of the list of abilities used.`,
    makeNewSimInstance: function (): BlmSim {
        return new BlmSim();
    },
    loadSavedSimInstance: function (exported: BlmSettingsExternal) {
        return new BlmSim(exported);
    },
    supportedJobs: ['BLM'],
    supportedLevels: [100, 90, 80, 70],
    isDefaultSim: false,
    maintainers: [{
        name: 'Rika',
        contact: [{
            type: 'discord',
            discordTag: 'syntheticglottalstop',
            discordUid: '1111309997482193017',
        }],
    }],
};

class BlmCycleProcessor extends CycleProcessor<BlmGaugeManager> {
    nextThunderTime: number = 0;
    nextPolyglotTime: number = 30;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
    }

    override createGaugeManager(): BlmGaugeManager {
        return new BlmGaugeManager(this.stats.level);
    }

    getGcdWithLL(): number {
        return this.gcdTime(Actions.Xenoglossy);
    }

    override use(ability: Ability): AbilityUseResult {
        const abilityWithBuffs = this.beforeAbility(ability, this.getActiveBuffsFor(ability));
        const blmAbility = this.gaugeManager.getAdjustedAbility(abilityWithBuffs as BlmAbility);

        // Maybe add natural regen / Lucid ticks at some point...

        // Handle Thunder refresh.
        if (blmAbility.name === "High Thunder") {
            this.nextThunderTime = this.nextGcdTime + 30 - blmAbility.appDelay - STANDARD_ANIMATION_LOCK;
        }
        else if (blmAbility.name === "Thunder III") {
            this.nextThunderTime = this.nextGcdTime + 27 - blmAbility.appDelay - STANDARD_ANIMATION_LOCK;
        }

        if (this.nextGcdTime > this.nextPolyglotTime) {
            this.nextPolyglotTime += 30;
            this.gaugeManager.polyglot += 1;
        }

        return super.use(blmAbility);
    }

    override canUseWithoutClipping(action: OgcdAbility) {
        // Override this to always return true below lv.80 because we have pretty much no weave slots
        // and getting cooldowns off is more important.
        if (this.stats.level < 80) {
            return false;
        }
        return super.canUseWithoutClipping(action);
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
        const timeTwoGcds = this.getGcdWithLL() * 3;
        // From Amplifier (lv.86 or higher)
        if (this.stats.level >= 86) {
            if (this.cdTracker.statusOf(Actions.Amplifier).readyAt.relative < timeTwoGcds) {
                if (this.gaugeManager.polyglot >= this.gaugeManager.getMaxPolyglotCharges()) {
                    return true;
                }
            }
        }
        // From Timer
        if (this.nextPolyglotTime - this.nextGcdTime < timeTwoGcds) {
            if (this.gaugeManager.polyglot >= this.gaugeManager.getMaxPolyglotCharges()) {
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

    hasSwiftOrTriple(): boolean {
        const buffs = this.getActiveBuffs();
        const swift = buffs.find(buff => buff.name === SwiftcastBuff.name);
        const triple = buffs.find(buff => buff.name === TriplecastBuff.name);
        return swift !== undefined || triple !== undefined;
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
        if (cp.gaugeManager.isInFire()) {
            if (cp.gaugeManager.elementLevel === 1) {
                // If AF1, use Fire 3 if we have Firestarter, otherwise Paradox to generate one.
                if (cp.hasFirestarter()) {
                    return Actions.Fire3;
                }
                else if (cp.gaugeManager.paradox && cp.stats.level >= 90) {
                    return Actions.FireParadox;
                }
                else {
                    console.warn(`[BLM Sim] Using AF1 F3 without F3P, something went wrong.`);
                    return Actions.Fire3;
                }
            }
            else if (cp.gaugeManager.elementLevel === 3) {
                // Priority is Blizzard 3, Flare star, Despair, Fire 4, Paradox.
                if (cp.gaugeManager.magicPoints < 800) {
                    return Actions.Blizzard3;
                }
                else if (cp.stats.level < 72 && cp.gaugeManager.magicPoints < 1600) {
                    // Special case for lv.70, we don't have Despair so fire phase ends early.
                    return Actions.Blizzard3;
                }
                else if (cp.gaugeManager.astralSoul === 6 && cp.stats.level >= 100) {
                    return Actions.FlareStar;
                }
                else if (cp.gaugeManager.magicPoints <= 1600 && cp.stats.level >= 72) {
                    return Actions.Despair;
                }
                else if (cp.gaugeManager.astralSoul < 3) {
                    return Actions.Fire4;
                }
                else if (cp.gaugeManager.paradox && cp.stats.level >= 90) {
                    return Actions.FireParadox;
                }
                else if (cp.gaugeManager.astralSoul < 6) {
                    return Actions.Fire4;
                }
            }
            else {
                // Why are we in AF2?
                console.error(`[BLM Sim] We are in AF${cp.gaugeManager.elementLevel}, something went *really* wrong.`);
            }
        }

        // In Umbral Ice
        if (cp.gaugeManager.isInIce()) {
            if (cp.gaugeManager.elementLevel < 3) {
                return Actions.Blizzard3;
            }
            else if (cp.gaugeManager.umbralHearts < 3) {
                return Actions.Blizzard4;
            }
            else if (cp.gaugeManager.paradox) {
                return Actions.IceParadox;
            }
            else {
                return Actions.Fire3;
            }
        }

        return Actions.Thunder3;
    }

    useBlmRotation(cp: BlmCycleProcessor) {
        // TODO: fix the mess and actually handle oGCDs and weaving properly.

        ////////
        ///oGCDs
        ////////

        // This is really unnecessary.
        if (cp.inBurst()) {
            if (!cp.hasSwiftOrTriple() && cp.cdTracker.statusOf(Actions.Triplecast).readyToUse) {
                if (cp.canUseWithoutClipping(Actions.Triplecast)) {
                    this.use(cp, Actions.Triplecast);
                }
                else {
                    if (cp.gaugeManager.polyglot > 0) {
                        this.use(cp, Actions.Xenoglossy);
                    }
                    this.use(cp, Actions.Triplecast);
                }
            }
            else {
                if (cp.gaugeManager.polyglot > 0) {
                    this.use(cp, Actions.Xenoglossy);
                }
            }
        }

        if (cp.shouldPot() && cp.canUseWithoutClipping(potionMaxInt)) {
            this.use(cp, potionMaxInt);
        }

        // Amplifier (lv.86 or higher)
        if (cp.stats.level >= 86) {
            if (cp.cdTracker.statusOf(Actions.Amplifier).readyToUse) {
                if (cp.canUseWithoutClipping(Actions.Amplifier)) {
                    this.use(cp, Actions.Amplifier);
                }
                else {
                    if (cp.gaugeManager.polyglot > 0) {
                        this.use(cp, Actions.Xenoglossy);
                    }
                    this.use(cp, Actions.Amplifier);
                }
            }
        }

        // Ley Lines
        if (cp.cdTracker.statusOf(Actions.LeyLines).readyToUse) {
            if (cp.canUseWithoutClipping(Actions.LeyLines)) {
                this.use(cp, Actions.LeyLines);
            }
            else {
                if (cp.gaugeManager.polyglot > 0) {
                    this.use(cp, Actions.Xenoglossy);
                }
                this.use(cp, Actions.LeyLines);
            }
        }

        // Dump resources in burst or if fight ending soon
        if (cp.inBurst() || cp.fightEndingSoon()) {
            if (cp.gaugeManager.polyglot > 0) {
                this.use(cp, Actions.Xenoglossy);
            }
        }

        // End of fire phase is: no MP for lv.80 and above, <1600 MP for below
        if (cp.gaugeManager.isInFire(3) &&
                (cp.gaugeManager.magicPoints === 0 ||
                    cp.stats.level < 80 && cp.gaugeManager.magicPoints < 1600)) {
            // Use manafont if available
            if (cp.cdTracker.statusOf(Actions.Manafont).readyToUse) {
                if (cp.canUseWithoutClipping(Actions.Manafont)) {
                    this.use(cp, Actions.Manafont);
                }
                else {
                    if (cp.gaugeManager.polyglot > 0) {
                        this.use(cp, Actions.Xenoglossy);
                    }
                    this.use(cp, Actions.Manafont);
                }
            }
            // IGNORE THIS SETTING IF BELOW LEVEL 90
            else if (this.settings.transposeFromAstralFire && cp.stats.level >= 90) {
                // Otherwise: do we have swift/triple? use them to transpose.
                if (cp.hasSwiftOrTriple()) {
                    this.use(cp, Actions.Transpose);
                }
                else if (cp.cdTracker.statusOf(Actions.Swiftcast).readyToUse) {
                    this.use(cp, Actions.Swiftcast);
                    if (cp.canUseWithoutClipping(Actions.Transpose)) {
                        if (cp.gaugeManager.polyglot > 0) {
                            this.use(cp, Actions.Xenoglossy);
                        }
                        this.use(cp, Actions.Transpose);
                    }
                }
                else if (cp.cdTracker.statusOf(Actions.Triplecast).readyToUse) {
                    this.use(cp, Actions.Triplecast);
                    if (cp.canUseWithoutClipping(Actions.Transpose)) {
                        if (cp.gaugeManager.polyglot > 0) {
                            this.use(cp, Actions.Xenoglossy);
                        }
                        this.use(cp, Actions.Transpose);
                    }
                }
            }
        }

        // IGNORE THIS SETTING IF BELOW LEVEL 90
        if (this.settings.transposeFromUmbralIce && cp.stats.level >= 90) {
            // End of ice phase is: no Paradox: transpose.
            if (cp.gaugeManager.isInIce(3) && !cp.gaugeManager.paradox) {
                if (cp.canUseWithoutClipping(Actions.Transpose)) {
                    if (cp.gaugeManager.polyglot > 0) {
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

        // TODO: Use a less hacky way to replace Xeno with Foul below lv.80
        if (cp.stats.level < 80 && ability.name === "Xenoglossy") {
            ability = Actions.Foul;
        }

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
    }

    private useLevel70Opener(cp: BlmCycleProcessor, prepullLL: boolean) {
        if (prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.Thunder3);
        this.use(cp, Actions.Swiftcast);
        this.use(cp, Actions.Fire4);
        this.use(cp, potionMaxInt);
        if (!prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        for (let i = 0; i < 3; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Foul);
        this.use(cp, Actions.Manafont);
        for (let i = 0; i < 4; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Thunder3);
        for (let i = 0; i < 3; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Blizzard3);
        this.use(cp, Actions.Blizzard4);
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.LeyLines);
    }

    private useLevel80Opener(cp: BlmCycleProcessor, prepullLL: boolean) {
        if (prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.Thunder3);
        this.use(cp, Actions.Swiftcast);
        this.use(cp, Actions.Amplifier);
        this.use(cp, Actions.Fire4);
        this.use(cp, potionMaxInt);
        if (!prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        for (let i = 0; i < 3; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Despair);
        this.use(cp, Actions.Xenoglossy);
        this.use(cp, Actions.Manafont);
        for (let i = 0; i < 3; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Thunder3);
        for (let i = 0; i < 4; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Despair);
        this.use(cp, Actions.Blizzard3);
        this.use(cp, Actions.Blizzard4);
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.LeyLines);
    }

    private useLevel90Opener(cp: BlmCycleProcessor, prepullLL: boolean) {
        if (prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.Thunder3);
        this.use(cp, Actions.Swiftcast);
        this.use(cp, Actions.Amplifier);
        this.use(cp, Actions.Fire4);
        this.use(cp, potionMaxInt);
        if (!prepullLL) {
            this.use(cp, Actions.LeyLines);
        }
        for (let i = 0; i < 3; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Despair);
        this.use(cp, Actions.Xenoglossy);
        this.use(cp, Actions.Manafont);
        for (let i = 0; i < 3; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.Thunder3);
        for (let i = 0; i < 3; i++) {
            this.use(cp, Actions.Fire4);
        }
        this.use(cp, Actions.FireParadox);
        this.use(cp, Actions.Triplecast);
        this.use(cp, Actions.Despair);
        this.use(cp, Actions.Transpose);
        this.use(cp, Actions.Blizzard3);
        this.use(cp, Actions.Blizzard4);
        this.use(cp, Actions.IceParadox);
        this.use(cp, Actions.Transpose);
        this.use(cp, Actions.Fire3);
        this.use(cp, Actions.LeyLines);
    }

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
        this.use(cp, Actions.Triplecast);
        this.use(cp, Actions.Flare);
        this.use(cp, Actions.FlareStar);
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
            this.useLevel90Opener(cp, prepullLL);
        }
        else if (cp.stats.level === 80) {
            this.useLevel80Opener(cp, prepullLL);
        }
        else {
            this.useLevel70Opener(cp, prepullLL);
        }
    }

    private printCooldownDrift(cp: BlmCycleProcessor, abilityName: string) {
        const usedAbilities = cp.usedAbilities.filter(used => used.ability.name === abilityName);

        const uses = usedAbilities.length;
        const drifts = [];
        for (let i = 0; i < uses - 1; ++i) {
            const diff = usedAbilities[i + 1].usedAt - usedAbilities[i].usedAt;
            drifts.push(Math.round(diff));
        }

        if (drifts.length > 0) {
            cp.addSpecialRow(`${abilityName} - uses: ${uses}, drift: ${drifts.map(t => `${t}s`).join(", ")}`, 0);
        }
        else {
            cp.addSpecialRow(`${abilityName} - uses: ${uses}`, 0);
        }
    }

    private printGcdClipping(cp: BlmCycleProcessor) {
        const GCD_CLIP_ALLOWED = 0.01;

        const gcds = cp.usedAbilities.filter(used => used.ability.type === 'gcd');

        let totalClip = 0;
        const clipTimes = [];
        for (let i = 0; i < gcds.length - 1; ++i) {
            // The highest between cast time and GCD time.
            const castTime = cp.castTime(gcds[i].ability as GcdAbility, gcds[i].combinedEffects);
            const gcdTime = cp.gcdTime(gcds[i].ability as GcdAbility, gcds[i].combinedEffects);
            const checkTime = Math.max(castTime, gcdTime);
            if (gcds[i + 1].usedAt - gcds[i].usedAt > checkTime) {
                const clipAmount = gcds[i + 1].usedAt - gcds[i].usedAt - checkTime;
                totalClip += clipAmount;

                if (clipAmount > GCD_CLIP_ALLOWED) {
                    clipTimes.push(formatTime(gcds[i].usedAt));
                }
            }
        }

        if (totalClip > 0) {
            cp.addSpecialRow(`GCD clips: ${totalClip.toFixed(2)}s, ${clipTimes.join(", ")}`, 0);
        }
        else {
            cp.addSpecialRow(`No GCD clips`, 0);
        }
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<BlmCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdMag(2.5);
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

                // Recap cooldown drift.
                cp.addSpecialRow(">>> Recap cooldown drift:", 0);
                outer.printCooldownDrift(cp, "Ley Lines");
                outer.printCooldownDrift(cp, "Amplifier");
                outer.printCooldownDrift(cp, "Manafont");
                outer.printGcdClipping(cp);
            },
        }];
    }
}
