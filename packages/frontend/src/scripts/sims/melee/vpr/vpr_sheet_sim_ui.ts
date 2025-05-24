import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {BaseMultiCycleSimGui} from "../../multicyclesim_ui";
import {VprSimResult, VprSimSettings} from "@xivgear/core/sims/melee/vpr/vpr_sheet_sim";
import {VprExtraData} from "@xivgear/core/sims/melee/vpr/vpr_types";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";
import {extraDataDiscreteGaugeRenderer} from "../../common/sim_ui_utils";

export class VprSimGui extends BaseMultiCycleSimGui<VprSimResult, VprSimSettings> {

    protected extraAbilityUsedColumns(result: VprSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'serpentOfferings',
            displayName: 'Serpent Offerings',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const serpentOfferings = (usedAbility.extraData as VprExtraData).gauge.serpentOfferings;

                    const gauge = new GaugeWithText<number>(
                        num => num < 50 ? '#d22017' : '#61d0ec',
                        num => num.toString(),
                        num => num
                    );
                    gauge.setDataValue(serpentOfferings);
                    gauge.classList.add('sim-gauge', 'three-digit');
                    return gauge;
                }
                return document.createTextNode("");
            },
        }, {
            shortName: 'rattlingCoils',
            displayName: 'Rattling Coils',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: extraDataDiscreteGaugeRenderer<VprExtraData>((_, extra) => {
                const rattlingCoils = extra.gauge.rattlingCoils;

                const out = [];

                for (let i = 1; i <= 3; i++) {
                    const stack = document.createElement('span');
                    if (i <= rattlingCoils) {
                        stack.classList.add('vpr-rattling-gauge-full');
                    }
                    else {
                        stack.classList.add('vpr-rattling-gauge-default');

                    }
                    out.push(stack);
                }

                return out;
            }),
        },
        ];
    }

}
