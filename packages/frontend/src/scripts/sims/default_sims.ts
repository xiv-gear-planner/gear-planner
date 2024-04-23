import {whmSheetSpec} from "./whm_sheet_sim";
import {sgeSheetSpec} from "./sge_sheet_sim";
import {sgeNewSheetSpec} from "./sge_sheet_sim_mk2";
import {astNewSheetSpec} from "./ast_sheet_sim";
import {schNewSheetSpec} from "./sch_sheet_sim";
import {whmNewSheetSpec} from "./whm_new_sheet_sim";
import {rprSheetSpec} from "./rpr_sheet_sim";
import {registerSim} from "../simulation";
import {potRatioSimSpec} from "./potency_ratio";
import { BluWinged120Spec } from "./blu_winged120";

export function registerDefaultSims() {
    registerSim(potRatioSimSpec);
    registerSim(whmSheetSpec);
    registerSim(sgeSheetSpec);
    registerSim(sgeNewSheetSpec);
    registerSim(astNewSheetSpec);
    registerSim(schNewSheetSpec);
    registerSim(whmNewSheetSpec);
    registerSim(rprSheetSpec);
    registerSim(BluWinged120Spec);
}
