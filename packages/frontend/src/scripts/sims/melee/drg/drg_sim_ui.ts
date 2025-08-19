import {FieldBoundCheckBox, labeledCheckbox, quickElement} from "@xivgear/common-ui/components/util";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {BaseMultiCycleSimGui} from "../../multicyclesim_ui";
import {DrgSimResult, DrgSettings} from "@xivgear/core/sims/melee/drg/drg_sim";
import {DrgGaugeState} from "@xivgear/core/sims/melee/drg/drg_types";

export class DrgSimGui extends BaseMultiCycleSimGui<DrgSimResult, DrgSettings> {
    protected extraAbilityUsedColumns(_: DrgSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'wwt',
            displayName: 'Firstminds\' Focus',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<DrgGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }
                const gauge = usedAbility.gaugeAfter;
                const children = [];
                for (let i = 1; i <= 2; i++) {
                    children.push(quickElement('span', [i <= gauge.firstmindsFocus ? 'drg-wwt-full' : 'drg-wwt-default'], []));
                }
                return quickElement('div', ['icon-gauge-holder'], children);
            },
        }];
    }

    override makeCustomConfigInterface(settings: DrgSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));

        /*
        const useEptOpenerCB = new FieldBoundCheckBox(settings, "useEptOpener");

        configDiv.appendChild(labeledCheckbox("Use ePT opener (will use TT opener otherwise)", useEptOpenerCB));

        const useDoubleMdCB = new FieldBoundCheckBox(settings, "useDoubleMd");

        configDiv.appendChild(labeledCheckbox("Use double Mirage Dive", useDoubleMdCB));
        */

        return configDiv;
    }

}
