import { Ability, SimSettings, SimSpec, OgcdAbility } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { combineBuffEffects } from "@xivgear/core/sims/sim_utils";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { formatDuration } from "@xivgear/core/util/strutils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { WarGauge } from "./war_gauge";
import { WarExtraData, WarAbility, WarGcdAbility, WarOgcdAbility, WrathfulBuff, SurgingTempest, NascentChaosBuff, InnerReleaseBuff, PrimalRendReadyBuff, PrimalRuinationReadyBuff } from "./war_types";
import { sum } from "@xivgear/core/util/array_utils";
import * as Actions from './war_actions';
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";
import { potionMaxStr } from "@xivgear/core/sims/common/potion";

export interface WarSimResult extends CycleSimResult {

}

export interface WarSettings extends SimSettings {
    // If we use potions (used every six minutes).
    usePotion: boolean;
    // the length of the fight in seconds
    fightTime: number;
}

export interface WarSettingsExternal extends ExternalCycleSettings<WarSettings> {

}

export const warSpec: SimSpec<WarSim, WarSettingsExternal> = {
    stub: "war-sim-lv100",
    displayName: "WAR Sim",
    description: `Simulates a WAR rotation using level 100 abilities/traits.
If potions are enabled, pots in the burst window every 6m (i.e. 0m, 6m, 12m, etc).
Defaults to simulating a killtime of 8m 30s (510s).`,
    makeNewSimInstance: function (): WarSim {
        return new WarSim();
    },
    loadSavedSimInstance: function (exported: WarSettingsExternal) {
        return new WarSim(exported);
    },
    supportedJobs: ['WAR'],
    supportedLevels: [100],
    isDefaultSim: true,
    maintainers: [{
        name: 'Violet Stardust',
        contact: [{
            type: 'discord',
            discordTag: 'violet.stardust',
            discordUid: '194908170030809098',
        }],
    }],
};

class RotationState {
    private _combo: number = 0;

    get combo() {
        return this._combo
    };

    set combo(newCombo) {
        this._combo = newCombo;
        if (this._combo >= 3) this._combo = 0;
    }
}

class WarCycleProcessor extends CycleProcessor {
    gauge: WarGauge;
    rotationState: RotationState;
    
    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new WarGauge();
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
        // Add gauge data to this record for the UI
        const extraData: WarExtraData = {
            gauge: this.gauge.getGaugeState(),
        };
        
        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    comboActions: WarGcdAbility[] = [Actions.HeavySwing, Actions.Maim, Actions.StormsPath];
    getComboToUse() {
        // TODO: Better Storm's Eye management
        if (this.rotationState.combo === 1) {
            const buffs = [...this.getActiveBuffs(this.currentTime)]
            let surgingTempestDuration = 0
            const surgingTempest = buffs.find(buff => buff.name === SurgingTempest.name)
            const buffData = surgingTempest && this.getActiveBuffData(surgingTempest, this.currentTime)
            if (buffData) {
                surgingTempestDuration = Math.round(buffData.end - this.currentTime)
            }
            if (surgingTempestDuration < 10) {
                this.rotationState.combo++
                return Actions.StormsEye
            }
        }
        return this.comboActions[this.rotationState.combo++];
    }

    inBurst(): boolean {
        // TODO
        const livingShadowReadyAt = 50 //this.cdTracker.statusOf(Actions.LivingShadow).readyAt.relative
        return livingShadowReadyAt > 95 && livingShadowReadyAt < 115;
    }

    // If the fight is ending within the next 12 seconds (to dump resources)
    fightEndingSoon(): boolean {
        return this.currentTime > (this.totalTime - 12);
    }

    isPrimalRuinationReadyActive(): boolean {
        const buffs = this.getActiveBuffs()
        const prr = buffs.find(buff => buff.name === PrimalRuinationReadyBuff.name)
        return prr !== undefined
    }

    isPrimalRendReadyActive(): boolean {
        const buffs = this.getActiveBuffs()
        const prr = buffs.find(buff => buff.name === PrimalRendReadyBuff.name)
        return prr !== undefined
    }

