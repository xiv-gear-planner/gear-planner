import {FieldBoundFloatField, labelFor} from "@xivgear/common-ui/components/util";
import {NamedSection} from "../../components/section";
import {ResultSettings} from "@xivgear/core/sims/cycle_sim";

export class ResultSettingsArea extends NamedSection {
    constructor(resultSettings: ResultSettings) {
        super("Result Settings");
        const inputField = new FieldBoundFloatField(resultSettings, 'stdDevs', {
            inputMode: 'number'
        });
        const label = labelFor('+/- Standard Deviations', inputField);
        label.style.display = 'block';
        this.appendChild(label);
        this.appendChild(inputField);
    }
}

customElements.define('result-settings-area', ResultSettingsArea);
