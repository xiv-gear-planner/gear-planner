import {
    Ability,
    CombinedBuffEffect,
    GcdAbility,
    PartyBuff,
    SimResult,
    SimSpec,
    Simulation
} from "@xivgear/core/sims/sim_types";
import {BuffSettingsExport, BuffSettingsManager} from "@xivgear/core/sims/common/party_comp_settings";
import {defaultResultSettings, ResultSettings} from "@xivgear/core/sims/cycle_sim";
import {addValues, applyStdDev, multiplyFixed, ValueWithDev} from "@xivgear/xivmath/deviation";
import {CharacterGearSet} from "@xivgear/core/gear";
import {JobName} from "@xivgear/xivmath/xivconstants";
import {NamedSection} from "../../components/section";
import {BuffSettingsArea} from "../party_comp_settings";
import {ResultSettingsArea} from "../components/result_settings";
import {writeProxy} from "@xivgear/core/util/proxies";
import {simpleAutoResultTable} from "../components/simple_tables";
import {quickElement} from "../../components/util";
import {abilityEquals} from "@xivgear/core/sims/ability_helpers";
import {abilityToDamageNew, combineBuffEffects, noBuffEffects} from "@xivgear/core/sims/sim_utils";
import {CustomTable, HeaderRow} from "../../tables";

export const dncDtSheetSpec: SimSpec<DncDtSim, DncDtSimSettings> = {
    displayName: "DNC Level 100 Sim",
    loadSavedSimInstance(exported: DncDtSimSettingsExport) {
        return new DncDtSim(exported);
    },
    makeNewSimInstance(): DncDtSim {
        return new DncDtSim();
    },
    stub: "dnc-dt-sim",
    supportedJobs: ['DNC'],
    supportedLevels: [100],
    isDefaultSim: true
};

export type DncDtSimSettings = NonNullable<unknown>

export type DncDtSimSettingsExport = {
    customSettings: DncDtSimSettings,
    buffConfig: BuffSettingsExport,
    resultSettings: ResultSettings,
}

export interface DncDtSimResults extends SimResult {
    unbuffedPps: number,
    totalDamage: ValueWithDev,
    mainDpsFull: ValueWithDev,
    cycleTime: number,
    buffBuckets: BuffWindowUsages[]
}

const cascade: GcdAbility = {
    name: 'Cascade',
    type: 'gcd',
    attackType: 'Weaponskill',
    potency: 220,
    gcd: 2.5,
    id: 15989
} as const satisfies GcdAbility;

const fountain: GcdAbility = {
    name: 'Fountain',
    type: 'gcd',
    attackType: 'Weaponskill',
    potency: 280,
    gcd: 2.5,
    id: 15990
} as const satisfies GcdAbility;

type SkillCount = [ability: Ability, count: number];

type BuffWindowUsages = {
    maxDuration: number | null,
    minDuration: number | null,
    skills: SkillCount[],
    buffs: PartyBuff[],
    buffEffects: CombinedBuffEffect
}

export class DncDtSim implements Simulation<DncDtSimResults, DncDtSimSettings, DncDtSimSettingsExport> {
    readonly spec = dncDtSheetSpec;
    displayName = 'DNC Sim';
    readonly shortName = dncDtSheetSpec.stub;
    readonly manualRun = false;

    readonly settings: DncDtSimSettings;
    private readonly resultSettings: ResultSettings;
    private readonly buffManager: BuffSettingsManager;
    private readonly job: JobName = 'DNC';

    constructor(settings?: DncDtSimSettingsExport) {
        this.settings = this.makeDefaultSettings();
        if (settings !== undefined) {
            Object.assign(this.settings, settings.customSettings ?? settings);
            this.buffManager = BuffSettingsManager.fromSaved(settings.buffConfig);
            this.resultSettings = settings.resultSettings ?? defaultResultSettings();
        }
        else {
            this.buffManager = BuffSettingsManager.defaultForJob(this.job);
            this.resultSettings = defaultResultSettings();
        }
    }

