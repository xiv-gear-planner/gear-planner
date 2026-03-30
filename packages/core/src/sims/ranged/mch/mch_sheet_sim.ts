import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import type {CharacterGearSet} from "../../../gear";
import {potionMaxDex} from "../../common/potion";
import type {CycleSettings} from "../../cycle_settings";
import {CycleProcessor, type AbilityUseResult, type CycleSimResult, type ExternalCycleSettings, type MultiCycleSettings, type PreDmgAbilityUseRecordUnf, type Rotation} from "../../cycle_sim";
import {BaseMultiCycleSim} from "../../processors/sim_processors";
import type {Ability, DamagingAbility, SimSettings, SimSpec} from "../../sim_types";
import {AirAnchor, AutomatonQueen, AutomatonQueenArmPunch, AutomatonQueenCrownedCollider, AutomatonQueenPileBunker, BarrelStabilizer, BlazingShot, Chainsaw, Checkmate, Detonator, DoubleCheck, Drill, Excavator, FullMetalField, HeatedCleanShot, HeatedSlugShot, HeatedSplitShot, Hypercharge, Reassemble, Wildfire} from "./mch_actions";
import {ExcavatorReadyBuff, FullMetalMachinistBuff, HyperchargedBuff, OverheatedBuff, ReassembledBuff, WildfireBuff} from "./mch_buffs";
import {MchGauge} from "./mch_gauge";
import type {MchAbility, MchGcdAbility, MchOgcdAbility} from "./mch_types";
import {combineBuffEffects} from "../../sim_utils";
import {formatDuration} from "@xivgear/util/strutils";

/**
 * Actions TODO:
 *  - Automaton Queen
 *  - Wildfire
 */

interface RotationConstants {
    toolGcds: number,
    toolBattery: number,
    reassembleActions: MchGcdAbility[],
    petActionsDelay: number[],
}

interface ActionQueueItem {
    ability: MchOgcdAbility & DamagingAbility,
    usedAt: number,
}

/** Array of the 1/2/3 combo actions */
const COMBO_ACTIONS = [HeatedSplitShot, HeatedSlugShot, HeatedCleanShot];

/** Constants for the rotation, per job level */
const ROTATION_CONSTANTS: Record<'100' /* | '90' | '80' | '70' */, RotationConstants> = {
    '100': {
        toolGcds: 6 + 3 + 2 + 2 + 1 + 3, // 17 (6 Drill, 3 AA, 2+2 CS/Ex, 1 FMF, 3 BS from Hypercharged)
        toolBattery: 60 + 40 + 40, // 140 (60 AA, 40+40 CS/Ex)
        reassembleActions: [Drill, AirAnchor, Excavator, Chainsaw],
        petActionsDelay: [5.6, 7.1, 8.6, 10.1, 11.6, 13.6, 16.1],
    },
} as const;

export interface MchSimSettings extends SimSettings {
    usePots: boolean;
    // if set to true, the opener pot is skipped and the first pot will happen at 2
    skipOpenerPot: boolean;
    killTime: number;
}

export interface MchSimSettingsExternal extends ExternalCycleSettings<MchSimSettings> {}
export interface MchSimResult extends CycleSimResult {}

export const mchSheetSpec: SimSpec<MchSheetSim, MchSimSettingsExternal> = {
    stub: 'mch-sheet-sim',
    displayName: 'MCH simulator',
    supportedJobs: ['MCH'],
    supportedLevels: [100], // TODO: support for 70, 80, 90
    isDefaultSim: true,
    maintainers: [{
        name: 'Zodia Ware',
        contact: [{
            type: 'discord',
            discordTag: 'zodiia',
            discordUid: '308679185105420290',
        }],
    }],
    makeNewSimInstance: () => new MchSheetSim(),
    loadSavedSimInstance: (settings) => new MchSheetSim(settings),
};

export class MchCycleProcessor extends CycleProcessor {
    public readonly gcdTimer: number;

