import type {CharacterGearSet} from "../../../gear";
import type {CycleSettings} from "../../cycle_settings";
import {CycleProcessor, type AbilityUseResult, type CycleSimResult, type ExternalCycleSettings, type MultiCycleSettings, type PreDmgAbilityUseRecordUnf, type Rotation} from "../../cycle_sim";
import {BaseMultiCycleSim} from "../../processors/sim_processors";
import type {Ability, SimSettings, SimSpec} from "../../sim_types";
import {AirAnchor, BarrelStabilizer, Chainsaw, Checkmate, DoubleCheck, Drill, Excavator, HeatedCleanShot, HeatedSlugShot, HeatedSplitShot} from "./mch_actions";
import {ExcavatorReadyBuff} from "./mch_buffs";
import {MchGauge} from "./mch_gauge";
import type {MchAbility, MchGcdAbility, MchOgcdAbility} from "./mch_types";

/**
 * Actions TODO:
 *  - Barrel Stabilizer + Full Metal Field
 *  - Hypercharge
 *  - Blazing Shot
 *  - Reassemble
 *  - Automaton Queen
 *  - Wildfire
 */

const COMBO_ACTIONS = [HeatedSplitShot, HeatedSlugShot, HeatedCleanShot];

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

    // Use as soon as possible
    // Check for 1 use of Drill is to check if rotation is started in opener (we want to use CM/DC between Chainsaw and Drill)
    private canUseBarrelStabilizer(): boolean {
        if (this.cdTracker.statusOf(Drill).currentCharges === 2) {
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
        if (cmStatus.currentCharges > dcStatus.currentCharges) { // prioritize the one that has more charges
            return true;
        }
        if (cmStatus.cappedAt.relative < dcStatus.cappedAt.relative) { // prioritize the one that will cap earlier
            return true;
        }
        // we need more conditions here
        return true;
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

    private getNextGcdAbility(): MchGcdAbility {
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
        if (this.canUseCheckmate()) {
            return Checkmate;
        }
        if (this.canUseDoubleCheck()) {
            return DoubleCheck;
        }

        return null;
    }

    private updateGauge(ability: MchAbility) {
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
        return super.use(ability);
    }

    executeNextGcd() {
        const gcdAbility = this.getNextGcdAbility();

        this.use(gcdAbility);
    }

    executeNextOgcd() {
        const ogcdAbility = this.getNextOgcdAbility();

        if (ogcdAbility !== null) {
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
        return new MchCycleProcessor(settings);
    }

    override getRotationsToSimulate(set: CharacterGearSet): Rotation<MchCycleProcessor>[] {
        return [{
            cycleTime: 120,
            apply: (cycleProcessor) => {
                while (cycleProcessor.remainingGcdTime) {
                    cycleProcessor.executeNextGcd();
                    cycleProcessor.executeNextOgcd();
                    cycleProcessor.executeNextOgcd();
                }
            },
        }];
    }
}
