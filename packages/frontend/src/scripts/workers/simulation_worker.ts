import {GearPlanSheet} from "@xivgear/core/sheet";
import {SimRunner} from "@xivgear/core/solving/sim_runner";
import {SetExport} from "@xivgear/xivmath/geartypes";
import {JobInfo, WorkerBehavior} from "./worker_common";
import {JobContext, SolverSimulationRequest} from "@xivgear/core/workers/worker_types";

export type SolverSimulationResult = {
    dps: number;
    set: SetExport;
}

export type SolverSimulationJobContext = JobContext<SolverSimulationRequest, number, SolverSimulationResult>;

export class SolverSimulationRunner extends WorkerBehavior<SolverSimulationJobContext> {

    readonly sheet: GearPlanSheet;

    public constructor(sheet: GearPlanSheet, info: JobInfo) {
        super(info);
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

        const [bestDps, bestSet] = await simRunner.simulateSetsAndReturnBest(this.sheet, settings.sets, (n) => this.postUpdate(n));
        const result = {
            dps: bestDps,
            set: this.sheet.exportGearSet(bestSet),
        };

        this.postResult(result);
    }
}
