import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {
    FieldBoundCheckBox,
    FieldBoundFloatField,
    labeledCheckbox,
    labelFor,
    positiveValuesOnly
} from "@xivgear/common-ui/components/util";
import {NamedSection} from "../../components/section";

export function cycleSettingsGui(cycleSettings: CycleSettings) {
    const out = new NamedSection('Cycle Settings');
    const timeField = new FieldBoundFloatField(cycleSettings, 'totalTime', {
        inputMode: 'number',
        postValidators: [positiveValuesOnly]
    });
    timeField.id = 'cycle-total-time';
    const label = labelFor('Total Time:', timeField);
    out.contentArea.appendChild(label);
    out.contentArea.appendChild(timeField);
    out.contentArea.appendChild(document.createElement('br'));
    const autosCb = new FieldBoundCheckBox(cycleSettings, 'useAutos');
    out.contentArea.appendChild(labeledCheckbox('Use Auto-Attacks', autosCb));
    return out;
}