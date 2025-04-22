import {Ability, SimSettings, SimSpec, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {combineBuffEffects} from "@xivgear/core/sims/sim_utils";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {MchGauge} from "./mch_gauge";
import {MchExtraData, MchAbility, MchGcdAbility, ReassembledBuff, OverheatedBuff, FullMetalFieldBuff, HyperchargedBuff, ExcavatorReadyBuff} from "./mch_types";
import {sum} from "@xivgear/util/array_utils";
import * as Actions from './mch_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxDex} from "../../common/potion";

export interface MchSimResult extends CycleSimResult {

}

export interface MchSettings extends SimSettings {
    // If we use potions (used every six minutes).
    usePotion: boolean;
    // the length of the fight in seconds
    fightTime: number;
}

export interface MchSettingsExternal extends ExternalCycleSettings<MchSettings> {

}

export const mchSpec: SimSpec<MchSim, MchSettingsExternal> = {
    stub: "mch-sheet-sim",
    displayName: "MCH Sim",
    description: `Simulates a MCH rotation for level 100.
If potions are enabled, pots in the burst window every 6m (i.e. 0m, 6m, 12m, etc).
Defaults to simulating a killtime of 8m 30s (510s).`,
    makeNewSimInstance: function (): MchSim {
        return new MchSim();
    },
    loadSavedSimInstance: function (exported: MchSettingsExternal) {
        return new MchSim(exported);
    },
    supportedJobs: ['MCH'],
    supportedLevels: [100],
    isDefaultSim: true,
    maintainers: [{
        name: 'Juliacare',
        contact: [{
            type: 'discord',
            discordTag: 'juliacare',
            discordUid: '187548138456743936',
        }],
    }],
};

// AutomatonQueenAbilityUsageTime is a type representing two things:
// - a Automaton Queen ability
// - the time it should go off at
// This should be further enhanced to only include abilities where the
// actor is Automaton Queen, once that has been implemented for correct stats.
type AutomatonQueenAbilityUsageTime = {
    // The Automaton queen ability to use
    ability: MchAbility,
    // The time to use the ability at
    usageTime: number,
}

class RotationState {
    private _combo: number = 0;

    get combo() {
        return this._combo;
    };

    set combo(newCombo) {
        this._combo = newCombo;
        if (this._combo >= 3) this._combo = 0;
    }
}

class MchCycleProcessor extends CycleProcessor {
    gauge: MchGauge;
    rotationState: RotationState;
    // AutomatonQueenAbilityUsageTime tracks which remaining Automaton Queen abilities we have
    // upcoming. It's implemented this way so that the entries and buffs are correct
    // on the timeline.
    AutomatonQueenAbilityUsages: AutomatonQueenAbilityUsageTime[] = [];

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new MchGauge();
        this.rotationState = new RotationState();
    }

    /** Advances to as late as possible.
     * NOTE: I'm adding an extra 20ms to each animation lock to make sure we don't hit anything that's impossible to achieve ingame.
     */
    // @TODO Juliacare: this function isn't being used anywhere currently
    advanceForLateWeave(weaves: OgcdAbility[]) {
        const pingAndServerDelayAdjustment = 0.02;
        const totalAnimLock = sum(weaves.map(ability => (ability.animationLock ?? STANDARD_ANIMATION_LOCK) + pingAndServerDelayAdjustment));
        const remainingtime = this.nextGcdTime - this.currentTime;

        if (totalAnimLock > remainingtime) {
            return;
        }

        this.advanceTo(this.currentTime + (remainingtime - totalAnimLock));
    }

    applyAutomatonQueenAbility(abilityUsage: AutomatonQueenAbilityUsageTime) {
        const buffs = [...this.getActiveBuffs(abilityUsage.usageTime)];

        // @TODO Juliacare: filter out buffs that do not apply to Automaton Queen's actions
        const filteredBuffs = buffs.filter(buff => {
            return buff.name !== ReassembledBuff.name && buff.name !== OverheatedBuff.name;
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
        });
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        const extraData: MchExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    comboActions: MchGcdAbility[] = [Actions.HeatedSplitShot, Actions.HeatedSlugShot, Actions.HeatedCleanShot];
    getComboToUse() {
        return this.comboActions[this.rotationState.combo++];
    }

    inBurst(): boolean {
        const timeIntoTwoMinutes = this.currentTime % 120;

        // Six seconds after every (i.e. 0:06, 2:06, etc) burst, buffs will be up,
        // and will remain up for twenty seconds.
        return 6 <= timeIntoTwoMinutes && timeIntoTwoMinutes < 26;
    }

    tillBurst(): number {
        const timeIntoTwoMinutes = this.currentTime % 120;
        return 120 - timeIntoTwoMinutes;
    }

    // If the fight is ending within the next 12 seconds (to dump resources)
    // @TODO Juliacare: this function isn't being used anywhere currently
    fightEndingSoon(): boolean {
        return this.currentTime > (this.totalTime - 12);
    }

    // buff checker logic
    // @TODO Juliacare: this function isn't being used anywhere currently
    isReassembleBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === ReassembledBuff.name);
        return buff !== undefined;
    }

    isOverheatedBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === OverheatedBuff.name);
        return buff !== undefined;
    }

    isHyperchargedBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === HyperchargedBuff.name);
        return buff !== undefined;
    }

    isFullMetalFieldBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === FullMetalFieldBuff.name);
        return buff !== undefined;
    }

    isExcavatorReadyBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === ExcavatorReadyBuff.name);
        return buff !== undefined;
    }

    // Pot logic
    // @TODO Juliacare: this function isn't being used anywhere currently
    shouldPot(): boolean {
        const sixMinutesInSeconds = 360;
        const isSixMinuteWindow = this.currentTime % sixMinutesInSeconds < 20;
        return isSixMinuteWindow;
    }

    // Time until logic
    getTimeUntilReassembleCapped(): number {
        return this.cdTracker.statusOf(Actions.Reassemble).cappedAt.relative;
    }
    // @TODO Juliacare: this function isn't being used anywhere currently
    getTimeUntilDoubleCheckCapped(): number {
        return this.cdTracker.statusOf(Actions.DoubleCheck).cappedAt.relative;
    }
    // @TODO Juliacare: this function isn't being used anywhere currently
    getTimeUntilCheckMateCapped(): number {
        return this.cdTracker.statusOf(Actions.Checkmate).cappedAt.relative;
    }
}

