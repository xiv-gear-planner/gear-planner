import {JobName} from "../xivconstants";
import {AttackType} from "../geartypes";

/**
 * Represents an ability you can use
 */
export type Ability = {
    name: string,
    potency: number,
    attackType: AttackType,
    /**
     * If the ability's GCD can be lowered by sps/sks, put it here.
     */
    gcd?: number,
    /**
     * If the ability takes a fixed amount of time, rather than being reduced by sps/sks,
     * put it here.
     */
    fixedGcd?: number,
    autoCrit?: boolean,
    autoDh?: boolean
}


export type ComputedDamage = {
    expected: number
}

/**
 * Represents an ability actually being used
 */
export type UsedAbility = {
    ability: Ability,
    buffs: Buff[],
    usedAt: number,
    damage: ComputedDamage
}

/**
 * Represents a pseudo-ability used to round out a cycle to exactly 120s.
 *
 * e.g. If our last GCD of the 120s cycle would start at 118.9s, then we do not have enough time
 * remaining for an entire GCD. Thus, we would have a PartialAbility with portion = (1.1s / 2.5s)
 *
 */
export type PartiallyUsedAbility = UsedAbility & {
    portion: number
}

export type BuffEffects = {
    dmgIncrease?: number,
    critChanceIncrease?: number,
    dhitChanceIncrease?: number,
}

export type Buff = Readonly<{
    // Name of buff
    name: string,
    // Job of buff
    job: JobName,
    // "Optional" would be things like DNC partner buffs, where merely having the job
    // in your comp does not mean you would necessarily get the buff.
    optional?: boolean,
    // Can only apply to self - not a party/targeted buff
    selfOnly?: boolean,
    // Cooldown
    cooldown: number,
    // Duration
    duration: number,
    // The effect(s) of the buff
    effects: BuffEffects;
}>;
