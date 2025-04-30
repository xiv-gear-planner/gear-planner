import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {ColDefs, CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {AbilitiesUsedTable} from "../components/ability_used_table";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {WhmExtraData, WhmSimResult, WhmSettings} from "@xivgear/core/sims/healer/whm_new_sheet_sim";
import {quickElement} from "@xivgear/common-ui/components/util";

class WhmGaugeGui {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'lilies',
            displayName: 'Lilies',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const blueLilies = (usedAbility.extraData as WhmExtraData).gauge.blueLilies;
                    const redLilies = (usedAbility.extraData as WhmExtraData).gauge.redLilies;

                    const children = [];

                    for (let i = 1; i <= 3; i++) {
                        children.push(quickElement('span', [i <= blueLilies ? 'whm-gauge-blue' : 'whm-gauge-default'], []));
                    }

                    for (let i = 1; i <= 3; i++) {
                        children.push(quickElement('span', [i <= redLilies ? 'whm-gauge-red' : 'whm-gauge-default'], []));
                    }

                    return quickElement('div', ['icon-gauge-holder'], children);
                }
                return document.createTextNode("");
            },
        },
        ];
    }
}
export class WhmSimGui extends BaseMultiCycleSimGui<WhmSimResult, WhmSettings> {
    override makeAbilityUsedTable(result: WhmSimResult): AbilitiesUsedTable {
        const extraColumns = WhmGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns: ColDefs<DisplayRecordFinalized> = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
