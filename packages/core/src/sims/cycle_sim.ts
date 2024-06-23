import {
    Ability,
    AutoAttack,
    Buff,
    BuffController,
    CombinedBuffEffect,
    ComboData,
    ComboKey,
    Cooldown,
    DamageResult,
    FinalizedAbility,
    GcdAbility,
    OgcdAbility,
    PartiallyUsedAbility,
    PartyBuff,
    SimResult,
    SimSettings,
    UsedAbility
} from "./sim_types";
import {ComputedSetStats} from "@xivgear/xivmath/geartypes";
import {
    AUTOATTACK_APPLICATION_DELAY,
    CAST_SNAPSHOT_PRE,
    CASTER_TAX,
    NORMAL_GCD,
    STANDARD_ANIMATION_LOCK
} from "@xivgear/xivmath/xivconstants";
import {CooldownMode, CooldownTracker} from "./common/cooldown_manager";
import {addValues, fixedValue, multiplyFixed, ValueWithDev} from "@xivgear/xivmath/deviation";
import {abilityEquals, appDelay, completeComboData, FinalizedComboData} from "./ability_helpers";
import {abilityToDamageNew, combineBuffEffects} from "./sim_utils";
import {BuffSettingsExport} from "./common/party_comp_settings";
import {CycleSettings} from "./cycle_settings";

/**
 * CycleContext is similar to CycleProcessor, but is scoped to within a cycle. It provides methods
 * and properties for keeping track of time relative to the cycle itself.
 */
export class CycleContext {

    cycleStartedAt: number;
    /**
     * cycleTime is the length of one cycle. Commonly 120 seconds.
     */
    readonly cycleTime: number;
    /**
     * The amount of overall fight time when this cycle begins. Can be used to modify a rotation
     * to account for an early end.
     */
    readonly fightTimeRemainingAtCycleStart: number;
    /**
     * The number of this cycle. 0 is the first cycle.
     */
    readonly cycleNumber: number;
    readonly mcp: CycleProcessor;
    private lastSeenPrepullOffset: number = 0;

    constructor(mcp: CycleProcessor, cycleTime: number) {
        this.cycleTime = cycleTime;
        this.cycleStartedAt = mcp.currentTime;
        this.fightTimeRemainingAtCycleStart = mcp.totalTime - mcp.currentTime;
        this.cycleNumber = mcp.currentCycle;
        this.mcp = mcp;
        this.lastSeenPrepullOffset = this.mcp.totalPrePullOffset;
    }

    recheckPrepull() {
        const newPrePullOffset = this.mcp.totalPrePullOffset;
        const delta = newPrePullOffset - this.lastSeenPrepullOffset;
        if (delta !== 0) {
            this.cycleStartedAt += delta;
            this.lastSeenPrepullOffset = newPrePullOffset;
        }
    }

    /**
     * The overall fight time. Equivalent to CycleProcessor's currentTime.
     */
    get overallFightTime() {
        return this.mcp.currentTime;
    }

    /**
     * The maximum possible length of this cycle. It is the lesser of the cycle time and the
     * duration of overall fight time remaining when this cycle began.
     */
    get maxTime() {
        return Math.min(this.cycleTime, this.fightTimeRemainingAtCycleStart);
    }

    /**
     * The time remaining in this cycle, taking into account the possibility that the fight's
     * overall remaining time would cut off the cycle.
     */
    get cycleRemainingTime() {
        return Math.max(0, this.cycleStartedAt + this.maxTime - this.mcp.currentTime);
    }

    /**
     * The time remaining, accounting for GCD time. That is, if our next GCD is not available for another
     * X seconds, this would return cycleRemainingTime + X.
     */
    get cycleRemainingGcdTime() {
        return Math.max(0, this.cycleStartedAt + this.maxTime - this.mcp.nextGcdTime);
    }

    /**
     * The overall fight's time remaining.
     */
    get fightRemainingTime() {
        return this.mcp.remainingTime;
    }

    /**
     * The overall fight's time remaining for GCDs.
     */
    get fightRemainingGcdTime() {
        return this.mcp.remainingGcdTime;
    }


    /**
     * Get the buffs that would be active right now.
     */
    getActiveBuffs(): Buff[] {
        return this.mcp.getActiveBuffs();
    }

    /**
     * Activate a buff manually
     *
     * @param buff The buff to activate
     */
    activateBuff(buff: Buff) {
        this.mcp.activateBuff(buff);
    }

    // /**
    //  * How many GCDs have been used this cycle
    //  */
    // gcdCount() {
    //     return this.usedAbilities.filter(used => used.ability['type'] == 'gcd').length;
    // }

    /**
     * Use an ability
     *
     * @param ability The ability to use
     */
    use(ability: Ability): AbilityUseResult {
        const use = this.mcp.use(ability);
        this.recheckPrepull();
        return use;
    }

    /**
     * Use an ability until a specific time. The time is treated as being relative to the cycle.
     *
     * @param ability  The ability to use.
     * @param useUntil The time (relative to start of cycle) to use.
     */
    useUntil(ability: GcdAbility, useUntil: number | 'end') {
        if (useUntil == 'end') {
            useUntil = this.cycleTime;
        }
        const useUntilFinal = useUntil;
        // TODO: when using align-first or align-full mode, and doing your pre-pull within a cycle, this needs to
        //  be able to account for the time shift that occurs when the pre-pull offset is applied.
        this.mcp.useWhile(ability, () => {
            this.recheckPrepull();
            const correctedEndTime = Math.min(this.cycleStartedAt + useUntilFinal, this.cycleStartedAt + this.cycleTime, this.mcp.totalTime);
            return this.mcp.currentTime < correctedEndTime;
        });
        this.recheckPrepull();
    }