    gauge = new MchGauge();
    comboState = 0;
    ogcdsRemaining = 0;
    potAbility: MchOgcdAbility;
    constants: RotationConstants;
    /** How many times Hypercharge can be used before next burst */
    hyperchargeUses = 0;
    /** How much battery we would have on next burst as of right now */
    batteryOnNextBurst = 0;
    /** Queue of non-locking actions to execute (Wildfire's detonation and Automaton Queen actions) */
    additionalActionsQueue: ActionQueueItem[] = [];

    constructor(settings: MultiCycleSettings, private simSettings: MchSimSettings) {
        super(settings);
        this.gcdTimer = this.gcdTime(HeatedCleanShot);
        this.potAbility = {
            ...potionMaxDex,
            cooldown: {
                time: 360,
            },
        };
        switch (this.stats.level) {
            case 100:
                this.constants = ROTATION_CONSTANTS['100'];
                break;
                // TODO: level 90, 80, 70
            default:
                this.constants = ROTATION_CONSTANTS['100'];
                break;
        }
    }

    private getNextComboAbility(): MchGcdAbility {
        return COMBO_ACTIONS[this.comboState];
    }

    /**
     * Returns the time before the next burst window.
     *
     * @param [delay=0] Additional delay, useful for calculating the time before some point inside the burst window.
     */
    private timeBeforeNextBurstWindow(delay: number = 0) {
        return (120 + delay - this.nextGcdTime % 120) % 120;
    }

    /**
     * Calculates the gauge generation for the next 2 minutes.
     * This should never be called at any other point than before a 2-min burst, or the values will be wrong.
     *
     * @returns The amount of gauge generated over the course of the next 2 minutes, including current gauge values.
     */
    private calculateGaugeUsageForNextCycle(opener = false) {
        const status = { heat: this.gauge.heat, battery: this.gauge.battery };
        const comboGcds = Math.ceil(this.timeBeforeNextBurstWindow() / this.gcdTimer) - this.constants.toolGcds;

        // add battery from tool usage
        status.battery += this.constants.toolBattery;
        // add heat from combo usage
        status.heat += comboGcds * 5;
        // add battery from heated clean shot usage
        status.battery += Math.floor((comboGcds + this.comboState) / 3) * 10;
        while (status.heat >= 100) { // includes 100 because we might have one more combo use during burst. TODO greedy overcap
            status.heat -= 65;
            status.battery -= 10;
            this.hyperchargeUses += 1;
        }
        // we have ""one more"" air anchor use on opener (as in, we use it 4 times instead of 3 in the first 2 minutes)
        if (opener) {
            status.battery += 20;
        }
        this.hyperchargeUses += 1; // Hypercharged buff
        this.batteryOnNextBurst = status.battery;
    }

    /**
     * Algorithm that calculates if using Hypercharge right now would make any weaponskill drift.
     */
    private wouldHyperchargeGcdDrift(): boolean {
        // Yes, Blazing Shot is on a fixed 1.5s GCD timer. But with a GCD <2.5s, having a fixed 7.5s instead of 3*GCD would screw up
        // the rest of this algorithm because Air Anchor and Excavator will *always* drift by a few milliseconds, which is intended.
        const timeToHyperchargeEnd = (this.nextGcdTime - this.currentTime) + this.gcdTimer * 3;
        let recastTimers = [
            this.cdTracker.statusOfAt(Drill, this.nextGcdTime).cappedAt.relative - timeToHyperchargeEnd,
            this.cdTracker.statusOfAt(AirAnchor, this.nextGcdTime).readyAt.relative - timeToHyperchargeEnd,
            this.cdTracker.statusOfAt(Chainsaw, this.nextGcdTime).readyAt.relative - timeToHyperchargeEnd,
            (this.getActiveBuffData(ExcavatorReadyBuff)?.end ?? Infinity) - (this.currentTime + timeToHyperchargeEnd),
        ].filter((it) => Number.isFinite(it)).sort((a, b) => b - a);

        while (recastTimers.length > 0) {
            if (recastTimers[recastTimers.length - 1] < 0) {
                return true;
            }
            recastTimers.pop();
            recastTimers = recastTimers.map((it) => it - this.gcdTimer);
        }
        return false;
    }

