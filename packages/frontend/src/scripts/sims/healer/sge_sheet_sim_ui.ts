import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {SimulationGui} from "../simulation_gui";
import {SgeSheetSettings, SgeSheetSimResult} from "@xivgear/core/sims/healer/sge_sheet_sim";

export class SgeSimGui extends SimulationGui<SgeSheetSimResult, SgeSheetSettings, SgeSheetSettings> {
    makeToolTip = undefined;
    makeResultDisplay = undefined;

    makeConfigInterface(settings: SgeSheetSettings): HTMLElement {
        const div = document.createElement("div");
        const brdCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasBard', {id: 'brd-checkbox'});
        div.appendChild(labeledCheckbox('BRD in Party', brdCheck));
        const schCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasScholar', {id: 'sch-checkbox'});
        div.appendChild(labeledCheckbox('SCH in Party', schCheck));
        const drgCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasDragoon', {id: 'drg-checkbox'});
        div.appendChild(labeledCheckbox('DRG in Party', drgCheck));
        return div;
    }
}