    /**
     * Use a GCD
     *
     * @param ability the GCD ability to use
     */
    useGcd(ability: GcdAbility): AbilityUseResult {
        const useGcd = this.mcp.useGcd(ability);
        this.recheckPrepull();
        return useGcd;
    }

    /**
     * Use an oGCD
     *
     * @param ability The oGCD ability to use
     */
    useOgcd(ability: OgcdAbility): AbilityUseResult {
        const useOgcd = this.mcp.useOgcd(ability);
        this.recheckPrepull();
        return useOgcd;
    }
}

/**
 * Represents whether an ability got 'cut off' because there wasn't enough time left to use it.
 *
 * 'full' indicates that the ability was not cut off.
 * 'partial' indicates that the ability partially fit in the time remaining, so its damage was proprated
 * based on the proportion that did fit.
 * 'none' indicates that none of the ability fit, and the attempt to use it had no effect.
 */
export type AbilityUseResult = 'full' | 'partial' | 'none';

/**
 * Base settings object for a cycle based sim
 */
export type MultiCycleSettings = {
    /**
     * The total fight time. Typically set by the user.
     */
    readonly totalTime: number,
    /**
     * The time of a single cycle.
     */
    readonly cycleTime: number,
    /**
     * All enabled party buffs.
     */
    readonly allBuffs: PartyBuff[],
    /**
     * Which of the party buffs should not be automatically activated due to them coming from
     * the class which is actively being simulated.
     */
    readonly manuallyActivatedBuffs?: PartyBuff[],
    /**
     * The player stats.
     */
    readonly stats: ComputedSetStats,
    /**
     * Whether to use auto-attacks.
     */
    readonly useAutos: boolean
}

export type CycleFunction = (cycle: CycleContext) => void

export const isAbilityUse = (record: DisplayRecordUnf): record is AbilityUseRecordUnf => 'ability' in record;
export const isFinalizedAbilityUse = (record: DisplayRecordFinalized): record is FinalizedAbility => 'original' in record;

/**
 * Represents a usage of a buff.
 */
export interface BuffUsage {
    /**
     * The buff which was usedj.
     */
    readonly buff: Buff,
    /**
     * The start time.
     */
    start: number,
    /**
     * The end time.
     */
    end: number,
    /**
     * If true, the buff was forcibly removed before expiry.
     */
    forceEnd: boolean
}

/**
 * Sets how to set the actual cycle length of a CycleProcessor
 *
 * align-absolute: the default behavior. Cycle length is trimmed to align to the "expected" cycle times. e.g., if the current
 * time is 135 seconds, and you start the second cycle, it will be (240 - 135) = 105 seconds
 *
 * align-to-first: Cycle length is trimmed to the expected time, but offset by the start time of the first cycle.
 * e.g. if you started the first cycle at 5 seconds, and you're about to start the second cycle at 130 seconds, it will
 * be trimmed to (240 + 5 - 130) = 115 seconds.
 *
 * full-duration: Use the full duration for every cycle, regardless of start time. Prone to drift, but avoids needing
 * to check cooldowns if the CD time is less than or equal to the cycle time and is used at the same point in every
 * cycle.
 */
export type CycleLengthMode = 'align-absolute'
    | 'align-to-first'
    | 'full-duration';

/**
 * Contains number, start time, and end time for a cycle.
 */
export type CycleInfo = {
    readonly cycleNum: number,
    start: number,
    end: number | null,
}

class ComboTracker {
    private _lastComboAbility: Ability | null = null;

    constructor(public readonly key: string) {
    }

    get lastComboAbility(): Ability | null {
        return this._lastComboAbility;
    }

    set lastComboAbility(value: Ability | null) {
        // console.log(`Combo state: [${this.key}] '${this._lastComboAbility?.name} => ${value?.name}`);
        this._lastComboAbility = value;
    }
}


/**
 * CycleProcessor is a rotation-based simulation backend that requires actual ability uses to be specified.
 * The 'Cycle' part of the name refers to the fact that it supports loops/cycles.
 *
 * Note about times:
 */
export class CycleProcessor {

