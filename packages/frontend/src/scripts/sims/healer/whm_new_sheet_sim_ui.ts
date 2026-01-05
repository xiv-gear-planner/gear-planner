import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {col, CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {WhmGaugeState, WhmSettings, WhmSimResult} from "@xivgear/core/sims/healer/whm_new_sheet_sim";
import {quickElement} from "@xivgear/common-ui/components/util";

export class WhmSimGui extends BaseMultiCycleSimGui<WhmSimResult, WhmSettings> {

    protected extraAbilityUsedColumns(result: WhmSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [col({
            shortName: 'lilies',
            displayName: 'Lilies',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility: PreDmgUsedAbility<WhmGaugeState> | null) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }
                const blueLilies = usedAbility.gaugeAfter.blueLilies;
                const redLilies = usedAbility.gaugeAfter.redLilies;

                const children = [];

                for (let i = 1; i <= 3; i++) {
                    children.push(quickElement('span', [i <= blueLilies ? 'whm-gauge-blue' : 'whm-gauge-default'], []));
                }

                for (let i = 1; i <= 3; i++) {
                    children.push(quickElement('span', [i <= redLilies ? 'whm-gauge-red' : 'whm-gauge-default'], []));
                }

                return quickElement('div', ['icon-gauge-holder'], children);
            },
        }),
        ];
    }

}
