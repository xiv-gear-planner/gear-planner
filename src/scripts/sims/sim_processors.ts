import {ComputedSetStats} from "../geartypes";
import {applyDhCrit, baseDamage} from "../xivmath";
import {
    Ability, AutoAttack,
    Buff,
    ComputedDamage,
    DamagingAbility,
    DotDamageUnf,
    FinalizedAbility,
    GcdAbility,
    OgcdAbility,
    PartiallyUsedAbility,
    UsedAbility
} from "./sim_types";
import {
    CAST_SNAPSHOT_PRE,
    CASTER_TAX,
    JobName,
    NORMAL_GCD,
    STANDARD_ANIMATION_LOCK,
    STANDARD_APPLICATION_DELAY
} from "../xivconstants";
import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {BuffSettingsArea, BuffSettingsExport, BuffSettingsManager} from "./party_comp_settings";
import {CycleSettings, defaultCycleSettings} from "./cycle_settings";
import {CharacterGearSet} from "../gear";
import {cycleSettingsGui} from "./components/cycle_settings_components";
import {writeProxy} from "../util/proxies";
import {AbilitiesUsedTable} from "./components/ability_used_table";
import {quickElement} from "../components/util";
import {sum} from "../util/array_utils";

function appDelay(ability: Ability) {
    let delay = STANDARD_APPLICATION_DELAY;
    if (ability.type === 'gcd') {
        delay += Math.max(0, (ability.cast ?? 0) - CAST_SNAPSHOT_PRE);
    }
    return delay;
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

function dotPotencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect): ComputedDamage {
    const modifiedStats = {...stats};
    modifiedStats.critChance += combinedBuffEffects.critChanceIncrease;
    modifiedStats.dhitChance += combinedBuffEffects.dhitChanceIncrease;
    const nonCritDmg = baseDamage(modifiedStats, potency, dmgAbility.attackType, dmgAbility.autoDh ?? false, dmgAbility.autoCrit ?? false, true);
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
    const nonCritDmg = baseDamage(modifiedStats, potency, dmgAbility.attackType, dmgAbility.autoDh ?? false, dmgAbility.autoCrit ?? false);
    const afterCritDh = applyDhCrit(nonCritDmg, modifiedStats);
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

export function abilityToDamageNew(stats: ComputedSetStats, ability: Ability, combinedBuffEffects: CombinedBuffEffect): {
    'directDamage': ComputedDamage | null,
    'dot': DotDamageUnf | null
} {
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

    readonly cycleStartedAt: number;
    readonly cycleTime: number;
    readonly fightTimeRemainingAtCycleStart: number;
    readonly cycleNumber: number;
    readonly mcp: CycleProcessor;

    constructor(mcp: CycleProcessor, cycleTime: number) {
        this.cycleTime = cycleTime;
        this.cycleStartedAt = mcp.currentTime;
        this.fightTimeRemainingAtCycleStart = mcp.totalTime - mcp.currentTime;
        this.cycleNumber = mcp.currentCycle;
        this.mcp = mcp;
    }

    get overallFightTime() {
        return this.mcp.currentTime;
    }

    get maxTime() {
        return Math.min(this.cycleTime, this.fightTimeRemainingAtCycleStart);
    }

    get cycleRemainingTime() {
        return Math.max(0, this.maxTime - this.mcp.currentTime);
    }

    get cycleRemainingGcdTime() {
        return Math.max(0, this.maxTime - this.mcp.nextGcdTime);
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
        return this.mcp.use(ability);
    }

    useUntil(ability: GcdAbility, useUntil: number) {
        const correctedTime = Math.min(this.cycleStartedAt + useUntil, this.cycleStartedAt + this.cycleTime, this.mcp.totalTime);
        this.mcp.useUntil(ability, correctedTime);
    }

    useGcd(ability: GcdAbility): AbilityUseResult {
        return this.mcp.useGcd(ability);
    }

    useOgcd(ability: OgcdAbility): AbilityUseResult {
        return this.mcp.useOgcd(ability);
    }
}

export type AbilityUseResult = 'full' | 'partial' | 'none';

export type MultiCycleSettings = {
    readonly totalTime: number,
    readonly cycleTime: number,
    readonly allBuffs: Buff[],
    readonly manuallyActivatedBuffs?: Buff[],
    readonly stats: ComputedSetStats,
    readonly useAutos: boolean
}

export type CycleFunction = (cycle: CycleContext) => void

export const isAbilityUse = (record: DisplayRecordUnf): record is AbilityUseRecordUnf => 'ability' in record;
export const isFinalizedAbilityUse = (record: DisplayRecordFinalized): record is FinalizedAbility => 'original' in record;

interface BuffUsage {
    buff: Buff,
    start: number,
    end: number
}

export class CycleProcessor {

    /**
     * The current cycle number. -1 is pre-pull, 0 is the first cycle, etc
     */
    currentCycle: number = -1;
    currentTime: number = 0;
    nextGcdTime: number = 0;
    nextAutoAttackTime: number = 0;
    gcdBase: number = NORMAL_GCD;
    readonly cycleTime: number;
    readonly allRecords: DisplayRecordUnf[] = [];
    readonly buffTimes = new Map<Buff, number>();
    readonly buffHistory: BuffUsage[] = [];
    readonly totalTime: number;
    readonly stats: ComputedSetStats;
    readonly dotMap = new Map<number, UsedAbility>();
    private readonly manuallyActivatedBuffs: readonly Buff[];
    combatStarted: boolean = false;

    constructor(settings: MultiCycleSettings) {
        this.cycleTime = settings.cycleTime;
        this.totalTime = settings.totalTime;
        this.stats = settings.stats;
        this.manuallyActivatedBuffs = settings.manuallyActivatedBuffs ?? [];
        settings.allBuffs.forEach(buff => {
            if (this.isBuffAutomatic(buff)) {
                if (buff.startTime !== undefined) {
                    this.setBuffStartTime(buff, buff.startTime);
                }
            }
        });
    }

    /**
     * Set the time at which a buff will start
     *
     * @param buff      The buff
     * @param startTime The start time
     */
    setBuffStartTime(buff: Buff, startTime: number) {
        this.buffTimes.set(buff, startTime);
        this.buffHistory.push({
            buff: buff,
            start: startTime,
            end: startTime + buff.duration
        });
    }

    isBuffAutomatic(buff: Buff): boolean {
        return !this.manuallyActivatedBuffs.includes(buff);
    }

    get remainingTime() {
        return Math.max(0, this.totalTime - this.currentTime);
    }

    get remainingGcdTime() {
        return Math.max(0, this.totalTime - this.nextGcdTime);
    }

    /**
     * Manually mark a buff as being active now
     *
     * @param buff
     */
    activateBuff(buff: Buff) {
        this.setBuffStartTime(buff, this.currentTime);
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
            else if (this.isBuffAutomatic(buff)) {
                this.setBuffStartTime(buff, time + buff.cooldown);
            }
        });
        return activeBuffs;
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

    use(ability: Ability): AbilityUseResult {
        // Logic for GCDs
        if (ability.type == "gcd") {
            return this.useGcd(ability);
        }
        // oGCD logic branch
        else if (ability.type == 'ogcd') {
            return this.useOgcd(ability);
        }
        else {
            console.error("Unknown ability type", ability);
            return 'none';
        }
    }

    useUntil(ability: GcdAbility, useUntil: number) {
        while (this.nextGcdTime < useUntil && this.remainingGcdTime > 0) {
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
        if (pauseAutos) {
            this.nextAutoAttackTime += delta;
        }
        else {
            if (advanceTo >= this.nextAutoAttackTime && this.combatStarted) {
                this.currentTime = this.nextAutoAttackTime;
                this.recordAutoAttack();
            }
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
        const buffs = this.getActiveBuffs();
        const dmgInfo = abilityToDamageNew(this.stats, aaAbility, combineBuffEffects(buffs));
        this.addAbilityUse({
            usedAt: this.currentTime,
            ability: aaAbility,
            directDamage: dmgInfo.directDamage,
            buffs: buffs,
            combinedEffects: combineBuffEffects(buffs),
            totalTimeTaken: 0,
            appDelayFromStart: 0,
        });
        this.nextAutoAttackTime = this.currentTime + this.aaDelay;
    }

    useGcd(ability: GcdAbility): AbilityUseResult {
        if (this.remainingGcdTime <= 0) {
            // Already over time limit. Ignore completely.
            return 'none';
        }
        if (this.nextGcdTime > this.currentTime) {
            this.advanceTo(this.nextGcdTime);
        }
        // We need to calculate our buff set twice. The first is because buffs may affect the cast and/or recast time.
        const gcdStartsAt = this.currentTime;
        const preBuffs = this.getActiveBuffs();
        const preCombinedEffects: CombinedBuffEffect = combineBuffEffects(preBuffs);
        const abilityGcd = ability.fixedGcd ? ability.gcd :
            (ability.attackType == "Spell") ? 
                (this.stats.gcdMag(ability.gcd ?? this.gcdBase, preCombinedEffects.haste)) :
                (this.stats.gcdPhys(ability.gcd ?? this.gcdBase, preCombinedEffects.haste));
        const snapshotsAt = ability.cast ? Math.max(this.currentTime, this.currentTime + ability.cast - CAST_SNAPSHOT_PRE) : this.currentTime;
        // When this GCD will end (strictly in terms of GCD. e.g. a BLM spell where cast > recast will still take the cast time. This will be
        // accounted for later).
        const gcdFinishedAt = this.currentTime + abilityGcd;
        const animLock = ability.cast ? Math.max(ability.cast + CASTER_TAX, STANDARD_ANIMATION_LOCK) : STANDARD_ANIMATION_LOCK;
        const animLockFinishedAt = this.currentTime + animLock;
        this.advanceTo(snapshotsAt, true);
        if (ability.activatesBuffs) {
            ability.activatesBuffs.forEach(buff => this.activateBuff(buff));
        }
        const buffs = this.getActiveBuffs();
        const combinedEffects: CombinedBuffEffect = combineBuffEffects(buffs);
        // Enough time for entire GCD
        // if (gcdFinishedAt <= this.totalTime) {
        const dmgInfo = abilityToDamageNew(this.stats, ability, preCombinedEffects);
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
            appDelayFromStart: appDelay(ability),
            totalTimeTaken: Math.max(animLock, abilityGcd),
        });
        // Anim lock OR cast time, both effectively block use of skills.
        // If cast time > GCD recast, then we use that instead. Also factor in caster tax.
        this.advanceTo(animLockFinishedAt);
        // If we're casting a long-cast, then the GCD is blocked for more than a GCD.
        this.nextGcdTime = Math.max(gcdFinishedAt, animLockFinishedAt);
        this.addAbilityUse(usedAbility);
        // Workaround for auto-attacks after first ability
        this.advanceTo(this.currentTime);
        return 'full';
    }

    useOgcd(ability: OgcdAbility): AbilityUseResult {
        if (this.remainingTime <= 0) {
            // Already over time limit. Ignore completely.
            return 'none';
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
        // if (animLockFinishedAt <= this.totalTime) {
        const dmgInfo = abilityToDamageNew(this.stats, ability, combinedEffects);
        const usedAbility: UsedAbility = ({
            ability: ability,
            buffs: buffs,
            combinedEffects: combinedEffects,
            usedAt: this.currentTime,
            directDamage: dmgInfo.directDamage ?? {expected: 0},
            dot: dmgInfo.dot,
            totalTimeTaken: animLock,
            appDelayFromStart: appDelay(ability)
        });
        this.advanceTo(animLockFinishedAt);
        // Account for potential GCD clipping
        this.nextGcdTime = Math.max(this.nextGcdTime, animLockFinishedAt);
        this.addAbilityUse(usedAbility);
        return 'full';
    }

    private addAbilityUse(usedAbility: AbilityUseRecordUnf) {
        this.allRecords.push(usedAbility);
        // If this is a pre-pull ability, we can offset by the hardcast time and/or application delay
        if (!this.combatStarted && usedAbility.ability.potency !== null) {
            let prepullOffset = 0;
            const firstDamagingAbility = this.usedAbilities.find(ability => ability.ability.potency !== null);
            if (firstDamagingAbility !== undefined) {
                prepullOffset = -firstDamagingAbility.appDelayFromStart;
            }
            this.usedAbilities.forEach(used => {
                used.usedAt += prepullOffset;
            });
            this.combatStarted = true;
            this.currentTime += prepullOffset;
            this.nextGcdTime += prepullOffset;
            this.nextAutoAttackTime += prepullOffset;
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

    private finalize() {
        this.dotMap.forEach((existing) => {
            const currentTick = Math.floor(Math.min(this.currentTime, this.totalTime) / 3);
            const oldTick = Math.floor((existing.usedAt + existing.appDelayFromStart) / 3);
            existing.dot.actualTickCount = Math.min(currentTick - oldTick, existing.dot.fullDurationTicks);
        });
    }

    oneCycle(cycleFunction: CycleFunction) {
        if (this.currentCycle < 0) {
            this.currentCycle = 0;
        }
        const expectedStartTime = this.cycleTime * this.currentCycle;
        const actualStartTime = this.currentTime;
        const delta = actualStartTime - expectedStartTime;
        const ctx = new CycleContext(this, this.cycleTime - delta);
        // console.debug('Delta', delta);
        // TODO: make some kind of 'marker' for this
        this.allRecords.push({
            label: "-- Start of Cycle --",
            usedAt: this.currentTime,
        });
        cycleFunction(ctx);
        this.allRecords.push({
            label: "-- End of Cycle --",
            usedAt: this.currentTime,
        });
        this.currentCycle++;
    }

    remainingCycles(cycleFunction: CycleFunction) {
        while (this.remainingGcdTime > 0) {
            this.oneCycle(cycleFunction);
        }
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

export type Rotation = {
    readonly cycleTime: number;
    apply(cp: CycleProcessor);
}

export abstract class BaseMultiCycleSim<ResultType extends CycleSimResult, InternalSettingsType extends SimSettings>
    implements Simulation<ResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>> {

    abstract displayName: string;
    abstract shortName: string;
    abstract spec: SimSpec<Simulation<ResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>>, ExternalCycleSettings<InternalSettingsType>>;
    readonly manuallyActivatedBuffs?: Buff[];
    settings: InternalSettingsType;
    readonly buffManager: BuffSettingsManager;
    readonly cycleSettings: CycleSettings;

    protected constructor(job: JobName, settings?: ExternalCycleSettings<InternalSettingsType>) {
        this.settings = this.makeDefaultSettings();
        if (settings !== undefined) {
            Object.assign(this.settings, settings.customSettings ?? settings);
            this.buffManager = BuffSettingsManager.fromSaved(settings.buffConfig);
            this.cycleSettings = settings.cycleSettings ?? defaultCycleSettings();
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

    abstract getRotationsToSimulate(): Rotation[];

    async simulate(set: CharacterGearSet): Promise<ResultType> {
        console.log("Sim start");
        const allBuffs = this.buffManager.enabledBuffs;
        const rotations = this.getRotationsToSimulate();
        const allResults = rotations.map(rot => {
            const cp = new CycleProcessor({
                stats: set.computedStats,
                totalTime: this.cycleSettings.totalTime,
                cycleTime: rot.cycleTime,
                allBuffs: allBuffs,
                manuallyActivatedBuffs: this.manuallyActivatedBuffs ?? [],
                useAutos: this.cycleSettings.useAutos ?? true
            });
            rot.apply(cp);

            const used = cp.finalizedRecords;
            const cycleDamage = sum(used.map(used => isFinalizedAbilityUse(used) ? used.totalDamage : 0));
            const dps = cycleDamage / cp.nextGcdTime;
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
        console.log("Sim end");
        return allResults[0];
    };

}