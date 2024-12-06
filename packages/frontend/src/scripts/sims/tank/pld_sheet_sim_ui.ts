import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {AbilitiesUsedTable} from "../components/ability_used_table";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {CustomColumnSpec} from "../../tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {PldExtraData} from "@xivgear/core/sims/tank/pld/pld_types";
import {PldSettings, PldSimResult} from "@xivgear/core/sims/tank/pld/pld_sheet_sim";

export class PldSimGui extends BaseMultiCycleSimGui<PldSimResult, PldSettings> {
    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [
            {
                shortName: 'fight-or-flight',
                displayName: 'Fight Or Flight',
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: (usedAbility?: PreDmgUsedAbility) => {
                    if (usedAbility?.extraData !== undefined) {
                        const fightOrFlightDuration = (usedAbility.extraData as PldExtraData).fightOrFlightDuration;
                        const div = document.createElement('div');
                        div.style.height = '100%';
                        div.style.display = 'flex';
                        div.style.alignItems = 'center';
                        div.style.gap = '6px';
                        div.style.padding = '2px 0 2px 0';
                        div.style.boxSizing = 'border-box';

                        const span = document.createElement('span');
                        span.textContent = `${fightOrFlightDuration}s`;

                        const barOuter = document.createElement('div');
                        barOuter.style.borderRadius = '20px';
                        barOuter.style.background = '#00000033';
                        barOuter.style.width = '120px';
                        barOuter.style.height = 'calc(100% - 3px)';
                        barOuter.style.display = 'inline-block';
                        barOuter.style.overflow = 'hidden';
                        barOuter.style.border = '1px solid black';

                        const barInner = document.createElement('div');
                        barInner.style.backgroundColor = '#B14FAE';
                        barInner.style.height = '100%';
                        barInner.style.width = `${Math.round((fightOrFlightDuration / 20) * 100)}%`;
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

    override makeCustomConfigInterface(settings: PldSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }

    override makeAbilityUsedTable(result: PldSimResult): AbilitiesUsedTable {
        const extraColumns = PldSimGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
