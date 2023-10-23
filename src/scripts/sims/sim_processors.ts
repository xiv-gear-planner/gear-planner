import {ComputedSetStats} from "../geartypes";
import {applyDhCrit, baseDamage} from "../xivmath";
import {
    Ability,
    Buff,
    ComputedDamage,
    DamagingAbility,
    GcdAbility, OgcdAbility,
    PartiallyUsedAbility,
    UsedAbility
} from "./sim_types";
import {CASTER_TAX, NORMAL_GCD, STANDARD_ANIMATION_LOCK} from "../xivconstants";

export class CycleProcessor {

    nextGcdTime: number = 0;
    currentTime: number = 0;
    gcdBase: number = NORMAL_GCD;
    readonly usedAbilities: (UsedAbility | PartiallyUsedAbility)[] = [];
    readonly buffTimes = new Map<Buff, number>();

    constructor(private cycleTime: number, private allBuffs: Buff[], private stats: ComputedSetStats, private manuallyActivatedBuffs?: Buff[]) {
        this.allBuffs.forEach(buff => {
            if (manuallyActivatedBuffs && manuallyActivatedBuffs.includes(buff)) {
                return;
            }
            if (buff.startTime !== undefined) {
                this.buffTimes.set(buff, buff.startTime);
            }
        });
    }

    /**
     * Get the buffs that would be active right now.
     */
    getActiveBuffs(): Buff[] {
        const queryTime = this.currentTime;
        const activeBuffs: Buff[] = [];
        this.buffTimes.forEach((time, buff) => {
            if (time === undefined || time > queryTime) {
                return;
            }
            if ((queryTime - time) < buff.duration) {
                activeBuffs.push(buff);
            }
            return;
        });
        return activeBuffs;
    }

    activateBuff(buff: Buff) {
        this.buffTimes.set(buff, this.currentTime);
    }

    /**
     * How many GCDs have been used
     */
    gcdCount() {
        return this.usedAbilities.filter(used => used.ability['type'] == 'gcd').length;
    }

    use(ability: Ability) {
        // Logic for GCDs
        if (ability.type == "gcd") {
            this.useGcd(ability);
        }
        // oGCD logic branch
        else if (ability.type == 'ogcd') {
            this.useOgcd(ability);
        }
    }

    useUntil(ability: GcdAbility, useUntil: number) {
        while (this.nextGcdTime < useUntil) {
            this.use(ability);
        }
    }

    useGcd(ability: GcdAbility) {
        if (this.nextGcdTime > this.cycleTime) {
            // Already over time limit. Ignore completely.
            return;
        }
        if (this.nextGcdTime > this.currentTime) {
            this.currentTime = this.nextGcdTime;
        }
        if (ability.activatesBuffs) {
            ability.activatesBuffs.forEach(buff => this.activateBuff(buff));
        }
        const buffs = this.getActiveBuffs();
        const combinedEffects: CombinedBuffEffect = combineBuffEffects(buffs);
        const abilityGcd = ability.fixedGcd ? ability.gcd : (this.stats.gcdMag(ability.gcd ?? this.gcdBase, combinedEffects.haste));
        // When this GCD will end (strictly in terms of GCD. e.g. a BLM spell where cast > recast will still take the cast time. This will be
        // accounted for later).
        const gcdFinishedAt = this.currentTime + abilityGcd;
        // Enough time for entire GCD
        if (gcdFinishedAt <= this.cycleTime) {
            this.usedAbilities.push({
                ability: ability,
                combinedEffects: combinedEffects,
                buffs: buffs,
                usedAt: this.currentTime,
                damage: abilityToDamage(this.stats, ability, combinedEffects),
            });
            // Anim lock OR cast time, both effectively block use of skills.
            // If cast time > GCD recast, then we use that instead. Also factor in caster tax.
            const animLock = ability.cast ? Math.max(ability.cast + CASTER_TAX, STANDARD_ANIMATION_LOCK) : STANDARD_ANIMATION_LOCK;
            const animLockFinishedAt = this.currentTime + animLock;
            this.currentTime = animLockFinishedAt;
            // If we're casting a long-cast, then the GCD is blocked for more than a GCD.
            this.nextGcdTime = Math.max(gcdFinishedAt, animLockFinishedAt);
        }
        // GCD will only partially fit into remaining time. Pro-rate the damage.
        else {
            const remainingTime = this.cycleTime - this.nextGcdTime;
            const portion = remainingTime / abilityGcd;
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                combinedEffects: combinedEffects,
                usedAt: this.nextGcdTime,
                portion: portion,
                damage: abilityToDamage(this.stats, ability, combinedEffects, portion),
            });
            this.nextGcdTime = this.cycleTime;
            this.currentTime = this.cycleTime;
        }

    }

    useOgcd(ability: OgcdAbility) {
        if (this.currentTime > this.cycleTime) {
            // Already over time limit. Ignore completely.
            return;
        }
        const buffs = this.getActiveBuffs();
        const combinedEffects: CombinedBuffEffect = combineBuffEffects(buffs);
        // Similar logic to GCDs, but with animation lock alone
        const animLock = ability.animationLock ?? STANDARD_ANIMATION_LOCK;
        const animLockFinishedAt = animLock + this.currentTime;
        // Fits completely
        if (animLockFinishedAt <= this.cycleTime) {
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                combinedEffects: combinedEffects,
                usedAt: this.currentTime,
                damage: abilityToDamage(this.stats, ability, combinedEffects),
            });
            this.currentTime = animLockFinishedAt;
            // Account for potential GCD clipping
            this.nextGcdTime = Math.max(this.nextGcdTime, animLockFinishedAt);
        }
        // fits partially
        else {
            const remainingTime = this.cycleTime - this.currentTime;
            const portion = remainingTime / animLock;
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                combinedEffects: combinedEffects,
                usedAt: this.currentTime,
                portion: portion,
                damage: abilityToDamage(this.stats, ability, combinedEffects, portion),
            });
            this.nextGcdTime = this.cycleTime;
            this.currentTime = this.cycleTime;
        }

    }
}

export type CombinedBuffEffect = {
    dmgMod: number,
    critChanceIncrease: number,
    dhitChanceIncrease: number,
    haste: number
}

export function combineBuffEffects(buffs: Buff[]): CombinedBuffEffect {
    const combinedEffects: CombinedBuffEffect = {
        dmgMod: 1,
        critChanceIncrease: 0,
        dhitChanceIncrease: 0,
        haste: 0
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
        if (buff.effects.haste) {
            combinedEffects.haste += buff.effects.haste;
        }
    }
    return combinedEffects;
}

export function abilityToDamage(stats: ComputedSetStats, ability: Ability, combinedBuffEffects: CombinedBuffEffect, portion: number = 1): ComputedDamage {
    const basePot = ability.potency;
    if (!ability.potency) {
        return {
            expected: 0
        }
    }
    else if (ability.potency > 0) {
        // TODO: messy
        const dmgAbility = ability as DamagingAbility;
        const modifiedStats = {...stats};
        modifiedStats.critChance += combinedBuffEffects.critChanceIncrease;
        modifiedStats.dhitChance += combinedBuffEffects.dhitChanceIncrease;
        const nonCritDmg = baseDamage(modifiedStats, basePot, dmgAbility.attackType, dmgAbility.autoDh ?? false, dmgAbility.autoCrit ?? false);
        const afterCritDh = applyDhCrit(nonCritDmg, modifiedStats);
        const afterDmgBuff = afterCritDh * combinedBuffEffects.dmgMod;
        const afterPortion = afterDmgBuff * portion;
        return {
            expected: afterPortion,
        }
    }

}
