import {JobName} from "@xivgear/xivmath/xivconstants";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {cycleSettingsGui} from "./components/cycle_settings_components";
import {writeProxy} from "@xivgear/core/util/proxies";
import {AbilitiesUsedTable} from "./components/ability_used_table";
import {quickElement} from "@xivgear/common-ui/components/util";
import {sum} from "@xivgear/core/util/array_utils";
import {addValues, applyStdDev, multiplyFixed} from "@xivgear/xivmath/deviation";
import {ResultSettingsArea} from "./components/result_settings";
import {NamedSection} from "../components/section";
import {simpleAutoResultTable} from "./components/simple_tables";
import {PartyBuff, SimSettings, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";
import {
    CycleProcessor,
    CycleSimResult,
    defaultResultSettings,
    ExternalCycleSettings,
    isFinalizedAbilityUse,
    MultiCycleSettings,
    ResultSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {BuffSettingsManager} from "@xivgear/core/sims/common/party_comp_settings";
import {BuffSettingsArea} from "./party_comp_settings";


/**
 * Base class for a CycleProcessor based simulation. You should extend this class,
 * and provide your own generic types.
 */
export abstract class BaseMultiCycleSim<ResultType extends CycleSimResult, InternalSettingsType extends SimSettings, CycleProcessorType extends CycleProcessor = CycleProcessor>
    implements Simulation<ResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>> {

    abstract displayName: string;
    abstract shortName: string;
    abstract spec: SimSpec<Simulation<ResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>>, ExternalCycleSettings<InternalSettingsType>>;
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
            resultSettings: this.resultSettings
        };
    }

    /**
     * Overridable method for inserting sim-specific custom settings.
     *
     * @param settings       This sim's settings object.
     * @param updateCallback A callback which should be called if any settings change.
     */
    makeCustomConfigInterface(settings: InternalSettingsType, updateCallback: () => void): HTMLElement | null {
        return null;
    }

    /**
     * Make the config interface. Generally, this should not be overridden. Instead, override
     * {@link makeCustomConfigInterface}
     *
     * @param settings
     * @param updateCallback
     */
    makeConfigInterface(settings: InternalSettingsType, updateCallback: () => void): HTMLElement {
        // TODO: need internal settings panel
        const div = document.createElement("div");
        div.appendChild(cycleSettingsGui(writeProxy(this.cycleSettings, updateCallback)));
        const custom = this.makeCustomConfigInterface(settings, updateCallback);
        if (custom) {
            custom.classList.add('custom-sim-settings-area');
            const section = new NamedSection('Sim-Specific Settings');
            section.contentArea.append(custom);
            div.appendChild(section);
        }
        div.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        div.appendChild(new ResultSettingsArea(writeProxy(this.resultSettings, updateCallback)));
        return div;
    }

    makeResultDisplay(result: ResultType): HTMLElement {
        // noinspection JSNonASCIINames
        const mainResultsTable = simpleAutoResultTable({
            "Expected DPS": result.mainDpsFull.expected,
            "Std Deviation": result.mainDpsFull.stdDev,
            "Expected +1σ": applyStdDev(result.mainDpsFull, 1),
            "Expected +2σ": applyStdDev(result.mainDpsFull, 2),
            "Expected +3σ": applyStdDev(result.mainDpsFull, 3),
            "Unbuffed PPS": result.unbuffedPps
        });
        mainResultsTable.classList.add('main-results-table');
        const abilitiesUsedTable = new AbilitiesUsedTable(result.displayRecords);
        return quickElement('div', ['cycle-sim-results-table'], [mainResultsTable, abilitiesUsedTable]);
    }

    makeToolTip(result: ResultType): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.unbuffedPps}\n`;
    }

    /**
     * Whether or not autoattacks should be enabled by default for ths sim.
     */
    get useAutosByDefault(): boolean {
        // future TODO: flip this when 7.0 drops.
        // Not changing now such as to not cause confusion with existing sheets.
        // Also, this should arguably be added as a property to the job data itself.
        // const jobData = JOB_DATA[this.job];
        // return jobData.role !== 'Healer' && jobData.role !== 'Caster';
        return true;
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
        }
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
    abstract getRotationsToSimulate(): Rotation<CycleProcessorType>[];

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

            const used = cp.finalizedRecords.filter(isFinalizedAbilityUse);
            const totalDamage = addValues(...used.map(used => used.totalDamageFull));
            const dps = multiplyFixed(totalDamage, 1.0 / cp.currentTime);
            const unbuffedPps = sum(used.map(used => used.totalPotency)) / cp.nextGcdTime;
            const buffTimings = [...cp.buffHistory];

            return {
                mainDpsResult: applyStdDev(dps, this.resultSettings.stdDevs ?? 0),
                totalDamage: totalDamage,
                mainDpsFull: dps,
                abilitiesUsed: used,
                displayRecords: cp.finalizedRecords,
                unbuffedPps: unbuffedPps,
                buffTimings: buffTimings
            } satisfies CycleSimResult as unknown as ResultType;
        });
        allResults.sort((a, b) => b.mainDpsResult - a.mainDpsResult);
        console.debug("Sim end");
        return allResults[0];
    };

}
