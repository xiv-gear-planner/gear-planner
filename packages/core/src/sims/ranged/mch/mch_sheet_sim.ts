import {Ability, SimSettings, SimSpec, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {formatDuration} from "@xivgear/util/strutils";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {MchheatGauge} from "./mch_heatgauge";
import {MchbatteryGauge} from "./mch_heatgauge";
import {MchExtraData, MchAbility, MchGcdAbility, ReassembleBuff, AutomatonQueenBuff, HyperchargeBuff, FullmetalfieldBuff, mchogcdAbility} from "./mch_types";
import {sum} from "@xivgear/util/array_utils";
import * as Actions from './mch_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxStr} from "@xivgear/core/sims/common/potion";

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
    batterygauge: MchbatteryGauge;
    heatgauge: MchheatGauge;
    rotationState: RotationState;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.batterygauge = new mchbatteryGauge();
        this.heatgauge = new mchheatGauge();
        this.rotationState = new RotationState();
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
        // Add battery data to this record for the UI
        const extraData: MchExtraData = {
            gauge: this.batterygauge.getbatteryGaugeState(),
        };
         // Add heat data to this record for the UI
         const extraData: MchExtraData = {
            gauge: this.heatgauge.getheatGaugeState(),
        };       
        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }