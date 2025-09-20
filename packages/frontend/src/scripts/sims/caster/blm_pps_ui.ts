import {FieldBoundCheckBox, FieldBoundIntField, labeledCheckbox, labeledComponent} from "@xivgear/common-ui/components/util";
import {SimulationGui} from "../simulation_gui";
import {NamedSection} from "../../components/section";
import {simpleKvTable} from "../components/simple_tables";
import {BlmPpsResult, BlmPpsSettings, BlmPpsSettingsExternal} from "@xivgear/core/sims/caster/blm/blm_pps_sim";
import {AnyStringIndex} from "@xivgear/util/util_types";
import {applyStdDev} from "@xivgear/xivmath/deviation";

export class BlmPpsGui extends SimulationGui<BlmPpsResult, BlmPpsSettings, BlmPpsSettingsExternal> {

    makeMainResultDisplay(result: BlmPpsResult): HTMLElement {
        // noinspection JSNonASCIINames
        const data: AnyStringIndex = {
            "Expected DPS": result.mainDpsFull.expected,
            "Std Deviation": result.mainDpsFull.stdDev,
            "Expected +1σ": applyStdDev(result.mainDpsFull, 1),
            "Expected +2σ": applyStdDev(result.mainDpsFull, 2),
            "Expected +3σ": applyStdDev(result.mainDpsFull, 3),
            "PPS": result.pps,
        };
        const mainResultsTable = simpleKvTable(data);
        mainResultsTable.classList.add('main-results-table');
        return mainResultsTable;
    }

    makeResultDisplay(result: BlmPpsResult): HTMLElement {
        return this.makeMainResultDisplay(result);
    }

    makeDescriptionPanel(): NamedSection {
        const out = new NamedSection('Potency per second');

        const text = document.createElement('p');
        text.textContent = 'This is potency per second';
        out.contentArea.appendChild(text);

        return out;
    }

    makeConfigInterface(settings: BlmPpsSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        configDiv.appendChild(this.makeDescriptionPanel());

        const useStandardF3PCB = new FieldBoundCheckBox(settings, "useStandardF3P");
        configDiv.appendChild(labeledCheckbox("Use AF1 F3P consistently to enter Astral Fire. (ignored at levels 80 and below)", useStandardF3PCB));

        const useColdB3CB = new FieldBoundCheckBox(settings, "useColdB3");
        configDiv.appendChild(labeledCheckbox("Use instant cast UI1 B3 when possible. (ignored at level 70)", useColdB3CB));

        const spendManafontF3PCB = new FieldBoundCheckBox(settings, "spendManafontF3P");
        configDiv.appendChild(labeledCheckbox("Spend the free F3P granted by Manafont. (ignored at levels 80 and below)", spendManafontF3PCB));

        return configDiv;
    }
}