    async simulate(set: CharacterGearSet): Promise<DncDtSimResults> {
        // Get enabled buffs
        const enabledBuffs = this.buffManager.enabledBuffs;
        // Map from duration to list of party buffs with that duration
        const durationMap: Map<number, PartyBuff[]> = new Map();
        enabledBuffs.forEach(buff => {
            const duration = buff.duration;
            const newValue = durationMap.get(duration) ?? [];
            newValue.push(buff);
            durationMap.set(duration, newValue);
        });
        // Total skills used over one cycle
        const totals = [...this.skillsInBuffDuration(set, null)];
        // The end state of this map is to be a map from a duration to the skills that can be used in that duration
        // but **not** the next shorter duration.
        const skillsDurationMap: Map<number, SkillCount[]> = new Map();
        const durationKeys: number[] = Array.from(durationMap.keys()).filter(dur => dur);
        const outOfBuffs = [...totals];
        // Start with longest duration
        let previous = outOfBuffs;
        durationKeys.sort((a, b) => b - a);
        for (const duration of durationKeys) {
            // The math works by starting with the previous bucket (thus larger), and subtracting the
            // next (thus smaller) bucket from it.
            const thisDurationCumulative = this.skillsInBuffDuration(set, duration);
            console.log(`Duration before ${duration} - raw ${JSON.stringify(thisDurationCumulative)}`);
            for (const skillCount of thisDurationCumulative) {
                const matchingSkill = previous.find(val => abilityEquals(val[0], skillCount[0]));
                if (matchingSkill) {
                    console.log(`Skill ${skillCount[0].name} (${duration}) = ${matchingSkill[1]} - ${skillCount[1]}`);
                    matchingSkill[1] -= skillCount[1];
                }
            }
            skillsDurationMap.set(duration, thisDurationCumulative);
            console.log(`Duration after ${duration} - raw ${JSON.stringify(thisDurationCumulative)}`);
            previous = thisDurationCumulative;
        }
        const resultBuckets: BuffWindowUsages[] = [];
        resultBuckets.push({
            maxDuration: null,
            minDuration: durationKeys.length > 0 ? durationKeys[0] : null,
            skills: [...outOfBuffs],
            buffs: [],
            buffEffects: noBuffEffects()
        });
        for (let i = 0; i < durationKeys.length; i++) {
            const duration = durationKeys[i];
            const minDuration = (i + 1) in durationKeys ? durationKeys[i + 1] : null;
            const buffs = durationMap.get(duration) ?? [];
            resultBuckets.push({
                maxDuration: duration,
                minDuration: minDuration,
                skills: skillsDurationMap.get(duration),
                buffs: buffs,
                buffEffects: combineBuffEffects(buffs)
            });
        }
        let totalPotency = 0;
        const totalDamage: ValueWithDev = addValues(
            ...resultBuckets.map(bucket => {
                const buffEffects = bucket.buffEffects;
                return addValues(...bucket.skills.flatMap(sc => {
                    const skill = sc[0];
                    const count = sc[1];
                    totalPotency += skill.potency * count;
                    // TODO: how will this handle DoTs?
                    const dmg = abilityToDamageNew(set.computedStats, skill, buffEffects);
                    if (dmg.directDamage) {
                        return [multiplyFixed(dmg.directDamage, count)];
                    }
                    return [];
                }));
            })
        );
        const cycleTime = this.totalCycleTime(set);
        const dps = multiplyFixed(totalDamage, 1.0 / cycleTime);
        const pps = totalPotency / cycleTime;
        return {
            cycleTime: cycleTime,
            mainDpsFull: dps,
            mainDpsResult: applyStdDev(dps, this.resultSettings.stdDevs ?? 0),
            totalDamage: totalDamage,
            unbuffedPps: pps,
            buffBuckets: resultBuckets
        }
    }

    totalCycleTime(set: CharacterGearSet): number {
        // TODO
        return 120;
    }

