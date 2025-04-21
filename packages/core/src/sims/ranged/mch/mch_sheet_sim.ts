import {Ability, SimSettings, SimSpec, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {MchGauge} from "./mch_gauge";
import {MchExtraData, MchAbility, MchGcdAbility, ReassembleBuff, HyperchargeBuff, FullMetalMachinistBuff, HyperchargedBuff, ExcavatorReadyBuff} from "./mch_types";
import {sum} from "@xivgear/util/array_utils";
import * as Actions from './mch_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxDex} from "../../common/potion";

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
    gauge: MchGauge;
    rotationState: RotationState;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new MchGauge();
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
        const extraData: MchExtraData = {
            gauge: this.gauge.getGaugeState(),
            hypercharge: 0,
        };

        const hypercharge = usedAbility.buffs.find(buff => buff.name === HyperchargeBuff.name);
        if (hypercharge) {
            extraData.hypercharge = hypercharge.stacks;
        }

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    comboActions: MchGcdAbility[] = [Actions.HeatedSplitShot, Actions.HeatedSlugShot, Actions.HeatedCleanShot];
    getComboToUse() {
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
        const buff = buffs.find(buff => buff.name === ReassembleBuff.name);
        return buff !== undefined;
    }

    isHyperchargeBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === HyperchargeBuff.name);
        return buff !== undefined;
    }

    isHyperchargedBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === HyperchargedBuff.name);
        return buff !== undefined;
    }

    isFullMetalMachinistBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === FullMetalMachinistBuff.name);
        return buff !== undefined;
    }

    isExcavatorReadyBuffActive(): boolean {
        const buffs = this.getActiveBuffs();
        const buff = buffs.find(buff => buff.name === ExcavatorReadyBuff.name);
        return buff !== undefined;
    }

    // Pot logic
    shouldPot(): boolean {
        const sixMinutesInSeconds = 360;
        const isSixMinuteWindow = this.currentTime % sixMinutesInSeconds < 20;
        return isSixMinuteWindow;
    }

    // Time until logic
    getTimeUntilReassembleCapped(): number {
        return this.cdTracker.statusOf(Actions.Reassemble).cappedAt.absolute - this.currentTime;
    }
    getTimeUntilDoubleCheckCapped(): number {
        return this.cdTracker.statusOf(Actions.DoubleCheck).cappedAt.absolute - this.currentTime;
    }

    getTimeUntilCheckMateCapped(): number {
        return this.cdTracker.statusOf(Actions.Checkmate).cappedAt.absolute - this.currentTime;
    }
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

    protected createCycleProcessor(settings: MultiCycleSettings): MchCycleProcessor {
        return new MchCycleProcessor({
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

    // Note: this is stateful, and updates combos to the next combo.
    getGCDToUse(cp: MchCycleProcessor): MchGcdAbility {
        if (cp.isHyperchargeBuffActive()) {
            return Actions.BlazingShot;
        }

        if (cp.isFullMetalMachinistBuffActive() && cp.inBurst()) {
            return Actions.FullMetalField;
        }

        // TODO Juliacare: fill in the rest of the priority system GCDs

        // Last priority, use combo
        return cp.getComboToUse();
    }

    // Uses MCH actions as part of a rotation.
    useMchRotation(cp: MchCycleProcessor) {
        ////////
        ///oGCDs
        ////////

        // TODO Juliacare: fill in oGCDs

        ////////
        ////GCDs
        ////////
        // If we don't have time to use a GCD, return early.
        if (cp.remainingGcdTime <= 0) {
            return;
        }

        this.use(cp, (this.getGCDToUse(cp)));
    }

    useAutomatonQueen(cp: MchCycleProcessor) {
    }

    use(cp: MchCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        let mchAbility = ability as MchAbility;

        // Only use potion if enabled in settings
        if (!this.settings.usePotion && ability.name.includes("of Dexterity")) {
            return null;
        }

        // If we try to use Automaton Queen, do it properly
        if (mchAbility.id === Actions.AutomatonQueen.id) {
            // TODO Juliacare implement this function, copy Living Shadow.
            // When you change it, change mchAbility to a const
            // i.e.
            // let mchAbility = ability as MchAbility;
            // ->
            // const mchAbility = ability as MchAbility;
            this.useAutomatonQueen(cp);
            // For now, just pretend it does flat potency equal to gauge.
            mchAbility = {
                ...mchAbility,
                potency: cp.gauge.batteryGauge * 24,
            };
        }

        if (mchAbility.updateBatteryGauge !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }

            mchAbility.updateBatteryGauge(cp.gauge);
        }

        if (mchAbility.updateHeatGauge !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }

            mchAbility.updateHeatGauge(cp.gauge);
        }

        return cp.use(mchAbility);
    }

    private useOpener(cp: MchCycleProcessor) {
        this.use(cp, Actions.Reassemble);
        cp.advanceTo(5 - 2 * STANDARD_ANIMATION_LOCK);
        this.use(cp, potionMaxDex);
        this.use(cp, Actions.AirAnchor);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.Drill);
        this.use(cp, Actions.BarrelStabilizer);
        this.use(cp, Actions.Chainsaw);
        this.use(cp, Actions.Excavator);
        this.use(cp, Actions.AutomatonQueen);
        this.use(cp, Actions.Reassemble);
        this.use(cp, Actions.Drill);
        this.use(cp, Actions.Checkmate);
        // TODO Juliacare add Wildfire
        //this.use(cp, Actions.Wildfire);
        this.use(cp, Actions.FullMetalField);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.Hypercharge);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.BlazingShot);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.Drill);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.Checkmate);
        this.use(cp, Actions.HeatedSplitShot);
        this.use(cp, Actions.DoubleCheck);
        this.use(cp, Actions.HeatedSlugShot);
        this.use(cp, Actions.HeatedCleanShot);
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
