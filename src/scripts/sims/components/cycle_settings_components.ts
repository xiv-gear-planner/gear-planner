import {CycleSettings} from "../cycle_settings";
import {FieldBoundFloatField, labeledCheckbox, labelFor, positiveValuesOnly} from "../../components/util";

export function cycleSettingsGui(cycleSettings: CycleSettings) {
    const out = document.createElement('div')
    const timeField = new FieldBoundFloatField(cycleSettings, 'totalTime', {
        inputMode: 'number',
        postValidators: [positiveValuesOnly]
    });
    timeField.id = 'cycle-total-time';
    const label = labelFor('Total Time:', timeField);
    out.appendChild(label);
    out.appendChild(timeField);
    return out;
}