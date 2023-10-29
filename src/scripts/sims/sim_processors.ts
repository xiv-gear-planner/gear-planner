import {ComputedSetStats} from "../geartypes";
import {applyDhCrit, baseDamage} from "../xivmath";
import {
    Ability,
    Buff,
    ComputedDamage,
    DamagingAbility,
    GcdAbility,
    OgcdAbility,
    PartiallyUsedAbility,
    UsedAbility
} from "./sim_types";
import {
    CAST_SNAPSHOT_PRE,
    CASTER_TAX,
    NORMAL_GCD,
    STANDARD_ANIMATION_LOCK,
    STANDARD_APPLICATION_DELAY
} from "../xivconstants";

function appDelay(ability: Ability) {
    let delay = STANDARD_APPLICATION_DELAY;
    if (ability.type === 'gcd') {
        delay += Math.max(0, (ability.cast ?? 0) - CAST_SNAPSHOT_PRE);
    }
    return delay;
}

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
        while (this.nextGcdTime < useUntil && this.nextGcdTime < this.cycleTime) {
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
        // We need to calculate our buff set twice. The first is because buffs may affect the cast and/or recast time.
        const preBuffs = this.getActiveBuffs();
        const preCombinedEffects: CombinedBuffEffect = combineBuffEffects(preBuffs);
        const abilityGcd = ability.fixedGcd ? ability.gcd : (this.stats.gcdMag(ability.gcd ?? this.gcdBase, preCombinedEffects.haste));
        const snapshotsAt = ability.cast ? Math.max(this.currentTime, this.currentTime + ability.cast - CAST_SNAPSHOT_PRE) : this.currentTime;
        // When this GCD will end (strictly in terms of GCD. e.g. a BLM spell where cast > recast will still take the cast time. This will be
        // accounted for later).
        const gcdFinishedAt = this.currentTime + abilityGcd;
        const animLock = ability.cast ? Math.max(ability.cast + CASTER_TAX, STANDARD_ANIMATION_LOCK) : STANDARD_ANIMATION_LOCK;
        const animLockFinishedAt = this.currentTime + animLock;
        this.currentTime = snapshotsAt;
        if (ability.activatesBuffs) {
            ability.activatesBuffs.forEach(buff => this.activateBuff(buff));
        }
        const buffs = this.getActiveBuffs();
        const combinedEffects: CombinedBuffEffect = combineBuffEffects(buffs);
        // Enough time for entire GCD
        if (gcdFinishedAt <= this.cycleTime) {
            this.usedAbilities.push({
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
                usedAt: this.currentTime,
                damage: abilityToDamage(this.stats, ability, preCombinedEffects),
                appDelayFromStart: appDelay(ability)
            });
            // Anim lock OR cast time, both effectively block use of skills.
            // If cast time > GCD recast, then we use that instead. Also factor in caster tax.
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
                buffs: preBuffs,
                combinedEffects: preCombinedEffects,
                usedAt: this.nextGcdTime,
                portion: portion,
                damage: abilityToDamage(this.stats, ability, preCombinedEffects, portion),
                appDelayFromStart: appDelay(ability)
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
        if (ability.activatesBuffs) {
            ability.activatesBuffs.forEach(buff => this.activateBuff(buff));
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
                appDelayFromStart: appDelay(ability)
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
                appDelayFromStart: appDelay(ability)
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

export class CycleContext {

    currentTime: number = 0;
    nextGcdTime: number = 0;
    readonly cycleTime: number;
    readonly overallEndTime: number;
    readonly usedAbilities: (UsedAbility | PartiallyUsedAbility)[] = [];
    readonly buffTimes: Map<Buff, number>;
    readonly stats: ComputedSetStats;
    readonly gcdBase: number;
    readonly cycleNumber: number;

    constructor(mcp: MultiCycleProcessor) {
        this.cycleTime = mcp.cycleTime;
        this.overallEndTime = mcp.totalTime - mcp.nextGcdTime;
        this.buffTimes = new Map<Buff, number>(mcp.buffTimes);
        this.gcdBase = mcp.gcdBase;
        this.stats = mcp.stats;
        this.cycleNumber = mcp.currentCycle;
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
        while (this.nextGcdTime < useUntil && this.nextGcdTime < this.cycleTime && this.nextGcdTime < this.overallEndTime) {
            this.use(ability);
        }
    }

    useGcd(ability: GcdAbility) {
        if (this.nextGcdTime > this.cycleTime || this.nextGcdTime >= this.overallEndTime) {
            // Already over time limit. Ignore completely.
            return;
        }
        if (this.nextGcdTime > this.currentTime) {
            this.currentTime = this.nextGcdTime;
        }
        // We need to calculate our buff set twice. The first is because buffs may affect the cast and/or recast time.
        const gcdStartsAt = this.currentTime;
        const preBuffs = this.getActiveBuffs();
        const preCombinedEffects: CombinedBuffEffect = combineBuffEffects(preBuffs);
        const abilityGcd = ability.fixedGcd ? ability.gcd : (this.stats.gcdMag(ability.gcd ?? this.gcdBase, preCombinedEffects.haste));
        const snapshotsAt = ability.cast ? Math.max(this.currentTime, this.currentTime + ability.cast - CAST_SNAPSHOT_PRE) : this.currentTime;
        // When this GCD will end (strictly in terms of GCD. e.g. a BLM spell where cast > recast will still take the cast time. This will be
        // accounted for later).
        const gcdFinishedAt = this.currentTime + abilityGcd;
        const animLock = ability.cast ? Math.max(ability.cast + CASTER_TAX, STANDARD_ANIMATION_LOCK) : STANDARD_ANIMATION_LOCK;
        const animLockFinishedAt = this.currentTime + animLock;
        this.currentTime = snapshotsAt;
        if (ability.activatesBuffs) {
            ability.activatesBuffs.forEach(buff => this.activateBuff(buff));
        }
        const buffs = this.getActiveBuffs();
        const combinedEffects: CombinedBuffEffect = combineBuffEffects(buffs);
        // Enough time for entire GCD
        if (gcdFinishedAt <= this.overallEndTime) {
            this.usedAbilities.push({
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
                damage: abilityToDamage(this.stats, ability, preCombinedEffects),
                appDelayFromStart: appDelay(ability)
            });
            // Anim lock OR cast time, both effectively block use of skills.
            // If cast time > GCD recast, then we use that instead. Also factor in caster tax.
            this.currentTime = animLockFinishedAt;
            // If we're casting a long-cast, then the GCD is blocked for more than a GCD.
            this.nextGcdTime = Math.max(gcdFinishedAt, animLockFinishedAt);
        }
        // GCD will only partially fit into remaining time. Pro-rate the damage.
        else {
            const remainingTime = this.overallEndTime - this.nextGcdTime;
            const portion = remainingTime / abilityGcd;
            this.usedAbilities.push({
                ability: ability,
                buffs: preBuffs,
                combinedEffects: preCombinedEffects,
                usedAt: this.nextGcdTime,
                portion: portion,
                damage: abilityToDamage(this.stats, ability, preCombinedEffects, portion),
                appDelayFromStart: appDelay(ability)
            });
            this.nextGcdTime = this.overallEndTime;
            this.currentTime = this.overallEndTime;
        }

    }

    useOgcd(ability: OgcdAbility) {
        if (this.currentTime > this.cycleTime || this.currentTime > this.overallEndTime) {
            // Already over time limit. Ignore completely.
            return;
        }
        if (ability.activatesBuffs) {
            ability.activatesBuffs.forEach(buff => this.activateBuff(buff));
        }
        const buffs = this.getActiveBuffs();
        const combinedEffects: CombinedBuffEffect = combineBuffEffects(buffs);
        // Similar logic to GCDs, but with animation lock alone
        const animLock = ability.animationLock ?? STANDARD_ANIMATION_LOCK;
        const animLockFinishedAt = animLock + this.currentTime;
        // Fits completely
        if (animLockFinishedAt <= this.overallEndTime) {
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                combinedEffects: combinedEffects,
                usedAt: this.currentTime,
                damage: abilityToDamage(this.stats, ability, combinedEffects),
                appDelayFromStart: appDelay(ability)
            });
            this.currentTime = animLockFinishedAt;
            // Account for potential GCD clipping
            this.nextGcdTime = Math.max(this.nextGcdTime, animLockFinishedAt);
        }
        // fits partially
        else {
            const remainingTime = this.cycleTime - this.overallEndTime;
            const portion = remainingTime / animLock;
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                combinedEffects: combinedEffects,
                usedAt: this.currentTime,
                portion: portion,
                damage: abilityToDamage(this.stats, ability, combinedEffects, portion),
                appDelayFromStart: appDelay(ability)
            });
            this.nextGcdTime = this.cycleTime;
            this.currentTime = this.cycleTime;
        }

    }

}

