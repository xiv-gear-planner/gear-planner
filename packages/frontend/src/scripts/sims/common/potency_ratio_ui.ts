import {SimSettings} from "@xivgear/core/sims/sim_types";
import {SimulationGui} from "../simulation_gui";
import {EmptyObject} from "@xivgear/util/types";
import {NamedSection} from "../../components/section";
import {simpleMappedResultTable} from "../components/simple_tables";
import {PotencyRatioSimResults} from "@xivgear/core/sims/common/potency_ratio";

function makeDescriptionPanel() {
    const out = new NamedSection('Potency Ratio');
    const text = document.createElement('p');
    text.textContent = 'This calculation represents the expected damage of a 100 potency action. This does not represent an accurate DPS value, as it does not take Skill/Spell Speed into account.';
    out.contentArea.appendChild(text);
    return out;
}

export class PotencyRatioSimGui extends SimulationGui<PotencyRatioSimResults, SimSettings, EmptyObject> {
    makeConfigInterface = makeDescriptionPanel;

    makeResultDisplay(result: PotencyRatioSimResults): HTMLElement {
        const tbl = simpleMappedResultTable<PotencyRatioSimResults>({
            'mainDpsResult': 'Dmg/100p, with Crit/DH',
            'withoutCritDh': 'Dmg/100p, no Crit/DH',
        })(result);
        tbl.classList.add('sim-basic-result-table');
        const description = makeDescriptionPanel();
        description.appendChild(tbl);
        description.style.maxWidth = '400px';
        return description;
    }
}
