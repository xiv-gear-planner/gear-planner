import {ComputedSetStats} from "../geartypes";
import {applyDhCrit, baseDamage} from "../xivmath";
import {Ability, Buff, BuffEffects, ComputedDamage, PartiallyUsedAbility, UsedAbility} from "./sim_types";

export class CycleProcessor {

    currentTime: number = 0;
    startOfBuffs: number | null = null;
    gcdBase: number;
    usedAbilities: (UsedAbility | PartiallyUsedAbility)[] = [];

    constructor(private cycleTime: number, private allBuffs: Buff[], private stats: ComputedSetStats) {
        this.gcdBase = this.stats.gcdMag(2.5);
    }

    /**
     * Get the buffs that would be active right now.
     */
    getActiveBuffs(): Buff[] {
        if (this.startOfBuffs === null) {
            return [];
        }
        return this.getBuffs(this.currentTime - this.startOfBuffs);
    }

    /**
     * Get the buffs that would be active `buffRemainingTime` since the start of the buff window.
     *
     * i.e. getBuffs(0) should return everything, getBuffs(15) would return 20 sec buffs but not 15, etc
     */
    getBuffs(buffRemainingTime: number): Buff[] {
        return this.allBuffs.filter(buff => buff.duration > buffRemainingTime);
    }

    /**
     * Start the raid buffs
     */
    activateBuffs() {
        this.startOfBuffs = this.currentTime;
    }

    /**
     * How many GCDs have been used
     */
    gcdCount() {
        return this.usedAbilities.length;
    }

    use(ability: Ability) {
        if (this.currentTime > this.cycleTime) {
            // Already over time. Ignore.
            return;
        }
        const abilityGcd = ability.fixedGcd ?? (ability.gcd ? this.stats.gcdMag(ability.gcd) : this.gcdBase);
        const gcdFinishedAt = this.currentTime + abilityGcd;
        const buffs = this.getActiveBuffs();
        if (gcdFinishedAt <= this.cycleTime) {
            // Enough time for entire GCD
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                usedAt: this.currentTime,
                damage: abilityToDamage(this.stats, ability, buffs),
            });
            this.currentTime = gcdFinishedAt;
        }
        else {
            const remainingTime = this.cycleTime - this.currentTime;
            const portion = remainingTime / abilityGcd;
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                usedAt: this.currentTime,
                portion: portion,
                damage: abilityToDamage(this.stats, ability, buffs, portion),
            });
            this.currentTime = this.cycleTime;
        }
    }

    useUntil(ability: Ability, useUntil: number) {
        while (this.currentTime < useUntil) {
            this.use(ability);
        }
    }
}

export type CombinedBuffEffect = {
    dmgMod: number,
    critChanceIncrease: number,
    dhitChanceIncrease: number
}

export function combineBuffEffects(buffs: Buff[]): CombinedBuffEffect {
    const combinedEffects: CombinedBuffEffect = {
        dmgMod: 1,
        critChanceIncrease: 0,
        dhitChanceIncrease: 0
    }
    for (let buff of buffs) {
        if (buff.effects.dmgIncrease) {
            combinedEffects.dmgMod *= (1 + buff.effects.dmgIncrease);
        }
        if (buff.effects.critChanceIncrease) {
            combinedEffects.critChanceIncrease += buff.effects.critChanceIncrease;
        }
        if (buff.effects.dhitChanceIncrease) {
            combinedEffects.dhitChanceIncrease += buff.effects.dhitChanceIncrease;
        }
    }
    return combinedEffects;
}

export function abilityToDamage(stats: ComputedSetStats, ability: Ability, buffs: Buff[], portion: number = 1): ComputedDamage {
    const basePot = ability.potency;
    const combinedEffects: CombinedBuffEffect = combineBuffEffects(buffs);
    const modifiedStats = {...stats};
    modifiedStats.critChance += combinedEffects.critChanceIncrease;
    modifiedStats.dhitChance += combinedEffects.dhitChanceIncrease;
    const nonCritDmg = baseDamage(modifiedStats, basePot, ability.attackType, ability.autoDh ?? false, ability.autoCrit ?? false);
    const afterCritDh = applyDhCrit(nonCritDmg, modifiedStats);
    const afterDmgBuff = afterCritDh * combinedEffects.dmgMod;
    const afterPortion = afterDmgBuff * portion;
    return {
        expected: afterPortion
    }

}