export type MultiCycleSettings = {
    readonly totalTime: number,
    readonly cycleTime: number,
    readonly allBuffs: Buff[],
    readonly manuallyActivatedBuffs?: Buff[],
    readonly stats: ComputedSetStats,
}

export type CycleFunction = (cycle: CycleContext) => void

export class MultiCycleProcessor {

    nextGcdTime: number = 0;
    /**
     * The current cycle number. -1 is pre-pull, 0 is the first cycle, etc
     */
    currentCycle: number = -1;
    currentTime: number = 0;
    gcdBase: number = NORMAL_GCD;
    readonly cycleTime: number;
    readonly usedAbilities: (UsedAbility | PartiallyUsedAbility)[] = [];
    readonly buffTimes = new Map<Buff, number>();
    readonly totalTime: number;
    readonly stats: ComputedSetStats;

    constructor(settings: MultiCycleSettings) {
        this.cycleTime = settings.cycleTime;
        this.totalTime = settings.totalTime;
        this.stats = settings.stats;
        settings.allBuffs.forEach(buff => {
            if (settings.manuallyActivatedBuffs && settings.manuallyActivatedBuffs.includes(buff)) {
                return;
            }
            if (buff.startTime !== undefined) {
                this.buffTimes.set(buff, buff.startTime);
            }
        });
    }

