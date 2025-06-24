import {SimulationGui} from "../simulation_gui";
import {EmptyObject} from "@xivgear/util/util_types";
import {NamedSection} from "../../components/section";
import {simpleMappedResultTable} from "../components/simple_tables";
import {MPResult, MPSettings} from "@xivgear/core/sims/healer/healer_mp";

export class MPSimGui extends SimulationGui<MPResult, MPSettings, EmptyObject> {
    makeConfigInterface = this.makeDescriptionPanel;

    makeResultDisplay(result: MPResult): HTMLElement {
        const tbl = simpleMappedResultTable<MPResult>({
            'mainDpsResult': 'MP per minute',
            'baseRegen': 'MP Regen without actions',
            'minutesToZero': 'Minutes to Zero',
        })(result);
        tbl.classList.add('sim-basic-result-table');
        const description = this.makeDescriptionPanel();
        description.appendChild(tbl);
        description.style.maxWidth = '500px';
        return description;
    }

    makeDescriptionPanel(): HTMLElement {
        const out = new NamedSection('MP per Minute');
        const text = document.createElement('p');
        text.textContent = 'This calculation represents MP gains and expenditures standardized to a period of 60 seconds. It is an oversimplification as the actual time to run out of MP will depend on other factors, but can be used to compare the effect of additional spell speed and piety.';
        out.contentArea.appendChild(text);
        return out;
    }
}
