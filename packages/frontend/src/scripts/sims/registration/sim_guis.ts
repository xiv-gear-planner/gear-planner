import {ExportSettingsTypeOfSim, ResultTypeOfSim, SettingsTypeOfSim, SimulationGui} from "../simulation_gui";
import {SimResult, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";


type SimGuiCtor<X extends Simulation<SimResult, unknown, unknown>> = {
    new(sim: X): SimulationGui<ResultTypeOfSim<X>, SettingsTypeOfSim<X>, ExportSettingsTypeOfSim<X>>;
}

export function registerGui<X extends Simulation<SimResult, unknown, unknown>>(simSpec: SimSpec<X, unknown>, guiCtor: SimGuiCtor<X>) {
    simGuiMap.set(simSpec as SimSpec<never, never>, guiCtor as SimGuiCtor<never>);
}

function getGuiCtor<X extends Simulation<SimResult, unknown, unknown>>(simSpec: SimSpec<X, never>): SimGuiCtor<X> {
    return simGuiMap.get(simSpec as SimSpec<never, never>);
}

/**
 * Given a simulation, construct a {@link SimulationGui} instance most appropriate for that sim.
 *
 * @param sim The simulation
 */
export function makeGui<X extends Simulation<SimResult, unknown, unknown>>(sim: X): SimulationGui<ResultTypeOfSim<X>, SettingsTypeOfSim<X>, ExportSettingsTypeOfSim<X>> {
    const ctor: SimGuiCtor<X> = getGuiCtor(sim.spec);
    return new ctor(sim);
}

export const simGuiMap: Map<SimSpec<never, never>, SimGuiCtor<never>> = new Map;
