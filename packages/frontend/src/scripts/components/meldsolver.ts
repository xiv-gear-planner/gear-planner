import { CharacterGearSet } from "@xivgear/core/gear";
import { SetExport, SimExport } from "@xivgear/xivmath/geartypes";
import { SimResult, SimSettings, Simulation } from "@xivgear/core/sims/sim_types";
import { GearPlanSheet } from "@xivgear/core/sheet";
import { GearsetGenerationRequest, SolverSimulationRequest, workerPool } from "../workers/worker_pool";
import { GearsetGenerationSettings } from "@xivgear/core/solving/gearset_generation";
import { SolverSimulationSettings } from "@xivgear/core/solving/sim_runner";
import { range } from "@xivgear/core/util/array_utils";

export class MeldSolverSettings {
    sim: Simulation<SimResult, SimSettings, unknown>;
    gearset: CharacterGearSet;
    overwriteExistingMateria: boolean;
    useTargetGcd: boolean;
    targetGcd?: number;
}

/**
 * Different from MeldsolverSettings because webworkers needs a serializable object
 * There's probably a better way than
 */
export class MeldSolverSettingsExport {
    sim: SimExport;
    gearset: SetExport;
    overwriteExistingMateria: boolean;
    useTargetGcd: boolean;
    targetGcd?: number;
}

/**
 * Represents a **Single Instance** of meld solvin
 */
export class MeldSolver {

    readonly _sheet: GearPlanSheet;
    jobs: {
        jobId: number,
        promise: Promise<unknown>;
    }[] = [];

    public constructor(sheet: GearPlanSheet) {
        this._sheet = sheet;
    }

    public async cancel() {
        const promises = [];
        for (const promise of this.jobs) {
            promises.push(workerPool.cancelJob(promise.jobId, this._sheet));
        }

        for (const promise of promises) {
            await promise;
        }
    }

    public async solveMelds(
        gearsetGenSettings: GearsetGenerationSettings,
        simSettings: SolverSimulationSettings,
        update: (val: unknown) => void): Promise<CharacterGearSet> {

        if (!simSettings) {
            return null;
        }

        const gearsetGenRequest: GearsetGenerationRequest = {
            jobType: 'generateGearset',
            sheet: this._sheet.exportSheet(),
            data: GearsetGenerationSettings.export(gearsetGenSettings, this._sheet)
        };
        console.log("n: ", workerPool.numFreeWorkers);
        const gearGenJob = workerPool.requestWork(gearsetGenRequest);
        this.jobs.push(gearGenJob)

        let sets: SetExport[] = await (gearGenJob.promise as Promise<SetExport[]>);
        this.jobs = [];

        const nSimJobs = workerPool.numFreeWorkers;
        const nSetsPerJob = Math.ceil(sets.length / nSimJobs);
        const numSets = sets.length;
        let totalSimmed = 0;

        console.log("Solving ", sets.length, " sets");
        console.log("Workers: ", nSimJobs);
        console.log(nSetsPerJob, " per worker");

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _i of range(0, nSimJobs)) {
            
            let jobSets = sets.splice(sets.length - Math.min(nSetsPerJob, sets.length));
            const simRequest: SolverSimulationRequest = {
                jobType: 'solverSimulation',
                sheet: this._sheet.exportSheet(),
                data: {
                    ...SolverSimulationSettings.export(simSettings, this._sheet),
                    sets: jobSets
                }
            }

            this.jobs.push(workerPool.requestWork(simRequest, (numSimmed: number) => {
                totalSimmed += numSimmed;
                update(100 * totalSimmed / numSets);
            }));
            jobSets = undefined;
        }
        sets = undefined;

        const allResults: {
            dps: number,
            set: SetExport,
        }[] = [];

        for (const job of this.jobs) {
            allResults.push(await (job.promise as Promise< {dps: number, set: SetExport }>));
        }

        allResults.sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            return b.dps - a.dps
        });
        return this._sheet.importGearSet(allResults.at(0).set);
    }
}