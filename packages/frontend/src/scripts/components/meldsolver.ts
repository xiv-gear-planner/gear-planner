import {CharacterGearSet} from "@xivgear/core/gear";
import {MicroSetExport, SetExport, SimExport} from "@xivgear/xivmath/geartypes";
import {SimResult, SimSettings, Simulation} from "@xivgear/core/sims/sim_types";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {GearsetGenerationSettings} from "@xivgear/core/solving/gearset_generation";
import {SolverSimulationSettings} from "@xivgear/core/solving/sim_runner";
import {range} from "@xivgear/core/util/array_utils";
import {WORKER_POOL} from "../workers/worker_pool";
import {GearsetGenerationRequest, SolverSimulationRequest} from "@xivgear/core/workers/worker_types";
import {GearsetGenerationJobContext} from "../workers/meld_generation_worker";
import {SolverSimulationJobContext} from "../workers/simulation_worker";

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
            promises.push(WORKER_POOL.cancelJob(job.jobId));
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

        let sets: MicroSetExport[] = [];

        const gearGenJob = WORKER_POOL.submitTask<GearsetGenerationJobContext>(gearsetGenRequest, s => sets.push(...s));
        this.jobs.push(gearGenJob);
        await gearGenJob.promise;
        // This will return gear sets "loosely ordered", where they are broken into buckets based on
        // the usual cycle sim cache key (weapon delay + sks + sps). Each bucket is placed contiguously
        // into the list, but there is no guarantee of ordering of the buckets.
        if (sets.length === 0) {
            return [undefined, undefined];
        }
        this.jobs = [];

        // Give GC time to catch up?
        await new Promise(resolve => setTimeout(resolve, 1_000));

        const nSimJobs = WORKER_POOL.maxWorkers;
        const nSetsPerJob = Math.ceil(sets.length / nSimJobs);
        const numSets = sets.length;
        update(0, numSets);
        let totalSimmed = 0;
        // Split up very large chunks of work, so that we don't get a "long tail" issue where one worker
        // has lagged behind but the other workers have no way of picking up the slack.
        // Cap at 1000 sets per sub-job
        const numWorkSplits = Math.max(nSimJobs, Math.ceil(numSets / 1_000));

        console.log("Solving ", sets.length, " sets");
        console.log("Workers: ", nSimJobs);
        console.log(nSetsPerJob, " per worker");

        const solverSimulationSettingsExport = SolverSimulationSettings.export(simSettings);

        let pending = 0;

        for (const _ of range(0, numWorkSplits)) {
            // await new Promise(resolve => setTimeout(resolve, 500));
            // Don't bother queueing an unnecessary amount of jobs because the job request is heavy
            while (pending >= WORKER_POOL.maxWorkers + 2) {
                // TODO not very good
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            let jobSets = sets.splice(sets.length - Math.min(nSetsPerJob, sets.length));
            if (jobSets.length === 0) {
                break;
            }
            const simRequest: SolverSimulationRequest = {
                jobType: 'solverSimulation',
                sheet: this._sheet.exportSheet(),
                data: {
                    ...solverSimulationSettingsExport,
                    sets: jobSets,
                },
            };
            jobSets = undefined;
            const task = WORKER_POOL.submitTask<SolverSimulationJobContext>(simRequest, (numSimmed: number) => {
                totalSimmed += numSimmed;
                update(100 * totalSimmed / numSets, numSets);
            });

            this.jobs.push(task);
            task.promise.then(() => pending -= 1);

            pending += 1;
        }

        sets = undefined;

        const allResults: {
            dps: number,
            set: SetExport,
        }[] = [];

        for (const job of this.jobs) {
            allResults.push(await (job.promise as Promise<{
                dps: number,
                set: SetExport
            }>));
        }

        allResults.sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            return b.dps - a.dps;
        });

        return [this._sheet.importGearSet(allResults.at(0).set), allResults.at(0).dps];
    }
}