    /**
     * The current cycle number. -1 is pre-pull, 0 is the first cycle, etc
     */
    currentCycle: number = -1;
    /**
     * The current time. This should not normally be written to, as it will be automatically updated internally
     * as actions are used.
     *
     * If combat has not started, this represents time since the first action usage.
     * Once combat begins, this is rebased such that the start of combat is zero.
     */
    currentTime: number = 0;
    /**
     * Like currentTime, but indicates when the next GCD can start, taking into account the current GCD timer.
     */
    nextGcdTime: number = 0;
    /**
     * When the next auto-attack would occur, assuming no cast locks happen between now and then.
     */
    nextAutoAttackTime: number = 0;
    private pendingPrePullOffset: number = 0;
    /**
     * The total adjustment (in seconds) that was performed to rebase the timer such that start-of-combat is zero.
     *
     * e.g. if you used 5 seconds worth of pre-pull actions, this would be -5.
     */
    totalPrePullOffset: number = 0;
    /**
     * The "default" GCD time - typically 2.5 seconds.
     */
    readonly gcdBase: number = NORMAL_GCD;
    /**
     * The length of a cycle. Commonly 120 seconds.
     */
    readonly cycleTime: number;
    /**
     * Contains records of abilities and other events. Should generally not be accessed externally.
     *
     * To retrieve records after a simulation finishes, see {@link finalizedRecords}.
     */
    readonly allRecords: DisplayRecordUnf[] = [];
    /**
     * Log of when party buffs were last activated.
     */
    private readonly buffTimes = new Map<PartyBuff, number>();
    /**
     * Log of when all status effects were activated.
     */
    readonly buffHistory: BuffUsage[] = [];
    /**
     * The total maximum fight time
     */
    readonly totalTime: number;
    /**
     * The stats of the set currently being simulated
     */
    readonly stats: ComputedSetStats;
    /**
     * Map from DoT effect ID to an object which tracks, among other things, when it was used.
     */
    readonly dotMap = new Map<number, UsedAbility>();
    /**
     * Contains party buffs which should not be activated automatically by virtue of coming from the class being
     * simulated.
     */
    private readonly manuallyActivatedBuffs: readonly PartyBuff[];
    /**
     * Whether combat has started
     */
    combatStarted: boolean = false;
    /**
     * Whether auto-attacks are enabled
     */
    readonly useAutos: boolean;
    /**
     * Cooldown tracker.
     */
    readonly cdTracker: CooldownTracker;
    private _cdEnforcementMode: CooldownMode;
    /**
     * Controls the logic used to re-align cycles. Since cycles typically do not last exactly their desired time
     * (i.e. there is drift), you can control how it should re-align cycles when this happens.
     *
     * See the docs on CycleLengthMode for more information on each mode.
     */
    cycleLengthMode: CycleLengthMode = 'align-absolute';
    private firstCycleStartTime: number = 0;
    private readonly cycles: CycleInfo[] = [];
    private readonly comboTrackerMap: Map<ComboKey, ComboTracker>;
    private readonly aaAbility: AutoAttack;

    constructor(private settings: MultiCycleSettings) {
        // TODO: set enforcement mode
        this.cdTracker = new CooldownTracker(() => this.currentTime);
        this._cdEnforcementMode = 'warn';
        this.cycleTime = settings.cycleTime;
        this.totalTime = settings.totalTime;
        this.stats = settings.stats;
        this.manuallyActivatedBuffs = settings.manuallyActivatedBuffs ?? [];
        this.useAutos = settings.useAutos;
        this.comboTrackerMap = new Map();
        this.aaAbility = {
            attackType: 'Auto-attack',
            type: 'autoattack',
            name: 'Auto Attack',
            id: (this.stats.jobStats.aaPotency >= 90 ? 7 : 8),
            noIcon: true,
            potency: this.stats.jobStats.aaPotency
        };
    }

    get cdEnforcementMode(): CooldownMode {
        return this._cdEnforcementMode;
    }

    /**
     * The cooldown enforcement mode affects behavior when an ability with a cooldown is used while it is
     * still on cooldown.
     *
     * Options are:
     *
     * 'none' - cooldown tracker will happily allow the cooldown to be used at an invalid time.
     * 'warn' - cooldown tracker will log a warning to console, but will continue
     * 'delay' - cycle processor will fast-forward the time to when the cooldown would be ready. This is ideal for
     * classes such as DNC where the optimal rotation may involve waiting a fraction of a second for a long CD to be
     * ready, rather than trying to use another GCD and thus drifting.
     * 'reject' - cooldown tracker will throw an error if you attempt to use an invalid CD. It is not recommended to
     * use this for logic (i.e. don't try/catch). Instead, just query whether the cooldown is ready or not.
     */
    set cdEnforcementMode(value: CooldownMode) {
        this._cdEnforcementMode = value;
        this.cdTracker.mode = value;
    }

    /**
     * Set the time at which a buff will start
     *
     * @param buff      The buff
     * @param startTime The start time
     */
    setBuffStartTime(buff: Buff, startTime: number) {
        if (this.isBuffAutomatic(buff)) {
            this.buffTimes.set(buff, startTime);
        }
        this.buffHistory.push({
            buff: buff,
            start: startTime,
            end: buff.duration === undefined ? Number.MAX_VALUE : (startTime + buff.duration),
            forceEnd: false
        });
    }

    /**
     * Manually cancel a buff
     *
     * @param buff The buff to cancel
     */
    removeBuff(buff: Buff) {
        const activeUsages = this.getActiveBuffsData().filter(buffHist => buffHist.buff.name === buff.name);
        activeUsages.forEach(au => {
            au.end = this.currentTime;
            au.forceEnd = true;
        });
    }

    /**
     * Modifies the stack value for a given buff. The stack value provided should be the modified amount and not the final amount
     * 
     * @param buff The Buff
     * @param stacks The stack modification to add
     */
    modifyBuffStacks(buff: Buff, stacks: number) {
        const activeUsages = this.getActiveBuffsData().filter(buffHist => buffHist.buff.name === buff.name);
        this.removeBuff(buff);
        activeUsages.forEach(au => {
            const newStacks = au.buff.stacks + stacks;
            if (newStacks > 0) {
                this.activateBuff({
                    ...au.buff,
                    stacks: au.buff.stacks + stacks,
                });
            }
        });
    }

    /**
     * Whether a buff is an automatically-activated party buff.
     *
     * @param buff
     */
    isBuffAutomatic(buff: Buff): buff is PartyBuff {
        if ('cooldown' in buff) {
            return !this.manuallyActivatedBuffs.includes(buff);
        }
        return false;
    }

    /**
     * The remaining time in the fight.
     */
    get remainingTime() {
        // If you set the duration to 10 seconds, but you do 20 seconds of pre-pull stuff, then you would end up
        // never starting combat.
        if (!this.combatStarted) {
            return this.totalTime;
        }
        return Math.max(0, this.totalTime - this.currentTime);
    }

