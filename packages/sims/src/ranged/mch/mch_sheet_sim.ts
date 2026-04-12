import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import type {CharacterGearSet} from "@xivgear/core/gear";
import {CycleProcessor, type AbilityUseResult, type CycleSimResult, type ExternalCycleSettings, type MultiCycleSettings, type PreDmgAbilityUseRecordUnf, type Rotation} from "@xivgear/sims/cycle_sim";
import {potionMaxDex} from "@xivgear/sims/common/potion";
import {BaseMultiCycleSim} from "../../processors/sim_processors";
import type {Ability, DamagingAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {AirAnchor, AutomatonQueen, AutomatonQueenArmPunch, AutomatonQueenCrownedCollider, AutomatonQueenPileBunker, BarrelStabilizer, BlazingShot, Chainsaw, Checkmate, Detonator, DoubleCheck, Drill, Excavator, FullMetalField, HeatedCleanShot, HeatedSlugShot, HeatedSplitShot, Hypercharge, Reassemble, Wildfire} from "./mch_actions";
import {ExcavatorReadyBuff, FullMetalMachinistBuff, HyperchargedBuff, OverheatedBuff, ReassembledBuff} from "./mch_buffs";
import {MchGauge} from "./mch_gauge";
import type {MchAbility, MchGcdAbility, MchOgcdAbility} from "./mch_types";
import {combineBuffEffects} from "@xivgear/core/sims/sim_utils";
import {formatDuration} from "@xivgear/util/strutils";
import type {CycleSettings} from "../../cycle_settings";

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

/** Tracked actions for which warnings will be printed if they cap/drift */
const DRIFT_WARNING_ABILITY = [Drill, AirAnchor, Chainsaw, DoubleCheck, Checkmate];

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
    // if set to true, cooldowns like air anchor won't be held to align on 2-min bursts
    dontAlignCds: boolean;
}

export interface MchSimSettingsExternal extends ExternalCycleSettings<MchSimSettings> {}
export interface MchSimResult extends CycleSimResult {}

