import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {AbilitiesUsedTable} from "../components/ability_used_table";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {ColDefs, CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {MchExtraData} from "@xivgear/core/sims/ranged/mch/mch_types";
import {MchSettings, MchSimResult} from "@xivgear/core/sims/ranged/mch/mch_sheet_sim";

export class MchSimGui extends BaseMultiCycleSimGui<MchSimResult, MchSettings> {
    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'heatGauge',
            displayName: 'Heat Gauge',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as MchExtraData).gauge.heatGauge;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${gauge}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    // @TODO Juliacare: pick a colour, and pick a threshold for it to be a different colour
                    barInner.style.backgroundColor = gauge >= 50 ? '#ffc500' : '#e47e08';
                    barInner.style.width = `${gauge}%`;
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
            shortName: 'batteryGauge',
            displayName: 'Battery Gauge',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as MchExtraData).gauge.batteryGauge;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${gauge}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    // @TODO Juliacare: pick a colour, and pick a threshold for it to be a different colour
                    barInner.style.backgroundColor = gauge >= 50 ? '#ffc500' : '#e47e08';
                    barInner.style.width = `${gauge}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            },
        },
        ];
    }

    override makeCustomConfigInterface(settings: MchSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }

    override makeAbilityUsedTable(result: MchSimResult): AbilitiesUsedTable {
        const extraColumns = MchSimGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns: ColDefs<DisplayRecordFinalized> = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