    /**
     * The remaining time in the fight, minus the time remaining on the current GCD.
     */
    get remainingGcdTime() {
        // If you set the duration to 10 seconds, but you do 20 seconds of pre-pull stuff, then you would end up
        // never starting combat.
        if (!this.combatStarted) {
            return this.totalTime;
        }
        return Math.max(0, this.totalTime - this.nextGcdTime);
    }

    /**
     * Manually mark a buff as being active now
     *
     * @param buff The buff
     */
    activateBuff(buff: Buff) {
        this.activateBuffWithDelay(buff, 0);
    }

    /**
     * Manually mark a buff as being active after a given delay
     *
     * @param buff The buff
     * @param delay The delay after which to apply the buff
     */
    activateBuffWithDelay(buff: Buff, delay: number) {
        this.setBuffStartTime(buff, this.currentTime + delay);
    }

    private recheckAutoBuffs() {
        if (!this.combatStarted) {
            return;
        }
        const queryTime = this.currentTime;
        this.buffTimes.forEach((time, buff) => {
            if (time === undefined || time > queryTime) {
                return;
            }
            if ((queryTime - time) < buff.duration) {
                return;
            }
            else if (this.isBuffAutomatic(buff)) {
                this.setBuffStartTime(buff, time + buff.cooldown);
            }
        });
    }

    /**
     * Get the buffs that would be active right now.
     */
    getActiveBuffs(): Buff[] {
        const activeBuffs: Buff[] = [];
        this.getActiveBuffsData().forEach(h => {
            if (!activeBuffs.includes(h.buff)) {
                activeBuffs.push(h.buff);
            }
        });
        return activeBuffs;
    }

    /**
     * Get the buffs that would be active right now, which affect a specific ability.
     *
     * @param ability The ability in question
     */
    getActiveBuffsFor(ability: Ability): Buff[] {
        return this.getActiveBuffs().filter(buff => {
            if ('appliesTo' in buff) {
                return buff.appliesTo(ability);
            }
            return true;
        });
    }

    private getActiveBuffsData(): BuffUsage[] {
        const queryTime = this.currentTime;
        this.recheckAutoBuffs();
        return this.buffHistory.filter(h => h.start <= queryTime && h.end > queryTime && !h.forceEnd);
    }

    /**
     * Add a special text row to the output records.
     *
     * @param message The text
     * @param time The time of the record. Current time will be used if not specified.
     */
    addSpecialRow(message: string, time?: number) {
        this.allRecords.push({
            usedAt: time ?? this.currentTime,
            label: message,
        } satisfies SpecialRecord);
    }

    /**
     * A record of all abilities used.
     */
    get usedAbilities(): readonly AbilityUseRecordUnf[] {
        return this.allRecords.filter(isAbilityUse);
    }

    /**
     * A record of events, including special rows and such.
     */
    get finalizedRecords(): readonly DisplayRecordFinalized[] {
        this.finalize();
        return (this.allRecords.map(record => {
            if (isAbilityUse(record)) {

                const partialRate = record.totalTimeTaken > 0 ? Math.max(0, Math.min(1, (this.totalTime - record.usedAt) / record.totalTimeTaken)) : 1;
                const directDamage = multiplyFixed(record.directDamage, partialRate);
                const dot = record.dot;
                const dotDmg = dot ? multiplyFixed(dot.damagePerTick, dot.actualTickCount) : fixedValue(0);
                const totalDamage = addValues(directDamage, dotDmg);
                const totalPotency = record.ability.potency + ('dot' in record.ability ? record.ability.dot.tickPotency * record.dot.actualTickCount : 0);
                return {
                    usedAt: record.usedAt,
                    original: record,
                    partialRate: partialRate == 1 ? null : partialRate,
                    directDamage: directDamage.expected,
                    directDamageFull: directDamage,
                    dotInfo: dot,
                    totalDamage: totalDamage.expected,
                    totalDamageFull: totalDamage,
                    totalPotency: totalPotency,
                    buffs: record.buffs,
                    combinedEffects: record.combinedEffects,
                    ability: record.ability
                } satisfies FinalizedAbility;
            }
            else {
                return record;
            }
        }));
    }

    private isGcd(ability: Ability): ability is GcdAbility {
        return ability.type === 'gcd';
    }

    private getCombinedEffectsFor(ability: Ability): {
        buffs: ReturnType<typeof this.getActiveBuffs>,
        combinedEffects: ReturnType<typeof combineBuffEffects>,
    } {
        const active = this.getActiveBuffsFor(ability);
        const combined = combineBuffEffects(active);
        return {
            'buffs': active,
            'combinedEffects': combined
        }
    }