    /**
     * Returns the number of skills that fit in a buff duration, or total if the buff duration is null.
     *
     * This should be cumulative - e.g. the count for 'null' should be the total skills used. The count for '20' should
     * be the count of skills used in 20 second buffs, including 15 and 10 second buffs.
     *
     * @param set
     * @param buffDuration
     */
    skillsInBuffDuration(set: CharacterGearSet, buffDuration: number | null): SkillCount[] {
        const gcd = set.computedStats.gcdPhys(2.5);
        // Totals, regardless of buffs
        if (buffDuration === null) {
            return [
                [cascade, 3.6 / gcd],
                [fountain, 3.6 / gcd]
            ]
        }
        // In buffs of at least 20 seconds
        else if (buffDuration >= 20) {
            return [
                [cascade, 0.5 / gcd],
                [fountain, 0.5 / gcd]
            ]
        }
        // etc
        else {
            return []
        }
    }

    exportSettings(): DncDtSimSettingsExport {
        return {
            buffConfig: this.buffManager.exportSetting(),
            customSettings: this.settings,
            resultSettings: this.resultSettings

        }
    }

    makeCustomConfigInterface(settings: DncDtSimSettings, updateCallback: () => void): HTMLElement | null {
        return null;
    }

    makeConfigInterface(settings: DncDtSimSettings, updateCallback: () => void): HTMLElement {
        const div = document.createElement("div");
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

    makeToolTip?(result: DncDtSimResults): string {
        return 'TODO';
    }

    makeResultDisplay(result: DncDtSimResults): HTMLElement {
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

        const transposedData: {
            ability: Ability,
            usages: Map<number, number>,
            outOfBuffs: number,
            total: number
        }[] = [];

        const buffDurations = new Set<number>();

        result.buffBuckets.forEach(bucket => {
            const duration: number | null = bucket.maxDuration;
            if (duration !== null) {
                buffDurations.add(duration);
            }
            bucket.skills.forEach(sc => {
                const ability: Ability = sc[0];
                const count: number = sc[1];
                let abilityData = transposedData.find(datum => abilityEquals(datum.ability, ability));
                if (!abilityData) {
                    abilityData = {
                        ability: ability,
                        usages: new Map<number, number>(),
                        outOfBuffs: 0,
                        total: 0
                    };
                    transposedData.push(abilityData);
                }
                abilityData.total += count;
                if (duration !== null) {
                    abilityData.usages.set(duration, (abilityData.usages.get(duration) ?? 0) + count);
                }
                else {
                    abilityData.outOfBuffs += count;
                }
            });
        });

        const buffDurationsSorted = Array.from(buffDurations);
        buffDurationsSorted.sort((a, b) => (b - a));


        const bucketsTable = new CustomTable<typeof transposedData[number]>();
        const columns: typeof bucketsTable.columns = [{
            shortName: "skill",
            displayName: "Skill",
            getter: item => item.ability,
            renderer: (value: Ability) => {
                return document.createTextNode(`${value.name}`);
            }
        }];
        buffDurations.forEach(dur => {
            columns.push({
                shortName: `buff-dur-${dur}`,
                displayName: `In ${dur}s Buffs`,
                getter: bucket => {
                    return bucket.usages.get(dur) ?? 0
                },
                renderer: value => document.createTextNode(value.toFixed(3)),
            })
        });
        columns.push({
            shortName: `out-of-buffs`,
            displayName: `Out of Buffs`,
            getter: bucket => {
                return bucket.outOfBuffs
            },
            renderer: value => document.createTextNode(value.toFixed(3)),
        });
        columns.push({
            shortName: `total`,
            displayName: `Total`,
            getter: bucket => {
                return bucket.total
            },
            renderer: value => document.createTextNode(value.toFixed(3)),
        });
        bucketsTable.columns = columns;

        bucketsTable.data = [new HeaderRow(), ...transposedData];

        return quickElement('div', ['cycle-sim-results-table'], [mainResultsTable, bucketsTable]);
    }

    private makeDefaultSettings(): DncDtSimSettings {
        return {}
    }
}