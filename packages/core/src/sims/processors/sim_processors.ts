import {JOB_DATA, JobName} from "@xivgear/xivmath/xivconstants";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {arrayEq, sum} from "@xivgear/util/array_utils";
import {addValues, applyStdDev, multiplyFixed} from "@xivgear/xivmath/deviation";
import {PartyBuff, SimSettings, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";
import {
    CutoffMode,
    CycleProcessor,
    CycleSimResult,
    CycleSimResultFull,
    defaultResultSettings,
    ExternalCycleSettings,
    GaugeManager,
    isFinalizedAbilityUse,
    MultiCycleSettings,
    ResultSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {BuffSettingsManager} from "@xivgear/core/sims/common/party_comp_settings";

export type RotationCacheKey = (number | boolean | string)[];

export class NoopGaugeManager implements GaugeManager<unknown> {
    gaugeSnapshot(): {} {
        return {};
    }
}

/**
 * Cycle processor type to gauge manager type
 */
export type GaugeManagerTypeOf<C extends CycleProcessor> = C extends CycleProcessor<infer G> ? G : never;
/**
 * Cycle processor type to gauge state type
 */
export type GaugeStateTypeOf<C extends CycleProcessor> = C extends CycleProcessor<infer G> ? G : never;
/**
 * Gauge manager type to to gauge state type
 */
export type GaugeStateTypeOfMgr<C extends GaugeManager<unknown>> = C extends GaugeManager<infer G> ? G : never;

/**
 * Base class for a CycleProcessor based simulation. You should extend this class,
 * and provide your own generic types.
 */
export abstract class BaseMultiCycleSim<
    ResultType extends CycleSimResult,
    InternalSettingsType extends SimSettings,
    CycleProcessorType extends CycleProcessor = CycleProcessor<NoopGaugeManager>,
    FullResultType extends CycleSimResultFull<ResultType> = CycleSimResultFull<ResultType>,
    // GaugeManagerType extends GaugeManagerTypeOf<CycleProcessorType> = NoopGaugeManager,
> implements Simulation<FullResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>> {

    abstract displayName: string;
    abstract shortName: string;
    abstract spec: SimSpec<Simulation<FullResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>>, ExternalCycleSettings<InternalSettingsType>>;
    /**
     * Party buffs which would be activated automatically, but should be treated as manual due to being
     * associated with the class being simulated.
     */
    readonly manuallyActivatedBuffs?: PartyBuff[];
    settings: InternalSettingsType;
    /**
     * Manages party buff settings
     */
    readonly buffManager: BuffSettingsManager;
    /**
     * Manages generic cycle settings
     */
    readonly cycleSettings: CycleSettings;
    /**
     * Represents result settings, such as what std deviation to use as the main result
     */
    readonly resultSettings: ResultSettings;

    readonly manualRun = false;

    private cachedCycleProcessors: [string, CycleProcessorType][];
    private cachedRotationKey: RotationCacheKey | undefined;

    protected constructor(public readonly job: JobName, settings?: ExternalCycleSettings<InternalSettingsType>) {
        this.settings = this.makeDefaultSettings();
        if (settings !== undefined) {
            Object.assign(this.settings, settings.customSettings ?? settings);
            this.buffManager = BuffSettingsManager.fromSaved(settings.buffConfig);
            this.cycleSettings = this.rehydrateCycleSettings(settings.cycleSettings);
            this.resultSettings = settings.resultSettings ?? defaultResultSettings();
        }
        else {
            this.cycleSettings = this.defaultCycleSettings();
            this.buffManager = BuffSettingsManager.defaultForJob(job);
            this.resultSettings = defaultResultSettings();
        }
    }

    abstract makeDefaultSettings(): InternalSettingsType;

    exportSettings(): ExternalCycleSettings<InternalSettingsType> {
        return {
            customSettings: this.settings,
            buffConfig: this.buffManager.exportSetting(),
            cycleSettings: this.cycleSettings,
            resultSettings: this.resultSettings,
        };
    }

    /**
     * Whether or not autoattacks should be enabled by default for ths sim.
     *
     * The default implementation returns false for healers and casters, true for everyone else.
     */
    get useAutosByDefault(): boolean {
        const jobData = JOB_DATA[this.job];
        return jobData.role !== 'Healer' && jobData.role !== 'Caster';
    }

    get defaultCutoffMode(): CutoffMode {
        return 'prorate-gcd';
    }

    /**
     * Return the default settings for this sim. You can override this to provide your own custom
     * settings. It should respect {@link useAutosByDefault}
     */
    defaultCycleSettings(): CycleSettings {
        return {
            cycles: 6,
            totalTime: 6 * 120,
            which: 'totalTime',
            useAutos: this.useAutosByDefault,
            cutoffMode: this.defaultCutoffMode,
        };
    }

    rehydrateCycleSettings(imported: Partial<CycleSettings>): CycleSettings {
        const out = this.defaultCycleSettings();
        Object.assign(out, imported);
        return out;
    }

    /**
     * This is the main abstract method of this simulation type. You can specify one or more
     * rotations to simulate. The sim's result will be whichever rotation sims the highest.
     */
    abstract getRotationsToSimulate(set: CharacterGearSet): Rotation<CycleProcessorType>[];

    /**
     * If you are using a custom CycleProcessorType, you MUST override this method and have it return
     * an instance of your custom type. It is only implemented on the base class for the convenience of
     * simulations that are using the default CycleProcessor implementation.
     *
     * @param settings The settings
     * @return The CycleProcessor instance.
     * @protected
     */
    protected createCycleProcessor(settings: MultiCycleSettings): CycleProcessorType {
        return new CycleProcessor(settings) as CycleProcessorType;
    };


    generateRotations(set: CharacterGearSet, simple: boolean = false): [string, CycleProcessorType][] {

        const allBuffs = this.buffManager.enabledBuffs;
        const rotations = this.getRotationsToSimulate(set);
        return rotations.map((rot, index) => {

            const cp = this.createCycleProcessor({
                stats: set.computedStats,
                totalTime: this.cycleSettings.totalTime,
                cycleTime: rot.cycleTime,
                allBuffs: allBuffs,
                manuallyActivatedBuffs: this.manuallyActivatedBuffs ?? [],
                useAutos: (this.cycleSettings.useAutos ?? true) && set.getItemInSlot('Weapon') !== null,
                cutoffMode: this.cycleSettings.cutoffMode,
                simpleMode: simple,
            });
            rot.apply(cp);
            return [rot.name ?? `Unnamed #${index + 1}`, cp];
        });
    }

    calcDamageSimple(set: CharacterGearSet): number {
        const allResults = this.cachedCycleProcessors.map(item => {
            const cp = item[1];
            cp.stats = set.computedStats;
            const used = cp.finalizedRecords.filter(isFinalizedAbilityUse);
            const totalDamage = addValues(...used.map(used => used.totalDamageFull));
            const timeBasis = cp.finalizedTimeBasis;
            const dps = multiplyFixed(totalDamage, 1.0 / timeBasis);

            return applyStdDev(dps, this.resultSettings.stdDevs ?? 0);
        });
        const sorted = [...allResults];
        sorted.sort((a, b) => b - a);
        console.debug("Sim end");
        const best = sorted[0];
        return best;
    }

    calcDamage(set: CharacterGearSet): FullResultType {
        const allResults = this.cachedCycleProcessors.map(item => {
            const [label, cp] = item;

            cp.stats = set.computedStats;
            const used = cp.finalizedRecords.filter(isFinalizedAbilityUse);
            const totalDamage = addValues(...used.map(used => used.totalDamageFull));
            const timeBasis = cp.finalizedTimeBasis;
            const dps = multiplyFixed(totalDamage, 1.0 / timeBasis);
            const unbuffedPps = sum(used.map(used => used.totalPotency)) / cp.nextGcdTime;
            const buffTimings = [...cp.buffHistory];

            return {
                mainDpsResult: applyStdDev(dps, this.resultSettings.stdDevs ?? 0),
                totalDamage: totalDamage,
                mainDpsFull: dps,
                abilitiesUsed: used,
                displayRecords: cp.finalizedRecords,
                unbuffedPps: unbuffedPps,
                buffTimings: buffTimings,
                totalTime: timeBasis,
                label: label,
            } satisfies CycleSimResult as unknown as ResultType;
        });
        const sorted = [...allResults];
        sorted.sort((a, b) => b.mainDpsResult - a.mainDpsResult);
        console.debug("Sim end");
        const best = sorted[0];
        // @ts-expect-error Developer will need to override this method if they want to use a custom type for the
        // full result type.
        return {
            mainDpsResult: best.mainDpsResult,
            all: sorted,
            best: best,
        };
    }

    protected computeCacheKey(set: CharacterGearSet): RotationCacheKey {
        const stats = set.computedStats;
        const sps = stats.spellspeed;
        const sks = stats.skillspeed;
        const wdly = stats.weaponDelay;
        return [sps, sks, wdly];
    }

    async simulate(set: CharacterGearSet): Promise<FullResultType> {
        console.debug("Sim start");
        const cacheKey = this.computeCacheKey(set);
        if (!arrayEq(this.cachedRotationKey, cacheKey)) {
            this.cachedCycleProcessors = this.generateRotations(set);
            this.cachedRotationKey = cacheKey;
        }
        return this.calcDamage(set);
    };

    async simulateSimple(set: CharacterGearSet): Promise<number> {
        console.debug("Sim start");
        const cacheKey = this.computeCacheKey(set);
        if (!arrayEq(this.cachedRotationKey, cacheKey)) {
            // console.error(`cache MISS: ${this.cachedRotationKey} => ${cacheKey}`);
            this.cachedCycleProcessors = this.generateRotations(set, true);
            this.cachedRotationKey = cacheKey;
        }
        // else {
        //     console.error("cache HIT");
        // }
        return this.calcDamageSimple(set);
    };

    settingsChanged() {
        this.invalidateCaches();
    }

    invalidateCaches() {
        this.cachedCycleProcessors = [];
        this.cachedRotationKey = undefined;
    }

}
