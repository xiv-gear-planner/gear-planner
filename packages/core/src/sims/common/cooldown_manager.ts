import {Ability, CdAbility} from "../sim_types";

export type CooldownMode = 'none' | 'warn' | 'delay' | 'reject';

export type CooldownStatus = {
    /**
     * Whether the cooldown is ready to use. For normal cooldowns, this means it is off CD.
     * For charge abilities, this means it has at least one charge.
     */
    readyToUse: boolean,
    /**
     * When the cooldown will be ready, or already became ready to use. For normal cooldowns,
     * this is when it will be off CD. For charge abilities, this is when it will have
     * at least one charge. If it is already ready, this will return the current time.
     */
    readyAt: {
        absolute: number,
        relative: number,
    },
    /**
     * Whether the cooldown is capped. For normal cooldowns, this is the same as readyToUse.
     * For charges, this is when it will be fully capped.
     */
    capped: boolean,
    /**
     * When the cooldown will be capped. For normal cooldowns, this is the same as {@link readyAt}.
     * For charge-based abilities, this is when it is fully capped.
     */
    cappedAt: {
        absolute: number,
        relative: number,
    },
    /**
     * The current charge count. For non-charge abilities, this will only ever be 1 or 0.
     */
    currentCharges: number,
}

class InternalState {
    constructor(readonly cappedAt: number) {
    }
}

/**
 * Cooldown tracker
 */
export class CooldownTracker {


    private readonly currentState: Map<number, InternalState> = new Map();
    public mode: CooldownMode = 'warn';

    public constructor(private timeSource: () => number, mode: CooldownMode = 'warn') {
        this.mode = mode;
    }

    private get currentTime(): number {
        return this.timeSource();
    }

    public useAbility(ability: Ability, cdTimeOverride?: number): void {
        if (!hasCooldown(ability)) {
            return;
        }
        const cd = ability.cooldown;
        if (cd.reducedBy !== undefined && cd.reducedBy !== 'none' && cdTimeOverride === undefined) {
            // TODO: not super happy about the logic being split up here, find a better way
            console.warn(`CD ${ability.name} is supposed to be reduced by ${cd.reducedBy}, but an override time was not passed in`);
        }
        const cdTime = cdTimeOverride ?? cd.time;
        const status = this.statusOf(ability);
        const currentTime = this.currentTime;
        if (!status.readyToUse) {
            switch (this.mode) {
                case "none":
                    // Use it anyway
                    break;
                case "warn":
                    console.warn(`Ability ${ability.name} used at ${currentTime}, but it is not ready for another ${status.readyAt.relative.toFixed(3)}s`);
                    break;
                case "delay":
                    throw Error('Delay should be happening at the simulation level. This is a bug.');
                case "reject":
                    throw Error(`Ability ${ability.name} used at ${currentTime}, but it is not ready for another ${status.readyAt.relative.toFixed(3)}s`);
            }
        }
        // If the ability would have been capped at 75 seconds, and it has a 30 second CD, it will not be capped at 105
        // seconds. The trivial case is the ability is capped 'now' and you use it (works for charge based and normal).
        const newCappedAt = status.cappedAt.absolute + cdTime;
        const state = new InternalState(newCappedAt);
        const key = cooldownKey(ability);
        this.currentState.set(key, state);
    }

    public canUse(ability: Ability, when?: number): boolean {
        if (when === undefined) {
            when = this.currentTime;
        }
        return this.statusOfAt(ability, when).readyToUse;
    }

    /**
     * Shift the timing of every cooldown, in order to allow CD usage to be adjusted
     * for pre-pull uses.
     *
     * @param delta The time shift. Negative means shift all recorded times backwards (i.e.
     * abilities will be *closer* to coming off CD). Positive means the opposite. e.g. to adjust
     * for pre-pull timings, it should be negative.
     */
    public timeShift(delta: number) {
        for (const key of this.currentState.keys()) {
            this.currentState.set(key, new InternalState(this.currentState.get(key).cappedAt + delta));
        }
    }

    public statusOf(ability: Ability): CooldownStatus {
        return this.statusOfAt(ability, this.currentTime);
    }

