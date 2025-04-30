import {FieldBoundIntField, labelFor, nonNegative, quickElement} from "@xivgear/common-ui/components/util";
import {AbilitiesUsedTable} from "../components/ability_used_table";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {ColDefs} from "@xivgear/common-ui/table/tables";
import {SchExtraData, SchSettings, SchSimResult} from "@xivgear/core/sims/healer/sch_sheet_sim";

class SchGaugeGui {

    static generateResultColumns(result: CycleSimResult): ColDefs<DisplayRecordFinalized> {
        return [{
            shortName: 'aetherflow',
            displayName: 'Aetherflow',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const aetherflow = (usedAbility.extraData as SchExtraData).gauge.aetherflow;

                    const children = [];

                    for (let i = 1; i <= 3; i++) {
                        children.push(quickElement('span', [i <= aetherflow ? 'sch-gauge-active' : 'sch-gauge-default'], []));
                    }

                    return quickElement('div', ['icon-gauge-holder'], children);
                }
                return document.createTextNode("");
            },
        },
        ];
    }
}

export class SchSimGui extends BaseMultiCycleSimGui<SchSimResult, SchSettings> {
    makeCustomConfigInterface(settings: SchSettings, updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");
        const edField = new FieldBoundIntField<SchSettings>(settings, 'edsPerAfDiss', {
            inputMode: 'number',
            postValidators: [nonNegative],
        });
        edField.id = 'edField';
        const label = labelFor('ED per AF/Diss', edField);
        label.style.display = 'block';
        configDiv.appendChild(label);
        configDiv.appendChild(edField);
        return configDiv;
    }

    makeAbilityUsedTable(result: SchSimResult): AbilitiesUsedTable {
        const extraColumns = SchGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns: ColDefs<DisplayRecordFinalized> = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
