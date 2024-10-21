import { FieldBoundCheckBox, labeledCheckbox, FieldBoundFloatField, nonNegative, labelFor, quickElement } from "@xivgear/common-ui/components/util";
import { SimulationGui } from "../simulation_gui";
import { WhmSheetSimResult, WhmSheetSettings } from "@xivgear/core/sims/healer/whm_sheet_sim";

export class WhmSheetSimGui extends SimulationGui<WhmSheetSimResult, WhmSheetSettings, WhmSheetSettings> {
    makeToolTip = null;
    makeResultDisplay = null;

    makeConfigInterface(settings: WhmSheetSettings): HTMLElement {

        const outerDiv = document.createElement("div");
        const checkboxesDiv = document.createElement("div");

        const brdCheck = new FieldBoundCheckBox<WhmSheetSettings>(settings, 'hasBard', {id: 'brd-checkbox',});
        checkboxesDiv.appendChild(labeledCheckbox('BRD in Party', brdCheck));
        const schCheck = new FieldBoundCheckBox<WhmSheetSettings>(settings, 'hasScholar', {id: 'sch-checkbox',});
        checkboxesDiv.appendChild(labeledCheckbox('SCH in Party', schCheck));
        const drgCheck = new FieldBoundCheckBox<WhmSheetSettings>(settings, 'hasDragoon', {id: 'drg-checkbox',});
        checkboxesDiv.appendChild(labeledCheckbox('DRG in Party', drgCheck));

        outerDiv.appendChild(checkboxesDiv);

        const ldPerMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'ldPerMin', {
            id: 'ldPerMin-input',
            postValidators: [nonNegative,],
        });
        const ldPerMinLabel = labelFor('Lucid Dreaming/Minute', ldPerMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item',], [ldPerMinLabel, ldPerMin,]));

        const rezPerMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'rezPerMin', {
            id: 'rezPerMin-input',
            postValidators: [nonNegative,],
        });
        const rezPerMinLabel = labelFor('Raise/Minute', rezPerMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item',], [rezPerMinLabel, rezPerMin,]));

        const m2perMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'm2PerMin', {
            id: 'm2PerMin-input',
            postValidators: [nonNegative,],
        });
        const m2perMinLabel = labelFor('Medica II/Minute', m2perMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item',], [m2perMinLabel, m2perMin,]));

        const c3perMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'c3PerMin', {
            id: 'c3PerMin-input',
            postValidators: [nonNegative,],
        });
        const c3perMinLabel = labelFor('Cure III/Minute', c3perMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item',], [c3perMinLabel, c3perMin,]));

        return outerDiv;
    }

}
