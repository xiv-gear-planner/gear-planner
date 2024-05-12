import {ResultSettings} from "../sim_processors";
import {FieldBoundFloatField, labelFor} from "../../components/util";

export class ResultSettingsArea extends HTMLElement {
    constructor(resultSettings: ResultSettings) {
        super();
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