    // Always use
    private canUseDrill(): boolean {
        // TODO: Hold one charge for 2min burst
        return this.cdTracker.canUse(Drill, this.nextGcdTime);
    }

    // Always use as soon as available
    private canUseAirAnchor(): boolean {
        // TODO: Possibly let it drift by one GCD to realign with 2m burst for GCDs <2.5
        if (!this.cdTracker.canUse(AirAnchor, this.nextGcdTime)) {
            console.log(`[${formatDuration(this.nextGcdTime)}] can't use air anchor yet, cd is ${this.cdTracker.statusOfAt(AirAnchor, this.nextGcdTime).readyAt.relative}`);
        }
        return this.cdTracker.canUse(AirAnchor, this.nextGcdTime);
    }

    // Always use as soon as available
    private canUseChainsaw(): boolean {
        // TODO: Possibly let it drift by one GCD to realign with 2m burst for GCDs <2.5
        return this.cdTracker.canUse(Chainsaw, this.nextGcdTime);
    }

    // Use if Excavator Ready buff is available
    private canUseExcavator(): boolean {
        if (this.gauge.battery >= 30 && this.batteryOnNextBurst - this.gauge.battery === 110) { // hold so that we align 100 battery on 2 min
            // console.log(`[${formatDuration(this.currentTime)}] holding excavator for battery`);
            return false;
        }
        return this.getActiveBuffs(this.currentTime).includes(ExcavatorReadyBuff);
    }

    // Use when hypercharged and excavator have been spent, and FMF is available
    private canUseFullMetalField(): boolean {
        const buffs = this.getActiveBuffs(this.currentTime);

        return buffs.includes(FullMetalMachinistBuff)
            && !buffs.includes(ExcavatorReadyBuff);
    }

    // Use when overheated is active
    private canUseBlazingShot(): boolean {
        return this.getActiveBuffs(this.currentTime).some((buff) => buff.name === OverheatedBuff.name);
    }

    // Use as soon as possible, timing positioned using the opener
    private canUseBarrelStabilizer(): boolean {
        return this.cdTracker.canUse(BarrelStabilizer, this.nextGcdTime);
    }

    private canUseCheckmate(): boolean {
        const cmStatus = this.cdTracker.statusOf(Checkmate);
        const dcStatus = this.cdTracker.statusOf(DoubleCheck);

        if (cmStatus.currentCharges === 0) {
            return false;
        }
        if ((cmStatus.cappedAt.relative - Checkmate.cooldown.time) > this.timeBeforeNextBurstWindow(5)) {
            // hold one charge for the burst window
            return false;
        }
        if (cmStatus.cappedAt.relative < dcStatus.cappedAt.relative) { // prioritize the one that will cap earlier
            return true;
        }
        return false;
    }

    // basically the opposite of above
    private canUseDoubleCheck(): boolean {
        const cmStatus = this.cdTracker.statusOf(Checkmate);
        const dcStatus = this.cdTracker.statusOf(DoubleCheck);

        if (dcStatus.currentCharges === 0) {
            return false;
        }
        if ((dcStatus.cappedAt.relative - DoubleCheck.cooldown.time) > this.timeBeforeNextBurstWindow(5)) {
            // hold one charge for the burst window
            return false;
        }
        if (dcStatus.cappedAt.relative < cmStatus.cappedAt.relative) { // prioritize the one that will cap earlier
            return true;
        }
        return false;
    }

