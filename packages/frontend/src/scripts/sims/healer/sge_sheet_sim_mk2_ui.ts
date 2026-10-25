import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {SgeNewSheetSettings, SgeSheetSimResult} from "@xivgear/sims/healer/sge_sheet_sim_mk2";
import {potionOptionsDropdown} from "../common/sim_ui_utils";
import {el} from "@xivgear/common-ui/components/util";

export class SgeSheetSimGui extends BaseMultiCycleSimGui<SgeSheetSimResult, SgeNewSheetSettings> {
    makeCustomConfigInterface(settings: SgeNewSheetSettings, updateCallback: () => void): HTMLElement | null {
        return el('div', {}, [potionOptionsDropdown(settings)]);
    }
}
