import type {CharacterGearSet} from "../../../gear";
import {potionMaxDex} from "../../common/potion";
import type {CycleSettings} from "../../cycle_settings";
import {CycleProcessor, type AbilityUseResult, type CycleSimResult, type ExternalCycleSettings, type MultiCycleSettings, type PreDmgAbilityUseRecordUnf, type Rotation} from "../../cycle_sim";
import {BaseMultiCycleSim} from "../../processors/sim_processors";
import type {Ability, SimSettings, SimSpec} from "../../sim_types";
import {AirAnchor, BarrelStabilizer, BlazingShot, Chainsaw, Checkmate, DoubleCheck, Drill, Excavator, FullMetalField, HeatedCleanShot, HeatedSlugShot, HeatedSplitShot, Hypercharge, Reassemble} from "./mch_actions";
import {ExcavatorReadyBuff, FullMetalMachinistBuff, HyperchargedBuff, OverheatedBuff} from "./mch_buffs";
import {MchGauge} from "./mch_gauge";
import type {MchAbility, MchGcdAbility, MchOgcdAbility} from "./mch_types";

/**
 * Actions TODO:
 *  - Automaton Queen
 *  - Wildfire
 */

const COMBO_ACTIONS = [HeatedSplitShot, HeatedSlugShot, HeatedCleanShot];
const HYPERCHARGE_GCD_DURATION = BlazingShot.gcd * 5;

export interface MchSimSettings extends SimSettings {
    usePots: boolean;
    // if set to true, pots would be used at 0-5-10-... instead of 0-6-12-...
    usePotsOnOddMinute: boolean;
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

class MchCycleProcessor extends CycleProcessor {
    gauge = new MchGauge();
    comboState = 0;
    ogcdsRemaining = 0;
    nextPotWindow = 0;
    gcdTimer = 2.5;

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

    // Always use as soon as available
    private canUseAirAnchor(): boolean {
        return this.cdTracker.canUse(AirAnchor, this.nextGcdTime);
    }

    // Always use, unless < 2 charges & chainsaw is available
    private canUseDrill(): boolean {
        if (this.cdTracker.statusOf(Drill).currentCharges < 2
            && (this.canUseChainsaw() || this.canUseExcavator())) {
            // Do not use drill if Chainsaw/Excavator are available.
            return false;
        }
        return this.cdTracker.canUse(Drill, this.nextGcdTime);
    }

    // Always use as soon as available
    private canUseChainsaw(): boolean {
        return this.cdTracker.canUse(Chainsaw, this.nextGcdTime);
    }

    // Use if Excavator Ready buff is available
    // TODO: hold for 10 battery
    private canUseExcavator(): boolean {
        return this.getActiveBuffs().includes(ExcavatorReadyBuff);
    }

    // Use when hypercharged, excavator and both drills has been spent, and FMF is available
    private canUseFullMetalField(): boolean {
        const buffs = this.getActiveBuffs();

        return buffs.includes(FullMetalMachinistBuff)
            && !buffs.includes(ExcavatorReadyBuff)
            && !this.cdTracker.canUse(Drill);
    }

    // Use when overheated is active
    private canUseBlazingShot(): boolean {
        return this.getActiveBuffs().some((buff) => buff.name === OverheatedBuff.name);
    }

    // Use as soon as possible
    // Checks for Drill charges and Chainsaw are made to position the use of BS during the opener.
    private canUseBarrelStabilizer(): boolean {
        if (this.cdTracker.statusOf(Drill).currentCharges === 2) {
            return false;
        }
        if (this.cdTracker.canUse(Chainsaw)) {
            return false;
        }
        return this.cdTracker.canUse(BarrelStabilizer);
    }

    private canUseCheckmate(): boolean {
        const cmStatus = this.cdTracker.statusOf(Checkmate);
        const dcStatus = this.cdTracker.statusOf(DoubleCheck);

        if (cmStatus.currentCharges === 0) {
            return false;
        }
        if (cmStatus.currentCharges === 3) { // only on opener
            return true;
        }
        if (this.cdTracker.canUse(Chainsaw) || this.getActiveBuffs().includes(ExcavatorReadyBuff)) { // hold during opener to after chainsaw and excavator are used
            return false;
        }
        if (cmStatus.currentCharges > dcStatus.currentCharges) { // prioritize the one that has more charges
            return true;
        }
        if (cmStatus.cappedAt.relative < dcStatus.cappedAt.relative) { // prioritize the one that will cap earlier
            return true;
        }
        // we need more conditions here
        return false;
    }

    // basically the opposite of above
    private canUseDoubleCheck(): boolean {
        const cmStatus = this.cdTracker.statusOf(Checkmate);
        const dcStatus = this.cdTracker.statusOf(DoubleCheck);

        if (dcStatus.currentCharges === 0) {
            return false;
        }
        if (dcStatus.currentCharges === 3) { // only on opener
            return true;
        }
        if (dcStatus.currentCharges > cmStatus.currentCharges) { // prioritize the one that has more charges
            return true;
        }
        if (dcStatus.cappedAt.relative < cmStatus.cappedAt.relative) { // prioritize the one that will cap earlier
            return true;
        }
        // we need more conditions here
        return false;
    }

    /**
     * Algorithm that calculates if using Hypercharge right now would make any ability drift.
     */
    private wouldHyperchargeGcdDrift(): boolean {
        // Yes, Blazing Shot is on a fixed 1.5s GCD timer. But with a GCD <2.5s, having a fixed 7.5s instead of 3*GCD would screw up
        // the rest of this algorithm because Air Anchor and Excavator will *always* drift by a few milliseconds, which is intended.
        const timeToHyperchargeEnd = (this.nextGcdTime - this.currentTime) + this.gcdTimer * 3;
        let recastTimers = [
            this.cdTracker.statusOf(Drill).cappedAt.relative - timeToHyperchargeEnd,
            this.cdTracker.statusOf(AirAnchor).readyAt.relative - timeToHyperchargeEnd,
            this.cdTracker.statusOf(Chainsaw).readyAt.relative - timeToHyperchargeEnd,
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
        if (this.gauge.heat <= 50) {
            return false;
        }
        if (this.wouldHyperchargeGcdDrift()) {
            return false;
        }
        // TODO: hold hypercharged for burst window
        return false;
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

        return null;
    }

    private updateGauge(ability: MchAbility) {
        if (ability === Hypercharge && this.getActiveBuffs().includes(HyperchargedBuff)) {
            return;
        }
        ability.updateGauge?.(this.gauge);
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

    executePrePull() {
        this.use(Reassemble);
        if (this.simSettings.usePots) {
            this.use(potionMaxDex);
        }
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
        };
    }

    override createCycleProcessor(settings: MultiCycleSettings) {
        return new MchCycleProcessor(settings, this.settings);
    }

    override getRotationsToSimulate(set: CharacterGearSet): Rotation<MchCycleProcessor>[] {
        return [{
            cycleTime: 120,
            apply: (cycleProcessor) => {
                cycleProcessor.executePrePull();
                while (cycleProcessor.remainingGcdTime) {
                    cycleProcessor.executeNextGcd();
                    cycleProcessor.executeNextOgcd();
                    cycleProcessor.executeNextOgcd();
                }
            },
        }];
    }
}