export class MchSim extends BaseMultiCycleSim<MchSimResult, MchSettings, MchCycleProcessor> {
    spec = mchSpec;
    shortName = "mch-sheet-sim";
    displayName = mchSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: this.settings.fightTime,
        cycles: 0,
        which: 'totalTime',
        cutoffMode: 'prorate-gcd',
    };

    constructor(settings?: MchSettingsExternal) {
        super('MCH', settings);
        if (this.cycleSettings && settings && settings.cycleSettings) {
            this.cycleSettings.totalTime = settings.cycleSettings.totalTime;
        }
    }

    protected createCycleProcessor(settings: MultiCycleSettings): MchCycleProcessor {
        return new MchCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    override makeDefaultSettings(): MchSettings {
        return {
            usePotion: true,
            // 8 minutes and 30s, or 510 seconds
            // This is chosen since it's two pots, five bursts,
            fightTime: (8 * 60) + 30,
        };
    }

    // applyAutomatonQueenAbilities should be called before and after each ability
    // usage to ensure that Automaton Queen abilities are correctly positioned on the timeline.
    private applyAutomatonQueenAbilities(cp: MchCycleProcessor) {
        if (cp.AutomatonQueenAbilityUsages && cp.AutomatonQueenAbilityUsages.length > 0) {
            const usedAbilities: number[] = [];
            cp.AutomatonQueenAbilityUsages.forEach((abilityUsage, index) => {
                if (abilityUsage.usageTime <= cp.currentTime) {
                    cp.applyAutomatonQueenAbility(abilityUsage);
                    usedAbilities.push(index);
                }
            });
            usedAbilities.forEach(indexToRemove => {
                cp.AutomatonQueenAbilityUsages.splice(indexToRemove, 1);
            });
        }
    }

    // Note: this is stateful, and updates combos to the next combo.
    getGCDToUse(cp: MchCycleProcessor): MchGcdAbility {
        if (cp.isOverheatedBuffActive()) {
            return Actions.BlazingShot;
        }

        if (cp.isFullMetalFieldBuffActive() && cp.inBurst()) {
            return Actions.FullMetalField;
        }

        if (cp.gauge.batteryGauge <= 80 && (cp.inBurst() || cp.tillBurst() >= 40) && cp.cdTracker.canUse(Actions.Chainsaw)) {
            return Actions.Chainsaw;
        }

        if (cp.gauge.batteryGauge <= 80 && (cp.inBurst() || cp.tillBurst() >= 30) && cp.isExcavatorReadyBuffActive()) {
            return Actions.Excavator;
        }

        if (cp.gauge.batteryGauge <= 80 && (cp.inBurst() || cp.tillBurst() >= 20) && cp.cdTracker.canUse(Actions.AirAnchor)) {
            return Actions.AirAnchor;
        }

        if (cp.cdTracker.canUse(Actions.Drill)) {
            return Actions.Drill;
        }

        // Last priority, use combo
        return cp.getComboToUse();
    }

    // Uses MCH actions as part of a rotation.
    useMchRotation(cp: MchCycleProcessor) {
        ////////
        ///oGCDs
        ////////

        if (cp.canUseWithoutClipping(Actions.Wildfire) && cp.inBurst() && cp.isHyperchargedBuffActive()) {
            this.use(cp, Actions.Wildfire);
        } // figure out a way to force this to late weave, now just forcing it to look for hypercharged buff

        if (
            cp.canUseWithoutClipping(Actions.Checkmate) &&
                (
                    cp.isHyperchargedBuffActive() &&
                    (cp.cdTracker.statusOf(Actions.DoubleCheck).currentCharges < 2 ||
                    cp.cdTracker.statusOf(Actions.Checkmate).currentCharges > 2)
                )
        ) {
            this.use(cp, Actions.Checkmate);
        }

        if (cp.canUseWithoutClipping(Actions.DoubleCheck) && cp.isHyperchargedBuffActive()) {
            this.use(cp, Actions.DoubleCheck);
        }

        if (
            cp.canUseWithoutClipping(Actions.Hypercharge) &&
                (
                    (cp.tillBurst() < 2.5 || cp.tillBurst() > 30 || cp.inBurst()) &&
                    (cp.gauge.heatGauge >= 50 || cp.isHyperchargedBuffActive()) &&
                    cp.cdTracker.statusOf(Actions.AirAnchor).readyAt.relative > 6 &&
                    cp.cdTracker.statusOf(Actions.Chainsaw).readyAt.relative > 6 &&
                    cp.cdTracker.statusOf(Actions.Excavator).readyAt.relative > 6 &&
                    cp.cdTracker.statusOf(Actions.Drill).readyAt.relative > 6  &&
                    !cp.isOverheatedBuffActive()
                )
        ) {
            this.use(cp, Actions.Hypercharge);
        } // figure out a way to make this work better outside of burst

        if (cp.canUseWithoutClipping(Actions.BarrelStabilizer) && (cp.inBurst() || cp.tillBurst() <= 20)) {
            this.use(cp, Actions.BarrelStabilizer);
        }

        if (
            cp.canUseWithoutClipping(Actions.AutomatonQueen) &&
            (cp.inBurst() || cp.tillBurst() >= 50 || cp.tillBurst() <= 5.5) &&
            cp.gauge.batteryGauge >= 80
        ) {
            this.use(cp, Actions.AutomatonQueen);
        }

        if (
            cp.canUseWithoutClipping(Actions.Reassemble) &&
            (
                (cp.inBurst() || cp.tillBurst() > cp.getTimeUntilReassembleCapped()) &&
                (
                    cp.cdTracker.canUse(Actions.Drill, cp.nextGcdTime) ||
                    cp.cdTracker.canUse(Actions.AirAnchor, cp.nextGcdTime) ||
                    cp.cdTracker.canUse(Actions.Chainsaw, cp.nextGcdTime) ||
                    cp.cdTracker.canUse(Actions.Excavator, cp.nextGcdTime)
                ) && !cp.isOverheatedBuffActive
            )
        ) {
            this.use(cp, Actions.Reassemble);
        }

        if (
            cp.canUseWithoutClipping(Actions.Checkmate) &&
            ((cp.inBurst() || cp.cdTracker.statusOf(Actions.Checkmate).currentCharges > 1))
        ) {
            this.use(cp, Actions.Checkmate);
        }

        if (
            cp.canUseWithoutClipping(Actions.DoubleCheck) &&
            ((cp.inBurst() || cp.cdTracker.statusOf(Actions.DoubleCheck).currentCharges > 1))
        ) {
            this.use(cp, Actions.DoubleCheck);
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

    useAutomatonQueen(cp: MchCycleProcessor) {
        // After 5.6 delay, it does the following rotation with
        // 2.5 seconds between each.
        // Arm Punch * 5
        // Pile Bunker
        // Crowned Collider
        const automatonQueenDelay = 5.6;
        const automatonQueenDelayBetweenAbilities = 1.5;
        cp.AutomatonQueenAbilityUsages.push({
            // Arm Punch 1
            ability: {
                ...Actions.AutomatonQueenArmPunch,
                potency: 2.4 * cp.gauge.batteryGauge},
            // potency per 1 battery
            usageTime: cp.currentTime + automatonQueenDelay,
        });
        cp.AutomatonQueenAbilityUsages.push({
            // Arm Punch 2
            ability: {
                ...Actions.AutomatonQueenArmPunch,
                potency: 2.4 * cp.gauge.batteryGauge},
            // potency per 1 battery
            usageTime: cp.currentTime + automatonQueenDelay + 1 * automatonQueenDelayBetweenAbilities,
        });
        cp.AutomatonQueenAbilityUsages.push({
            // Arm Punch 3
            ability: {
                ...Actions.AutomatonQueenArmPunch,
                potency: 2.4 * cp.gauge.batteryGauge},
            // potency per 1 battery
            usageTime: cp.currentTime + automatonQueenDelay + 2 * automatonQueenDelayBetweenAbilities,
        });
        cp.AutomatonQueenAbilityUsages.push({
            // Arm Punch 4
            ability: {
                ...Actions.AutomatonQueenArmPunch,
                potency: 2.4 * cp.gauge.batteryGauge},
            // potency per 1 battery
            usageTime: cp.currentTime + automatonQueenDelay + 3 * automatonQueenDelayBetweenAbilities,
        });
        cp.AutomatonQueenAbilityUsages.push({
            // Arm Punch 5
            ability: {
                ...Actions.AutomatonQueenArmPunch,
                potency: 2.4 * cp.gauge.batteryGauge},
            // potency per 1 battery
            usageTime: cp.currentTime + automatonQueenDelay + 4 * automatonQueenDelayBetweenAbilities,
        });
        cp.AutomatonQueenAbilityUsages.push({
            // Pile Bunker
            ability: {
                ...Actions.AutomatonQueenPileBunker,
                potency: 6.8 * cp.gauge.batteryGauge},
            // potency per 1 battery
            usageTime: cp.currentTime + automatonQueenDelay + 5 * automatonQueenDelayBetweenAbilities,
        });
        cp.AutomatonQueenAbilityUsages.push({
            // Crowned Collider
            ability: {
                ...Actions.AutomatonQueenCrownedCollider,
                potency: 7.8 * cp.gauge.batteryGauge},
            // potency per 1 battery
            usageTime: cp.currentTime + automatonQueenDelay + 6 * automatonQueenDelayBetweenAbilities + 1,
            // crowned collider has a recast time of 2.5s instead of 1.5s
        });
        cp.gauge.batteryGauge = 0;
    }

    use(cp: MchCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        const mchAbility = ability as MchAbility;

        // If we try to use Automaton Queen, do it properly
        if (mchAbility.id === Actions.AutomatonQueen.id) {
            this.useAutomatonQueen(cp);
        }

        // Apply Automaton Queen abilities before attempting to use an ability
        // AND before we move the timeline for that ability.
        this.applyAutomatonQueenAbilities(cp);

        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (ability.type === 'ogcd' && cp.canUseWithoutClipping(ability)) {
            const readyAt = cp.cdTracker.statusOf(ability).readyAt.absolute;
            if (cp.totalTime > readyAt) {
                cp.advanceTo(readyAt);
            }
        }

        // Only use potion if enabled in settings
        if (!this.settings.usePotion && ability.name.includes("of Dexterity")) {
            return null;
        }

        // update Battery gauge
        if (mchAbility.updateBatteryGauge !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }
            mchAbility.updateBatteryGauge(cp.gauge);
        }

        // update Heat gauge
        if (mchAbility.updateHeatGauge !== undefined) {
            // Don't spend Heat on Hypercharge if we have the Hypercharged buff
            if (mchAbility.id !== Actions.Hypercharge.id || !cp.isHyperchargedBuffActive()) {
                // Prevent gauge updates showing incorrectly on autos before this ability
                if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                    cp.advanceTo(cp.nextGcdTime);
                }
                mchAbility.updateHeatGauge(cp.gauge);
            }
        }

        // Lower the cooldown of Double Check and Checkmate if appropriate
        if (mchAbility.id === Actions.BlazingShot.id) {
            cp.cdTracker.modifyCooldown(Actions.DoubleCheck, -15);
            cp.cdTracker.modifyCooldown(Actions.Checkmate, -15);
        }

        // Apply Automaton Queen abilities before attempting to use an ability
        // AND after we move the timeline for that ability.
        this.applyAutomatonQueenAbilities(cp);

        return cp.use(mchAbility);
    }

    private useOpener(cp: MchCycleProcessor) {
        this.use(cp, Actions.Reassemble);
        cp.advanceTo(5 - 2 * STANDARD_ANIMATION_LOCK);
        this.use(cp, potionMaxDex);
        this.use(cp, Actions.AirAnchor);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.Drill);
        this.use(cp, Actions.BarrelStabilizer);
        this.use(cp, Actions.Chainsaw);
        this.use(cp, Actions.Excavator);
        this.use(cp, Actions.AutomatonQueen);
        this.use(cp, Actions.Reassemble);
        this.use(cp, Actions.Drill);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.Wildfire);
        this.use(cp, Actions.FullMetalField);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.Hypercharge);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.Drill);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.HeatedSplitShot);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.HeatedSlugShot);
        this.use(cp, Actions.HeatedCleanShot);
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<MchCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const settings = { ...this.settings };
        const outer = this;

        console.log(`[MCH Sim] Running Rotation for ${gcd} GCD...`);
        console.log(`[MCH Sim] Settings configured: ${JSON.stringify(settings)}`);
        return [{
            cycleTime: 120,
            apply(cp: MchCycleProcessor) {
                outer.useOpener(cp);

                cp.remainingCycles(() => {
                    outer.useMchRotation(cp);
                });
            },
        }];
    }
}
