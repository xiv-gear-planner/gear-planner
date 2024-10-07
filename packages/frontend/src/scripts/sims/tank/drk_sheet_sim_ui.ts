import { FieldBoundCheckBox, labeledCheckbox } from "@xivgear/common-ui/components/util";
import { DrkSettings, DrkSimResult } from "@xivgear/core/sims/tank/drk/drk_lv100_sim";
import { BaseMultiCycleSimGui } from "../multicyclesim_ui";
import { AbilitiesUsedTable } from "../components/ability_used_table";
import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from "@xivgear/core/sims/cycle_sim";
import { CustomColumnSpec } from "../../tables";
import { PreDmgUsedAbility } from "@xivgear/core/sims/sim_types";
import { DrkExtraData } from "@xivgear/core/sims/tank/drk/drk_types";

export class DrkSimGui extends BaseMultiCycleSimGui<DrkSimResult, DrkSettings> {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'bloodGauge',
            displayName: 'Blood',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const blood = (usedAbility.extraData as DrkExtraData).gauge.blood;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${blood}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = blood >= 50 ? '#e5004e' : '#660929';
                    barInner.style.width = `${blood}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            }
        },
        {
            shortName: 'mp',
            displayName: 'MP',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const mp = (usedAbility.extraData as DrkExtraData).gauge.mp;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${mp}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = mp >= 3000 ? '#00fcf3' : '#03706c';
                    barInner.style.width = `${mp}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            }
        },
        ];
    }
    
    override makeCustomConfigInterface(settings: DrkSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }

    override makeAbilityUsedTable(result: DrkSimResult): AbilitiesUsedTable {
        const extraColumns = DrkSimGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}