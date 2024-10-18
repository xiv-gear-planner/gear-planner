import { Ability, SimSettings, SimSpec, OgcdAbility } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { combineBuffEffects } from "@xivgear/core/sims/sim_utils";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { formatDuration } from "@xivgear/core/util/strutils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { DrkGauge } from "./drk_gauge";
import { DrkExtraData, DrkAbility } from "./drk_types";
import { sum } from "@xivgear/core/util/array_utils";
import * as Drk250 from './rotations/drk_lv100_250';
import * as Drk246 from './rotations/drk_lv100_246';
import * as Actions from './drk_actions';
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";
import { potionMaxStr } from "@xivgear/core/sims/common/potion";

export interface DrkSimResult extends CycleSimResult {

}

export interface DrkSettings extends SimSettings {
    usePotion: boolean;
    // If we use a pre-pull TBN. This should be exposed and more fully tested as 'false' once the computationally created rotation is implemented.
    prepullTBN: boolean; 
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
        // If the fight is ending within the next 12 seconds (to dump resources)
        return this.currentTime > (this.totalTime - 12);
    }

    // Gets the DRK ability with Blood Weapon's blood and MP additions
    // added to it.
    getDrkAbilityWithBloodWeapon(ability: DrkAbility): DrkAbility {
        return this.beforeAbility(ability, this.getActiveBuffsFor(ability));         
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

    applyLivingShadowAbility(abilityUsage: LivingShadowAbilityUsageTime) {
        const buffs = [...this.getActiveBuffs(abilityUsage.usageTime)]
        let darksideDuration = 0
        // Get what the the Darkside duration would be at this
        // point of time, for visualization in the UI
        const darkside = buffs.find(buff => buff.name === "Darkside")
        const buffData = darkside && this.getActiveBuffData(darkside, abilityUsage.usageTime)
        if (buffData) {
            darksideDuration = Math.round(buffData.end - abilityUsage.usageTime)
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
        const buffData = darkside && this.getActiveBuffData(darkside, usedAbility.usedAt)
        if (buffData) {
            extraData.darksideDuration = Math.round(buffData.end - usedAbility.usedAt)
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
        cutoffMode: 'prorate-gcd',
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
            prepullTBN: true, 
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
        if (ability.id === Actions.LivingShadow.id) {
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
                ability: Actions.LivingShadowAbyssalDrain,
                usageTime: cp.currentTime + 6.8
            })
            // We could skip this, since it does no damage,
            // but it makes the timeline more accurate to reality, so that's nice.
            this.livingShadowAbilityUsages.push({
                // Shadowstride
                ability: Actions.LivingShadowShadowstride,
                usageTime: cp.currentTime + 6.8 + 1*2.18
            })     
            this.livingShadowAbilityUsages.push({
                // Shadowbringer
                ability: Actions.LivingShadowShadowbringer,
                usageTime: cp.currentTime + 6.8 + 2*2.18
            })            
            this.livingShadowAbilityUsages.push({
                // Edge of Shadow
                ability: Actions.LivingShadowEdgeOfShadow,
                usageTime: cp.currentTime + 6.8 + 3*2.18
            })
            this.livingShadowAbilityUsages.push({
                // Bloodspiller
                ability: Actions.LivingShadowBloodspiller,
                usageTime: cp.currentTime + 6.8 + 4*2.18
            })
            this.livingShadowAbilityUsages.push({
                // Disesteem
                ability: Actions.LivingShadowDisesteem,
                usageTime: cp.currentTime + 6.8 + 5*2.18
            })
        }

        // Apply Living Shadow abilities before attempting to use an ability
        // AND before we move the timeline for that ability.
        this.applyLivingShadowAbilities(cp)

        // Log when we try to use more gauge than what we currently have
        if (drkAbility.id === Actions.Bloodspiller.id && cp.gauge.bloodGauge < 50) {
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
        if (!this.settings.usePotion && ability.name.includes("of Strength")) {
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

    private useOpener(cp: DrkCycleProcessor, prepullTBN: boolean) {
        if (prepullTBN) {
            this.use(cp, Actions.TheBlackestNight)
            cp.advanceTo(3 - STANDARD_ANIMATION_LOCK);
            // Hacky out of combat mana tick.
            // TODO: Refactor this once MP is handled in a more core way
            cp.gauge.magicPoints += 600
        } else {
            cp.advanceTo(1 - STANDARD_ANIMATION_LOCK);
        }
        this.use(cp, Actions.Unmend)        
        cp.advanceForLateWeave([potionMaxStr]);
        this.use(cp, potionMaxStr)
        this.use(cp, Actions.HardSlash)
        this.use(cp, Actions.EdgeOfShadow)
        this.use(cp, Actions.LivingShadow)
        this.use(cp, Actions.SyphonStrike)
        this.use(cp, Actions.Souleater)
        this.use(cp, Actions.Delirium)
        this.use(cp, Actions.Disesteem)
        this.use(cp, Actions.SaltedEarth)
        this.use(cp, Actions.EdgeOfShadow)
        this.use(cp, Actions.ScarletDelirium)
        this.use(cp, Actions.EdgeOfShadow)
        this.use(cp, Actions.Comeuppance)
        this.use(cp, Actions.CarveAndSpit)
        this.use(cp, Actions.EdgeOfShadow)
        this.use(cp, Actions.Torcleaver)
        this.use(cp, Actions.Shadowbringer)
        this.use(cp, Actions.EdgeOfShadow)
        this.use(cp, Actions.Bloodspiller)
        this.use(cp, Actions.SaltAndDarkness)
    }
    
    static getRotationForGcd(gcd: number): DrkAbility[] {
        // TODO: Once a generic computational rotation,
        // it should be used for non-2.50/2.46 GCDs.

        // This is fairly coarse as of right now, and supports
        // only 2.46 and 2.50 particularly well. However, this
        // seems good enough for a first draft, as those are
        // the salient GCD speeds.

        if (gcd <= 2.46) {
            return [...Drk246.Rotation]
        }

        return  [...Drk250.Rotation]
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<DrkCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const settings = { ...this.settings };
        const outer = this;

        // TODO: Replace this with computationally generated rotation, though
        // this remains useful to compare to for that implementation.
        const rotation = DrkSim.getRotationForGcd(gcd);

        console.log(`[DRK Sim] Running Rotation for ${gcd} GCD...`);
        console.log(`[DRK Sim] Settings configured: ${JSON.stringify(settings)}`)
        return [{
            cycleTime: 120,
            apply(cp: DrkCycleProcessor) {
                // Reset Living Shadow when beginning a new rotation, in case
                // the last simmed rotation stopped mid execution of Living Shadow.
                outer.livingShadowAbilityUsages = []

                outer.useOpener(cp, settings.prepullTBN)

                // Loop
                if (rotation.length) {
                cp.remainingCycles(() => {
                        rotation.forEach(action => outer.use(cp, action));
                    });
                }
            }
        }];
    }
} 