    private canUseHypercharge(): boolean {
        const buffs = this.getActiveBuffs(this.currentTime);

        if (!this.cdTracker.canUse(Hypercharge)) {
            return false;
        }
        // used during burst window after Full Metal Field and Excavator are spent
        if (buffs.includes(HyperchargedBuff)) {
            if (!buffs.includes(FullMetalMachinistBuff) && !buffs.includes(ExcavatorReadyBuff)) {
                return true;
            }
            return false;
        }
        if (this.gauge.heat < 50) {
            return false;
        }
        if (this.wouldHyperchargeGcdDrift()) {
            return false;
        }
        if (this.hyperchargeUses === 0) {
            return false;
        }
        return true;
    }

    private canUseReassemble(): boolean {
        if (this.cdTracker.statusOf(Reassemble).cappedAt.relative > this.timeBeforeNextBurstWindow(5)) { // hold one charge for burst
            return false;
        }
        if (this.cdTracker.canUse(Reassemble, this.nextGcdTime)) {
            const nextGcd = this.getNextGcdAbility();

            return this.constants.reassembleActions.includes(nextGcd);
        }
        return false;
    }

    private canPot(): boolean {
        if (this.ogcdsRemaining !== 1) { // only use as "last" ogcd because we're gonna advance to the latest possible usage time
            return false;
        }
        return this.cdTracker.canUse(this.potAbility);
    }

    private canUseAutomatonQueen(): boolean {
        if (!this.cdTracker.canUse(AutomatonQueen) || this.gauge.battery < 50) {
            return false;
        }
        if (this.batteryOnNextBurst - this.gauge.battery >= 160) { // use at 170 or above so that we can reach 50+ when it's time to align to 80 remaining before burst
            return true;
        }
        if (this.batteryOnNextBurst > 100) {
            // console.log(`[${formatDuration(this.currentTime)}] battery on next burst is ${this.batteryOnNextBurst} and current gauge ${this.gauge.battery}`);
            return this.batteryOnNextBurst - this.gauge.battery <= 100;
        }
        return false;
    }

    private canUseWildfire(): boolean {
        if (!this.cdTracker.canUse(Wildfire)) {
            return false;
        }
        return true;
    }

    private getNextGcdAbility(): MchGcdAbility {
        if (this.canUseBlazingShot()) {
            return BlazingShot;
        }
        if (this.canUseChainsaw()) {
            return Chainsaw;
        }
        if (this.canUseExcavator()) {
            return Excavator;
        }
        if (this.canUseAirAnchor()) {
            return AirAnchor;
        }
        if (this.canUseFullMetalField()) {
            return FullMetalField;
        }
        if (this.canUseDrill()) {
            return Drill;
        }

        return this.getNextComboAbility();
    }

    private getNextOgcdAbility(): MchOgcdAbility | null {
        if (this.canUseBarrelStabilizer()) {
            return BarrelStabilizer;
        }
        if (this.canUseWildfire()) {
            return Wildfire;
        }
        if (this.canUseHypercharge()) {
            this.hyperchargeUses -= 1;
            return Hypercharge;
        }
        if (this.canUseAutomatonQueen()) {
            // console.log(`[${formatDuration(this.currentTime)}] Using queen for ${this.gauge.battery} battery with ${this.batteryOnNextBurst} on next burst`);
            return AutomatonQueen;
        }
        if (this.canUseReassemble()) {
            return Reassemble;
        }
        if (this.canUseCheckmate()) {
            return Checkmate;
        }
        if (this.canUseDoubleCheck()) {
            return DoubleCheck;
        }
        if (this.canPot()) {
            this.advanceTo(this.nextGcdTime - STANDARD_ANIMATION_LOCK);
            return this.potAbility;
        }

        return null;
    }

    private updateGauge(ability: MchAbility) {
        if (ability === Hypercharge && this.getActiveBuffs(this.currentTime).includes(HyperchargedBuff)) {
            return;
        }
        if (ability === AutomatonQueen) {
            this.batteryOnNextBurst -= this.gauge.battery;
        }
        ability.updateGauge?.(this.gauge);
    }

