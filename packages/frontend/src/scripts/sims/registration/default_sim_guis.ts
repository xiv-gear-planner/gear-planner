// General
import {potRatioSimSpec} from "@xivgear/core/sims/common/potency_ratio";
import {PotencyRatioSimGui} from "../common/potency_ratio_ui";
import {pldUsageSimSpec} from "@xivgear/core/sims/tank/pld/pld_usage_sim_no_sks";
import {BaseUsageCountSimGui} from "../count_sim_gui";
import {pldSKSSheetSpec} from "@xivgear/core/sims/tank/pld/pldsks_sim";
import {pldSKSSimGui} from "../tank/pldsks_sheet_sim_ui";
import {drkSpec} from "@xivgear/core/sims/tank/drk/drk_sheet_sim";
import {DrkSimGui} from "../tank/drk_sheet_sim_ui";
import {warSpec} from "@xivgear/core/sims/tank/war/war_sheet_sim";
import {WarSimGui} from "../tank/war_sheet_sim_ui";
import {gnbSpec} from "@xivgear/core/sims/tank/gnb/gnb_sheet_sim";
import {GnbSimGui} from "../tank/gnb_sheet_sim_ui";
import {pldSpec} from "@xivgear/core/sims/tank/pld/pld_sheet_sim";
import {PldSimGui} from "../tank/pld_sheet_sim_ui";
import {whmSheetSpec} from "@xivgear/core/sims/healer/whm_sheet_sim";
import {WhmSheetSimGui} from "../healer/whm_sheet_sim_ui";
import {sgeSheetSpec} from "@xivgear/core/sims/healer/sge_sheet_sim";
import {SgeSimGui} from "../healer/sge_sheet_sim_ui";
import {sgeNewSheetSpec} from "@xivgear/core/sims/healer/sge_sheet_sim_mk2";
import {SgeSheetSimGui} from "../healer/sge_sheet_sim_mk2_ui";
import {astNewSheetSpec} from "@xivgear/core/sims/healer/ast_sheet_sim";
import {AstSheetSimGui} from "../healer/ast_sheet_sim_ui";
import {schNewSheetSpec} from "@xivgear/core/sims/healer/sch_sheet_sim";
import {SchSimGui} from "../healer/sch_sheet_sim_ui";
import {whmNewSheetSpec} from "@xivgear/core/sims/healer/whm_new_sheet_sim";
import {WhmSimGui} from "../healer/whm_new_sheet_sim_ui";
import {mpSimSpec} from "@xivgear/core/sims/healer/healer_mp";
import {MPSimGui} from "../healer/healer_mp_sim_ui";
import {drgSpec} from "@xivgear/core/sims/melee/drg/drg_sim";
import {DrgSimGui} from "../melee/drg/drg_sim_ui";
import {rprSheetSpec} from "@xivgear/core/sims/melee/rpr/rpr_sheet_sim";
import {RprSheetSimGui} from "../melee/rpr/rpr_sheet_sim_ui";
import {vprSheetSpec} from "@xivgear/core/sims/melee/vpr/vpr_sheet_sim";
import {VprSimGui} from "../melee/vpr/vpr_sheet_sim_ui";
import {ninSpec} from "@xivgear/core/sims/melee/nin/nin_lv100_sim";
import {NinSheetSimGui} from "../melee/nin/nin_lvl100_sim_ui";
import {mnkSpec} from "@xivgear/core/sims/melee/mnk/mnk_sim";
import {MnkSimGui} from "../melee/mnk/mnk_sim_ui";
import {samSpec} from "@xivgear/core/sims/melee/sam/sam_lv100_sim";
import {SamSimGui} from "../melee/sam/sam_lvl100_sim_ui";
import {dncDtSheetSpec} from "@xivgear/core/sims/ranged/dnc_sim";
import {blmSpec} from "@xivgear/core/sims/caster/blm/blm_sheet_sim";
import {BlmSimGui} from "../caster/blm_sim_ui";
import {blmPpsSpec} from "@xivgear/core/sims/caster/blm/blm_pps_sim";
import {BlmPpsGui} from "../caster/blm_pps_ui";
import {BluWinged120Spec} from "@xivgear/core/sims/blu/blu_winged120";
import {BluSimGui} from "../blu/blu_common_ui";
import {BluFlame120Spec} from "@xivgear/core/sims/blu/blu_flame120";
import {BluBreath60Spec} from "@xivgear/core/sims/blu/blu_breath60";
import {BluWinged60Spec} from "@xivgear/core/sims/blu/blu_winged60";
import {BluFlame60Spec} from "@xivgear/core/sims/blu/blu_flame60";
import {BluF2PSpec} from "@xivgear/core/sims/blu/blu_free_trial";
import {registerGui} from "./sim_guis";
import {registerDefaultSims} from "@xivgear/core/sims/default_sims";

export const registerSims = registerDefaultSims;

export function registerDefaultSimGuis() {

    registerGui(potRatioSimSpec, PotencyRatioSimGui);
    // Tanks
    registerGui(pldUsageSimSpec, BaseUsageCountSimGui);
    registerGui(pldSKSSheetSpec, pldSKSSimGui);
    registerGui(drkSpec, DrkSimGui);
    registerGui(warSpec, WarSimGui);
    registerGui(gnbSpec, GnbSimGui);
    registerGui(pldSpec, PldSimGui);
    // Healers
    registerGui(whmSheetSpec, WhmSheetSimGui);
    registerGui(sgeSheetSpec, SgeSimGui);
    registerGui(sgeNewSheetSpec, SgeSheetSimGui);
    registerGui(astNewSheetSpec, AstSheetSimGui);
    registerGui(schNewSheetSpec, SchSimGui);
    registerGui(whmNewSheetSpec, WhmSimGui);
    registerGui(mpSimSpec, MPSimGui);
    // Melee
    registerGui(drgSpec, DrgSimGui);
    registerGui(rprSheetSpec, RprSheetSimGui);
    registerGui(vprSheetSpec, VprSimGui);
    registerGui(ninSpec, NinSheetSimGui);
    registerGui(mnkSpec, MnkSimGui);
    registerGui(samSpec, SamSimGui);
    // Ranged
    registerGui(dncDtSheetSpec, BaseUsageCountSimGui);
    // Caster
    registerGui(blmSpec, BlmSimGui);
    registerGui(blmPpsSpec, BlmPpsGui);
    registerGui(BluWinged120Spec, BluSimGui);
    registerGui(BluFlame120Spec, BluSimGui);
    registerGui(BluBreath60Spec, BluSimGui);
    registerGui(BluWinged60Spec, BluSimGui);
    registerGui(BluFlame60Spec, BluSimGui);
    registerGui(BluF2PSpec, BluSimGui);

}