    public statusOfAt(ability: Ability, desiredTime: number): CooldownStatus {
        if (!hasCooldown(ability)) {
            return defaultStatus(ability, desiredTime);
        }
        const existing = this.currentState.get(cooldownKey(ability));
        // Have existing state
        if (existing) {
            const cappedAt = existing.cappedAt;
            const timeUntilCap = cappedAt - desiredTime;
            // Completely capped
            if (timeUntilCap <= 0) {
                return {
                    readyAt: {
                        absolute: desiredTime,
                        relative: 0
                    },
                    readyToUse: true,
                    capped: true,
                    cappedAt: {
                        absolute: desiredTime,
                        relative: 0
                    },
                    currentCharges: ability.cooldown?.charges ?? 1,
                }
            }
            // Not capped
            else {
                // Figure out if we have charges.
                // Start with full charges, then subtract a charge for every cooldown worth of time until we would
                // be capped.
                // e.g. if we have 1:30 until capped on an ability with 60 second CD and 3 charges, then that looks like
                // this:
                /*
                    currentCharges = 3, i = 0, timeUntilCap = 90
                    currentCharges = 2, i = 60, timeUntilCap = 90
                    currentCharges = 1, i = 120, timeUntilCap = 90
                 */
                /*
                    Example 2: 60 second non-charge CD that has just been used:
                    currentCharges = 1, i = 0, timeUntilCap = 60
                    currentCharges = 0, i = 60, timeUntilCap = 60
                 */
                const maxCharges = ability.cooldown.charges ?? 1;
                // There is an unsupported case here, where mixed length CDs/charge counts are not supported
                // with shared CDs.
                // This branch is meant to handle this case when using one-charge abilities.
                // TODO: consider whether there is a way to block this case using type defs.
                if (maxCharges === 1) {
                    return {
                        readyAt: {
                            absolute: cappedAt,
                            relative: cappedAt - desiredTime
                        },
                        readyToUse: false,
                        capped: false,
                        cappedAt: {
                            absolute: cappedAt,
                            relative: cappedAt - desiredTime,
                        },
                        currentCharges: 0,
                    }
                }
                else {

                    let currentCharges = maxCharges;
                    let remainingTime;
                    let timeUntilNextCharge;
                    for (remainingTime = 0; remainingTime < timeUntilCap; remainingTime += ability.cooldown.time) {
                        currentCharges--;
                        timeUntilNextCharge = timeUntilCap - remainingTime;
                    }
                    if (currentCharges < 0) {
                        currentCharges = 0;
                    }
                    // Not capped, but have a charge
                    if (currentCharges >= 1) {
                        return {
                            readyAt: {
                                absolute: desiredTime,
                                relative: 0
                            },
                            readyToUse: true,
                            capped: false,
                            cappedAt: {
                                absolute: cappedAt,
                                relative: cappedAt - desiredTime,
                            },
                            currentCharges: currentCharges,
                        }
                    }
                    else {
                        // e.g. if CD is 60 seconds, two charges, and we have 75 seconds until capped,
                        // then we will have a charge available in (75 mod 60) === 15 seconds
                        const remaining = timeUntilNextCharge;
                        return {
                            readyAt: {
                                absolute: remaining + desiredTime,
                                relative: remaining
                            },
                            readyToUse: false,
                            capped: false,
                            cappedAt: {
                                absolute: cappedAt,
                                relative: cappedAt - desiredTime,
                            },
                            currentCharges: currentCharges,
                        }
                    }
                }
            }
        }
        else {
            return defaultStatus(ability, desiredTime);
        }
    }
}

function defaultStatus(ability: Ability, absTime: number): CooldownStatus {
    return {
        readyAt: {
            absolute: absTime,
            relative: 0
        },
        readyToUse: true,
        capped: true,
        cappedAt: {
            absolute: absTime,
            relative: 0
        },
        currentCharges: ability.cooldown?.charges ?? 1,
    }
}

/**
 * Given that abilities can indicate that they share a cooldown with another ability, this function extracts
 * the "real" cooldown key.
 * @param ability
 */
function cooldownKey(ability: CdAbility): number {
    const seen = [];
    let current = ability;
    let attempts = 10;
    // This SHOULDN'T happen with the new types, but leaving this check just in case.
    while (--attempts > 0) {
        if (current.cooldown.sharesCooldownWith !== undefined) {
            current = current.cooldown.sharesCooldownWith;
            if (seen.includes(current)) {
                throw Error(`Ability ${ability.name} has circular references of CD sharing.`)
            }
            seen.push(current);
        }
        else {
            return current.id;
        }
    }
    throw Error(`Ability ${ability.name} has too many layers of nested CD share.`)
}

function hasCooldown(ability: Ability): ability is CdAbility {
    return ability.cooldown !== undefined;
}