    isInnerReleaseActive(): boolean {
        const buffs = this.getActiveBuffs()
        const bloodWeapon = buffs.find(buff => buff.name === InnerReleaseBuff.name)
        return bloodWeapon !== undefined
    }

    // isScornActive(): boolean {
    //     return this.getActiveBuffData(ScornBuff, this.currentTime)?.buff?.duration > 0
    // }

    // isSaltedEarthActive(): boolean {
    //     return this.getActiveBuffData(SaltedEarthBuff, this.currentTime)?.buff?.duration > 0
    // }

    isNascentChaosActive(): boolean {
        const buffs = this.getActiveBuffs()
        const nc = buffs.find(buff => buff.name === NascentChaosBuff.name)
        return nc !== undefined
    }

    isWrathfulActive(): boolean {
        const buffs = this.getActiveBuffs()
        const wrathful = buffs.find(buff => buff.name === WrathfulBuff.name)
        return wrathful !== undefined
    }

    shouldPot(): boolean {
        // TODO
        const livingShadowReadyAt = 50 //this.cdTracker.statusOf(Actions.LivingShadow).readyAt.relative
        const sixMinutesInSeconds = 360
        const isSixMinuteWindow = this.currentTime % sixMinutesInSeconds < 20
        return livingShadowReadyAt > 110 && livingShadowReadyAt < 120 && isSixMinuteWindow
    }
}

export class WarSim extends BaseMultiCycleSim<WarSimResult, WarSettings, WarCycleProcessor> {
    spec = warSpec;
    shortName = "war-sim-lv100";
    displayName = warSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: this.settings.fightTime,
        cycles: 0,
        which: 'totalTime',
        cutoffMode: 'prorate-gcd',
    }

    constructor(settings?: WarSettingsExternal) {
        super('WAR', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): WarCycleProcessor {
        return new WarCycleProcessor({
            ...settings,
            hideCycleDividers: true
        });
    }

    override makeDefaultSettings(): WarSettings {
        return {
            usePotion: true,
            // 8 minutes and 30s, or 510 seconds
            // This is chosen since it's two pots, five bursts,
            // and is somewhat even between the two main GCDs.
            fightTime: (8 * 60) + 30,
        };
    }

    // Gets the next GCD to use in the WAR rotation.
    // Note: this is stateful, and updates combos to the next combo.
    getGCDToUse(cp: WarCycleProcessor): WarGcdAbility {
        // TODO

        // Last priority, use combo
        return cp.getComboToUse();
    }

    // Uses WAR actions as part of a rotation.
    useWarRotation(cp: WarCycleProcessor) {
        ////////
        ///oGCDs
        ////////
        // TODO

        ////////
        ////GCDs
        ////////
        // If we don't have time to use a GCD, return early.
        if (cp.remainingGcdTime <= 0) {
            return;
        }

        this.use(cp, (this.getGCDToUse(cp)))
    }

    use(cp: WarCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        const warAbility = ability as WarAbility;

        // Log when we try to use more gauge than what we currently have
        if (warAbility.id === Actions.FellCleave.id && !cp.isInnerReleaseActive && cp.gauge.beastGauge < 50) {
            console.warn(`[WAR Sim][${formatDuration(cp.currentTime)}] Attempted to use Fell Cleave when you only have ${cp.gauge.beastGauge} gauge`);
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
        if (!this.settings.usePotion && ability.name.includes("of Strength")) {
            return null;
        }

        // Update gauges, but not for our free Fell Cleaves
        if (warAbility.updateBeastGauge !== undefined && !(warAbility.id === Actions.FellCleave.id && cp.isInnerReleaseActive)) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }
        
            warAbility.updateBeastGauge(cp.gauge);
        }

        return cp.use(ability);
    }

    private useOpener(cp: WarCycleProcessor) {
        // TODO
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<WarCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const settings = { ...this.settings };
        const outer = this;

        console.log(`[WAR Sim] Running Rotation for ${gcd} GCD...`);
        console.log(`[WAR Sim] Settings configured: ${JSON.stringify(settings)}`)
        return [{
            cycleTime: 120,
            apply(cp: WarCycleProcessor) {
                outer.useOpener(cp)

                cp.remainingCycles(() => {
                    outer.useWarRotation(cp);
                });
            }
        }];
    }
} 