export const mchSheetSpec: SimSpec<MchSheetSim, MchSimSettingsExternal> = {
    stub: 'mch-sheet-sim',
    displayName: 'MCH Sim',
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
    public readonly gcdCalculated: number;

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
        this.gcdCalculated = this.gcdTime(HeatedCleanShot);
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
     * @param [absolute] Do not wrap it to 120, meaning the value could reach more than 120
     */
    private timeBeforeNextBurstWindow(delay: number = 0, absolute = false, ogcd = false) {
        const time = ogcd ? this.currentTime : this.nextGcdTime;

        if (absolute) {
            return 120 + delay - this.nextGcdTime % 120;
        }
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
        const comboGcds = Math.ceil(this.timeBeforeNextBurstWindow() / this.gcdCalculated) - this.constants.toolGcds;

        // add battery from tool usage
        status.battery += this.constants.toolBattery;
        // add heat from combo usage
        status.heat += comboGcds * 5;
        // add battery from heated clean shot usage
        status.battery += Math.floor((comboGcds + this.comboState) / 3) * 10;
        while (status.heat >= 100) { // includes 100 because we might have one more combo use during burst.
            status.heat -= 65;
            status.battery -= 10;
            this.hyperchargeUses += 1;
        }
        // we have ""one more"" air anchor use on opener (as in, we use it 4 times instead of 3 in the first 2 minutes)
        // that will only happen with 2.5 gcd or without cd alignment, as other gcds will drift it beyond the 2 minute mark to realign it
        if (opener && (this.gcdCalculated === 2.5 || this.simSettings.dontAlignCds)) {
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
        const timeToHyperchargeEnd = (this.nextGcdTime - this.currentTime) + this.gcdCalculated * 3;
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
            recastTimers = recastTimers.map((it) => it - this.gcdCalculated);
        }
        return false;
    }

    private keepDrillChargeForBurst(): boolean {
        return !this.simSettings.dontAlignCds
            && this.cdTracker.statusOf(Drill).cappedAt.relative > this.timeBeforeNextBurstWindow(this.gcdCalculated * 4, true);
    }

    private holdForRepositioningOnBurst(gcds: number): boolean {
        return !this.simSettings.dontAlignCds
            && this.timeBeforeNextBurstWindow(this.gcdCalculated * gcds, true) < (this.gcdBase - this.gcdCalculated) * (120 / this.gcdBase);
    }

    private canUseDrill(): boolean {
        if (this.keepDrillChargeForBurst()) {
            return false;
        }
        return this.cdTracker.canUse(Drill, this.nextGcdTime);
    }

    private canUseAirAnchor(): boolean {
        if (this.holdForRepositioningOnBurst(0)) {
            return false;
        }
        return this.cdTracker.canUse(AirAnchor, this.nextGcdTime);
    }

    private canUseChainsaw(): boolean {
        if (this.holdForRepositioningOnBurst(2)) {
            return false;
        }
        return this.cdTracker.canUse(Chainsaw, this.nextGcdTime);
    }

    private canUseExcavator(): boolean {
        // hold so that we align 100 battery on 2 min
        if (this.gauge.battery >= 30 && this.batteryOnNextBurst - this.gauge.battery === 110) {
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
        return this.cdTracker.canUse(BarrelStabilizer, this.currentTime);
    }

    private canUseCheckmate(): boolean {
        const cmStatus = this.cdTracker.statusOf(Checkmate);
        const dcStatus = this.cdTracker.statusOf(DoubleCheck);

        if (cmStatus.currentCharges === 0) {
            return false;
        }
        // hold one charge for the burst window
        if ((cmStatus.cappedAt.relative - Checkmate.cooldown.time) > this.timeBeforeNextBurstWindow(this.gcdCalculated * 2)) {
            return false;
        }
        // prioritize the one that will cap earlier
        if (cmStatus.cappedAt.relative < dcStatus.cappedAt.relative) {
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
        // hold one charge for the burst window
        if ((dcStatus.cappedAt.relative - DoubleCheck.cooldown.time) > this.timeBeforeNextBurstWindow(this.gcdCalculated * 2)) {
            return false;
        }
        // prioritize the one that will cap earlier
        if (dcStatus.cappedAt.relative < cmStatus.cappedAt.relative) {
            return true;
        }
        return false;
    }

    private canUseHypercharge(): boolean {
        const buffs = this.getActiveBuffs(this.currentTime);

        if (!this.cdTracker.canUse(Hypercharge, this.currentTime)) {
            return false;
        }
        // prevent Drill from overcapping while we are hypercharged
        if (this.cdTracker.statusOfAt(Drill, this.nextGcdTime).cappedAt.relative < 7.5) {
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
        if (this.hyperchargeUses === 0) {
            return false;
        }
        // prevent using too early during burst; 90 is totally arbitrary
        if (this.cdTracker.statusOfAt(BarrelStabilizer, this.currentTime).readyAt.relative < 30) {
            return false;
        }
        return !this.wouldHyperchargeGcdDrift();
    }

    private canUseReassemble(): boolean {
        // hold one charge for burst
        if (this.cdTracker.statusOf(Reassemble).cappedAt.relative > this.timeBeforeNextBurstWindow(this.gcdCalculated * 2)) {
            return false;
        }
        if (this.cdTracker.canUse(Reassemble, this.currentTime)) {
            const nextGcd = this.getNextGcdAbility();

            return this.constants.reassembleActions.includes(nextGcd);
        }
        return false;
    }

    private canPot(): boolean {
        // only use as "last" ogcd because we're gonna advance to the latest possible usage time
        if (this.ogcdsRemaining !== 1) {
            return false;
        }
        return this.cdTracker.canUse(this.potAbility, this.currentTime);
    }

    private canUseAutomatonQueen(): boolean {
        if (!this.cdTracker.canUse(AutomatonQueen, this.currentTime) || this.gauge.battery < 50) {
            return false;
        }
        // use at 160 or above so that we can reach 50+ when it's time to align to 80 remaining before burst
        if (this.batteryOnNextBurst >= 200) {
            return true;
        }
        // if (this.batteryOnNextBurst - this.gauge.battery >= 160) {
        //     return true;
        // }
        if (this.batteryOnNextBurst > 100) {
            return this.batteryOnNextBurst - this.gauge.battery <= 100;
        }
        if (this.timeBeforeNextBurstWindow(this.gcdCalculated, true) > 120 && this.gauge.battery >= 90) {
            return true;
        }
        // this to prevent overcapping battery during the unaligned burst
        if (this.simSettings.dontAlignCds && this.gauge.battery >= 90) {
            return true;
        }
        return false;
    }

    private canUseWildfire(): boolean {
        if (!this.cdTracker.canUse(Wildfire, this.currentTime)) {
            return false;
        }
        return true;
    }

    private getNextGcdAbility(): MchGcdAbility {
        if (this.canUseBlazingShot()) {
            return BlazingShot;
        }
        if (this.canUseAirAnchor()) {
            return AirAnchor;
        }
        if (this.canUseChainsaw()) {
            return Chainsaw;
        }
        if (this.canUseExcavator()) {
            return Excavator;
        }
        if (this.canUseFullMetalField()) {
            return FullMetalField;
        }
        if (this.canUseDrill()) {
            return Drill;
        }

        return this.getNextComboAbility();
    }

    private getNextOgcdAbility(advanced = false): MchOgcdAbility | null {
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
            // this.advanceTo(this.nextGcdTime - STANDARD_ANIMATION_LOCK);
            return this.potAbility;
        }

        if (!advanced && this.currentTime + STANDARD_ANIMATION_LOCK < this.nextGcdTime) {
            this.advanceTo(this.nextGcdTime - STANDARD_ANIMATION_LOCK);
            return this.getNextOgcdAbility(true);
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
        // loop back to first action
        if (this.comboState === 2) {
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
                this.cdTracker.modifyCooldown(this.potAbility, 120 - this.gcdCalculated);
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
                // we also reset battery here and not in updateGauge, otherwise battery would be 0 above.
                this.gauge.battery = 0;
                break;
            default:
                // no action to queue
                break;
        }
    }

    private printAbilityDriftWarnings(usedAbility: Ability) {
        if (this.currentTime < 15) {
            // prevent printing a bunch of warnings while opener is being executed. 15 is totally arbitrary
            return;
        }
        DRIFT_WARNING_ABILITY.forEach((ability) => {
            if (ability.type !== usedAbility.type || ability.name === usedAbility.name) {
                return;
            }
            // do not print a warning when realigning the gcd with burst window and for the first two gcds in burst
            if (ability.type === 'gcd' && this.timeBeforeNextBurstWindow(this.gcdCalculated * 2) < (this.gcdBase - this.gcdCalculated) * 48 + this.gcdCalculated * 2) {
                return;
            }
            if (this.cdTracker.statusOf(ability).capped) {
                console.warn(`[${formatDuration(this.currentTime)}] ${ability.name} is capped/drifting.`);
            }
        });
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
        // only one ogcd on 1.5 gcd, and reduce cd for cm/dc
        if (ability === BlazingShot) {
            this.ogcdsRemaining = 1;
            this.cdTracker.modifyCooldown(Checkmate, -15);
            this.cdTracker.modifyCooldown(DoubleCheck, -15);
        }
        // any other gcd ability = 2 ogcd
        else if (ability.type === 'gcd') {
            this.ogcdsRemaining = 2;
        }
        this.printAbilityDriftWarnings(ability);
        return super.use(ability);
    }

    executeOpener() {
        // TODO: Level 70, 80, 90 openers, + potential variants
        this.executeLevel100Opener();
    }

    executeNextGcd() {
        const gcdAbility = this.getNextGcdAbility();

        if (this.timeBeforeNextBurstWindow(this.gcdCalculated) < this.gcdCalculated) {
            // next action will be start of 2m burst
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
            dontAlignCds: false,
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
