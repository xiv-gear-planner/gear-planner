import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {AbilitiesUsedTable} from "../components/ability_used_table";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/sims/cycle_sim";
import {ColDefs, CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {MchSimSettings, MchSimResult} from "@xivgear/sims/ranged/mch/mch_sheet_sim";
import type {MchPreDmgUsedAbility} from "@xivgear/sims/ranged/mch/mch_types";

export class MchSimGui extends BaseMultiCycleSimGui<MchSimResult, MchSimSettings> {
    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'heatGauge',
            displayName: 'Heat Gauge',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: MchPreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const gauge = usedAbility.extraData.gauge.heat;

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
                    barInner.style.backgroundColor = gauge >= 100 ? '#d31010' : '#D35A10';
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
            renderer: (usedAbility?: MchPreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const gauge = usedAbility.extraData.gauge.battery;

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
                    barInner.style.backgroundColor = gauge >= 100 ? '#005170' : '#2C9FCB';
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

    override makeCustomConfigInterface(settings: MchSimSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePots");
        const skipOpenerPot = new FieldBoundCheckBox(settings, "skipOpenerPot");
        const dontAlignCds = new FieldBoundCheckBox(settings, "dontAlignCds");

        configDiv.appendChild(labeledCheckbox("Use potions", potCb));
        configDiv.appendChild(labeledCheckbox("Skip opener pot and start potting on the first burst", skipOpenerPot));
        configDiv.appendChild(labeledCheckbox("Don't align cooldowns (Air Anchor, ...) on 2-min burst", dontAlignCds));
        return configDiv;
    }

    override makeAbilityUsedTable(result: MchSimResult, scrollRoot: HTMLElement | null): AbilitiesUsedTable {
        const extraColumns = MchSimGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result, scrollRoot);
        const newColumns: ColDefs<DisplayRecordFinalized> = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
