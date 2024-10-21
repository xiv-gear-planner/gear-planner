import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from "@xivgear/core/sims/cycle_sim";
import { PreDmgUsedAbility } from "@xivgear/core/sims/sim_types";
import { CustomColumnSpec } from "../../tables";
import { AbilitiesUsedTable } from "../components/ability_used_table";
import { BaseMultiCycleSimGui } from "../multicyclesim_ui";
import { WhmExtraData, WhmSimResult, WhmSettings } from "@xivgear/core/sims/healer/whm_new_sheet_sim";

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

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'center';
                    div.style.gap = '4px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    for (let i = 1; i <= 3; i++) {
                        const stack = document.createElement('span');
                        stack.style.clipPath = `polygon(0 50%, 50% 0, 100% 50%, 50% 100%, 0% 50%)`;
                        stack.style.background = '#00000033';
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (i <= blueLilies) {
                            stack.style.background = '#02d9c3';
                        }
                        div.appendChild(stack);
                    }

                    for (let i = 1; i <= 3; i++) {
                        const stack = document.createElement('span');
                        stack.style.clipPath = `polygon(0 50%, 50% 0, 100% 50%, 50% 100%, 0% 50%)`;
                        stack.style.background = '#00000033';
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (i <= redLilies) {
                            stack.style.background = '#ff0033';
                        }
                        div.appendChild(stack);
                    }

                    return div;
                }
                return document.createTextNode("");
            }
        }
        ];
    }
}
export class WhmSimGui extends BaseMultiCycleSimGui<WhmSimResult, WhmSettings> {
    override makeAbilityUsedTable(result: WhmSimResult): AbilitiesUsedTable {
        const extraColumns = WhmGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
