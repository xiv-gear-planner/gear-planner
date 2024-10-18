import { Ability, SimSettings, SimSpec, OgcdAbility } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { formatDuration } from "@xivgear/core/util/strutils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { WarGauge } from "./war_gauge";
import { WarExtraData, WarAbility, WarGcdAbility, WrathfulBuff, SurgingTempest, NascentChaosBuff, InnerReleaseBuff, PrimalRendReadyBuff, PrimalRuinationReadyBuff } from "./war_types";
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
    stub: "war-sheet-sim",
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
    wrathfulProgress = 0;
    
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
            surgingTempest: 0,
        };
        
        const surgingTempest = usedAbility.buffs.find(buff => buff.name === SurgingTempest.name)
        const buffData = surgingTempest && this.getActiveBuffData(surgingTempest, usedAbility.usedAt)
        if (buffData) {
            extraData.surgingTempest = Math.round(buffData.end - usedAbility.usedAt)
        }

        
        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    getSurgingTempestDuration(): number {
        let surgingTempestDuration = 0
        const buffs = [...this.getActiveBuffs(this.currentTime)]
        const surgingTempest = buffs.find(buff => buff.name === SurgingTempest.name)
        const buffData = surgingTempest && this.getActiveBuffData(surgingTempest, this.currentTime)
        if (buffData) {
            surgingTempestDuration = Math.round(buffData.end - this.currentTime)
        }
        return surgingTempestDuration
    }

    comboActions: WarGcdAbility[] = [Actions.HeavySwing, Actions.Maim, Actions.StormsPath];
    getComboToUse() {
        if (this.rotationState.combo === 2) {
            const surgingTempestDuration = this.getSurgingTempestDuration()
            if (surgingTempestDuration < 17) {
                this.rotationState.combo++
                return Actions.StormsEye
            }
        }
        return this.comboActions[this.rotationState.combo++];
    }

    recordWrathful() {
        if (this.wrathfulProgress == 2) {
            this.activateBuff(WrathfulBuff)
            this.wrathfulProgress = 0
        } else {
            this.wrathfulProgress++
        }
    }

    inBurst(): boolean {
        return this.currentTime % 126 < 20
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
        const innerRelease = buffs.find(buff => buff.name === InnerReleaseBuff.name)
        return innerRelease !== undefined
    }

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
        const sixMinutesInSeconds = 360
        const isSixMinuteWindow = this.currentTime % sixMinutesInSeconds < 20
        return isSixMinuteWindow
    }

    getTimeUntilInfuriateCapped(): number {
        return this.cdTracker.statusOf(Actions.Infuriate).cappedAt.absolute - this.currentTime
    }

    getTimeUntilOnslaughtCapped(): number {
        return this.cdTracker.statusOf(Actions.Onslaught).cappedAt.absolute - this.currentTime
    }
}

export class WarSim extends BaseMultiCycleSim<WarSimResult, WarSettings, WarCycleProcessor> {
    spec = warSpec;
    shortName = "war-sheet-sim";
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
        // This must be higher priority than Fell Cleave, since it overrides
        // the button.
        if (cp.isNascentChaosActive()) {
            return Actions.InnerChaos;
        }

        if (cp.isPrimalRendReadyActive()) {
            return Actions.PrimalRend;
        }

        if (cp.isPrimalRuinationReadyActive()) {
            return Actions.PrimalRuination;
        }

        if (cp.isInnerReleaseActive()) {
            return Actions.FellCleave;
        }

        if (cp.inBurst() && cp.gauge.beastGauge >= 50){
            return Actions.FellCleave;
        }

        // Fell Cleave if beast gauge is nearing cap and we need to use it
        if (cp.getTimeUntilInfuriateCapped() < 8 && cp.gauge.beastGauge >= 60) {
            return Actions.FellCleave;
        }

        // Next GCD will overcap
        if (cp.gauge.beastGauge === 90 && cp.rotationState.combo == 1) {
            return Actions.FellCleave;
        }

        // We need to refresh Surging Tempest soon.
        if (cp.gauge.beastGauge >= 90 && cp.rotationState.combo == 2 && cp.getSurgingTempestDuration() < 15) {
            return Actions.FellCleave;
        }

