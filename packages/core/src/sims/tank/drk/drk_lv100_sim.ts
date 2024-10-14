import { Ability, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { combineBuffEffects } from "@xivgear/core/sims/sim_utils";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { formatDuration } from "@xivgear/core/util/strutils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { DrkGauge } from "./drk_gauge";
import { DrkExtraData, DrkAbility, DrkRotationData } from "./drk_types";
import * as Drk250 from './rotations/drk_lv100_250';
import * as Drk246 from './rotations/drk_lv100_246';
import { Unmend, LivingShadowShadowstride, LivingShadowDisesteem, LivingShadowAbyssalDrain, LivingShadowShadowbringer, LivingShadowEdgeOfShadow, LivingShadowBloodspiller } from './drk_actions';
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";

export interface DrkSimResult extends CycleSimResult {

}

export interface DrkSettings extends SimSettings {
    usePotion: boolean;
    prepullUnmend: number; //the number given is how many seconds prepull we use Unmend.
    fightTime: number; // the length of the fight in seconds
    // TODO: should we add a prepull Shadowstride option? Would be nice to compare on differing killtimes
}

export interface DrkSettingsExternal extends ExternalCycleSettings<DrkSettings> {

}

export const drkSpec: SimSpec<DrkSim, DrkSettingsExternal> = {
    stub: "drk-sim-lv100",
    displayName: "DRK Sim",
    description: `Simulates a DRK rotation using level 100 abilities/traits.
Currently a work in progress, and only fully supports 2.50 and 2.46 GCD speeds.
Defaults to simulating a killtime of 8m 30s (510s).
Results are only currently accurate up to 9 minutes (540s).`,
    makeNewSimInstance: function (): DrkSim {
        return new DrkSim();
    },
    loadSavedSimInstance: function (exported: DrkSettingsExternal) {
        return new DrkSim(exported);
    },
    supportedJobs: ['DRK'],
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

// LivingShadowAbilityUsageTime is a type representing two
// things: a Living Shadow ability and the time it should go off at
type LivingShadowAbilityUsageTime = {
    // The Living Shadow ability to use
    ability: DrkAbility,
    // The time to use the ability at
    usageTime: number,
}

class DrkCycleProcessor extends CycleProcessor {
    gauge: DrkGauge;
    
    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.gauge = new DrkGauge();
    }

    fightEndingSoon(): boolean {
        // If the fight is ending within the next 10 seconds (to dump resources)
        return this.currentTime > (this.totalTime - 10);
    }

    // Gets the DRK ability with Blood Weapon's blood and MP additions
    // added to it.
    getDrkAbilityWithBloodWeapon(ability: DrkAbility): DrkAbility {
        return this.beforeAbility(ability, this.getActiveBuffsFor(ability));         
    }

    applyLivingShadowAbility(abilityUsage: LivingShadowAbilityUsageTime) {
        const buffs = [...this.getActiveBuffs(abilityUsage.usageTime)]
        let darksideDuration = 0
        // Get what the the Darkside duration would be at this
        // point of time, for visualization in the UI
        const darkside = buffs.find(buff => buff.name === "Darkside")
        if (darkside) {
            const buffData = this.getActiveBuffData(darkside, abilityUsage.usageTime)
            if (buffData) {
                darksideDuration = Math.round(buffData.end - abilityUsage.usageTime)
            }
        }

        // However, Darkside does not apply to Living Shadow abilities, so
        // we should remove it.
        const filteredBuffs = buffs.filter(buff => { 
            return buff.name !== "Darkside" && buff.name !== "Blood Weapon" && buff.name !== "Delirium"
        })

        this.addAbilityUse({
            usedAt: abilityUsage.usageTime,
            ability: abilityUsage.ability,
            buffs: filteredBuffs,
            combinedEffects: combineBuffEffects(filteredBuffs),
            totalTimeTaken: 0,
            appDelay: abilityUsage.ability.appDelay,
            appDelayFromStart: abilityUsage.ability.appDelay,
            castTimeFromStart: 0,
            snapshotTimeFromStart: 0,
            lockTime: 0
        }, darksideDuration);
    }

    // Optional darkside duration so that it can be given manually (what it 'would be') 
    // for abilities where it doesn't apply (Living Shadow's abilities).
    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf, darksideDuration = 0) {
        // Add gauge data to this record for the UI
        const extraData: DrkExtraData = {
            gauge: this.gauge.getGaugeState(),
            darksideDuration: darksideDuration,
        };
        
        const darkside = usedAbility.buffs.find(buff => buff.name === "Darkside")
        if (darkside) {
            const buffData = this.getActiveBuffData(darkside, usedAbility.usedAt)
            if (buffData) {
                extraData.darksideDuration = Math.round(buffData.end - usedAbility.usedAt)
            }
        }

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }
}

