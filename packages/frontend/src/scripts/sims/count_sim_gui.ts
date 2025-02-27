import {Ability, SimSettings} from "@xivgear/core/sims/sim_types";
import {SimulationGui} from "./simulation_gui";
import {writeProxy} from "@xivgear/util/proxies";
import {NamedSection} from "../components/section";
import {ResultSettingsArea} from "./components/result_settings";
import {BuffSettingsArea} from "./party_comp_settings";
import {quickElement} from "@xivgear/common-ui/components/util";
import {abilityEquals} from "@xivgear/core/sims/ability_helpers";
import {applyStdDev} from "@xivgear/xivmath/deviation";
import {col, CustomColumn, CustomTable, HeaderRow} from "@xivgear/common-ui/table/tables";
import {simpleAutoResultTable} from "./components/simple_tables";
import {BaseUsageCountSim, CountSimResult, ExternalCountSettings} from "@xivgear/core/sims/processors/count_sim";

export class BaseUsageCountSimGui<ResultType extends CountSimResult, InternalSettingsType extends SimSettings>
    extends SimulationGui<ResultType, InternalSettingsType, ExternalCountSettings<InternalSettingsType>> {

    declare sim: BaseUsageCountSim<ResultType, InternalSettingsType>;

    makeConfigInterface(settings: InternalSettingsType, updateCallback: () => void): HTMLElement {
        const div = document.createElement("div");
        const custom = this.makeCustomConfigInterface(settings, updateCallback);
        if (custom) {
            custom.classList.add('custom-sim-settings-area');
            const section = new NamedSection('Sim-Specific Settings');
            section.contentArea.append(custom);
            div.appendChild(section);
        }
        div.appendChild(new BuffSettingsArea(this.sim.buffManager, updateCallback));
        div.appendChild(new ResultSettingsArea(writeProxy(this.sim.resultSettings, updateCallback)));
        return div;
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

    makeToolTip?(result: ResultType): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.unbuffedPps}\n`;
    }

    makeResultDisplay(result: ResultType): HTMLElement {
        // noinspection JSNonASCIINames
        const mainResultsTable = simpleAutoResultTable({
            "Expected DPS": result.mainDpsFull.expected,
            "Std Deviation": result.mainDpsFull.stdDev,
            "Expected +1σ": applyStdDev(result.mainDpsFull, 1),
            "Expected +2σ": applyStdDev(result.mainDpsFull, 2),
            "Expected +3σ": applyStdDev(result.mainDpsFull, 3),
            "Unbuffed PPS": result.unbuffedPps,
            "Total Damage": result.totalDamage.expected,
            "Cycle Time": result.cycleTime.toFixed(3),
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
                        total: 0,
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
        const columns: CustomColumn<typeof transposedData[number], unknown, unknown>[] = [col({
            shortName: "skill",
            displayName: "Skill",
            getter: item => item.ability,
            renderer: (value: Ability) => {
                return document.createTextNode(`${value.name}`);
            },
        })];
        buffDurations.forEach(dur => {
            columns.push(col({
                shortName: `buff-dur-${dur}`,
                displayName: `In ${dur}s Buffs`,
                getter: bucket => {
                    return bucket.usages.get(dur) ?? 0;
                },
                renderer: value => document.createTextNode(value.toFixed(3)),
            }));
        });
        columns.push(col({
            shortName: `out-of-buffs`,
            displayName: `Out of Buffs`,
            getter: bucket => {
                return bucket.outOfBuffs;
            },
            renderer: value => document.createTextNode(value.toFixed(3)),
        }));
        columns.push(col({
            shortName: `total`,
            displayName: `Total`,
            getter: bucket => {
                return bucket.total;
            },
            renderer: value => document.createTextNode(value.toFixed(3)),
        }));
        bucketsTable.columns = columns;

        bucketsTable.data = [new HeaderRow(), ...transposedData];

        return quickElement('div', ['cycle-sim-results-table'], [mainResultsTable, bucketsTable]);
    }
}
