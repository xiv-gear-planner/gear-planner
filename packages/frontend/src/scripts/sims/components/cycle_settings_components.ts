import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {
    clampValues,
    FieldBoundCheckBox,
    FieldBoundFloatField,
    labeledCheckbox,
    labelFor
} from "@xivgear/common-ui/components/util";
import {NamedSection} from "../../components/general/section";
import {SimSettingsUpdateCallback} from "../simulation_gui";

export function cycleSettingsGui(cycleSettings: CycleSettings, updateCallback: SimSettingsUpdateCallback) {
    const out = new NamedSection('Cycle Settings');
    const timeField = new FieldBoundFloatField(cycleSettings, 'totalTime', {
        // 1 hour of sim time should be enough for any application
        // Also provide a minimum of 15 seconds since some sims break in bad ways at very short times.
        // The user is most likely not actually trying to enter that, they're probably in the middle of typing the
        // actual value.
        postValidators: [clampValues(15, 60 * 60)],
    });
    // TODO: might be nice to make this an official part of the FieldBoundConvertingTextField
    // Make this apply immediately on pressing enter or focus loss.
    timeField.addEventListener('change', () => updateCallback(0));
    timeField.id = 'cycle-total-time';
    const label = labelFor('Total Time:', timeField);
    out.contentArea.appendChild(label);
    out.contentArea.appendChild(timeField);
    out.contentArea.appendChild(document.createElement('br'));
    const autosCb = new FieldBoundCheckBox(cycleSettings, 'useAutos');
    autosCb.addListener(() => updateCallback(100));
    out.contentArea.appendChild(labeledCheckbox('Use Auto-Attacks', autosCb));
    return out;
}
