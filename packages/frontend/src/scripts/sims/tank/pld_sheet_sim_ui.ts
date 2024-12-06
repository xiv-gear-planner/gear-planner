import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {AbilitiesUsedTable} from "../components/ability_used_table";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {CustomColumnSpec} from "../../tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {PldExtraData} from "@xivgear/core/sims/tank/pld/pld_types";
import {PldSettings, PldSimResult} from "@xivgear/core/sims/tank/pld/pld_sheet_sim";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";

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
                        const out = new GaugeWithText<number>(() => '#B14FAE', v => `${fightOrFlightDuration}s`, v => v / 20 * 100);
                        out.setDataValue(fightOrFlightDuration);
                        out.classList.add('sim-gauge');
                        return out;
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
