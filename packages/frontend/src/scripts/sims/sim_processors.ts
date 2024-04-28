import {ComputedSetStats} from "@xivgear/xivmath/geartypes";
import {applyDhCrit, baseDamage} from "@xivgear/xivmath/xivmath";
import {
    Ability,
    AutoAttack,
    Buff,
    BuffController,
    ComputedDamage,
    Cooldown,
    DamagingAbility,
    DotDamageUnf,
    FinalizedAbility,
    GcdAbility,
    OgcdAbility,
    PartiallyUsedAbility,
    PartyBuff,
    UsedAbility
} from "./sim_types";
import {
    AUTOATTACK_APPLICATION_DELAY,
    CAST_SNAPSHOT_PRE,
    CASTER_TAX,
    JobName,
    NORMAL_GCD,
    STANDARD_ANIMATION_LOCK,
    STANDARD_APPLICATION_DELAY
} from "@xivgear/xivmath/xivconstants";
import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {BuffSettingsArea, BuffSettingsExport, BuffSettingsManager} from "./party_comp_settings";
import {CycleSettings, defaultCycleSettings, rehydrate} from "./cycle_settings";
import {CharacterGearSet} from "../gear";
import {cycleSettingsGui} from "./components/cycle_settings_components";
import {writeProxy} from "../util/proxies";
import {AbilitiesUsedTable} from "./components/ability_used_table";
import {quickElement} from "../components/util";
import {sum} from "../util/array_utils";
import {CooldownMode, CooldownTracker} from "./common/cooldown_manager";

/**
 * Returns the application delay of an ability (from time of snapshot to time of damage/effects applying).
 *
 * @param ability The ability in question
 */
function appDelay(ability: Ability) {
    let delay = STANDARD_APPLICATION_DELAY;
    // TODO: add application delay field to Ability
    return delay;
}


export type CombinedBuffEffect = {
    dmgMod: number,
    critChanceIncrease: number,
    dhitChanceIncrease: number,
    forceCrit: boolean,
    forceDhit: boolean
    haste: number,
}

export function combineBuffEffects(buffs: Buff[]): CombinedBuffEffect {
    const combinedEffects: CombinedBuffEffect = {
        dmgMod: 1,
        critChanceIncrease: 0,
        dhitChanceIncrease: 0,
        forceCrit: false,
        forceDhit: false,
        haste: 0,
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
        if (buff.effects.forceCrit) {
            combinedEffects.forceCrit = true;
        }
        if (buff.effects.forceDhit) {
            combinedEffects.forceDhit = true;
        }
    }
    return combinedEffects;
}

function dotPotencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect): ComputedDamage {
    const modifiedStats = {...stats};
    modifiedStats.critChance += combinedBuffEffects.critChanceIncrease;
    modifiedStats.dhitChance += combinedBuffEffects.dhitChanceIncrease;
    // TODO: are there any dots with auto-crit or auto-dh?
    const forceDh = false;
    const forceCrit = false;
    const nonCritDmg = baseDamage(modifiedStats, potency, dmgAbility.attackType, forceDh, forceCrit, true);
    const afterCritDh = applyDhCrit(nonCritDmg, modifiedStats);
    const afterDmgBuff = afterCritDh * combinedBuffEffects.dmgMod;
    return {
        expected: afterDmgBuff,
    }
}

function potencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect): ComputedDamage {
    const modifiedStats = {...stats};
    modifiedStats.critChance += combinedBuffEffects.critChanceIncrease;
    modifiedStats.dhitChance += combinedBuffEffects.dhitChanceIncrease;
    const forceDhit = dmgAbility.autoDh || combinedBuffEffects.forceDhit;
    const forceCrit = dmgAbility.autoCrit || combinedBuffEffects.forceCrit;
    const nonCritDmg = baseDamage(modifiedStats, potency, dmgAbility.attackType, forceDhit, forceCrit);
    const afterCritDh = applyDhCrit(nonCritDmg, {
        ...modifiedStats,
        critChance: forceCrit ? 1 : modifiedStats.critChance,
        dhitChance: forceDhit ? 1 : modifiedStats.dhitChance,
    });
    const afterDmgBuff = afterCritDh * combinedBuffEffects.dmgMod;
    return {
        expected: afterDmgBuff,
    }
}