    private updateComboStatus(ability: MchAbility) {
        if (!(COMBO_ACTIONS as MchAbility[]).includes(ability)) {
            return;
        }
        if (this.comboState === 2) { // loop back to first action
            this.comboState = 0;
        }
        else {
            this.comboState += 1;
        }
    }

    private executeLevel100Opener() {
        this.use(Reassemble);
        if (this.simSettings.usePots) {
            if (!this.simSettings.skipOpenerPot) {
                this.advanceTo(5 - STANDARD_ANIMATION_LOCK * 2, true);
                this.use(this.potAbility);
            }
            else {
                this.advanceTo(5 - STANDARD_ANIMATION_LOCK * 1, true);
                this.cdTracker.modifyCooldown(this.potAbility, 120 - this.gcdTimer);
            }
        }
        else {
            this.advanceTo(5 - STANDARD_ANIMATION_LOCK * 1, true);
        }
        this.calculateGaugeUsageForNextCycle(true);
        this.use(AirAnchor);
        this.use(DoubleCheck);
        this.use(Checkmate);
        this.use(Drill);
        this.use(Chainsaw);
        this.use(BarrelStabilizer);
        this.use(Excavator);
        this.use(AutomatonQueen);
        this.use(Reassemble);
        this.use(Drill);
        this.use(DoubleCheck);
        this.use(Wildfire);
        // rest of the opener is handled perfectly well by the normal rotation
    }

    private useQueuedActions(ability: PreDmgAbilityUseRecordUnf) {
        const unusedActions = this.additionalActionsQueue.filter((queuedAction) => {
            if (ability.usedAt > queuedAction.usedAt) {
                const buffs = this.getActiveBuffs(queuedAction.usedAt).filter(
                    (it) => it.name !== ReassembledBuff.name && it.name !== OverheatedBuff.name
                );

                super.addAbilityUse({
                    usedAt: queuedAction.usedAt,
                    ability: queuedAction.ability,
                    buffs: buffs,
                    combinedEffects: combineBuffEffects(buffs),
                    totalTimeTaken: 0,
                    appDelay: queuedAction.ability.appDelay,
                    appDelayFromStart: queuedAction.ability.appDelay,
                    castTimeFromStart: 0,
                    snapshotTimeFromStart: 0,
                    lockTime: 0,
                    dot: queuedAction.ability.dot ? {
                        damagePerTick: {
                            expected: queuedAction.ability.dot.tickPotency,
                            stdDev: 1,
                        },
                        fullDurationTicks: 1,
                        actualTickCount: 1,
                    } : undefined,
                    gaugeAfter: ability.gaugeAfter, // ?
                });
                return false;
            }
            return true;
        });
        this.additionalActionsQueue = unusedActions;
    }

    private queueActions(use: PreDmgAbilityUseRecordUnf) {
        switch (use.ability.name) {
            case Wildfire.name:
                this.additionalActionsQueue.push({
                    ability: Detonator,
                    usedAt: use.usedAt + 10,
                });
                break;
            case AutomatonQueen.name:
                this.additionalActionsQueue.push({
                    ability: {
                        ...AutomatonQueenArmPunch,
                        potency: AutomatonQueenArmPunch.potency * this.gauge.battery,
                    },
                    usedAt: use.usedAt + this.constants.petActionsDelay[0],
                }, {
                    ability: {
                        ...AutomatonQueenArmPunch,
                        potency: AutomatonQueenArmPunch.potency * this.gauge.battery,
                    },
                    usedAt: use.usedAt + this.constants.petActionsDelay[1],
                }, {
                    ability: {
                        ...AutomatonQueenArmPunch,
                        potency: AutomatonQueenArmPunch.potency * this.gauge.battery,
                    },
                    usedAt: use.usedAt + this.constants.petActionsDelay[2],
                }, {
                    ability: {
                        ...AutomatonQueenArmPunch,
                        potency: AutomatonQueenArmPunch.potency * this.gauge.battery,
                    },
                    usedAt: use.usedAt + this.constants.petActionsDelay[3],
                }, {
                    ability: {
                        ...AutomatonQueenArmPunch,
                        potency: AutomatonQueenArmPunch.potency * this.gauge.battery,
                    },
                    usedAt: use.usedAt + this.constants.petActionsDelay[4],
                }, {
                    ability: {
                        ...AutomatonQueenPileBunker,
                        potency: AutomatonQueenPileBunker.potency * this.gauge.battery,
                    },
                    usedAt: use.usedAt + this.constants.petActionsDelay[5],
                }, {
                    ability: {
                        ...AutomatonQueenCrownedCollider,
                        potency: AutomatonQueenCrownedCollider.potency * this.gauge.battery,
                    },
                    usedAt: use.usedAt + this.constants.petActionsDelay[6],
                });
                this.gauge.battery = 0; // we also reset battery here and not in updateGauge, otherwise battery would be 0 above.
                break;
            default:
                // no action to queue
                break;
        }
    }

