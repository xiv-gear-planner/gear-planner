import {CharacterGearSet} from "@xivgear/core/gear";
import {SetExport, SimExport} from "@xivgear/xivmath/geartypes";
import {SimResult, SimSettings, Simulation} from "@xivgear/core/sims/sim_types";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {GearsetGenerationRequest, SolverSimulationRequest, workerPool} from "../workers/worker_pool";
import {GearsetGenerationSettings} from "@xivgear/core/solving/gearset_generation";
import {SolverSimulationSettings} from "@xivgear/core/solving/sim_runner";
import {range} from "@xivgear/core/util/array_utils";

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
        for (const job of this.jobs) {
            promises.push(workerPool.cancelJob(job.jobId));
        }
        await Promise.all(promises);
    }

    public async solveMelds(
        gearsetGenSettings: GearsetGenerationSettings,
        simSettings: SolverSimulationSettings,
        update: (percentage: unknown, total: number) => void): Promise<[CharacterGearSet, number]> {

        if (!simSettings) {
            return null;
        }

        const gearsetGenRequest: GearsetGenerationRequest = {
            jobType: 'generateGearset',
            sheet: this._sheet.exportSheet(),
            data: GearsetGenerationSettings.export(gearsetGenSettings, this._sheet),
        };

        const gearGenJob = workerPool.submitTask(gearsetGenRequest);
        this.jobs.push(gearGenJob);

        // This will return gear sets "loosely ordered", where they are broken into buckets based on
        // the usual cycle sim cache key (weapon delay + sks + sps). Each bucket is placed contiguously
        // into the list, but there is no guarantee of ordering of the buckets.
        let sets: SetExport[] = await (gearGenJob.promise as Promise<SetExport[]>);
        if (sets.length === 0) {
            return [undefined, undefined];
        }
        this.jobs = [];

        const nSimJobs = workerPool.maxWorkers;
        const nSetsPerJob = Math.ceil(sets.length / nSimJobs);
        const numSets = sets.length;
        let totalSimmed = 0;
        // Split up very large chunks of work, so that we don't get a "long tail" issue where one worker
        // has lagged behind but the other workers have no way of picking up the slack.
        const numWorkSplits = Math.max(nSimJobs, Math.ceil(numSets / 1_000));

        console.log("Solving ", sets.length, " sets");
        console.log("Workers: ", nSimJobs);
        console.log(nSetsPerJob, " per worker");

        for (const _ of range(0, numWorkSplits)) {

            let jobSets = sets.splice(sets.length - Math.min(nSetsPerJob, sets.length));
            if (jobSets.length === 0) {
                break;
            }
            const simRequest: SolverSimulationRequest = {
                jobType: 'solverSimulation',
                sheet: this._sheet.exportSheet(),
                data: {
                    ...SolverSimulationSettings.export(simSettings, this._sheet),
                    sets: jobSets,
                },
            };

            this.jobs.push(workerPool.submitTask(simRequest, (numSimmed: number) => {
                totalSimmed += numSimmed;
                update(100 * totalSimmed / numSets, numSets);
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
            return b.dps - a.dps;
        });
        return [this._sheet.importGearSet(allResults.at(0).set), allResults.at(0).dps];
    }
}