export class DrkSim extends BaseMultiCycleSim<DrkSimResult, DrkSettings, DrkCycleProcessor> {
    spec = drkSpec;
    shortName = "drk-sim-lv100";
    displayName = drkSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: this.settings.fightTime,
        cycles: 0,
        which: 'totalTime',
    }
    mpTicks = 0
    // livingShadowAbilityUsages tracks which remaining Living Shadow abilities we have
    // upcoming. It's implemented this way so that the entries and buffs are correct 
    // on the timeline.
    livingShadowAbilityUsages: LivingShadowAbilityUsageTime[] = []

    constructor(settings?: DrkSettingsExternal) {
        super('DRK', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): DrkCycleProcessor {
        return new DrkCycleProcessor({
            ...settings,
            hideCycleDividers: true
        });
    }

    override makeDefaultSettings(): DrkSettings {
        return {
            usePotion: true,
            prepullUnmend: 1, 
            // 8 minutes and 30s, or 510 seconds
            // This is chosen since it's two pots, five bursts,
            // and is somewhat even between the two main GCDs.
            fightTime: (8 * 60) + 30,
        };
    }

    // applyLivingShadowAbilities should be called before and after each ability
    // usage to ensure that Living Shadow abilities are correctly positioned on the timeline.
    private applyLivingShadowAbilities(cp: DrkCycleProcessor) {
        if (this.livingShadowAbilityUsages && this.livingShadowAbilityUsages.length > 0) {
            const usedAbilities = []
            this.livingShadowAbilityUsages.forEach((abilityUsage, index) => {
                if (abilityUsage.usageTime <= cp.currentTime) {
                    cp.applyLivingShadowAbility(abilityUsage)
                    usedAbilities.push(index)
                }
            })
            usedAbilities.forEach(indexToRemove => {
                this.livingShadowAbilityUsages.splice(indexToRemove, 1)
            })
        }

    }

    use(cp: DrkCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        const drkAbility = ability as DrkAbility;

        // Add 200 mp every ~3sish. Very imperfect, but it'll do for now.
        // In the future, MP should probably be refactored into the base processor.
        // We use Math.floor to be pessimistic, i.e. worst case mana ticks.
        const expectedMPTicks = Math.floor(Math.round(cp.currentTime) / 3)
        // Reset mpTicks at the start of a new fight or simulation.
        if (expectedMPTicks == 0) {
            this.mpTicks = 0
        }
        const differenceInMPTicks = expectedMPTicks - this.mpTicks
        if (differenceInMPTicks > 0) {
            this.mpTicks += differenceInMPTicks
            cp.gauge.magicPoints += differenceInMPTicks * 200
        }

        // If we try to use Living Shadow, do it properly
        if (ability.id === 16472) {
            // After 6.8 delay, it does the following rotation with
            // 2.18 seconds between each.
            // Abyssal Drain
            // Shadowstride (no damage)
            // Flood of Shadow (Shadowbringer at level 90+)(AoE)
            // Edge of Shadow
            // Bloodspiller
            // Carve and Spit (Disesteem(AoE) at level 100)
            this.livingShadowAbilityUsages.push({
                // Abyssal Drain
                ability: LivingShadowAbyssalDrain,
                usageTime: cp.currentTime + 6.8
            })
            // We could skip this, since it does no damage,
            // but it makes the timeline more accurate to reality, so that's nice.
            this.livingShadowAbilityUsages.push({
                // Shadowstride
                ability: LivingShadowShadowstride,
                usageTime: cp.currentTime + 6.8 + 1*2.18
            })     
            this.livingShadowAbilityUsages.push({
                // Shadowbringer
                ability: LivingShadowShadowbringer,
                usageTime: cp.currentTime + 6.8 + 2*2.18
            })            
            this.livingShadowAbilityUsages.push({
                // Edge of Shadow
                ability: LivingShadowEdgeOfShadow,
                usageTime: cp.currentTime + 6.8 + 3*2.18
            })
            this.livingShadowAbilityUsages.push({
                // Bloodspiller
                ability: LivingShadowBloodspiller,
                usageTime: cp.currentTime + 6.8 + 4*2.18
            })
            this.livingShadowAbilityUsages.push({
                // Disesteem
                ability: LivingShadowDisesteem,
                usageTime: cp.currentTime + 6.8 + 5*2.18
            })
        }

        // Apply Living Shadow abilities before attempting to use an ability
        // AND before we move the timeline for that ability.
        this.applyLivingShadowAbilities(cp)

        // Log when we try to use more gauge than what we currently have
        if (drkAbility.id === 7392 && cp.gauge.bloodGauge < 50) {
            console.warn(`[${formatDuration(cp.currentTime)}][DRK Sim] Attempted to use Bloodspiller when you only have ${cp.gauge.bloodGauge} blood`);
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
        if (!this.settings.usePotion && ability.name.includes("of strength")) {
            return null;
        }

        // Update gauges
        const abilityWithBloodWeapon = cp.getDrkAbilityWithBloodWeapon(ability)
        if (abilityWithBloodWeapon.updateBloodGauge !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }
            abilityWithBloodWeapon.updateBloodGauge(cp.gauge);
        }
        if (abilityWithBloodWeapon.updateMP !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && cp.nextGcdTime > cp.currentTime) {
                cp.advanceTo(cp.nextGcdTime);
            }
            abilityWithBloodWeapon.updateMP(cp.gauge);
        }


        // Apply Living Shadow abilities before attempting to use an ability
        // AND after we move the timeline for that ability.
        this.applyLivingShadowAbilities(cp)

        const abilityUseResult = cp.use(ability);

        // TODO use up remaining gauge and Shadowbringer before the fight ends
        if (ability.type === 'gcd' && cp.fightEndingSoon()) {
            // TODO: cp.use(action name goes here);
        }

        return abilityUseResult;
    }

    static getRotationForGcd(gcd: number): DrkRotationData {
        // TODO: Once a generic computational rotation,
        // it should be used for non-2.50/2.46 GCDs.

        // This is fairly coarse as of right now, and supports
        // only 2.46 and 2.50 particularly well. However, this
        // seems good enough for a first draft, as those are
        // the salient GCD speeds.

        if (gcd <= 2.46) {
            return {
                name: "2.46 GCD Rotation",
                rotation: {
                    opener: [...Drk246.Opener],
                    loop: [...Drk246.Loop],
                }
            }
        }

        return {
            name: "2.50 GCD Rotation",
            rotation: {
                opener: [...Drk250.Opener],
                loop: [...Drk250.Loop],
            }
        }
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<DrkCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const { name, rotation } = DrkSim.getRotationForGcd(gcd);
        const settings = { ...this.settings };
        const outer = this;

        console.log(`[DRK Sim] Running ${name}...`);
        return [{
            name: name,
            cycleTime: 120,
            apply(cp: DrkCycleProcessor) {
                // Pre-pull Unmend timing
                const first = rotation.opener.shift();
                cp.use(first);
                if (first.name === Unmend.name && settings.prepullUnmend > STANDARD_ANIMATION_LOCK) {
                    cp.advanceTo(settings.prepullUnmend - STANDARD_ANIMATION_LOCK);
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