    override addAbilityUse(ability: PreDmgAbilityUseRecordUnf) {
        this.useQueuedActions(ability);
        this.queueActions(ability);
        super.addAbilityUse({
            ...ability,
            extraData: {
                gauge: {
                    heat: this.gauge.heat,
                    battery: this.gauge.battery,
                },
            },
        });
    }

    override use(ability: Ability): AbilityUseResult {
        this.updateGauge(ability);
        this.updateComboStatus(ability);
        if (ability === BlazingShot) { // only one ogcd on 1.5 gcd, and reduce cd for cm/dc
            this.ogcdsRemaining = 1;
            this.cdTracker.modifyCooldown(Checkmate, -15);
            this.cdTracker.modifyCooldown(DoubleCheck, -15);
        }
        else if (ability.type === 'gcd') { // any other gcd ability = 2 ogcd
            this.ogcdsRemaining = 2;
        }
        return super.use(ability);
    }

    executeOpener() {
        // TODO: Level 70, 80, 90 openers, + potential variants
        this.executeLevel100Opener();
    }

    executeNextGcd() {
        const gcdAbility = this.getNextGcdAbility();

        if (this.timeBeforeNextBurstWindow(this.gcdTimer) < this.gcdTimer) { // next action will be start of 2m burst
            this.calculateGaugeUsageForNextCycle();
        }
        this.use(gcdAbility);
    }

    executeNextOgcd() {
        if (this.ogcdsRemaining <= 0) {
            return;
        }

        const ogcdAbility = this.getNextOgcdAbility();

        if (ogcdAbility !== null) {
            this.use(ogcdAbility);
        }
        this.ogcdsRemaining -= 1;
    }
}

export class MchSheetSim extends BaseMultiCycleSim<MchSimResult, MchSimSettings, MchCycleProcessor> {
    spec = mchSheetSpec;
    displayName = this.spec.displayName;
    shortName = this.spec.stub;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: this.settings.killTime,
        cycles: 0,
        which: 'totalTime',
        cutoffMode: 'prorate-gcd',
    };

    constructor(settings?: MchSimSettingsExternal) {
        super('MCH', settings);
    }

    override makeDefaultSettings(): MchSimSettings {
        return {
            killTime: 510, // 8m30s
            usePots: true,
            skipOpenerPot: false,
        };
    }

    override createCycleProcessor(settings: MultiCycleSettings) {
        return new MchCycleProcessor(settings, this.settings);
    }

    override getRotationsToSimulate(set: CharacterGearSet): Rotation<MchCycleProcessor>[] {
        return [{
            cycleTime: 120,
            apply: (cycleProcessor) => {
                cycleProcessor.executeOpener();
                while (cycleProcessor.remainingGcdTime) {
                    cycleProcessor.executeNextGcd();
                    cycleProcessor.executeNextOgcd();
                    cycleProcessor.executeNextOgcd();
                }
            },
        }];
    }
}
