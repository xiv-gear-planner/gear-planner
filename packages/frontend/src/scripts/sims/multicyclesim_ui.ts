import {
    CycleProcessor,
    CycleSimResult,
    CycleSimResultFull,
    DisplayRecordFinalized,
    ExternalCycleSettings
} from "@xivgear/core/sims/cycle_sim";
import {SimulationGui} from "./simulation_gui";
import {SimSettings} from "@xivgear/core/sims/sim_types";
import {cycleSettingsGui} from "./components/cycle_settings_components";
import {writeProxy} from "@xivgear/util/proxies";
import {NamedSection} from "../components/section";
import {BuffSettingsArea} from "./party_comp_settings";
import {ResultSettingsArea} from "./components/result_settings";
import {applyStdDev} from "@xivgear/xivmath/deviation";
import {bestEffortFormat, simpleKvTable} from "./components/simple_tables";
import {AbilitiesUsedTable} from "./components/ability_used_table";
import {quickElement} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {AnyStringIndex} from "@xivgear/util/types";
import {
    col,
    CustomCell,
    CustomColumn,
    CustomColumnSpec,
    CustomRow,
    CustomTable,
    HeaderRow,
    SingleCellRowOrHeaderSelection,
    TableSelectionModel
} from "@xivgear/common-ui/table/tables";

export class BaseMultiCycleSimGui<ResultType extends CycleSimResult, InternalSettingsType extends SimSettings, CycleProcessorType extends CycleProcessor = CycleProcessor, FullResultType extends CycleSimResultFull<ResultType> = CycleSimResultFull<ResultType>>
    extends SimulationGui<FullResultType, InternalSettingsType, ExternalCycleSettings<InternalSettingsType>> {

    declare sim: BaseMultiCycleSim<ResultType, InternalSettingsType, CycleProcessorType, FullResultType>;


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
        div.appendChild(cycleSettingsGui(writeProxy(this.sim.cycleSettings, updateCallback)));
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
     * Make the table at the top of the results are that displays overall statistics
     *
     * @param result The result
     * @param includeRotationName Whether to include the rotation name/label. Rotation name is generally redundant
     * for sims that only specify a single rotation.
     */
    makeMainResultDisplay(result: ResultType, includeRotationName: boolean = false): HTMLElement {
        // noinspection JSNonASCIINames
        const data: AnyStringIndex = {
            "Expected DPS": result.mainDpsFull.expected,
            "Std Deviation": result.mainDpsFull.stdDev,
            "Expected +1σ": applyStdDev(result.mainDpsFull, 1),
            "Expected +2σ": applyStdDev(result.mainDpsFull, 2),
            "Expected +3σ": applyStdDev(result.mainDpsFull, 3),
            "Unbuffed PPS": result.unbuffedPps,
            "Time Taken": result.totalTime,
        };
        if (includeRotationName) {
            data["Rotation"] = result.label;
        }
        const mainResultsTable = simpleKvTable(data);
        mainResultsTable.classList.add('main-results-table');
        return mainResultsTable;
    }

    private makeRotationsTable(result: FullResultType, mainResultsTableHolder: HTMLElement, abilitiesUsedTable: AbilitiesUsedTable): HTMLTableElement {
        const out = new CustomTable<ResultType, TableSelectionModel<ResultType>>();
        out.columns = [
            col({
                shortName: 'rotname',
                displayName: 'Rotation',
                getter: item => item.label,
            }), col({
                shortName: 'dps',
                displayName: 'DPS',
                getter: item => item.mainDpsResult,
                renderer: bestEffortFormat,
            })];
        // These are sorted, so the first result is the highest which is the default selection
        let currentSelection = result.all[0];
        const outer = this;
        out.selectionModel = {
            clickCell(cell: CustomCell<ResultType, never>): void {
            },
            clickColumnHeader(col: CustomColumn<ResultType, never, never>): void {
            },
            clickRow(row: CustomRow<ResultType>): void {
                currentSelection = row.dataItem;
                abilitiesUsedTable.setNewData(currentSelection.abilitiesUsed);
                mainResultsTableHolder.replaceChildren(outer.makeMainResultDisplay(currentSelection, true));
            },
            getSelection(): SingleCellRowOrHeaderSelection<ResultType, never, never> {
                return null;
            },
            isCellSelectedDirectly(cell: CustomCell<ResultType, never>): boolean {
                return false;
            },
            isColumnHeaderSelected(col: CustomColumn<ResultType, never, never>): boolean {
                return false;
            },
            isRowSelected(row: CustomRow<ResultType>): boolean {
                return row.dataItem === currentSelection;
            },
            clearSelection(): void {
            },
        };
        out.data = [new HeaderRow(), ...result.all];
        return out;
    }

    protected extraAbilityUsedColumns(result: ResultType): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [];
    }

    makeAbilityUsedTable(result: ResultType, scrollRoot: HTMLElement | null): AbilitiesUsedTable {
        return new AbilitiesUsedTable(result.displayRecords, this.extraAbilityUsedColumns(result), scrollRoot);
    }

    makeResultDisplay(result: FullResultType): HTMLElement {
        const mainResultsTable = this.makeMainResultDisplay(result.best, result.all.length > 1);
        const mainHolder = quickElement('div', ['cycle-sim-table-holder', 'cycle-sim-main-holder'], [mainResultsTable]);

        const abilitiesScrollTable = quickElement('div', ['scroll-table-holder'], []);
        const abilitiesUsedTable = this.makeAbilityUsedTable(result.best, abilitiesScrollTable);
        abilitiesScrollTable.append(abilitiesUsedTable);

        if (result.all.length > 1) {
            const rotationsTable = this.makeRotationsTable(result, mainHolder, abilitiesUsedTable);
            return quickElement('div', ['cycle-sim-results', 'cycle-sim-results-full'], [
                quickElement('div', ['cycle-sim-table-holder', 'cycle-sim-rotations-holder'], [
                    quickElement('div', ['scroll-table-holder'], [rotationsTable]),
                ]),
                mainHolder,
                quickElement('div', ['cycle-sim-table-holder', 'cycle-sim-abilities-holder'], [
                    abilitiesScrollTable,
                ]),
            ]);
        }
        else {
            mainHolder.classList.add('cycle-sim-one-rotation');
            return quickElement('div', ['cycle-sim-results', 'cycle-sim-results-full'], [
                mainHolder,
                quickElement('div', ['cycle-sim-table-holder', 'cycle-sim-abilities-holder'], [
                    abilitiesScrollTable,
                ]),
            ]);
        }
    }

    makeToolTip(result: FullResultType): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.best.unbuffedPps}\n`;
    }
}
