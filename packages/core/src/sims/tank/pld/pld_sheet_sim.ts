import {Ability, SimSettings, SimSpec, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {sum} from "@xivgear/core/util/array_utils";
import * as Actions from './pld_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxStr} from "@xivgear/core/sims/common/potion";
import {AtonementReadyBuff, BladeOfHonorReadyBuff, ConfiteorReadyBuff, DivineMightBuff, FightOrFlightBuff, GoringBladeReadyBuff, PldExtraData, PldGcdAbility, PldOgcdAbility, RequiescatBuff, SepulchreReadyBuff, SupplicationReadyBuff} from "./pld_types";

export interface PldSimResult extends CycleSimResult {

}

export interface PldSettings extends SimSettings {
    // If we use potions (used every six minutes).
    usePotion: boolean;
    // the length of the fight in seconds
    fightTime: number;
}

export interface PldSettingsExternal extends ExternalCycleSettings<PldSettings> {

}

export const pldSpec: SimSpec<PldSim, PldSettingsExternal> = {
    stub: "pld-sheet-sim",
    displayName: "PLD Sim",
    description: `Simulates a PLD rotation for level 100/90/80/70.
If potions are enabled, pots in the burst window every 6m (i.e. 0m, 6m, 12m, etc).
Defaults to simulating a killtime of 8m 30s (510s).`,
    makeNewSimInstance: function (): PldSim {
        return new PldSim();
    },
    loadSavedSimInstance: function (exported: PldSettingsExternal) {
        return new PldSim(exported);
    },
    supportedJobs: ['PLD'],
    supportedLevels: [70, 80, 90, 100],
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
    private _confiteorCombo: number = 0;

    get combo() {
        return this._combo;
    };

    set combo(newCombo) {
        this._combo = newCombo;
        if (this._combo >= 3) this._combo = 0;
    }

    get confiteorCombo() {
        return this._confiteorCombo;
    };

    set confiteorCombo(newCombo) {
        this._confiteorCombo = newCombo;
        if (this._confiteorCombo >= 4) this._confiteorCombo = 0;
    }
}

class PldCycleProcessor extends CycleProcessor {
    rotationState: RotationState;
    // Used in combination with shouldWeAlternateNineGCDFoFAtThisSpeed to determine
    // if we're nine GCD FoFing now.
    shouldWeNineGCDFoFThisAlternation: boolean;
    expiacionAbility: PldOgcdAbility;
    requiescatAbility: PldOgcdAbility;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.rotationState = new RotationState();
        this.shouldWeNineGCDFoFThisAlternation = true;
        if (this.stats.level >= 86) {
            this.expiacionAbility = Actions.Expiacion;
        }
        else {
            this.expiacionAbility = Actions.SpiritsWithin;
        }
        if (this.stats.level >= 96) {
            this.requiescatAbility = Actions.Imperator;
        }
        else {
            this.requiescatAbility = Actions.Requiescat;
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
        const extraData: PldExtraData = {
            fightOrFlightDuration: 0,
            requiescatStacks: 0,
        };

        const fof = usedAbility.buffs.find(buff => buff.name === FightOrFlightBuff.name);
        const fofBuffData = fof && this.getActiveBuffData(fof, usedAbility.usedAt);
        if (fofBuffData) {
            extraData.fightOrFlightDuration = fofBuffData.end - usedAbility.usedAt;
        }

        const requiescat = usedAbility.buffs.find(buff => buff.name === RequiescatBuff.name);
        if (requiescat) {
            extraData.requiescatStacks = requiescat.stacks;
        }

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    getFightOrFlightDuration(): number {
        let fofDuration = 0;
        const buffs = [...this.getActiveBuffs(this.currentTime)];
        const fof = buffs.find(buff => buff.name === FightOrFlightBuff.name);
        const buffData = fof && this.getActiveBuffData(fof, this.currentTime);
        if (buffData) {
            fofDuration = buffData.end - this.currentTime;
        }
        return fofDuration;
    }

    comboActions: PldGcdAbility[] = [Actions.FastBlade, Actions.RiotBlade, Actions.RoyalAuthority];
    getComboToUse() {
        return this.comboActions[this.rotationState.combo++];
    }

    // If the fight is ending within the next 12 seconds (to dump resources)
    fightEndingSoon(): boolean {
        return this.currentTime > (this.totalTime - 12);
    }

    getRequiescatStacks(): number {
        let stacks = 0;
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === RequiescatBuff.name);
        if (buff) {
            stacks = buff.stacks;
        }
        return stacks;
    }

    // getRequiescatComboActions gets the list of GCD actions that should be/can be used with Requiescat
    // stacks at the current level.
    getRequiescatComboActions(): PldGcdAbility[] {
        if (this.stats.level < 80) {
            return [Actions.HolySpiritRequiescat, Actions.HolySpiritRequiescat, Actions.HolySpiritRequiescat, Actions.HolySpiritRequiescat];
        }
        if (this.stats.level < 90) {
            return [Actions.Confiteor, Actions.HolySpiritRequiescat, Actions.HolySpiritRequiescat, Actions.HolySpiritRequiescat];
        }
        return [Actions.Confiteor, Actions.BladeOfFaith, Actions.BladeOfTruth, Actions.BladeOfValor];
    }

    isConfiteorReadyBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === ConfiteorReadyBuff.name);
        return buff !== undefined;
    }

    isGoringBladeReadyBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === GoringBladeReadyBuff.name);
        return buff !== undefined;
    }

    isAtonementReadyBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === AtonementReadyBuff.name);
        return buff !== undefined;
    }

    getNumberOfGoodFillerGCDsLeft(): number {
        const divineMight = this.isDivineMightBuffActive() ? 1 : 0;
        if (this.isAtonementReadyBuffActive()) {
            return 3 + divineMight;
        }
        if (this.isSupplicationReadyBuffActive()) {
            return 2 + divineMight;
        }
        if (this.isSepulchreReadyBuffActive()) {
            return 1 + divineMight;
        }
        return divineMight;
    }

    isSupplicationReadyBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === SupplicationReadyBuff.name);
        return buff !== undefined;
    }

    isSepulchreReadyBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === SepulchreReadyBuff.name);
        return buff !== undefined;
    }

    isDivineMightBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === DivineMightBuff.name);
        return buff !== undefined;
    }

    isBladeOfHonorReadyBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === BladeOfHonorReadyBuff.name);
        return buff !== undefined;
    }

    shouldPot(): boolean {
        const sixMinutesInSeconds = 360;
        const isSixMinuteWindow = this.currentTime % sixMinutesInSeconds < 20;
        return isSixMinuteWindow;
    }

    shouldWeAlternateNineGCDFoFAtThisSpeed(): boolean {
        const gcdSpeedPhys = this.stats.gcdPhys(2.5);
        const gcdSpeedMag = this.stats.gcdMag(2.5);
        const timeForEightGCDs = gcdSpeedPhys * 4 + gcdSpeedMag * 4;
        // This covers roughly 2.44-2.46 physical GCD and 2.50 magical GCD.
        // For this speed, we want to alternate 8 GCD and 9 GCD FoFs.
        return timeForEightGCDs > 19.75 && timeForEightGCDs < 19.85;
    }

    shouldWeAlwaysGoForNineGCDFoFAtThisSpeed(): boolean {
        const gcdSpeedPhys = this.stats.gcdPhys(2.5);
        const gcdSpeedMag = this.stats.gcdMag(2.5);
        const timeForEightGCDs = gcdSpeedPhys * 4 + gcdSpeedMag * 4;
        // This is the speed at which we should do 9 GCD FoF every time.
        // It's still possible to get nine GCD FoFs at slower speeds (where this total is >= 19.75 but still below 19.96).
        // 19.75 (e.g. <2.44 physical GCD speed, <=2.50 magical GCD speed) seems to be the boundary of where it
        // makes sense for us to go for nine GCD FoFs every time.
        return timeForEightGCDs < 19.75;
    }

    shouldWeGoForNineGCDFoFNow(): boolean {
        if (this.shouldWeAlwaysGoForNineGCDFoFAtThisSpeed()) {
            return true;
        }

        if (this.shouldWeAlternateNineGCDFoFAtThisSpeed()) {
            return this.shouldWeNineGCDFoFThisAlternation;
        }

        return false;
    }
}