    /**
     * Use an ability
     *
     * @param ability The ability to use
     */
    use(ability: Ability): AbilityUseResult {
        // noinspection AssignmentToFunctionParameterJS
        ability = this.processCombo(ability);
        const isGcd = this.isGcd(ability);
        if (this.remainingGcdTime <= 0) {
            // Already over time limit. Ignore completely.
            return 'none';
        }
        // Since we might not be at the start of the next GCD yet (e.g. back-to-back instant GCDs), we need to do the
        // CD checking at the time when we expect to actually use this GCD.
        const cdCheckTime = isGcd ? Math.max(this.nextGcdTime, this.currentTime) : this.currentTime;
        if (!this.cdTracker.canUse(ability, cdCheckTime)) {
            switch (this.cdEnforcementMode) {
                case "none":
                case "warn":
                    // CD tracker will enforce this
                    break;
                case "delay":
                    this.advanceTo(this.cdTracker.statusOf(ability).readyAt.absolute);
                    break;
                // TODO: don't enforce at the CD tracker level, only warn, since we already enforce here
                case "reject":
                    throw Error(`Cooldown not ready: ${ability.name}, time ${this.currentTime}, in combat: ${this.combatStarted}`);
            }
        }
        if (isGcd) {
            if (this.nextGcdTime > this.currentTime) {
                this.advanceTo(this.nextGcdTime);
            }
        }
        // We need to calculate our buff set twice. The first is because buffs may affect the cast and/or recast time.
        const gcdStartsAt = this.currentTime;
        const pre = this.getCombinedEffectsFor(ability);
        const preBuffs = pre.buffs;
        const preCombinedEffects: CombinedBuffEffect = pre.combinedEffects;
        // noinspection AssignmentToFunctionParameterJS
        ability = this.beforeAbility(ability, preBuffs);
        const abilityGcd = isGcd ? (this.gcdTime(ability as GcdAbility, preCombinedEffects)) : 0;
        this.markCd(ability, preCombinedEffects);
        const effectiveCastTime: number | null = ability.cast ? this.castTime(ability, preCombinedEffects) : null;
        const snapshotDelayFromStart = effectiveCastTime ? Math.max(0, effectiveCastTime - CAST_SNAPSHOT_PRE) : 0;
        const snapshotsAt = this.currentTime + snapshotDelayFromStart;
        // When this GCD will end (strictly in terms of GCD. e.g. a BLM spell where cast > recast will still take the cast time. This will be
        // accounted for later).
        const gcdFinishedAt = this.currentTime + abilityGcd;
        const animLock = ability.animationLock ?? STANDARD_ANIMATION_LOCK;
        const effectiveAnimLock = effectiveCastTime ? Math.max(effectiveCastTime + CASTER_TAX, animLock) : animLock;
        const animLockFinishedAt = this.currentTime + effectiveAnimLock;
        this.advanceTo(snapshotsAt, true);
        const {
            buffs,
            combinedEffects
        } = this.getCombinedEffectsFor(ability);
        // noinspection AssignmentToFunctionParameterJS
        ability = this.beforeSnapshot(ability, buffs);
        // Enough time for entire GCD
        // if (gcdFinishedAt <= this.totalTime) {
        const dmgInfo = this.modifyDamage(abilityToDamageNew(this.stats, ability, combinedEffects), ability, buffs);
        const appDelayFromSnapshot = appDelay(ability);
        const appDelayFromStart = appDelayFromSnapshot + snapshotDelayFromStart;
        const usedAbility: UsedAbility = ({
            ability: ability,
            // We want to take the 'haste' value from the pre-snapshot values, but everything else should
            // come from when the ability snapshotted.
            // i.e. a haste buff that applies mid-cast will not help us, but a damage buff will.
            // Opposite applies for buffs falling off mid-cast.
            combinedEffects: {
                ...combinedEffects,
                haste: preCombinedEffects.haste,
            },
            buffs: Array.from(new Set<Buff>([...preBuffs, ...buffs])),
            usedAt: gcdStartsAt,
            directDamage: dmgInfo.directDamage ?? fixedValue(0),
            dot: dmgInfo.dot,
            appDelay: appDelayFromSnapshot,
            appDelayFromStart: appDelayFromStart,
            totalTimeTaken: Math.max(effectiveAnimLock, abilityGcd),
            castTimeFromStart: effectiveCastTime,
            snapshotTimeFromStart: snapshotDelayFromStart,
            lockTime: effectiveAnimLock
        });
        this.addAbilityUse(usedAbility);
        // Since we don't have proper modeling for situations where you need to delay something to catch a buff,
        // e.g. SCH chain into ED, just force buffs to apply no later than the animation lock.
        // At this specific point in time, we are exactly at the snapshot. Thus, the remaining application delay
        // is the snapshot-to-application delta only, and the animation lock also needs to have the time so far
        // subtracted.
        // TODO: fix this limitation
        const buffDelay = Math.max(0, Math.min(appDelayFromSnapshot, effectiveAnimLock - snapshotDelayFromStart));
        // Activate buffs afterwards
        if (ability.activatesBuffs) {
            ability.activatesBuffs.forEach(buff => this.activateBuffWithDelay(buff, buffDelay));
        }
        // Anim lock OR cast time, both effectively block use of skills.
        // If cast time > GCD recast, then we use that instead. Also factor in caster tax.
        this.advanceTo(animLockFinishedAt);
        // If we're casting a long-cast, then the GCD is blocked for more than a GCD.
        if (isGcd) {
            this.nextGcdTime = Math.max(gcdFinishedAt, animLockFinishedAt);
        }
        // Account for potential GCD clipping
        else {
            this.nextGcdTime = Math.max(this.nextGcdTime, animLockFinishedAt);
        }
        // Workaround for auto-attacks after first ability
        this.advanceTo(this.currentTime);
        this.adjustPrepull();
        return 'full';
    }

    /**
     * Use a GCD ability repeatedly until the specified time
     *
     * @param ability
     * @param useUntil
     */
    useUntil(ability: GcdAbility, useUntil: number) {
        this.useWhile(ability, () => this.nextGcdTime < useUntil);
    }

    /**
     * Use a GCD ability while the given predicate remains true.
     *
     * @param ability The ability to use
     * @param useWhile The predicate
     */
    useWhile(ability: GcdAbility, useWhile: () => boolean) {
        while (useWhile() && this.remainingGcdTime > 0) {
            // TODO: when using align-first or align-full mode, and doing your pre-pull within a cycle, this needs to
            //  be able to account for the time shift that occurs when the pre-pull offset is applied.
            this.use(ability);
        }
    }

