import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from "@xivgear/core/sims/cycle_sim";
import { PreDmgUsedAbility } from "@xivgear/core/sims/sim_types";
import { CustomColumnSpec } from "../../../tables";
import { AbilitiesUsedTable } from "../../components/ability_used_table";
import { BaseMultiCycleSimGui } from "../../multicyclesim_gui";
import { RprGauge } from "./rpr_gauge";
import { RprSimSettings, RprSheetSimResult } from "./rpr_sheet_sim";
import { RprExtraData } from "./rpr_types";

export class RprGaugeGui {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'soulGauge',
            displayName: 'Soul',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const soul = (usedAbility.extraData as RprExtraData).gauge.soul;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${soul}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = soul >= 50 ? '#e5004e' : '#660929';
                    barInner.style.width = `${soul}%`;
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
            shortName: 'shroudGauge',
            displayName: 'Shroud',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const shroud = (usedAbility.extraData as RprExtraData).gauge.shroud;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${shroud}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = shroud >= 50 ? '#00fcf3' : '#03706c';
                    barInner.style.width = `${shroud}%`;
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
}

export class RprSheetSimGui extends BaseMultiCycleSimGui<RprSheetSimResult, RprSimSettings> {

    override makeAbilityUsedTable(result: RprSheetSimResult): AbilitiesUsedTable {
        const extraColumns = RprGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }
}