export class PldSim extends BaseMultiCycleSim<PldSimResult, PldSettings, PldCycleProcessor> {
    spec = pldSpec;
    shortName = "pld-sheet-sim";
    displayName = pldSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: this.settings.fightTime,
        cycles: 0,
        which: 'totalTime',
        cutoffMode: 'prorate-gcd',
    };

    constructor(settings?: PldSettingsExternal) {
        super('PLD', settings);
        if (this.cycleSettings && settings && settings.cycleSettings) {
            this.cycleSettings.totalTime = settings.cycleSettings.totalTime;
        }
    }

    protected createCycleProcessor(settings: MultiCycleSettings): PldCycleProcessor {
        return new PldCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    override makeDefaultSettings(): PldSettings {
        return {
            usePotion: true,
            // 8 minutes and 30s, or 510 seconds
            // This is chosen since it's two pots, five bursts,
            // and is somewhat even between the two main GCDs.
            fightTime: (8 * 60) + 30,
        };
    }

    haveAnyRoyalAuthorityBuffs(cp: PldCycleProcessor): boolean {
        return cp.isAtonementReadyBuffActive() || cp.isSupplicationReadyBuffActive() || cp.isSepulchreReadyBuffActive() || cp.isDivineMightBuffActive();
    }

    willOvercapBuffsNextGCD(cp: PldCycleProcessor): boolean {
        return cp.rotationState.combo === 2 && this.haveAnyRoyalAuthorityBuffs(cp);
    }

    // Gets the next GCD to use in the PLD rotation.
    // Note: this is stateful, and updates combos to the next combo.
    getGCDToUse(cp: PldCycleProcessor): PldGcdAbility {
        const requiescatStacks = cp.getRequiescatStacks();
        const requiescatComboActions: PldGcdAbility[] = cp.getRequiescatComboActions();
        if (requiescatStacks === 4 && cp.isConfiteorReadyBuffActive()) {
            return Actions.Confiteor;
        }
        if (requiescatStacks > 0) {
            const comboAction = requiescatComboActions[4 - requiescatStacks];
            // It's not possible to use Requiescat Holy Spirits if we have Divine Might active.
            if (!(comboAction === Actions.HolySpiritRequiescat && cp.isDivineMightBuffActive())) {
                return requiescatComboActions[4 - requiescatStacks];
            }
        }

        if (cp.isGoringBladeReadyBuffActive()) {
            return Actions.GoringBlade;
        }

        const gcdSpeedPhys = cp.stats.gcdPhys(2.5);

        // If we're in FoF, prioritize highest potency filler
        if (cp.getFightOrFlightDuration() > 0) {
            if (cp.stats.level <= 84) {
                // Before Atonement actions get buffed, Holy Spirit is 400 potency, whereas
                // Atonement is 360, Supplication is 380, Sepulchre is 400
                if (cp.isDivineMightBuffActive()) {
                    return Actions.HolySpirit;
                }
            }
            if (cp.isSepulchreReadyBuffActive()) {
                return Actions.Sepulchre;
            }
            if (cp.isSupplicationReadyBuffActive()) {
                return Actions.Supplication;
            }
            // If we can finish the Atonement combo, it's better to get a Supplication than a Holy Spirit as the last buffed GCD
            if (cp.getFightOrFlightDuration() >= gcdSpeedPhys * 3) {
                if (cp.isAtonementReadyBuffActive()) {
                    return Actions.Atonement;
                }
            }
            if (cp.isDivineMightBuffActive()) {
                return Actions.HolySpirit;
            }
            if (cp.isAtonementReadyBuffActive()) {
                return Actions.Atonement;
            }
        }

        // If FoF is coming up, progress our combo so that we have the higher potency stuff in FoF
        // We only do this if it's not possible to fit all of our Atonement combo in FoF. Otherwise
        // there's no reason to advance.
        if (!cp.shouldWeGoForNineGCDFoFNow()) {
            // Two GCDs until FoF
            if (cp.getFightOrFlightDuration() === 0 && cp.cdTracker.statusOfAt(Actions.FightOrFlight, cp.nextGcdTime + gcdSpeedPhys).readyToUse) {
                // Using Atonement here means there's a higher chance our FoF has higher potency in it
                if (cp.isAtonementReadyBuffActive()) {
                    return Actions.Atonement;
                }
            }

            // One GCD until FoF
            if (cp.getFightOrFlightDuration() === 0 && cp.cdTracker.statusOfAt(Actions.FightOrFlight, cp.nextGcdTime).readyToUse) {
                // If we only have three left, we shouldn't use Supplication, since spells + Goring = 5
                if (cp.getNumberOfGoodFillerGCDsLeft() === 3 && !this.willOvercapBuffsNextGCD(cp)) {
                    return cp.getComboToUse();
                }

                if (cp.isSupplicationReadyBuffActive()) {
                    return Actions.Supplication;
                }
            }
        }

        // Try to save resources for FoF. Advance combo if we're not going to overcap buffs
        if (!this.willOvercapBuffsNextGCD(cp)) {
            return cp.getComboToUse();
        }

        if (cp.isAtonementReadyBuffActive()) {
            return Actions.Atonement;
        }

        if (cp.isSupplicationReadyBuffActive()) {
            return Actions.Supplication;
        }

        if (cp.isDivineMightBuffActive()) {
            return Actions.HolySpirit;
        }

        if (cp.isSepulchreReadyBuffActive()) {
            return Actions.Sepulchre;
        }

        // Last priority, use 123 combo
        return cp.getComboToUse();
    }

    // Uses PLD actions as part of a rotation.
    usePldRotation(cp: PldCycleProcessor) {
        ////////
        ///oGCDs
        ////////
        if (cp.canUseWithoutClipping(Actions.FightOrFlight)) {
            // If we want to go for 9 GCD FoF, we need to late weave it.
            if (cp.shouldWeGoForNineGCDFoFNow()) {
                cp.advanceForLateWeave([Actions.FightOrFlight]);
            }
            this.use(cp, Actions.FightOrFlight);
        }

        if (cp.canUseWithoutClipping(cp.requiescatAbility)) {
            this.use(cp, cp.requiescatAbility);
        }

        if (cp.canUseWithoutClipping(Actions.CircleOfScorn)) {
            this.use(cp, Actions.CircleOfScorn);
        }

        if (cp.canUseWithoutClipping(cp.expiacionAbility)) {
            this.use(cp, cp.expiacionAbility);
        }

        if (cp.isBladeOfHonorReadyBuffActive()) {
            if (cp.canUseWithoutClipping(Actions.BladeOfHonor)) {
                this.use(cp, Actions.BladeOfHonor);
            }
        }

        if (cp.getFightOrFlightDuration() > 0) {
            if (cp.canUseWithoutClipping(Actions.Intervene)) {
                this.use(cp, Actions.Intervene);
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

    use(cp: PldCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        if (ability.name === Actions.FightOrFlight.name) {
            // For the GCDs that alternate 8/9 GCD FoFs, this alternates FoF when we use it.
            const currentNineGCDFoFAlternation = cp.shouldWeNineGCDFoFThisAlternation;
            cp.shouldWeNineGCDFoFThisAlternation = !currentNineGCDFoFAlternation;
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

        return cp.use(ability);
    }

    private useOpener(cp: PldCycleProcessor) {
        const level = cp.stats.level;
        const requiescatComboActions = cp.getRequiescatComboActions();
        this.use(cp, Actions.HolySpiritHardcast);
        this.use(cp, cp.getComboToUse());
        this.use(cp, cp.getComboToUse());
        cp.advanceForLateWeave([potionMaxStr]);
        this.use(cp, potionMaxStr);
        this.use(cp, cp.getComboToUse());
        if (cp.shouldWeGoForNineGCDFoFNow()) {
            cp.advanceForLateWeave([Actions.FightOrFlight]);
            this.use(cp, Actions.FightOrFlight);
            this.use(cp, Actions.GoringBlade);
            this.use(cp, cp.requiescatAbility);
            this.use(cp, Actions.CircleOfScorn);
            this.use(cp, requiescatComboActions[0]);
            this.use(cp, cp.expiacionAbility);
            this.use(cp, Actions.Intervene);
            this.use(cp, requiescatComboActions[1]);
            this.use(cp, Actions.Intervene);
            this.use(cp, requiescatComboActions[2]);
            this.use(cp, requiescatComboActions[3]);
            if (level >= 100) {
                this.use(cp, Actions.BladeOfHonor);
            }
        }
        else {
            this.use(cp, Actions.FightOrFlight);
            this.use(cp, cp.requiescatAbility);
            this.use(cp, requiescatComboActions[0]);
            this.use(cp, Actions.CircleOfScorn);
            this.use(cp, cp.expiacionAbility);
            this.use(cp, requiescatComboActions[1]);
            this.use(cp, Actions.Intervene);
            this.use(cp, requiescatComboActions[2]);
            this.use(cp, Actions.Intervene);
            this.use(cp, requiescatComboActions[3]);
            if (level >= 100) {
                this.use(cp, Actions.BladeOfHonor);
            }
            this.use(cp, Actions.GoringBlade);
        }
        if (level >= 76) {
            this.use(cp, Actions.Atonement);
            this.use(cp, Actions.Supplication);
            this.use(cp, Actions.Sepulchre);
        }
        this.use(cp, Actions.HolySpirit);
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<PldCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const spellGcd = set.results.computedStats.gcdMag(2.5);
        const settings = { ...this.settings };
        const outer = this;

        console.log(`[PLD Sim] Running Rotation for ${gcd} GCD, ${spellGcd} spell GCD...`);
        console.log(`[PLD Sim] Settings configured: ${JSON.stringify(settings)}`);
        return [{
            cycleTime: 120,
            apply(cp: PldCycleProcessor) {
                outer.useOpener(cp);

                cp.remainingCycles(() => {
                    outer.usePldRotation(cp);
                });
            },
        }];
    }
}
