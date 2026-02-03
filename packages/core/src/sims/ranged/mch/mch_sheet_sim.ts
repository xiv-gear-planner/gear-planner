import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import type {CharacterGearSet} from "../../../gear";
import {potionMaxDex} from "../../common/potion";
import type {CycleSettings} from "../../cycle_settings";
import {CycleProcessor, type AbilityUseResult, type CycleSimResult, type ExternalCycleSettings, type MultiCycleSettings, type PreDmgAbilityUseRecordUnf, type Rotation} from "../../cycle_sim";
import {BaseMultiCycleSim} from "../../processors/sim_processors";
import type {Ability, SimSettings, SimSpec} from "../../sim_types";
import {AirAnchor, AutomatonQueen, BarrelStabilizer, BlazingShot, Chainsaw, Checkmate, DoubleCheck, Drill, Excavator, FullMetalField, HeatedCleanShot, HeatedSlugShot, HeatedSplitShot, Hypercharge, Reassemble, Wildfire} from "./mch_actions";
import {ExcavatorReadyBuff, FullMetalMachinistBuff, HyperchargedBuff, OverheatedBuff} from "./mch_buffs";
import {MchGauge} from "./mch_gauge";
import type {MchAbility, MchGcdAbility, MchOgcdAbility} from "./mch_types";

/**
 * Actions TODO:
 *  - Automaton Queen
 *  - Wildfire
 */

const COMBO_ACTIONS = [HeatedSplitShot, HeatedSlugShot, HeatedCleanShot];

export interface MchSimSettings extends SimSettings {
    usePots: boolean;
    // if set to true, pots would be used at 0-5-10-... instead of 0-6-12-...
    usePotsOnOddMinute: boolean; // todo
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
        name: 'zodiia',
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
    nextPotWindow = 0;

    constructor(settings: MultiCycleSettings, private simSettings: MchSimSettings) {
        super(settings);
        this.gcdTimer = this.gcdTime(HeatedCleanShot);
    }

    private getNextComboAbility(): MchGcdAbility {
        const action = COMBO_ACTIONS[this.comboState];

        if (this.comboState === 2) { // loop back to first action
            this.comboState = 0;
        }
        else {
            this.comboState += 1;
        }
        return action;
    }

    /**
     * Returns the time before the next burst window.
     *
     * @param [delay=0] Additional delay, useful for calculating the time before some point inside the burst window.
     */
    private timeBeforeNextBurstWindow(delay: number = 0) {
        return (120 + delay - this.nextGcdTime % 120) % 120;
    }

    // Always use
    private canUseDrill(): boolean {
        // TODO: Hold one charge for 2min burst
        return this.cdTracker.canUse(Drill, this.nextGcdTime);
    }

    // Always use as soon as available
    private canUseAirAnchor(): boolean {
        // TODO: Possibly let it drift by one GCD to realign with 2m burst for GCDs <2.5
        return this.cdTracker.canUse(AirAnchor, this.nextGcdTime);
    }

    // Always use as soon as available
    private canUseChainsaw(): boolean {
        // TODO: Possibly let it drift by one GCD to realign with 2m burst for GCDs <2.5
        return this.cdTracker.canUse(Chainsaw, this.nextGcdTime);
    }

    // Use if Excavator Ready buff is available
    private canUseExcavator(): boolean {
        // TODO: hold for gathering 10 battery and align 100 battery on 2m burst
        return this.getActiveBuffs().includes(ExcavatorReadyBuff);
    }

    // Use when hypercharged, excavator and both drills has been spent, and FMF is available
    private canUseFullMetalField(): boolean {
        const buffs = this.getActiveBuffs();

        return buffs.includes(FullMetalMachinistBuff)
            && !buffs.includes(ExcavatorReadyBuff)
            && !this.cdTracker.canUse(Drill, this.nextGcdTime);
    }

    // Use when overheated is active
    private canUseBlazingShot(): boolean {
        return this.getActiveBuffs().some((buff) => buff.name === OverheatedBuff.name);
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
        // TODO: hold one charge for the 2min burst
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
        // TODO: hold one charge for the 2min burst
        if (dcStatus.cappedAt.relative < cmStatus.cappedAt.relative) { // prioritize the one that will cap earlier
            return true;
        }
        return false;
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

    private canUseHypercharge(): boolean {
        const buffs = this.getActiveBuffs();

        // used during burst window after Full Metal Field is spent
        if (buffs.includes(HyperchargedBuff) && !buffs.includes(FullMetalMachinistBuff)) {
            return true;
        }
        if (this.gauge.heat < 50) {
            return false;
        }
        if (this.wouldHyperchargeGcdDrift()) {
            return false;
        }
        // TODO: hold 1 hypercharged for burst window
        return true;
    }

    private canUseReassemble(): boolean {
        if (this.cdTracker.statusOf(Reassemble).cappedAt.relative > this.timeBeforeNextBurstWindow(5)) { // hold one charge for burst
            return false;
        }
        return this.cdTracker.canUse(Reassemble, this.nextGcdTime);
    }

    private getNextGcdAbility(): MchGcdAbility {
        if (this.canUseBlazingShot()) {
            return BlazingShot;
        }
        if (this.canUseFullMetalField()) {
            return FullMetalField;
        }
        if (this.canUseAirAnchor()) {
            return AirAnchor;
        }
        if (this.canUseDrill()) {
            return Drill;
        }
        if (this.canUseChainsaw()) {
            return Chainsaw;
        }
        if (this.canUseExcavator()) {
            return Excavator;
        }

        return this.getNextComboAbility();
    }

    private getNextOgcdAbility(): MchOgcdAbility | null {
        if (this.canUseBarrelStabilizer()) {
            return BarrelStabilizer;
        }
        if (this.canUseHypercharge()) {
            return Hypercharge;
        }
        if (this.canUseCheckmate()) {
            return Checkmate;
        }
        if (this.canUseDoubleCheck()) {
            return DoubleCheck;
        }
        if (this.canUseReassemble()) {
            return Reassemble;
        }

        return null;
    }

    private updateGauge(ability: MchAbility) {
        if (ability === Hypercharge && this.getActiveBuffs().includes(HyperchargedBuff)) {
            return;
        }
        ability.updateGauge?.(this.gauge);
    }

    private executeLevel100Opener() {
        this.use(Reassemble);
        this.advanceTo(5 - STANDARD_ANIMATION_LOCK * 2, true);
        this.use(potionMaxDex);
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

    override addAbilityUse(ability: PreDmgAbilityUseRecordUnf) {
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

        this.use(gcdAbility);
    }

    executeNextOgcd() {
        if (this.ogcdsRemaining <= 0) {
            return;
        }

        const ogcdAbility = this.getNextOgcdAbility();

        if (ogcdAbility !== null) {
            this.ogcdsRemaining -= 1;
            this.use(ogcdAbility);
        }
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
            usePotsOnOddMinute: false,
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
