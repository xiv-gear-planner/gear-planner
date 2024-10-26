import { GearPlanSheet } from "@xivgear/core/sheet";
import { SimRunner } from "@xivgear/core/solving/sim_runner";
import { SetExport } from "@xivgear/xivmath/geartypes";
import { WorkerBehavior } from "./worker_common";
import { JobContext, SolverSimulationRequest } from "./worker_pool";

export type SolverSimulationResult = {
    dps: number;
    set: SetExport;
}

export type SolverSimulationJobContext = JobContext<SolverSimulationRequest, number, SolverSimulationResult>;

export class SolverSimulationRunner extends WorkerBehavior<SolverSimulationJobContext> {

    readonly sheet: GearPlanSheet;

    public constructor(sheet: GearPlanSheet) {
        super();
        this.sheet = sheet;
    }

    async execute(request: SolverSimulationRequest) {

        const settings = request.data;
        const sim = this.sheet.importSim(settings.sim);
        const simRunner = new SimRunner(sim);
        if (settings.sets === undefined || settings.sets.length === 0) {
            this.postResult(null);
            return;
        }

        const sorted = settings.sets?.map(s => this.sheet.importGearSet(s))?.sort((a, b) => {
            return a.computedStats.gcdPhys(2.5) - b.computedStats.gcdPhys(2.5);
        });

        settings.sets = undefined;
        const [bestDps, bestSet] = await simRunner.simulateSetsAndReturnBest(sorted, this.postUpdate);
        const result = {
            dps: bestDps,
            set: this.sheet.exportGearSet(bestSet),
        };
        this.postResult(result);
    }
}
