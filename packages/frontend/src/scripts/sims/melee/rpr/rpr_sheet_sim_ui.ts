import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {BaseMultiCycleSimGui} from "../../multicyclesim_ui";
import {RprSheetSimResult, RprSimSettings} from "@xivgear/core/sims/melee/rpr/rpr_sheet_sim";
import {RprExtraData} from "@xivgear/core/sims/melee/rpr/rpr_types";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";

export class RprSheetSimGui extends BaseMultiCycleSimGui<RprSheetSimResult, RprSimSettings> {
    protected extraAbilityUsedColumns(_: RprSheetSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'soulGauge',
            displayName: 'Soul',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const soul = (usedAbility.extraData as RprExtraData).gauge.soul;
                    const gauge = new GaugeWithText<number>(
                        num => num >= 50 ? '#e5004e' : '#660929',
                        num => num.toString(),
                        num => num
                    );
                    gauge.setDataValue(soul);
                    gauge.classList.add('sim-gauge', 'three-digit');
                    return gauge;

                }
                return document.createTextNode("");
            },
        }, {
            shortName: 'shroudGauge',
            displayName: 'Shroud',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const shroud = (usedAbility.extraData as RprExtraData).gauge.shroud;
                    const gauge = new GaugeWithText<number>(
                        num => num >= 50 ? '#00fcf3' : '#03706c',
                        num => num.toString(),
                        num => num
                    );
                    gauge.setDataValue(shroud);
                    gauge.classList.add('sim-gauge', 'three-digit');
                    return gauge;
                }
                return document.createTextNode("");
            },
        }];
    }

}
