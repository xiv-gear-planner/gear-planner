import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {SimulationGui} from "../simulation_gui";
import {writeProxy} from "@xivgear/util/proxies";
import {simpleKvTable} from "../components/simple_tables";
import {NamedSection} from "../../components/general/section";
import {quickElement} from "@xivgear/common-ui/components/util";
import {BlmPpsResult, BlmPpsSettings, BlmPpsSettingsExternal} from "@xivgear/core/sims/caster/blm/blm_pps_sim";
import {applyStdDev} from "@xivgear/xivmath/deviation";
import {ResultSettingsArea} from "../components/result_settings";

export class BlmPpsGui extends SimulationGui<BlmPpsResult, BlmPpsSettings, BlmPpsSettingsExternal> {

    makeMainResultDisplay(result: BlmPpsResult): HTMLElement {
        // noinspection JSNonASCIINames
        const mainResultsTable = simpleKvTable({
            "Expected DPS": result.mainDpsFull.expected,
            "Std Deviation": result.mainDpsFull.stdDev,
            "Expected +1σ": applyStdDev(result.mainDpsFull, 1),
            "Expected +2σ": applyStdDev(result.mainDpsFull, 2),
            "Expected +3σ": applyStdDev(result.mainDpsFull, 3),
            "PPS": result.pps,
            "PPS with Enochian": result.ppsWithEno,
        });
        mainResultsTable.classList.add('main-results-table');
        return quickElement('div', ['count-sim-results-area'], [mainResultsTable]);
    }

    makeResultDisplay(result: BlmPpsResult): HTMLElement {
        return this.makeMainResultDisplay(result);
    }

    makeConfigInterface(settings: BlmPpsSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const simSettings = new NamedSection('Sim Settings');

        const useStandardF3PCB = new FieldBoundCheckBox(settings, "useStandardF3P");
        simSettings.appendChild(labeledCheckbox("Use AF1 F3P consistently to enter Astral Fire. (ignored at levels 80 and below)", useStandardF3PCB));

        const useColdB3CB = new FieldBoundCheckBox(settings, "useColdB3");
        simSettings.appendChild(labeledCheckbox("Use instant cast UI1 B3 when possible. (ignored at level 70)", useColdB3CB));

        const spendManafontF3PCB = new FieldBoundCheckBox(settings, "spendManafontF3P");
        simSettings.appendChild(labeledCheckbox("Spend the free F3P granted by Manafont. (ignored at levels 80 and below)", spendManafontF3PCB));

        configDiv.appendChild(simSettings);

        configDiv.appendChild(new ResultSettingsArea(writeProxy(settings, _updateCallback)));

        return configDiv;
    }

    makeToolTip(result: BlmPpsResult): string {
        return `DPS: ${result.mainDpsResult}\nPPS: ${result.pps}\nwith Enochian: ${result.ppsWithEno}\n`;
    }
}