    /**
     * Determines whether or not an Off-GCD ability can be used without clipping the GCD
     * 
     * @param action The Off-GCD ability to check for
     * @returns whether or not this ability can be used without clipping the GCD
     */
    canUseWithoutClipping(action: OgcdAbility) {
        const readyAt = this.cdTracker.statusOf(action).readyAt.absolute;
        const maxDelayAt = this.nextGcdTime - (action.animationLock ?? STANDARD_ANIMATION_LOCK);
        return readyAt <= maxDelayAt;
    }

    /**
     * Fast-forward (i.e. do nothing until) the given time.
     *
     * @param advanceTo The time to fast-forward to.
     * @param pauseAutos Whether auto-attacks should be paused during this time.
     */
    advanceTo(advanceTo: number, pauseAutos: boolean = false) {
        const delta = advanceTo - this.currentTime;
        if (delta < 0) {
            throw new Error("Cannot rewind time!");
        }
        if (this.combatStarted && !this.combatStarting) {
            if (pauseAutos) {
                this.nextAutoAttackTime += delta;
            }
            else {
                if (advanceTo >= this.nextAutoAttackTime && this.combatStarted) {
                    this.currentTime = this.nextAutoAttackTime;
                    if (this.useAutos) {
                        // TODO: the initial auto-attack timing still needs to be validated using a class that starts
                        // with an instant skill.
                        this.recordAutoAttack();
                    }
                }
            }
        }
        else {
            this.nextAutoAttackTime = this.currentTime;
        }
        this.currentTime = advanceTo;
    }

    private recordAutoAttack() {
        const {
            buffs,
            combinedEffects
        } = this.getCombinedEffectsFor(this.aaAbility);
        const dmgInfo = abilityToDamageNew(this.stats, this.aaAbility, combinedEffects);
        const appDelay = AUTOATTACK_APPLICATION_DELAY;
        this.addAbilityUse({
            usedAt: this.currentTime,
            ability: this.aaAbility,
            directDamage: dmgInfo.directDamage,
            buffs: buffs,
            combinedEffects: combinedEffects,
            totalTimeTaken: 0,
            appDelay: appDelay,
            appDelayFromStart: appDelay,
            castTimeFromStart: 0,
            snapshotTimeFromStart: 0,
            lockTime: 0
        });
        const aaDelay = this.stats.aaDelay * (100 - this.stats.haste('Auto-attack') - combinedEffects.haste) / 100;
        this.nextAutoAttackTime = this.currentTime + aaDelay;
    }

    /**
     * See {@link #use}
     * @param ability The ability to use
     */
    useGcd(ability: GcdAbility): AbilityUseResult {
        return this.use(ability);
    }

    /**
     * See {@link #use}
     * @param ability The ability to use
     */
    useOgcd(ability: OgcdAbility): AbilityUseResult {
        return this.use(ability);
    }

    private adjustPrepull() {
        if (this.pendingPrePullOffset === 0) {
            return;
        }
        this.allRecords.forEach(used => {
            used.usedAt += this.pendingPrePullOffset;
        });
        this.currentTime += this.pendingPrePullOffset;
        this.nextGcdTime += this.pendingPrePullOffset;
        this.nextAutoAttackTime += this.pendingPrePullOffset;
        this.cdTracker.timeShift(this.pendingPrePullOffset);
        if (this.currentCycle >= 0) {
            this.firstCycleStartTime += this.pendingPrePullOffset;
        }
        this.totalPrePullOffset += this.pendingPrePullOffset;
        this.cycles.forEach(cycle => {
            cycle.start += this.pendingPrePullOffset;
            if (cycle.end !== null) {
                cycle.end += this.pendingPrePullOffset;
            }
        });
        const pending = this.pendingPrePullOffset;
        console.log(`Pre-pull adjustment: ${pending}`);
        this.pendingPrePullOffset = 0;
        if (this.combatStarting) {
            this.buffHistory.forEach(bh => {
                bh.start += pending;
                bh.end += pending;
            });
            this.settings.allBuffs.forEach(buff => {
                if (this.isBuffAutomatic(buff)) {
                    if (buff.startTime !== undefined) {
                        this.setBuffStartTime(buff, buff.startTime);
                    }
                }
            });
            this.combatStarting = false;
        }
    }

    private combatStarting: boolean = false;

    private addAbilityUse(usedAbility: AbilityUseRecordUnf) {
        this.allRecords.push(usedAbility);
        // If this is a pre-pull ability, we can offset by the hardcast time and/or application delay
        if (!this.combatStarted && usedAbility.ability.potency !== null) {
            // We want the first damaging ability
            const firstDamagingAbility = this.usedAbilities.find(ability => ability.ability.potency !== null);
            if (firstDamagingAbility !== undefined) {
                // e.g. if the ability has an application delay of 0.6 seconds, and it was used at 10 seconds, then we
                // want to adjust by 10.6 seconds
                this.pendingPrePullOffset = -(firstDamagingAbility.usedAt + firstDamagingAbility.appDelayFromStart);
            }
            this.combatStarted = true;
            this.combatStarting = true;
        }
        if (usedAbility.dot) {
            const dotId = usedAbility.ability['dot']?.id;
            // If the ability places a DoT, then check if we need to cut off an existing DoT
            if (dotId !== undefined) {
                const existing = this.dotMap.get(dotId);
                if (existing) {
                    // Get the current tick number at the time when the DoT would actually apply based on the skill's
                    // application delay.
                    const currentTick = Math.floor((usedAbility.usedAt + usedAbility.appDelayFromStart) / 3);
                    // Calculate which tick number the old DoT started on
                    const oldTick = Math.floor((existing.usedAt + existing.appDelayFromStart) / 3);
                    // Finally, calculate the actual tick count for the old DoT by taking the least of:
                    // 1. How many ticks have elapsed since the old DoT was applied
                    // 2. The maximum number of ticks the old DoT would have been able to apply based on its duration.
                    // There is a known caveat that this would not work if SE were to introduce a DoT with a duration
                    // that does not divide by 3.
                    const tickCount = Math.min(
                        currentTick - oldTick,
                        existing.dot.fullDurationTicks === 'indefinite' ? Number.MAX_VALUE : existing.dot.fullDurationTicks);
                    existing.dot.actualTickCount = tickCount;
                }
                // Set our new DoT into the DoT map
                this.dotMap.set(dotId, usedAbility);
            }
        }
    }

