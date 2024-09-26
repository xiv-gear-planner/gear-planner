import { FieldBoundIntField, nonNegative, labelFor } from "@xivgear/common-ui/components/util";
import { AbilitiesUsedTable } from "../components/ability_used_table";
import { SchExtraData, SchSettings, SchSimResult } from "./sch_sheet_sim";
import { BaseMultiCycleSimGui } from "../multicyclesim_gui";
import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from "@xivgear/core/sims/cycle_sim";
import { PreDmgUsedAbility } from "@xivgear/core/sims/sim_types";
import { CustomColumnSpec } from "../../tables";

class SchGaugeGui {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'aetherflow',
            displayName: 'Aetherflow',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const aetherflow = (usedAbility.extraData as SchExtraData).gauge.aetherflow;

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
                        if (i <= aetherflow) {
                            stack.style.background = '#0FFF33';
                        }
                        div.appendChild(stack);
                    }

                    return div;
                }
                return document.createTextNode("");
            }
        },
        ];
    }
}
export class SchSimGui extends BaseMultiCycleSimGui<SchSimResult, SchSettings> {
    makeCustomConfigInterface(settings: SchSettings, updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");
        const edField = new FieldBoundIntField<SchSettings>(settings, 'edsPerAfDiss', {
            inputMode: 'number',
            postValidators: [nonNegative]
        });
        edField.id = 'edField';
        const label = labelFor('Energy Drains per Aetherflow/Dissipation', edField);
        configDiv.appendChild(label);
        configDiv.appendChild(edField);
        return configDiv;
    }

    makeAbilityUsedTable(result: SchSimResult): AbilitiesUsedTable {
        const extraColumns = SchGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}