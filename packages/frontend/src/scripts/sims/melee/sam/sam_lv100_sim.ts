import { Ability, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { formatDuration } from "@xivgear/core/util/strutils";
import { FieldBoundCheckBox, FieldBoundFloatField, labeledCheckbox, labelFor } from "@xivgear/common-ui/components/util";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { BaseMultiCycleSim } from "../../sim_processors";
import { AbilitiesUsedTable } from "../../components/ability_used_table";
import SAMGauge from "./sam_gauge";
import { SAMExtraData, SAMRotationData, SamAbility } from "./sam_types";
import * as SlowSamRotation from './rotations/sam_lv100_214';
import * as MidSamRotation from './rotations/sam_lv100_207';
import * as FastSamRotation from './rotations/sam_lv100_200';
import { HissatsuShinten, MeikyoShisui } from './sam_actions';

export interface SamSimResult extends CycleSimResult {

}

export interface SamSettings extends SimSettings {
    usePotion: boolean;
    prePullMeikyo: number;
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

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: SAMExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }
}

export class SamSim extends BaseMultiCycleSim<SamSimResult, SamSettings, SAMCycleProcessor> {
    spec = samSpec;
    shortName = "sam-sim-lv100";
    displayName = samSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: (8 * 60) + 35,
        cycles: 0,
        which: 'totalTime',
    }

    constructor(settings?: SamSettingsExternal) {
        super('SAM', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): SAMCycleProcessor {
        return new SAMCycleProcessor({
            ...settings,
            hideCycleDividers: true
        });
    }

    override makeDefaultSettings(): SamSettings {
        return {
            usePotion: true,
            prePullMeikyo: 14,
        };
    }

    override makeCustomConfigInterface(settings: SamSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const ppField = new FieldBoundFloatField(settings, "prePullMeikyo", { inputMode: 'number' });
        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labelFor("Meikyo Pre-Pull Time:", ppField));
        configDiv.appendChild(ppField);
        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }

    override makeAbilityUsedTable(result: SamSimResult): AbilitiesUsedTable {
        const extraColumns = SAMGauge.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

    use(cp: SAMCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        const samAbility = ability as SamAbility;
        // Log when we try to use more gauge than what we currently have
        if (samAbility.kenkiCost > cp.gauge.kenkiGauge) {
            console.warn(`[${formatDuration(cp.currentTime)}][SAM Sim] Attempted to use ${samAbility.kenkiCost} kenki with ${samAbility.name} when you only have ${cp.gauge.kenkiGauge}`);
            return null;
        }

        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (ability.type === 'ogcd' && cp.canUseWithoutClipping(ability)) {
            const readyAt = cp.cdTracker.statusOf(ability).readyAt.absolute;
            if (cp.totalTime > readyAt) {
                cp.advanceTo(readyAt);
            }
        }

        // Only use potion if enabled in settings
        if (!this.settings.usePotion && ability.name.includes(' of Strength')) {
            return null;
        }

        // Update gauge from the ability itself
        if (samAbility.updateGauge !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }
            samAbility.updateGauge(cp.gauge);
        }

        const abilityUseResult = cp.use(ability);

        // Use up remaining Kenki between GCDs before the rotation ends
        if (ability.type === 'gcd' && cp.shouldUseShinten()) {
            cp.use(HissatsuShinten);
        }

        return abilityUseResult;
    }

    static getRotationForGcd(gcd: number): SAMRotationData {
        if (gcd >= 2.11) {
            return {
                name: "2.14 GCD Rotation",
                rotation: {
                    opener: [...SlowSamRotation.Opener],
                    loop: [...SlowSamRotation.Loop],
                }
            }
        }

        if (gcd >= 2.04) {
            return {
                name: "2.07 GCD Rotation",
                rotation: {
                    opener: [...MidSamRotation.Opener],
                    loop: [...MidSamRotation.Loop],
                }
            }
        }

        return {
            name: "2.00 GCD Rotation",
            rotation: {
                opener: [...FastSamRotation.Opener],
                loop: [...FastSamRotation.Loop],
            }
        }
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<SAMCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5, 13);
        const { name, rotation } = SamSim.getRotationForGcd(gcd);
        const settings = { ...this.settings };
        const outer = this;

        console.log(`[SAM Sim] Running ${name}...`);
        return [{
            name: name,
            cycleTime: 120,
            apply(cp: SAMCycleProcessor) {
                // Pre-pull Meikyo timing
                const first = rotation.opener.shift();
                cp.use(first);
                if (first.name === MeikyoShisui.name && settings.prePullMeikyo > STANDARD_ANIMATION_LOCK) {
                    cp.advanceTo(settings.prePullMeikyo - STANDARD_ANIMATION_LOCK);
                }

                // Opener
                rotation.opener.forEach(action => outer.use(cp, action));

                // Loop
                if (rotation.loop?.length) {
                    cp.remainingCycles(() => {
                        rotation.loop.forEach(action => outer.use(cp, action));
                    });
                }
            }
        }];
    }
} 