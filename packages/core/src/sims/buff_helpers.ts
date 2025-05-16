import {Buff} from "./sim_types";

function nonZero(number: number): boolean {
    return (number ?? 0) > 0;
}

/**
 * Whether a buff is relevant at the start of an action.
 *
 * e.g. for haste/swiftcast-style buffs, this would be true. It is also true
 * of the buff has any 'beforeAbility' hook.
 *
 * @param buff
 */
export function buffRelevantAtStart(buff: Buff): boolean {
    return nonZero(buff.effects?.haste) || (buff.beforeAbility !== undefined);
}

/**
 * Whether a buff is relevant at the point where an action snapshots. This
 * is true for any buff with damage-increasing effects, or with either a beforeSnapshot
 * or modifyDamage hook. In addition, it {@link buffRelevantAtStart} returns false,
 * this will return true to ensure that at least one of the two functions returns true
 * in either case.
 *
 * @param buff
 */
export function buffRelevantAtSnapshot(buff: Buff): boolean {
    return nonZero(buff.effects?.critChanceIncrease)
        || nonZero(buff.effects?.dhitChanceIncrease)
        || nonZero(buff.effects?.dmgIncrease)
        || (buff.effects?.forceCrit)
        || (buff.effects?.forceDhit)
        || (buff.beforeSnapshot !== undefined)
        || (buff.modifyDamage !== undefined)
        // As a fallback, also force this to return true if the buff is not relevant at start
        || !buffRelevantAtStart(buff);
}

let nextRandomBuffId = -10_000_000;

/**
 * For status effects without a real status ID (e.g. using a status effect as a pseudo-gauge, or fake statuses used
 * for unit tests), this will assign a unique ID that will not give it a status effect icon.
 */
export function noStatusId(): number {
    return nextRandomBuffId--;
}
