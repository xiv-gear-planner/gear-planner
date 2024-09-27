import { FieldBoundCheckBox, labeledCheckbox } from "@xivgear/common-ui/components/util";
import { CycleSimResult } from "@xivgear/core/sims/cycle_sim";
import { BluSimSettings } from "@xivgear/core/sims/blu/blu_common";
import { BaseMultiCycleSimGui } from "../multicyclesim_ui";

export class BluSimGui extends BaseMultiCycleSimGui<CycleSimResult, BluSimSettings> { 
    makeCustomConfigInterface(settings: BluSimSettings, updateCallback: () => void): HTMLElement {
        const configDiv = document.createElement("div");
        // insert BLU stance toggles
        const stancesDiv = document.createElement("div");
        const dpsMimicryCb = new FieldBoundCheckBox(settings, "dpsMimicryEnabled");
        stancesDiv.appendChild(labeledCheckbox("Aetheric Mimicry: DPS", dpsMimicryCb));
        const mightyGuardCb = new FieldBoundCheckBox(settings, "mightyGuardEnabled");
        stancesDiv.appendChild(labeledCheckbox("Mighty Guard", mightyGuardCb));
        const basicInstinctCb = new FieldBoundCheckBox(settings, "basicInstinctEnabled");
        stancesDiv.appendChild(labeledCheckbox("Basic Instinct", basicInstinctCb));

        configDiv.appendChild(stancesDiv);
        return configDiv;
    }

}