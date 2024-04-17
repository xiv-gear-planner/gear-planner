import {JobName} from "../xivconstants";
import {AttackType} from "../geartypes";
import {CombinedBuffEffect} from "./sim_processors";

export type DotInfo = Readonly<{
    duration: number,
    tickPotency: number,
    id: number
}>

export type NonDamagingAbility = Readonly<{
    potency: null,
}>
export type DamagingAbility = Readonly<{
    potency: number,
    attackType: AttackType,
    autoCrit?: boolean,
    autoDh?: boolean,
    dot?: DotInfo
}>

export type BaseAbility = Readonly<{
    name: string,
    activatesBuffs?: readonly Buff[],
    id?: number,
    attackType: AttackType,
    cooldown?: Cooldown
} & (NonDamagingAbility | DamagingAbility)>;

/**
 * Represents the cooldown of an ability
 */
export type Cooldown = Readonly<{
    /**
     * The cooldown duration, or the time to regain a single charge
     */
    time: number,
    /**
     * If the cooldown is reduced by sps or sks, indicate that here. Default is 'none'.
     */
    reducedBy?: 'none' | 'spellspeed' | 'skillspeed';
    /**
     * The number of charges of the ability
     */
    charges?: number
}>

/**
 * Represents an ability you can use
 */
export type GcdAbility = BaseAbility & Readonly<{
    type: 'gcd';
    /**
     * If the ability's GCD can be lowered by sps/sks, put it here.
     */
    gcd: number,
    /**
     * The time that it takes to cast. Do not include caster tax. Defaults to 0.5 (thus 0.6 after adding caster tax)
     * if not specified, i.e. normal animation lock.
     *
     * TODO: this is actually a false assumption - BLU oGCDs may have a cast time
     */
    cast?: number,
    /**
     * If the ability has a fixed cast and recast, rather than being reduced by sks/sps,
     * set to true.
     */
    fixedGcd?: boolean,
}>

export type OgcdAbility = BaseAbility & Readonly<{
    type: 'ogcd',
    animationLock?: number,
}>

export type AutoAttack = BaseAbility & DamagingAbility & Readonly<{
    type: 'autoattack',
    // TODO
}>

export type Ability = GcdAbility | OgcdAbility | AutoAttack;

export type DotDamageUnf = {
    fullDurationTicks: number,
    damagePerTick: ComputedDamage,
    actualTickCount?: number
}

export type ComputedDamage = {
    expected: number,
}

/**
 * Represents an ability actually being used
 */
export type UsedAbility = {
    /**
     * The ability that was used
     */
    ability: Ability,
    /**
     * The buffs that were active either when the ability started casting, or when it snapshotted (the union of both).
     */
    buffs: Buff[],
    /**
     * The combined effects that were active when the ability snapshotted, with the exception that the 'haste' field
     * comes from the start of the cast, since that is when haste matters.
     */
    combinedEffects: CombinedBuffEffect,
    /**
     * When the ability was initiated.
     */
    usedAt: number,
    /**
     * The direct damage of the ability
     */
    directDamage: ComputedDamage,
    /**
     * If a DoT, the DoT damage
     */
    dot?: DotDamageUnf,
    /**
     * The total cast time from usedAt
     */
    castTimeFromStart: number,
    /**
     * The total time between usedAt and snapshot
     */
    snapshotTimeFromStart: number,
    /**
     * The raw application delay from snapshot to application
     */
    appDelay: number,
    /**
     * The application delay from usedAt
     */
    appDelayFromStart: number,
    /**
     * The total time used by the ability. This doesn't mean *exclusive* use - e.g. for an instant GCD, this is
     * the total GCD time, not the total time you are unable to use other actions.
     */
    totalTimeTaken: number
    /**
     * The total time where you are unable to take other actions. For an instant, this is the animation lock. For
     * a cast, this is the cast time + caster tax.
     */
    lockTime: number
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

export type FinalizedAbility = {
    usedAt: number,
    original: UsedAbility,
    totalDamage: number,
    totalPotency: number,
    partialRate: number | null,
    directDamage: number,
    dotInfo: DotDamageUnf,
    combinedEffects: CombinedBuffEffect,
    ability: Ability,
    buffs: Buff[]
}

export type BuffEffects = {
    dmgIncrease?: number,
    critChanceIncrease?: number,
    dhitChanceIncrease?: number,
    haste?: number,
}

export type BuffController = {
    removeStatus(buff: Buff): void;
}

export type Buff = Readonly<{
    /** Name of buff */
    name: string,
    /** Job of buff */
    job: JobName,
    /** "Optional" would be things like DNC partner buffs, where merely having the job
     // in your comp does not mean you would necessarily get the buff. */
    optional?: boolean,
    /** Can only apply to self - not a party/targeted buff */
    selfOnly?: boolean,
    /** Cooldown */
    cooldown: number,
    /** Duration */
    duration: number,
    /** The effect(s) of the buff */
    effects: BuffEffects,
    /**
     * Time of usage - can be omitted for buffs that would only be used by self and never auto-activated
     */
    startTime?: number,
    /**
     * Optional function to run before an ability is used. This can be used for buffs that have special
     * effects which trigger when using an ability, e.g. Swiftcast/Dualcast.
     *
     * @returns The ability, if the buff needs to modify some properties of the ability. Null if no modification.
     */
    beforeAbility?<X extends Ability>(controller: BuffController, ability: X): X | null,
    /**
     * Optional status effect ID. Used to provide an icon.
     */
    statusId?: number

}>;
