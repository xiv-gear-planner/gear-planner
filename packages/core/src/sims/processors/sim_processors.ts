import { JOB_DATA, JobName } from "@xivgear/xivmath/xivconstants";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { CharacterGearSet } from "@xivgear/core/gear";
import { sum } from "@xivgear/core/util/array_utils";
import { addValues, applyStdDev, multiplyFixed } from "@xivgear/xivmath/deviation";
import { PartyBuff, SimSettings, SimSpec, Simulation } from "@xivgear/core/sims/sim_types";
import {
    CutoffMode,
    CycleProcessor,
    CycleSimResult,
    CycleSimResultFull,
    defaultResultSettings,
    ExternalCycleSettings,
    isFinalizedAbilityUse,
    MultiCycleSettings,
    ResultSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import { BuffSettingsManager } from "@xivgear/core/sims/common/party_comp_settings";

/**
 * Base class for a CycleProcessor based simulation. You should extend this class,
 * and provide your own generic types.
 */
export abstract class BaseMultiCycleSim<ResultType extends CycleSimResult, InternalSettingsType extends SimSettings, CycleProcessorType extends CycleProcessor = CycleProcessor, FullResultType extends CycleSimResultFull<ResultType> = CycleSimResultFull<ResultType>>
implements Simulation<FullResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>> {

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

    private cachedCycleProcessors: [string, CycleProcessor][];
    private cachedSpeed: number;

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


    generateRotations(set: CharacterGearSet): [string, CycleProcessor][] {

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
            });
            rot.apply(cp);
            return [rot.name ?? `Unnamed #${index + 1}`, cp];
        });
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

    async simulate(set: CharacterGearSet): Promise<FullResultType> {
        console.debug("Sim start");
        const setSpeed = set.isStatRelevant('spellspeed') ? set.computedStats.spellspeed : set.computedStats.skillspeed;
        if (setSpeed !== this.cachedSpeed) {
            this.cachedCycleProcessors = this.generateRotations(set);
            this.cachedSpeed = setSpeed;
        }
        return this.calcDamage(set);
    };

    settingsChanged() {
        this.invalidateCaches();
    }

    invalidateCaches() {
        this.cachedCycleProcessors = [];
        this.cachedSpeed = undefined;
    }

}
