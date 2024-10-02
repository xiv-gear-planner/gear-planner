import { CycleSimResult, DisplayRecordFinalized } from "@xivgear/core/sims/cycle_sim";
import { CustomColumnSpec } from "../../../tables";
import { AbilitiesUsedTable } from "../../components/ability_used_table";
import { BaseMultiCycleSimGui } from "../../multicyclesim_ui";
import { MnkSimResult, MnkSettings } from "@xivgear/core/sims/melee/mnk/mnk_sim";

class MNKGaugeGui {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [];
    }
}
export class MnkSimGui extends BaseMultiCycleSimGui<MnkSimResult, MnkSettings> {
    
    override makeCustomConfigInterface(settings: MnkSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        return configDiv;
    }

    override makeAbilityUsedTable(result: MnkSimResult): AbilitiesUsedTable {
        const extraColumns = MNKGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