    /**
     * Returns a record of individual cycles, including when each cycle started/ended.
     */
    get cycleRecords(): typeof this.cycles {
        return [...this.cycles];
    }

    private finalize() {
        // If any DoTs are still ticking, cut them off
        this.dotMap.forEach((existing) => {
            const currentTick = Math.floor(Math.min(this.currentTime, this.totalTime) / 3);
            const oldTick = Math.floor((existing.usedAt + existing.appDelayFromStart) / 3);
            existing.dot.actualTickCount = Math.min(currentTick - oldTick, existing.dot.fullDurationTicks === 'indefinite' ? Number.MAX_VALUE : existing.dot.fullDurationTicks);
        });
    }

    /**
     * Determine the effective cast time of an ability, assuming it is cast at the current time with the given set of
     * buffs.
     *
     * @param ability
     * @param effects
     */
    castTime(ability: Ability, effects: CombinedBuffEffect): number {
        const base = ability.cast;
        const stats = effects.modifyStats(this.stats);
        const haste = effects.haste + stats.haste(ability.attackType);
        return ability.fixedGcd ? base :
            (ability.attackType == "Spell") ?
                (stats.gcdMag(base ?? this.gcdBase, haste)) :
                (stats.gcdPhys(base ?? this.gcdBase, haste));
    }

    /**
     * Determine the effective GCD time of a GCD ability, assuming it is cast at the current time with the given set of
     * buffs.
     *
     * @param ability
     * @param effects
     */
    gcdTime(ability: GcdAbility, effects: CombinedBuffEffect): number {
        const base = ability.gcd;
        const stats = effects.modifyStats(this.stats);
        const haste = effects.haste + stats.haste(ability.attackType);
        return ability.fixedGcd ? base :
            (ability.attackType == "Spell") ?
                (stats.gcdMag(base ?? this.gcdBase, haste)) :
                (stats.gcdPhys(base ?? this.gcdBase, haste));
    }

    /**
     * Inform the cooldown tracker that a CD has been used.
     *
     * @param ability The ability
     * @param effects The combined effects
     * @private
     */
    private markCd(ability: Ability, effects: CombinedBuffEffect) {
        const cd = ability.cooldown;
        if (cd === undefined) {
            return;
        }
        const cdTime = this.cooldownTime(cd, effects);
        this.cdTracker.useAbility(ability, cdTime);
    }

    /**
     * Determine the effective CD time of a cooldown, assuming it is used at the current time with the given set of
     * buffs.
     *
     * @param cooldown The cooldown information to use as a basis
     * @param effects The effects
     */
    cooldownTime(cooldown: Cooldown, effects: CombinedBuffEffect): number {
        const stats = effects.modifyStats(this.stats);
        switch (cooldown.reducedBy) {
            case undefined:
            case "none":
                return cooldown.time;
            case "spellspeed":
                return stats.gcdMag(cooldown.time, effects.haste);
            case "skillspeed":
                return stats.gcdPhys(cooldown.time, effects.haste);
        }
    }

    /**
     * Perform one complete cycle, using the given cycle function.
     *
     * This is useful if your rotation changes from one cycle to another. However, it is also possible to simply
     * query the cycle number to change the rotation logic as appropriate.
     *
     * @param cycleFunction
     */
    oneCycle(cycleFunction: CycleFunction) {
        if (this.currentCycle < 0) {
            this.currentCycle = 0;
            this.firstCycleStartTime = this.currentTime;
        }
        const expectedStartTime = this.cycleTime * this.currentCycle;
        const actualStartTime = this.currentTime;
        let cycleTime: number;
        switch (this.cycleLengthMode) {
            case "align-absolute": {
                const delta = actualStartTime - expectedStartTime;
                cycleTime = this.cycleTime - delta;
                break;
            }
            case "align-to-first": {
                if (this.currentCycle === 0) {
                    cycleTime = this.cycleTime;
                }
                else {
                    const adjustedExpectedStartTime = expectedStartTime + this.firstCycleStartTime;
                    const delta = actualStartTime - adjustedExpectedStartTime;
                    cycleTime = this.cycleTime - delta;
                }
                break;
            }
            case "full-duration":
                cycleTime = this.cycleTime;
                break;
        }
        const ctx = new CycleContext(this, cycleTime);
        // console.debug('Delta', delta);
        // TODO: make some kind of 'marker' for this
        this.allRecords.push({
            label: "-- Start of Cycle --",
            usedAt: this.currentTime,
        });
        const cycleInfo: CycleInfo = {
            cycleNum: this.currentCycle,
            start: this.currentTime,
            end: null
        };
        this.cycles.push(cycleInfo);
        cycleFunction(ctx);
        ctx.recheckPrepull();
        this.allRecords.push({
            label: "-- End of Cycle --",
            usedAt: this.currentTime,
        });
        cycleInfo.end = this.currentTime;
        this.currentCycle++;
    }


