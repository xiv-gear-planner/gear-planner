import {pldUsageSimSpec} from "./tank/pld/pld_usage_sim_no_sks"
import {pldSKSSheetSpec} from "./tank/pld/pldsks_sim";
import {whmSheetSpec} from "./healer/whm_sheet_sim";
import {sgeSheetSpec} from "./healer/sge_sheet_sim";
import {sgeNewSheetSpec} from "./healer/sge_sheet_sim_mk2";
import {astNewSheetSpec} from "./healer/ast_sheet_sim";
import {schNewSheetSpec} from "./healer/sch_sheet_sim";
import {whmNewSheetSpec} from "./healer/whm_new_sheet_sim";
import {rprSheetSpec} from "./melee/rpr/rpr_sheet_sim";
import {vprSheetSpec} from "./melee/vpr/vpr_sheet_sim";
import {ninSpec} from "./melee/nin/nin_lv100_sim";
import {samSpec} from "./melee/sam/sam_lv100_sim";
import {potRatioSimSpec} from "./common/potency_ratio";
import {BluWinged120Spec} from "./blu/blu_winged120";
import {BluFlame120Spec} from "./blu/blu_flame120";
import {BluF2PSpec} from "./blu/blu_free_trial";
import {BluFlame60Spec} from "./blu/blu_flame60";
import {BluWinged60Spec} from "./blu/blu_winged60";
import {BluBreath60Spec} from "./blu/blu_breath60";
import {registerSim} from "@xivgear/core/sims/sim_registry";
import {dncDtSheetSpec} from "./ranged/dnc_sim";

export function registerDefaultSims() {
    registerSim(potRatioSimSpec);
    registerSim(pldUsageSimSpec);
    registerSim(pldSKSSheetSpec);
    registerSim(whmSheetSpec);
    registerSim(sgeSheetSpec);
    registerSim(sgeNewSheetSpec);
    registerSim(astNewSheetSpec);
    registerSim(schNewSheetSpec);
    registerSim(whmNewSheetSpec);
    registerSim(rprSheetSpec);
    registerSim(vprSheetSpec);
    registerSim(ninSpec);
    registerSim(samSpec);
    registerSim(BluWinged120Spec);
    registerSim(BluFlame120Spec);
    registerSim(BluBreath60Spec);
    registerSim(BluWinged60Spec);
    registerSim(BluFlame60Spec);
    registerSim(BluF2PSpec);
    registerSim(dncDtSheetSpec);
}
