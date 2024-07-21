import { Ability, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, AbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { formatDuration } from "@xivgear/core/util/strutils";
import { BaseMultiCycleSim } from "../../sim_processors";
import { AbilitiesUsedTable } from "../../components/ability_used_table";
import SAMGauge from "./sam_gauge";
import { SAMExtraData, SamAbility } from "./sam_types";
import * as SlowSamRotation from './rotations/sam_lv100_214';
import * as MidSamRotation from './rotations/sam_lv100_207';
import * as FastSamRotation from './rotations/sam_lv100_207';
import { HissatsuShinten } from './sam_actions';

export interface SamSimResult extends CycleSimResult {

}

export interface SamSettings extends SimSettings {

}

export interface SamSettingsExternal extends ExternalCycleSettings<SamSettings> {

}

export const samSpec: SimSpec<SamSim, SamSettingsExternal> = {
    stub: "sam-sim-lv100",
    displayName: "SAM Sim",
    description: 'Simulates a SAM rotation using level 100 abilities/traits.',
    makeNewSimInstance: function (): SamSim {
        return new SamSim();
    },
    loadSavedSimInstance: function (exported: SamSettingsExternal) {
        return new SamSim(exported);
    },
    supportedJobs: ['SAM'],
    supportedLevels: [100],
    isDefaultSim: true,
    maintainers: [{
        name: 'Makar',
        contact: [{
            type: 'discord',
            discordTag: 'makar',
            discordUid: '85924030661533696'
        }],
    }, {
        name: 'boxer',
        contact: [{
            type: 'discord',
            discordTag: '.boxer',
            discordUid: '123575345898061825'
        }],
    }],
};

class SAMCycleProcessor extends CycleProcessor {
    gauge: SAMGauge;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new SAMGauge(settings.stats.level);
    }

    shouldUseShinten(): boolean {
        // If the fight is ending soon, we should use up our remaining gauge.
        return this.currentTime > (this.totalTime - 5) && this.gauge.kenkiGauge >= 25;
    }

    override addAbilityUse(usedAbility: AbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: SAMExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: AbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    override use(ability: Ability): AbilityUseResult {
        if (this.currentTime >= this.totalTime) {
            return null;
        }

        const samAbility = ability as SamAbility;

        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (ability.type === 'ogcd' && this.canUseWithoutClipping(ability)) {
            const readyAt = this.cdTracker.statusOf(ability).readyAt.absolute;
            if (this.totalTime > readyAt) {
                this.advanceTo(readyAt);
            }
        }

        // Update gauge from the ability itself
        if (samAbility.updateGauge !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && this.nextGcdTime > this.currentTime) {
                this.advanceTo(this.nextGcdTime);
            }
            // Log when we use more gauge than what we currently have
            if (samAbility.kenkiCost > this.gauge.kenkiGauge) {
                console.error(`[${formatDuration(this.currentTime)}] Used ${samAbility.kenkiCost} kenki with ${samAbility.name} when you only have ${this.gauge.kenkiGauge}`);
            }
            samAbility.updateGauge(this.gauge);
        }

        const usedAbility = super.use(ability);

        // Use up remaining Kenki between GCDs before the rotation ends
        if (ability.type === 'gcd' && this.shouldUseShinten()) {
            this.use(HissatsuShinten);
        }

        return usedAbility;
    }
}

export class SamSim extends BaseMultiCycleSim<SamSimResult, SamSettings, SAMCycleProcessor> {
    spec = samSpec;
    shortName = "sam-sim-lv100";
    displayName = samSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: (6 * 60) + 30,
        cycles: 0,
        which: 'totalTime',
    }

    constructor(settings?: SamSettingsExternal) {
        super('SAM', settings);
    }

    makeDefaultSettings(): SamSettings {
        return {};
    }

    override makeAbilityUsedTable(result: SamSimResult): AbilitiesUsedTable {
        const extraColumns = SAMGauge.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

    protected createCycleProcessor(settings: MultiCycleSettings): SAMCycleProcessor {
        return new SAMCycleProcessor({
            ...settings,
            hideCycleDividers: true
        });
    }

    getRotationsToSimulate(): Rotation<SAMCycleProcessor>[] {
        return [{
            name: "2.14 GCD Rotation",
            cycleTime: 120,
            apply(cp: SAMCycleProcessor) {
                SlowSamRotation.Opener.forEach(action => cp.use(action));
                cp.remainingCycles(() => {
                    SlowSamRotation.Loop.forEach(action => cp.use(action));
                });
            }
        }, {
            name: "2.07 GCD Rotation",
            cycleTime: 120,
            apply(cp: SAMCycleProcessor) {
                MidSamRotation.Opener.forEach(action => cp.use(action));
                cp.remainingCycles(() => {
                    MidSamRotation.Loop.forEach(action => cp.use(action));
                });
            }
        }, {
            name: "2.00 GCD Rotation",
            cycleTime: 120,
            apply(cp: SAMCycleProcessor) {
                FastSamRotation.Opener.forEach(action => cp.use(action));
                cp.remainingCycles(() => {
                    FastSamRotation.Loop.forEach(action => cp.use(action));
                });
            }
        }]
    }
} 