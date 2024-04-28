import {JobName} from "@xivgear/xivmath/xivconstants";
import {AttackType} from "@xivgear/xivmath/geartypes";
import {CombinedBuffEffect, DamageResult} from "./sim_processors";

export type DotInfo = Readonly<{
    duration: number | 'indefinite',
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
    cooldown?: Cooldown,
    /**
     * The time that it takes to cast. Do not include caster tax. Defaults to 0.5 (thus 0.6 after adding caster tax)
     * if not specified, i.e. normal animation lock.
     */
    cast?: number,
    /**
     * If the ability has a fixed cast and recast, rather than being reduced by sks/sps,
     * set to true.
     */
    fixedGcd?: boolean,
    /**
     * Override the default animation lock
     */
    animationLock?: number,
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
}>

export type OgcdAbility = BaseAbility & Readonly<{
    type: 'ogcd',
}>

export type AutoAttack = BaseAbility & DamagingAbility & Readonly<{
    type: 'autoattack',
    // TODO
}>

export type Ability = GcdAbility | OgcdAbility | AutoAttack;

export type DotDamageUnf = {
    fullDurationTicks: number | 'indefinite',
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

/**
 * Describes the effects of a buff
 */
export type BuffEffects = {
    /**
     * Damage increase. e.g. 0.2 = 20% increase
     */
    dmgIncrease?: number,
    /**
     * Crit chance increase, e.g. 0.2 = 20% increase
     */
    critChanceIncrease?: number,
    /**
     * Dhit chance increase, e.g. 0.2 = 20% increase
     */
    dhitChanceIncrease?: number,
    /**
     * Force a crit
     */
    forceCrit?: boolean,
    /**
     * Force a DH
     */
    forceDhit?: boolean,
    /**
     * Haste. Expressed as the percentage value, e.g. 20 = 20% faster GCD
     */
    haste?: number,
}

export type BuffController = {
    removeStatus(buff: Buff): void;
    removeSelf(): void;
}

export type BaseBuff = Readonly<{
    /** Name of buff */
    name: string,
    /** Can only apply to self - not a party/targeted buff */
    selfOnly?: boolean,
    /** The effect(s) of the buff */
    effects: BuffEffects,
    /**
     * Filter what abilities this buff applies to
     *
     * @param ability The ability that is being used
     * @returns whether this buff should apply to this ability
     */
    appliesTo?(ability: Ability): boolean,
    /**
     * Optional function to run before an ability is used. This can be used for buffs that have special
     * effects which trigger when using an ability, e.g. Swiftcast/Dualcast.
     *
     * @param controller A controller which lets you perform actions such as removing buffs.
     * @param ability The original ability, unless it has already been modified by other hooks, in which case it may
     * have already been modified.
     * @returns The ability, if the buff needs to modify some properties of the ability. Null if no modification.
     */
    beforeAbility?<X extends Ability>(controller: BuffController, ability: X): X | void,
    /**
     * Modify an ability before it snapshots. If the ability is instant, this is not much different from
     * beforeAbility.
     *
     * @param controller A controller which lets you perform actions such as removing buffs.
     * @param ability The original ability, unless it has already been modified by other hooks, in which case it may
     * have already been modified.
     * @returns The ability, if the buff needs to modify some properties of the ability. Null if no modification.
     */
    beforeSnapshot?<X extends Ability>(controller: BuffController, ability: X): X | void,
    /**
     * Modify the final damage dealt by an ability.
     *
     * @param controller A controller which lets you perform actions such as removing buffs.
     * @param damageResult The damage result. May have other status effect modifiers already applied. This is the
     * post-calculation damage, after gear, plain damage buffs has been considered.
     * @param ability The ability
     * @returns The modified damage, or null if it does not need to be modified
     */
    modifyDamage?(controller: BuffController, damageResult: DamageResult, ability: Ability): DamageResult | void,
    /**
     * Optional status effect ID. Used to provide an icon.
     */
    statusId?: number
    /**
     * Stack count of this buff. This should generally not be baked into the buff - it should be inserted at run time.
     */
    stacks?: number
} & ({} | {
    /**
     * Override the auto-generated description which would normally describe the effects.
     *
     * Specify descriptionOverride, or descriptionExtras, or neither.
     */
    descriptionOverride: string,
} | {
    /**
     * Additional descriptions of custom effects.
     *
     * Specify descriptionOverride, or descriptionExtras, or neither.
     */
    descriptionExtras: string[],
})>;

export type PartyBuff = BaseBuff & Readonly<{
    /** Job of buff */
    job: JobName,
    /** Cooldown */
    cooldown: number,
    /** "Optional" would be things like DNC partner buffs, where merely having the job
     // in your comp does not mean you would necessarily get the buff. */
    optional?: boolean,

    selfOnly: false,
    /**
     * Time of usage - can be omitted for buffs that would only be used by self and never auto-activated
     */
    startTime?: number,

    /**
     * Duration. Required for party buffs
     */
    duration: number,
}>;

export type PersonalBuff = BaseBuff & Readonly<{
    /**
     * Duration. Optional for personal buffs - omit to signify an indefinite buff.
     */
    duration?: number | undefined;
}>;

export type Buff = PersonalBuff | PartyBuff;