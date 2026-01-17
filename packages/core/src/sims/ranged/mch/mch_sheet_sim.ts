import type {CharacterGearSet} from "../../../gear";
import type {CycleSettings} from "../../cycle_settings";
import {CycleProcessor, type CycleSimResult, type CycleSimResultFull, type ExternalCycleSettings, type Rotation} from "../../cycle_sim";
import {BaseMultiCycleSim} from "../../processors/sim_processors";
import type {SimSettings, SimSpec, Simulation} from "../../sim_types";
import {HeatedCleanShot, HeatedSlugShot, HeatedSplitShot} from "./mch_actions";
import {MchGauge} from "./mch_gauge";
import type {MchAbility, MchGcdAbility} from "./mch_types";

/**
 * Actions TODO:
 *  - 1-2-3 combo
 *  - Drill
 *  - Air Anchor
 *  - Chainsaw
 *  - Excavator
 *  - Double check/Checkmate
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

    private updateGauge(ability: MchAbility) {
        ability.updateGauge?.(this.gauge);
    }

    useNextAbility() {
        const ability = this.getNextComboAbility();

        this.updateGauge(ability);
        this.use(ability);
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

    override getRotationsToSimulate(set: CharacterGearSet): Rotation<MchCycleProcessor>[] {
        return [{
            cycleTime: 120,
            apply: (cycleProcessor) => cycleProcessor.remainingCycles(() => cycleProcessor.useNextAbility()),
        }];
    }
}
