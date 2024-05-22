import {ResultSettings} from "../sim_processors";
import {FieldBoundFloatField, labelFor} from "../../components/util";
import {NamedSection} from "../../components/section";

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