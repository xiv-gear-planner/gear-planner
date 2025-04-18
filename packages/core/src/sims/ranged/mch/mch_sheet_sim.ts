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
    
    // define combo

    comboActions: MchGcdAbility[] = [Actions.heatedsplitshot, Actions.heatedslugshot, Actions.heatedcleanshot];
    getComboToUse() {
        if (this.rotationState.combo === 2)
        return this.comboActions[this.rotationState.combo++];
    }

    inBurst(): boolean {
        const timeIntoTwoMinutes = this.currentTime % 120;

        // Six seconds after every (i.e. 0:06, 2:06, etc) burst, buffs will be up,
        // and will remain up for twenty seconds.
        return 6 <= timeIntoTwoMinutes && timeIntoTwoMinutes < 26;
    }

     // If the fight is ending within the next 12 seconds (to dump resources)
     fightEndingSoon(): boolean {
        return this.currentTime > (this.totalTime - 12);
    }

    // buff checker logic
     isReassembleBuffActive(): boolean {
            const buffs = this.getActiveBuffs();
            const prr = buffs.find(buff => buff.name === ReassembleBuff.name);
            return prr !== undefined;
        }
     isAutomatonQueenBuffActive(): boolean {
            const buffs = this.getActiveBuffs();
            const prr = buffs.find(buff => buff.name === AutomatonQueenBuff.name);
            return prr !== undefined;
        }
     isHyperchargeBuffActive(): boolean {
            const buffs = this.getActiveBuffs();
            const prr = buffs.find(buff => buff.name === HyperchargeBuff.name);
            return prr !== undefined;
        }
     isFreeHyperchargeBuffActive(): boolean {
            const buffs = this.getActiveBuffs();
            const prr = buffs.find(buff => buff.name === FreeHyperchargeBuff.name);
            return prr !== undefined;
        }
     isFullMetalFieldReadyBuffActive(): boolean {
            const buffs = this.getActiveBuffs();
            const prr = buffs.find(buff => buff.name === FullMetalFieldReadyBuff.name);
            return prr !== undefined;
        }
     isExcavatorReadyBuffActive(): boolean {
            const buffs = this.getActiveBuffs();
            const prr = buffs.find(buff => buff.name === ExcavatorReadyBuff.name);
            return prr !== undefined;
        }
    
    // Pot logic
    shouldPot(): boolean {
        const sixMinutesInSeconds = 360;
        const isSixMinuteWindow = this.currentTime % sixMinutesInSeconds < 20;
        return isSixMinuteWindow;
    }
    // Time until logic
    getTimeUntilReassembleCapped(): number {
        return this.cdTracker.statusOf(Actions.reassemble).cappedAt.absolute - this.currentTime;
    }
    getTimeUntilDoubleCheckCapped(): number {
        return this.cdTracker.statusOf(Actions.doublecheck).cappedAt.absolute - this.currentTime;
    }
    getTimeUntilCheckMateCapped(): number {
        return this.cdTracker.statusOf(Actions.checkmate).cappedAt.absolute - this.currentTime;
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

    protected createCycleProcessor(settings: MultiCycleSettings): MchSettingsExternal {
        return new MchSettingsExternal({
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

  //  willOvercapHeatGaugeNextGCD(cp: MchCycleProcessor): boolean {
  //      const gaugeFullAndNotAtStartOfCombo = cp.gauge.heatGauge === 100 && cp.rotationState.combo !== 0;
  //      const gaugeWillBeOvercappedByStormsPath = cp.gauge.beastGauge >= 90 && cp.rotationState.combo === 2 && cp.stormsPathIsNextComboFinisher();
  //      return gaugeFullAndNotAtStartOfCombo || gaugeWillBeOvercappedByStormsPath;
  //  }



    // MCH Rotation
    // Note: this is stateful, and updates combos to the next combo.
    getGCDToUse(cp: MchCycleProcessor): MchGcdAbility {
        if (cp.isHyperchargeBuffActive()) {
            return Actions.blazingshot;
        }

        if (cp.isFullMetalFieldReadyActive() && cp.inBurst()) {
            return Actions.fullmetalfield;
        }

        // Avoid overcap.
        if (this.willOvercapBeastGaugeNextGCD(cp)) {
            return Actions.FellCleave;
        }

        // Last priority, use combo
        return cp.getComboToUse();
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
    