    /**
     * Perform the given cycle function until the fight finishes.
     *
     * @param cycleFunction
     */
    remainingCycles(cycleFunction: CycleFunction) {
        while (this.remainingGcdTime > 0) {
            this.oneCycle(cycleFunction);
        }
    }

    /**
     * Whether or not the given ability is off cooldown/has charges right now.
     *
     * @param ability
     */
    isReady(ability: Ability): boolean {
        if ('gcd' in ability) {
            return this.cdTracker.canUse(ability, this.nextGcdTime);
        }
        else {
            return this.cdTracker.canUse(ability);
        }
    }

    private makeBuffController(buff: Buff): BuffController {
        const outer = this;
        return {
            removeStatus(buff: Buff): void {
                outer.removeBuff(buff);
            },
            removeSelf(): void {
                this.removeStatus(buff);
            },
            modifyStacks(buff: Buff, stacks: number): void {
                outer.modifyBuffStacks(buff, stacks)
            },
            modifyStacksSelf(stacks: number): void {
                this.modifyStacks(buff, stacks);
            }
        }
    }

    private beforeAbility<X extends Ability>(originalAbility: X, buffs: Buff[]): X {
        let ability: X = originalAbility;
        for (const buff of buffs) {
            if ('beforeAbility' in buff) {
                const modified: X | void = buff.beforeAbility(this.makeBuffController(buff), ability);
                if (modified) {
                    ability = modified;
                }
            }
        }
        return ability;
    }

    private beforeSnapshot<X extends Ability>(originalAbility: X, buffs: Buff[]): X {
        let ability: X = originalAbility;
        for (const buff of buffs) {
            if ('beforeSnapshot' in buff) {
                const modified: X | void = buff.beforeSnapshot(this.makeBuffController(buff), ability);
                if (modified) {
                    ability = modified;
                }
            }
        }
        return ability;
    }

    private modifyDamage(originalDamage: DamageResult, ability: Ability, buffs: Buff[]): DamageResult {
        let damage: DamageResult = originalDamage;
        for (const buff of buffs) {
            if ('modifyDamage' in buff) {
                const modified: DamageResult | void = buff.modifyDamage(this.makeBuffController(buff), damage, ability);
                if (modified) {
                    damage = modified;
                }
            }
        }
        return damage;
    }

    private getComboTracker(key: ComboKey) {
        const tracker = this.comboTrackerMap.get(key);
        if (tracker) {
            return tracker;
        }
        const out = new ComboTracker(key);
        this.comboTrackerMap.set(key, out);
        return out;
    }


    private processCombo(ability: Ability): Ability {
        /*
            What this needs to do:
            Update combo tracker state for all existing combos in the map
            Add any new required combo trackers
            Finally, use the default 'all' data to update anything that was not already matched
         */
        let out = ability;
        const comboData: FinalizedComboData = completeComboData(ability);
        // TODO: current implementation has a weird corner case where you could have two conflicting 'continue' cases,
        // but is this really a problem?
        const seen = [];
        for (const combo of comboData.combos) {
            const key = combo.comboKey;
            seen.push(key);
            const tracker = this.getComboTracker(key);
            out = updateComboTracker(combo, out, tracker);
        }
        for (const entry of this.comboTrackerMap.entries()) {
            const combo = comboData.others;
            if (!seen.includes(entry[0])) {
                const tracker = entry[1];
                out = updateComboTracker(combo, out, tracker);
            }
        }
        return out;
    }
}

export type SpecialRecord = {
    usedAt: number,
    label: string
}

export type AbilityUseRecordUnf = UsedAbility | PartiallyUsedAbility;

export type DisplayRecordUnf = AbilityUseRecordUnf | SpecialRecord;

export type DisplayRecordFinalized = FinalizedAbility | SpecialRecord;

export interface CycleSimResult extends SimResult {
    abilitiesUsed: readonly FinalizedAbility[],
    displayRecords: readonly DisplayRecordFinalized[],
    unbuffedPps: number,
    buffTimings: readonly BuffUsage[],
    totalDamage: ValueWithDev,
    mainDpsFull: ValueWithDev
}

export type ExternalCycleSettings<InternalSettingsType extends SimSettings> = {
    customSettings: InternalSettingsType;
    buffConfig: BuffSettingsExport;
    cycleSettings: CycleSettings;
    resultSettings: ResultSettings;
}

/**
 * Definition of a rotation.
 */
export type Rotation<CycleProcessorType = CycleProcessor> = {
    /**
     * The cycle time for this rotation
     */
    readonly cycleTime: number;
    /**
     * The rotation function for this rotation
     *
     * @param cp The CycleProcessor instance (or instance of a subclass)
     */
    apply(cp: CycleProcessorType): void;
}

export type ResultSettings = {
    stdDevs: number
}

export function defaultResultSettings(): ResultSettings {
    return {
        stdDevs: 0
    }
}

function updateComboTracker(combo: ComboData, ability: Ability, tracker: ComboTracker): Ability {
    let out = ability;
    switch (combo.comboBehavior) {
        case "start":
            tracker.lastComboAbility = ability;
            break;
        case "continue":
            if (tracker.lastComboAbility && tracker.lastComboAbility.id && combo.comboFrom.find(from => abilityEquals(from, tracker.lastComboAbility))) {
                tracker.lastComboAbility = ability;
                // Update the 'out' var with the new ability data
                out = {
                    ...out,
                    ...combo
                };
                break;
            }
        // If the ability does not match, then fall through the same behavior as 'break'
        case "break":
            tracker.lastComboAbility = null;
            break;
        case "nobreak":
            // Do nothing
            break;
    }
    return out;
}