        // Last priority, use combo
        return cp.getComboToUse();
    }

    // Uses WAR actions as part of a rotation.
    useWarRotation(cp: WarCycleProcessor) {
        ////////
        ///oGCDs
        ////////
        if (cp.canUseWithoutClipping(Actions.InnerRelease)) {
            this.use(cp, Actions.InnerRelease)
        }

        if (cp.shouldPot() && cp.canUseWithoutClipping(potionMaxStr)) {
            this.use(cp, potionMaxStr)
        }

        if (cp.isWrathfulActive() && cp.canUseWithoutClipping(Actions.PrimalWrath)){
            this.use(cp, Actions.PrimalWrath);
        }

        if (cp.canUseWithoutClipping(Actions.Upheaval)) {
            this.use(cp, Actions.Upheaval);
        }

        if (cp.inBurst() && cp.canUseWithoutClipping(Actions.Infuriate) && cp.gauge.beastGauge <= 50) {
            this.use(cp, Actions.Infuriate);
        }

        if (cp.inBurst() && cp.canUseWithoutClipping(Actions.Onslaught)) {
            this.use(cp, Actions.Onslaught);
        }

        // Don't overcap Infuriates. Use one if there's seven seconds left.
        if (cp.getTimeUntilInfuriateCapped() < 7 && cp.canUseWithoutClipping(Actions.Infuriate) && cp.gauge.beastGauge <= 50) {
            this.use(cp, Actions.Infuriate);
        }

        // Don't overcap Onslaughts. Use one if there's seven seconds left.
        if (cp.getTimeUntilOnslaughtCapped() < 7 && cp.canUseWithoutClipping(Actions.Onslaught)) {
            this.use(cp, Actions.Onslaught);
        }

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

        if (warAbility.id === Actions.InnerRelease.id) {
            // Hack: Only re-activate Surging Tempest if it's already active.
            if (cp.getSurgingTempestDuration() > 0) {
                cp.extendBuffByDuration(SurgingTempest, 10)
            }
        }

        // Only use potion if enabled in settings
        if (!this.settings.usePotion && ability.name.includes("of Strength")) {
            return null;
        }

        // Update gauges, but not for our free Fell Cleaves
        if (cp.isInnerReleaseActive() && warAbility.id === Actions.FellCleave.id) {
            cp.recordWrathful()
        } else if (warAbility.updateBeastGauge !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }
        
            warAbility.updateBeastGauge(cp.gauge);
        }

        // Lower Infuriate cooldown if appropriate
        if (warAbility.id === Actions.FellCleave.id || warAbility.id === Actions.InnerChaos.id) {
            cp.cdTracker.modifyCooldown(Actions.Infuriate, -5)
        }
        

        return cp.use(ability);
    }

    private useOpener(cp: WarCycleProcessor) {            
        cp.advanceTo(1 - STANDARD_ANIMATION_LOCK);
        this.use(cp, Actions.Tomahawk)
        this.use(cp, Actions.Infuriate)
        this.use(cp, Actions.Maim)
        this.use(cp, Actions.StormsEye)
        this.use(cp, Actions.InnerRelease)
        cp.advanceForLateWeave([potionMaxStr])
        this.use(cp, potionMaxStr)
        this.use(cp, Actions.InnerChaos)
        this.use(cp, Actions.Upheaval)
        this.use(cp, Actions.Onslaught)
        this.use(cp, Actions.PrimalRend)
        this.use(cp, Actions.Onslaught)
        this.use(cp, Actions.PrimalRuination)
        this.use(cp, Actions.Onslaught)
        this.use(cp, Actions.FellCleave)
        this.use(cp, Actions.FellCleave)
        this.use(cp, Actions.FellCleave)
        this.use(cp, Actions.PrimalWrath)
        this.use(cp, Actions.Infuriate)
        this.use(cp, Actions.InnerChaos)
        this.use(cp, Actions.HeavySwing)
        this.use(cp, Actions.Maim)
        this.use(cp, Actions.StormsPath)
        this.use(cp, Actions.FellCleave)
        this.use(cp, Actions.Infuriate)
        this.use(cp, Actions.InnerChaos)
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