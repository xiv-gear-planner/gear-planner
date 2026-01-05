import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {WarSettings, WarSimResult} from "@xivgear/core/sims/tank/war/war_sheet_sim";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {WarExtraData} from "@xivgear/core/sims/tank/war/war_types";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";

export class WarSimGui extends BaseMultiCycleSimGui<WarSimResult, WarSettings> {

    protected extraAbilityUsedColumns(result: WarSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'beastGauge',
            displayName: 'Beast Gauge',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const beast = (usedAbility.extraData as WarExtraData).gauge.beastGauge;
                    const gauge = new GaugeWithText<number>(
                        num => num >= 50 ? '#ffc500' : '#e47e08',
                        num => num.toString(),
                        num => num
                    );
                    gauge.setDataValue(beast);
                    gauge.classList.add('sim-gauge', 'three-digit');
                    return gauge;
                }
                return document.createTextNode("");
            },
        }, {
            shortName: 'surgingTempest',
            displayName: 'Surging Tempest',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const surgingTempestDuration = (usedAbility.extraData as WarExtraData).surgingTempest;
                    const gauge = new GaugeWithText<number>(
                        () => '#ee9199',
                        num => `${num}s`,
                        num => num / 60 * 100
                    );
                    gauge.setDataValue(surgingTempestDuration);
                    gauge.classList.add('sim-gauge', 'three-digit');
                    return gauge;
                }
                return document.createTextNode("");
            },
        },
        ];
    }

    override makeCustomConfigInterface(settings: WarSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }
}
