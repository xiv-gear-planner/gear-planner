import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {AbilitiesUsedTable} from "../../components/ability_used_table";
import {BaseMultiCycleSimGui} from "../../multicyclesim_ui";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CustomColumnSpec} from "../../../tables";
import {NinSettings, NinSimResult} from "@xivgear/core/sims/melee/nin/nin_lv100_sim";
import {NINExtraData} from "@xivgear/core/sims/melee/nin/nin_types";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";

export class NINGaugeGui {
    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'ninkiGauge',
            displayName: 'Ninki',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const ninki = (usedAbility.extraData as NINExtraData).gauge.ninki;
                    const out = new GaugeWithText<number>(
                        ninki => ninki >= 50 ? '#DB5858' : '#995691',
                        ninki => ninki.toString(),
                        ninki => ninki
                    );
                    out.setDataValue(ninki);
                    out.classList.add('sim-gauge');
                    return out;
                }
                return document.createTextNode("");
            },
        }, {
            shortName: 'kazematoi',
            displayName: 'Kazematoi',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                let textContent = "";
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as NINExtraData).gauge;
                    textContent = '🗡️'.repeat(gauge.kazematoi);
                }
                return document.createTextNode(textContent);
            },
        }];
    }

}

export class NinSheetSimGui extends BaseMultiCycleSimGui<NinSimResult, NinSettings> {

    override makeAbilityUsedTable(result: NinSimResult): AbilitiesUsedTable {
        const extraColumns = NINGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }
}
