import { pldUsageSimSpec } from "./tank/pld/pld_usage_sim_no_sks";
import { pldSKSSheetSpec } from "./tank/pld/pldsks_sim";
import { whmSheetSpec } from "./healer/whm_sheet_sim";
import { sgeSheetSpec } from "./healer/sge_sheet_sim";
import { sgeNewSheetSpec } from "./healer/sge_sheet_sim_mk2";
import { astNewSheetSpec } from "./healer/ast_sheet_sim";
import { schNewSheetSpec } from "./healer/sch_sheet_sim";
import { whmNewSheetSpec } from "./healer/whm_new_sheet_sim";
import { rprSheetSpec } from "./melee/rpr/rpr_sheet_sim";
import { vprSheetSpec } from "./melee/vpr/vpr_sheet_sim";
import { ninSpec } from "./melee/nin/nin_lv100_sim";
import { samSpec } from "./melee/sam/sam_lv100_sim";
import { potRatioSimSpec } from "./common/potency_ratio";
import { BluWinged120Spec } from "./blu/blu_winged120";
import { BluFlame120Spec } from "./blu/blu_flame120";
import { BluF2PSpec } from "./blu/blu_free_trial";
import { BluFlame60Spec } from "./blu/blu_flame60";
import { BluWinged60Spec } from "./blu/blu_winged60";
import { BluBreath60Spec } from "./blu/blu_breath60";
import { registerSim } from "@xivgear/core/sims/sim_registry";
import { dncDtSheetSpec } from "./ranged/dnc_sim";
import { ExportSettingsTypeOfSim, ResultTypeOfSim, SettingsTypeOfSim, SimulationGui } from "./simulation_gui";
import { PotencyRatioSimGui } from "./common/potency_ratio_ui";
import { BaseUsageCountSimGui } from "./count_sim_gui";
import { BaseMultiCycleSimGui } from "./multicyclesim_ui";
import { WhmSheetSimGui } from "./healer/whm_sheet_sim_ui";
import { SgeSheetSimGui } from "./healer/sge_sheet_sim_mk2_ui";
import { AstSheetSimGui } from "./healer/ast_sheet_sim_ui";
import { SchSimGui } from "./healer/sch_sheet_sim_ui";
import { WhmSimGui } from "./healer/whm_new_sheet_sim_ui";
import { RprSheetSimGui } from "./melee/rpr/rpr_sheet_sim_ui";
import { VprSimGui } from "./melee/vpr/vpr_sheet_sim_ui";
import { NinSheetSimGui } from "./melee/nin/nin_lvl100_sim_ui";
import { SamSimGui } from "./melee/sam/sam_lvl100_sim_ui";
import { SimResult, SimSpec, Simulation } from "@xivgear/core/sims/sim_types";
import { SgeSimGui } from "./healer/sge_sheet_sim_ui";

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

type SimGuiCtor<X extends Simulation<SimResult, unknown, unknown>> = {
    new (sim: X): SimulationGui<ResultTypeOfSim<X>, SettingsTypeOfSim<X>, ExportSettingsTypeOfSim<X>>;
}
function registerGui<X extends Simulation<SimResult, unknown, unknown>>(simSpec: SimSpec<X, unknown>, guiCtor: SimGuiCtor<X>) {
    simGuiMap.set(simSpec as SimSpec<never, never>, guiCtor as SimGuiCtor<never>)
}
function getGuiCtor<X extends Simulation<never, never, never>>(simSpec: SimSpec<X, never>): SimGuiCtor<X> {
    return simGuiMap.get(simSpec as SimSpec<never, never>);
}
export function makeGui<X extends Simulation<SimResult, unknown, unknown>>(sim: X): SimulationGui<ResultTypeOfSim<X>, SettingsTypeOfSim<X>, ExportSettingsTypeOfSim<X>> {
    const ctor: SimGuiCtor<X> = getGuiCtor(sim.spec);
    return new ctor(sim);
}
export const simGuiMap: Map<SimSpec<never, never>, SimGuiCtor<never>> = new Map;
registerGui(potRatioSimSpec, PotencyRatioSimGui)
registerGui(potRatioSimSpec, PotencyRatioSimGui);
registerGui(pldUsageSimSpec, BaseUsageCountSimGui);
registerGui(pldSKSSheetSpec, BaseMultiCycleSimGui);
registerGui(whmSheetSpec, WhmSheetSimGui);
registerGui(sgeSheetSpec, SgeSimGui);
registerGui(sgeNewSheetSpec, SgeSheetSimGui);
registerGui(astNewSheetSpec, AstSheetSimGui);
registerGui(schNewSheetSpec, SchSimGui);
registerGui(whmNewSheetSpec, WhmSimGui);
registerGui(rprSheetSpec, RprSheetSimGui);
registerGui(vprSheetSpec, VprSimGui);
registerGui(ninSpec, NinSheetSimGui);
registerGui(samSpec, SamSimGui);
registerGui(BluWinged120Spec, BaseMultiCycleSimGui);
registerGui(BluFlame120Spec, BaseMultiCycleSimGui);
registerGui(BluBreath60Spec, BaseMultiCycleSimGui);
registerGui(BluWinged60Spec, BaseMultiCycleSimGui);
registerGui(BluFlame60Spec, BaseMultiCycleSimGui);
registerGui(BluF2PSpec, BaseMultiCycleSimGui);
registerGui(dncDtSheetSpec, BaseUsageCountSimGui);