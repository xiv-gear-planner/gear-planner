import { FieldBoundCheckBox, labeledCheckbox } from "@xivgear/common-ui/components/util";
import { BaseMultiCycleSimGui } from "../multicyclesim_ui";
import { SgeNewSheetSettings, SgeSheetSimResult} from "@xivgear/core/sims/healer/sge_sheet_sim_mk2";

export class SgeSheetSimGui extends BaseMultiCycleSimGui<SgeSheetSimResult, SgeNewSheetSettings> {
    makeCustomConfigInterface(settings: SgeNewSheetSettings, updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");
        const potCb = new FieldBoundCheckBox(settings, "usePotion");
        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }
}