export function abilityToDamage(stats: ComputedSetStats, ability: Ability, combinedBuffEffects: CombinedBuffEffect, portion: number = 1): ComputedDamage {
    const basePot = ability.potency;
    if (!ability.potency) {
        return {
            expected: 0
        }
    }
    else {
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

export type DamageResult = {
    readonly directDamage: ComputedDamage | null,
    readonly dot: DotDamageUnf | null
}

export function abilityToDamageNew(stats: ComputedSetStats, ability: Ability, combinedBuffEffects: CombinedBuffEffect): DamageResult {
    if (!('potency' in ability)) {
        return {
            directDamage: null,
            dot: null
        }
    }
    return {
        directDamage: ability.potency ? potencyToDamage(stats, ability.potency, ability as DamagingAbility, combinedBuffEffects) : null,
        dot: 'dot' in ability ? {
            fullDurationTicks: ability.dot.duration / 3,
            damagePerTick: dotPotencyToDamage(stats, ability.dot.tickPotency, ability, combinedBuffEffects),
        } : null,
    }

}

export class CycleContext {

    cycleStartedAt: number;
    readonly cycleTime: number;
    readonly fightTimeRemainingAtCycleStart: number;
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

    get overallFightTime() {
        return this.mcp.currentTime;
    }

    get maxTime() {
        return Math.min(this.cycleTime, this.fightTimeRemainingAtCycleStart);
    }

    get cycleRemainingTime() {
        return Math.max(0, this.cycleStartedAt + this.maxTime - this.mcp.currentTime);
    }

    get cycleRemainingGcdTime() {
        return Math.max(0, this.cycleStartedAt + this.maxTime - this.mcp.nextGcdTime);
    }

    get fightRemainingTime() {
        return this.mcp.remainingTime;
    }

    get fightRemainingGcdTime() {
        return this.mcp.remainingGcdTime;
    }


    /**
     * Get the buffs that would be active right now.
     */
    getActiveBuffs(): Buff[] {
        return this.mcp.getActiveBuffs();
    }

    activateBuff(buff: Buff) {
        this.mcp.activateBuff(buff);
    }

    // /**
    //  * How many GCDs have been used this cycle
    //  */
    // gcdCount() {
    //     return this.usedAbilities.filter(used => used.ability['type'] == 'gcd').length;
    // }

    use(ability: Ability): AbilityUseResult {
        const use = this.mcp.use(ability);
        this.recheckPrepull();
        return use;
    }

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

    useGcd(ability: GcdAbility): AbilityUseResult {
        const useGcd = this.mcp.useGcd(ability);
        this.recheckPrepull();
        return useGcd;
    }

    useOgcd(ability: OgcdAbility): AbilityUseResult {
        const useOgcd = this.mcp.useOgcd(ability);
        this.recheckPrepull();
        return useOgcd;
    }
}

export type AbilityUseResult = 'full' | 'partial' | 'none';

export type MultiCycleSettings = {
    readonly totalTime: number,
    readonly cycleTime: number,
    readonly allBuffs: PartyBuff[],
    readonly manuallyActivatedBuffs?: PartyBuff[],
    readonly stats: ComputedSetStats,
    readonly useAutos: boolean
}

export type CycleFunction = (cycle: CycleContext) => void

export const isAbilityUse = (record: DisplayRecordUnf): record is AbilityUseRecordUnf => 'ability' in record;
export const isFinalizedAbilityUse = (record: DisplayRecordFinalized): record is FinalizedAbility => 'original' in record;

interface BuffUsage {
    readonly buff: Buff,
    readonly start: number,
    end: number,
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
type CycleLengthMode = 'align-absolute'
    | 'align-to-first'
    | 'full-duration';

export type CycleInfo = {
    readonly cycleNum: number,
    start: number,
    end: number | null,
}

export class CycleProcessor {

    /**
     * The current cycle number. -1 is pre-pull, 0 is the first cycle, etc
     */
    currentCycle: number = -1;
    currentTime: number = 0;
    nextGcdTime: number = 0;
    nextAutoAttackTime: number = 0;
    pendingPrePullOffset: number = 0;
    totalPrePullOffset: number = 0;
    gcdBase: number = NORMAL_GCD;
    readonly cycleTime: number;
    readonly allRecords: DisplayRecordUnf[] = [];
    readonly buffTimes = new Map<PartyBuff, number>();
    readonly buffHistory: BuffUsage[] = [];
    readonly totalTime: number;
    readonly stats: ComputedSetStats;
    readonly dotMap = new Map<number, UsedAbility>();
    private readonly manuallyActivatedBuffs: readonly PartyBuff[];
    combatStarted: boolean = false;
    readonly useAutos: boolean;
    readonly cdTracker: CooldownTracker;
    private _cdEnforcementMode: CooldownMode;
    cycleLengthMode: CycleLengthMode = 'align-absolute';
    private firstCycleStartTime: number = 0;
    private cycles: CycleInfo[] = [];

    constructor(private settings: MultiCycleSettings) {
        // TODO: set enforcement mode
        this.cdTracker = new CooldownTracker(() => this.currentTime);
        this._cdEnforcementMode = 'warn';
        this.cycleTime = settings.cycleTime;
        this.totalTime = settings.totalTime;
        this.stats = settings.stats;
        this.manuallyActivatedBuffs = settings.manuallyActivatedBuffs ?? [];
        this.useAutos = settings.useAutos;
    }

    get cdEnforcementMode(): CooldownMode {
        return this._cdEnforcementMode;
    }

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
            end: startTime + buff.duration,
            forceEnd: false
        });
    }

    removeBuff(buff: Buff) {
        const activeUsages = this.getActiveBuffsData().filter(buffHist => {
            return buffHist.buff === buff;
        });
        activeUsages.forEach(au => {
            au.end = this.currentTime;
            au.forceEnd = true;
        });
    }

    isBuffAutomatic(buff: Buff): buff is PartyBuff {
        if ('cooldown' in buff) {
            return !this.manuallyActivatedBuffs.includes(buff);
        }
        return false;
    }

    get remainingTime() {
        // If you set the duration to 10 seconds, but you do 20 seconds of pre-pull stuff, then you would end up
        // never starting combat.
        if (!this.combatStarted) {
            return this.totalTime;
        }
        return Math.max(0, this.totalTime - this.currentTime);
    }

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

    // TODO: somehow convey on the UI when a buff is active but not applicable, e.g. a haste buff does nothing
    // for an oGCD
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

    addSpecialRow(message: string, time?: number) {
        this.allRecords.push({
            usedAt: time ?? this.currentTime,
            label: message,
        } satisfies SpecialRecord);
    }

    get usedAbilities(): readonly AbilityUseRecordUnf[] {
        return this.allRecords.filter(isAbilityUse);
    }

    get finalizedRecords(): readonly DisplayRecordFinalized[] {
        this.finalize();
        return (this.allRecords.map(record => {
            if (isAbilityUse(record)) {

                const partialRate = record.totalTimeTaken > 0 ? Math.max(0, Math.min(1, (this.totalTime - record.usedAt) / record.totalTimeTaken)) : 1;
                const directDamage = record.directDamage.expected * partialRate;
                const dot = record.dot;
                const dotDmg = dot ? dot.damagePerTick.expected * dot.actualTickCount : 0;
                const totalDamage = directDamage + dotDmg;
                const totalPotency = record.ability.potency + ('dot' in record.ability ? record.ability.dot.tickPotency * record.dot.actualTickCount : 0);
                return {
                    usedAt: record.usedAt,
                    original: record,
                    partialRate: partialRate == 1 ? null : partialRate,
                    directDamage: directDamage,
                    dotInfo: dot,
                    totalDamage: totalDamage,
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

    use(ability: Ability): AbilityUseResult {
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
        const preBuffs = this.getActiveBuffsFor(ability);
        const preCombinedEffects: CombinedBuffEffect = combineBuffEffects(preBuffs);
        // noinspection AssignmentToFunctionParameterJS
        ability = this.beforeAbility(ability, preBuffs);
        const abilityGcd = isGcd ? (this.gcdTime(ability as GcdAbility, preCombinedEffects.haste)) : 0;
        this.markCd(ability, preCombinedEffects.haste);
        const effectiveCastTime: number | null = ability.cast ? this.castTime(ability, preCombinedEffects.haste) : null;
        const snapshotDelayFromStart = effectiveCastTime ? Math.max(0, effectiveCastTime - CAST_SNAPSHOT_PRE) : 0;
        const snapshotsAt = this.currentTime + snapshotDelayFromStart;
        // When this GCD will end (strictly in terms of GCD. e.g. a BLM spell where cast > recast will still take the cast time. This will be
        // accounted for later).
        const gcdFinishedAt = this.currentTime + abilityGcd;
        const animLock = ability.animationLock ?? STANDARD_ANIMATION_LOCK;
        const effectiveAnimLock = effectiveCastTime ? Math.max(effectiveCastTime + CASTER_TAX, animLock) : animLock;
        const animLockFinishedAt = this.currentTime + effectiveAnimLock;
        this.advanceTo(snapshotsAt, true);
        const buffs = this.getActiveBuffsFor(ability);
        const combinedEffects: CombinedBuffEffect = combineBuffEffects(buffs);
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
            directDamage: dmgInfo.directDamage ?? {expected: 0},
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
        // e.g. SCH chain into ED, just force everything to apply no later than the animation lock.
        // At this specific point in time, we are exactly at the snapshot. Thus, the remaining application delay
        // is the snapshot-to-application delta only, and the animation lock also needs to have the time so far
        // subtracted.
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

    useUntil(ability: GcdAbility, useUntil: number) {
        this.useWhile(ability, () => this.nextGcdTime < useUntil);
    }

    useWhile(ability: GcdAbility, useWhile: () => boolean) {
        while (useWhile() && this.remainingGcdTime > 0) {
            // TODO: when using align-first or align-full mode, and doing your pre-pull within a cycle, this needs to
            //  be able to account for the time shift that occurs when the pre-pull offset is applied.
            this.use(ability);
        }
    }

    get aaDelay(): number {
        return this.stats.weaponDelay;
    }

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
        const aaAbility: AutoAttack = {
            attackType: 'Auto-attack',
            type: 'autoattack',
            name: 'Auto Attack',
            potency: this.stats.jobStats.aaPotency
        };
        const buffs = this.getActiveBuffsFor(aaAbility);
        const dmgInfo = abilityToDamageNew(this.stats, aaAbility, combineBuffEffects(buffs));
        const delay = AUTOATTACK_APPLICATION_DELAY;
        this.addAbilityUse({
            usedAt: this.currentTime,
            ability: aaAbility,
            directDamage: dmgInfo.directDamage,
            buffs: buffs,
            combinedEffects: combineBuffEffects(buffs),
            totalTimeTaken: 0,
            appDelay: delay,
            appDelayFromStart: delay,
            castTimeFromStart: 0,
            snapshotTimeFromStart: 0,
            lockTime: 0
        });
        this.nextAutoAttackTime = this.currentTime + this.aaDelay;
    }

    useGcd(ability: GcdAbility): AbilityUseResult {
        return this.use(ability);
    }

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
        })
        this.pendingPrePullOffset = 0;
        // TODO: this will need to be updated to account for pre-pull self-buffs
        if (this.combatStarting) {
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
            if (dotId !== undefined) {
                const existing = this.dotMap.get(dotId);
                if (existing) {
                    const currentTick = Math.floor((usedAbility.usedAt + usedAbility.appDelayFromStart) / 3);
                    const oldTick = Math.floor((existing.usedAt + existing.appDelayFromStart) / 3);
                    const tickCount = Math.min(currentTick - oldTick, existing.dot.fullDurationTicks);
                    existing.dot.actualTickCount = tickCount;
                }
                this.dotMap.set(dotId, usedAbility);
            }
        }
    }

    get cycleRecords() {
        return [...this.cycles];
    }

    private finalize() {
        this.dotMap.forEach((existing) => {
            const currentTick = Math.floor(Math.min(this.currentTime, this.totalTime) / 3);
            const oldTick = Math.floor((existing.usedAt + existing.appDelayFromStart) / 3);
            existing.dot.actualTickCount = Math.min(currentTick - oldTick, existing.dot.fullDurationTicks);
        });
    }

    castTime(ability: Ability, haste: number): number {
        const base = ability.cast;
        return ability.fixedGcd ? base :
            (ability.attackType == "Spell") ?
                (this.stats.gcdMag(base ?? this.gcdBase, haste)) :
                (this.stats.gcdPhys(base ?? this.gcdBase, haste));
    }

    gcdTime(ability: GcdAbility, haste: number): number {
        const base = ability.gcd;
        return ability.fixedGcd ? base :
            (ability.attackType == "Spell") ?
                (this.stats.gcdMag(base ?? this.gcdBase, haste)) :
                (this.stats.gcdPhys(base ?? this.gcdBase, haste));
    }

    /**
     * Inform the cooldown tracker that a CD has been used.
     *
     * @param ability The ability
     * @param haste Current haste value
     * @private
     */
    private markCd(ability: Ability, haste: number) {
        const cd = ability.cooldown;
        if (cd === undefined) {
            return;
        }
        const cdTime = this.cooldownTime(cd, haste);
        this.cdTracker.useAbility(ability, cdTime);
    }

    cooldownTime(cooldown: Cooldown, haste: number): number {
        switch (cooldown.reducedBy) {
            case undefined:
            case "none":
                return cooldown.time;
            case "spellspeed":
                return this.stats.gcdMag(cooldown.time, haste);
            case "skillspeed":
                return this.stats.gcdPhys(cooldown.time, haste);
        }
    }

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
                    const adjustedExpectedStartTime = expectedStartTime + this.firstCycleStartTime
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
        }
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


    remainingCycles(cycleFunction: CycleFunction) {
        while (this.remainingGcdTime > 0) {
            this.oneCycle(cycleFunction);
        }
    }

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
            }
        }
    }

    private beforeAbility<X extends Ability>(originalAbility: X, buffs: Buff[]): X {
        let ability: X = originalAbility;
        for (let buff of buffs) {
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
        for (let buff of buffs) {
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
        for (let buff of buffs) {
            if ('modifyDamage' in buff) {
                const modified: DamageResult | void = buff.modifyDamage(this.makeBuffController(buff), damage, ability);
                if (modified) {
                    damage = modified;
                }
            }
        }
        return damage;
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
    abilitiesUsed: readonly AbilityUseRecordUnf[],
    // TODO
    displayRecords: readonly DisplayRecordFinalized[],
    unbuffedPps: number,
    buffTimings: readonly BuffUsage[]
}

export type ExternalCycleSettings<InternalSettingsType extends SimSettings> = {
    customSettings: InternalSettingsType
    buffConfig: BuffSettingsExport;
    cycleSettings: CycleSettings;
}

export type Rotation<CycleProcessorType = CycleProcessor> = {
    readonly cycleTime: number;
    apply(cp: CycleProcessorType): void;
}

export abstract class BaseMultiCycleSim<ResultType extends CycleSimResult, InternalSettingsType extends SimSettings, CycleProcessorType extends CycleProcessor = CycleProcessor>
    implements Simulation<ResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>> {

    abstract displayName: string;
    abstract shortName: string;
    abstract spec: SimSpec<Simulation<ResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>>, ExternalCycleSettings<InternalSettingsType>>;
    readonly manuallyActivatedBuffs?: PartyBuff[];
    settings: InternalSettingsType;
    readonly buffManager: BuffSettingsManager;
    readonly cycleSettings: CycleSettings;
    readonly manualRun = false;

    protected constructor(job: JobName, settings?: ExternalCycleSettings<InternalSettingsType>) {
        this.settings = this.makeDefaultSettings();
        if (settings !== undefined) {
            Object.assign(this.settings, settings.customSettings ?? settings);
            this.buffManager = BuffSettingsManager.fromSaved(settings.buffConfig);
            this.cycleSettings = rehydrate(settings.cycleSettings);
        }
        else {
            this.cycleSettings = defaultCycleSettings();
            this.buffManager = BuffSettingsManager.defaultForJob(job);
        }
    }

    abstract makeDefaultSettings(): InternalSettingsType;

    exportSettings(): ExternalCycleSettings<InternalSettingsType> {
        return {
            customSettings: this.settings,
            buffConfig: this.buffManager.exportSetting(),
            cycleSettings: this.cycleSettings
        };
    }

    makeConfigInterface(settings: InternalSettingsType, updateCallback: () => void): HTMLElement {
        // TODO: need internal settings panel
        const div = document.createElement("div");
        div.appendChild(cycleSettingsGui(writeProxy(this.cycleSettings, updateCallback)));
        div.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        return div;
    }

    makeResultDisplay(result: ResultType): HTMLElement {
        const mainResultsTable = simpleAutoResultTable({
            mainDpsResult: result.mainDpsResult,
            unbuffedPps: result.unbuffedPps
        });
        mainResultsTable.classList.add('main-results-table');
        const abilitiesUsedTable = new AbilitiesUsedTable(result.displayRecords);
        return quickElement('div', ['cycle-sim-results-table'], [mainResultsTable, abilitiesUsedTable]);
    }

    makeToolTip(result: ResultType): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.unbuffedPps}\n`;
    }

    abstract getRotationsToSimulate(): Rotation<CycleProcessorType>[];

    protected createCycleProcessor(settings: MultiCycleSettings): CycleProcessorType {
        return new CycleProcessor(settings) as CycleProcessorType;
    };


    async simulate(set: CharacterGearSet): Promise<ResultType> {
        console.debug("Sim start");
        const allBuffs = this.buffManager.enabledBuffs;
        const rotations = this.getRotationsToSimulate();
        const allResults = rotations.map(rot => {
            const cp = this.createCycleProcessor({
                stats: set.computedStats,
                totalTime: this.cycleSettings.totalTime,
                cycleTime: rot.cycleTime,
                allBuffs: allBuffs,
                manuallyActivatedBuffs: this.manuallyActivatedBuffs ?? [],
                useAutos: (this.cycleSettings.useAutos ?? true) && set.getItemInSlot('Weapon') !== null
            });
            rot.apply(cp);

            const used = cp.finalizedRecords;
            const cycleDamage = sum(used.map(used => isFinalizedAbilityUse(used) ? used.totalDamage : 0));
            const dps = cycleDamage / cp.currentTime;
            const unbuffedPps = sum(used.map(used => isFinalizedAbilityUse(used) ? used.totalPotency : 0)) / cp.nextGcdTime;
            const buffTimings = [...cp.buffHistory];

            return {
                mainDpsResult: dps,
                abilitiesUsed: used,
                displayRecords: cp.finalizedRecords,
                unbuffedPps: unbuffedPps,
                buffTimings: buffTimings
                // TODO
            } as unknown as ResultType;
        });
        allResults.sort((a, b) => b.mainDpsResult - a.mainDpsResult);
        console.debug("Sim end");
        return allResults[0];
    };

}
