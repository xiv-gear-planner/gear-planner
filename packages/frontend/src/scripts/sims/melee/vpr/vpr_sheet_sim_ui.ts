import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CustomColumnSpec} from "../../../tables";
import {AbilitiesUsedTable} from "../../components/ability_used_table";
import {BaseMultiCycleSimGui} from "../../multicyclesim_ui";
import {VprSimResult, VprSimSettings} from "@xivgear/core/sims/melee/vpr/vpr_sheet_sim";
import {VprExtraData} from "@xivgear/core/sims/melee/vpr/vpr_types";

class VprGaugeGui {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'serpentOfferings',
            displayName: 'Serpent Offerings',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const serpentOfferings = (usedAbility.extraData as VprExtraData).gauge.serpentOfferings;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${serpentOfferings}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = serpentOfferings < 50 ? '#d22017' : '#61d0ec';
                    barInner.style.width = `${serpentOfferings}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            },
        },
        {
            shortName: 'rattlingCoils',
            displayName: 'Rattling Coils',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const rattlingCoils = (usedAbility.extraData as VprExtraData).gauge.rattlingCoils;

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
                        if (i <= rattlingCoils) {
                            stack.style.background = '#84100F';
                        }
                        div.appendChild(stack);
                    }

                    return div;
                }
                return document.createTextNode("");
            },
        },
        ];
    }
}
export class VprSimGui extends BaseMultiCycleSimGui<VprSimResult, VprSimSettings> {

    override makeAbilityUsedTable(result: VprSimResult): AbilitiesUsedTable {
        const extraColumns = VprGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
