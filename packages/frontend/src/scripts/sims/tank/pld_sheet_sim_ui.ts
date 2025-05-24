import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {PldExtraData} from "@xivgear/core/sims/tank/pld/pld_types";
import {PldSettings, PldSimResult} from "@xivgear/core/sims/tank/pld/pld_sheet_sim";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";

export class PldSimGui extends BaseMultiCycleSimGui<PldSimResult, PldSettings> {
    protected extraAbilityUsedColumns(result: PldSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [
            {
                shortName: 'fight-or-flight',
                displayName: 'Fight Or Flight',
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: (usedAbility?: PreDmgUsedAbility) => {
                    if (usedAbility?.extraData !== undefined) {
                        const fightOrFlightDuration = (usedAbility.extraData as PldExtraData).fightOrFlightDuration;
                        const out = new GaugeWithText<number>(() => '#B14FAE', v => `${fightOrFlightDuration.toFixed(1)}s`, v => v / 20 * 100);
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

}
