import { BluBreath60Spec } from "./blu/blu_breath60";
import { BluFlame120Spec } from "./blu/blu_flame120";
import { BluFlame60Spec } from "./blu/blu_flame60";
import { BluF2PSpec } from "./blu/blu_free_trial";
import { BluWinged120Spec } from "./blu/blu_winged120";
import { BluWinged60Spec } from "./blu/blu_winged60";
import { potRatioSimSpec } from "./common/potency_ratio";
import { astNewSheetSpec } from "./healer/ast_sheet_sim";
import { schNewSheetSpec } from "./healer/sch_sheet_sim";
import { sgeSheetSpec } from "./healer/sge_sheet_sim";
import { sgeNewSheetSpec } from "./healer/sge_sheet_sim_mk2";
import { whmNewSheetSpec } from "./healer/whm_new_sheet_sim";
import { whmSheetSpec } from "./healer/whm_sheet_sim";
import { ninSpec } from "./melee/nin/nin_lv100_sim";
import { rprSheetSpec } from "./melee/rpr/rpr_sheet_sim";
import { samSpec } from "./melee/sam/sam_lv100_sim";
import { vprSheetSpec } from "./melee/vpr/vpr_sheet_sim";
import { dncDtSheetSpec } from "./ranged/dnc_sim";
import { registerSim } from "./sim_registry";
import { pldUsageSimSpec } from "./tank/pld/pld_usage_sim_no_sks";
import { pldSKSSheetSpec } from "./tank/pld/pldsks_sim";
import { warSpec } from "./tank/war/war_sheet_sim";
import { drkSpec } from "./tank/drk/drk_sheet_sim";

let registrationDone = false;

export function registerDefaultSims() {
    if (registrationDone) {
        console.warn("Duplicate registration!", new Error("Duplicate registration!"));
        return;
    }
    else {
        registrationDone = true;
    }
    registerSim(potRatioSimSpec);
    registerSim(pldUsageSimSpec);
    registerSim(pldSKSSheetSpec);
    registerSim(drkSpec);
    registerSim(warSpec);
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
