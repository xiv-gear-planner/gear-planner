import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {WarSettings, WarSimResult} from "@xivgear/core/sims/tank/war/war_sheet_sim";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {AbilitiesUsedTable} from "../components/ability_used_table";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {col, ColDefs, CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {WarExtraData} from "@xivgear/core/sims/tank/war/war_types";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";

export class WarSimGui extends BaseMultiCycleSimGui<WarSimResult, WarSettings> {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [col({
            shortName: 'beastGauge',
            displayName: 'Beast Gauge',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as WarExtraData).gauge.beastGauge;

                    const out = new GaugeWithText<number>(
                        val => (val >= 50 ? '#ffc500' : '#e47e08'),
                        val => val.toString(),
                        val => val
                    );
                    out.setDataValue(gauge);
                    return out;
                }
                return document.createTextNode("");
            },
            colStyler: (value, colElement) => {
                colElement.style.minWidth = '50px';
                colElement.style.maxWidth = '150px';
            },
        }), col({
            shortName: 'surgingTempest',
            displayName: 'Surging Tempest',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const surgingTempestDuration = (usedAbility.extraData as WarExtraData).surgingTempest;
                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${surgingTempestDuration}s`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = '#ee9199';
                    barInner.style.height = '100%';
                    barInner.style.width = `${Math.round((surgingTempestDuration / 60) * 100)}%`;
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            },
        }),
        ];
    }

    override makeCustomConfigInterface(settings: WarSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }

    override makeAbilityUsedTable(result: WarSimResult): AbilitiesUsedTable {
        const extraColumns = WarSimGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns: ColDefs<DisplayRecordFinalized> = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
