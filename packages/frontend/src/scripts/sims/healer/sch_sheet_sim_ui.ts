import {FieldBoundIntField, labelFor, nonNegative, quickElement} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {SchExtraData, SchSettings, SchSimResult} from "@xivgear/core/sims/healer/sch_sheet_sim";
import {extraDataDiscreteGaugeRenderer} from "../common/sim_ui_utils";

export class SchSimGui extends BaseMultiCycleSimGui<SchSimResult, SchSettings> {

    protected extraAbilityUsedColumns(_: SchSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'aetherflow',
            displayName: 'Aetherflow',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: extraDataDiscreteGaugeRenderer<SchExtraData>((_, extra) => {
                const aetherflow = extra.gauge.aetherflow;
                const children = [];

                for (let i = 1; i <= 3; i++) {
                    children.push(quickElement('span', [i <= aetherflow ? 'sch-gauge-active' : 'sch-gauge-default'], []));
                }
                return children;
            }),
        }];
    }

    makeCustomConfigInterface(settings: SchSettings, _: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");
        const edField = new FieldBoundIntField<SchSettings>(settings, 'edsPerAfDiss', {
            inputMode: 'number',
            postValidators: [nonNegative],
        });
        edField.id = 'edField';
        const label = labelFor('ED per AF/Diss', edField);
        label.style.display = 'block';
        configDiv.appendChild(label);
        configDiv.appendChild(edField);
        return configDiv;
    }

}