    // prePull(cycleFunction: CycleFunction) {
    //     if (this.currentCycle >= 0) {
    //         throw new Error("Cannot do a pre-pull cycle once a normal cycle has been done");
    //     }
    //     const ctx = new CycleContext(this);
    //     cycleFunction(ctx);
    //     if (ctx.usedAbilities.length === 0) {
    //         // Nothing was actually used
    //         return;
    //     }
    //     const last = ctx.usedAbilities[ctx.usedAbilities.length - 1];
    //
    //     ctx.usedAbilities.map(used => {
    //         this.usedAbilities.push({
    //             ...used,
    //             // CycleContext's '0' is the start of the cycle, but we want that to be an absolute time
    //             usedAt: used.usedAt + startAt,
    //         });
    //     });
    //     this.currentCycle++;
    // }

    oneCycle(cycleFunction: CycleFunction) {
        if (this.currentCycle < 0) {
            this.currentCycle = 0;
        }
        const ctx = new CycleContext(this);
        const startAt = this.currentTime;
        cycleFunction(ctx);
        // TODO: make some kind of 'marker' for this
        this.usedAbilities.push({
            ability: {
                type: "ogcd",
                name: "Start of Cycle",
                potency: null,
            },
            buffs: [],
            combinedEffects: combineBuffEffects([]),
            damage: {
                expected: 0,
            },
            portion: 0,
            usedAt: startAt,
            appDelayFromStart: 0
        });
        if (ctx.usedAbilities.length > 0) {
            // TODO: this logic doesn't work. If we want a 120s cycle, that needs to be 120 *plus* pre-pull stuff, so
            // pre-pull logic needs to be included within the cycler. Once we're at this point, it's too late to fix
            // anything.
            let prepullGcdOffset = 0;
            if (this.currentCycle === 0) {
                const firstDamagingAbility = ctx.usedAbilities.find(ability => ability.ability.potency !== null);
                if (firstDamagingAbility !== undefined) {
                    prepullGcdOffset = -firstDamagingAbility.appDelayFromStart;
                }
            }
            ctx.usedAbilities.map(used => {
                this.usedAbilities.push({
                    ...used,
                    // CycleContext's '0' is the start of the cycle, but we want that to be an absolute time
                    usedAt: used.usedAt + startAt + prepullGcdOffset,
                });
            });
        }
        // TODO: why 3x
        // Looks like it happens extra times during table initialization
        console.log("Cycle complete", this.currentCycle, this.currentTime, ctx.currentTime, ctx.nextGcdTime, ctx.overallEndTime);
        this.nextGcdTime += ctx.nextGcdTime;
        this.currentTime += ctx.nextGcdTime;
        this.currentCycle++;

    }

    remainingCycles(cycleFunction: CycleFunction) {
        while (this.nextGcdTime < this.totalTime) {
            this.oneCycle(cycleFunction);
        }
    }
}
