import {CharacterGearSet} from "@xivgear/core/gear";
import {MicroSetExport, SetExport, SimExport} from "@xivgear/xivmath/geartypes";
import {SimResult, SimSettings, Simulation} from "@xivgear/core/sims/sim_types";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {GearsetGenerationSettings} from "@xivgear/core/solving/gearset_generation";
import {SolverSimulationSettings} from "@xivgear/core/solving/sim_runner";
import {WORKER_POOL} from "../workers/worker_pool";
import {GearsetGenerationRequest, SolverSimulationRequest} from "@xivgear/core/workers/worker_types";
import {SolverSimulationJobContext} from "../workers/simulation_worker";
import {
    GearsetGenerationJobContext,
    GearsetGenerationStatusUpdate,
    MeldSolvingStatusUpdate
} from "@xivgear/core/solving/types";

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
    solveFood: boolean;
    targetGcd?: number;
}

let pending = 0;

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
        for (const job of this.jobs) {
            WORKER_POOL.cancelJob(job.jobId);
        }
    }

    public async solveMelds(
        gearsetGenSettings: GearsetGenerationSettings,
        simSettings: SolverSimulationSettings,
        update: (update: GearsetGenerationStatusUpdate | MeldSolvingStatusUpdate) => void
    ): Promise<[CharacterGearSet, number]> {

        if (!simSettings) {
            return null;
        }

        const gearsetGenRequest: GearsetGenerationRequest = {
            jobType: 'generateGearset',
            sheet: this._sheet.exportSheet(),
            data: GearsetGenerationSettings.export(gearsetGenSettings, this._sheet),
        };

        const sets: MicroSetExport[] = [];

        const gearGenJob = WORKER_POOL.submitTask<GearsetGenerationJobContext>(gearsetGenRequest, s => {
            if (s.type === 'sets') {
                for (let i = 0; i < s.sets.length; i++) {
                    sets.push(s.sets[i]);
                }
            }
            else if (s.type === 'status') {
                update(s);
            }
            else {
                console.warn(`Unknown update type: ${s['type']}`);
            }
        });
        this.jobs.push(gearGenJob);
        await gearGenJob.promise;
        // This will return gear sets "loosely ordered", where they are broken into buckets based on
        // the usual cycle sim cache key (weapon delay + sks + sps). Each bucket is placed contiguously
        // into the list, but there is no guarantee of ordering of the buckets.
        if (sets.length === 0) {
            return [undefined, undefined];
        }
        this.jobs = [];

        const maxWorkers = WORKER_POOL.maxWorkers;
        const numSets = sets.length;
        // Split up very large chunks of work, so that we don't get a "long tail" issue where one worker
        // has lagged behind but the other workers have no way of picking up the slack.
        // Cap at 5000 sets per sub-job
        const numWorkSplits = Math.max(maxWorkers, Math.ceil(numSets / 1_000));
        const nSetsPerJob = Math.ceil(sets.length / numWorkSplits);
        update({
            done: 0,
            total: numSets,
        });
        let totalSimmed = 0;

        // Give GC time to catch up, also gives the UI a chance to update
        await new Promise(resolve => setTimeout(resolve, 1_000));

        console.log(`Solving ${sets.length} sets`);
        console.log(`Workers: ${maxWorkers}`);
        console.log(`${nSetsPerJob} per worker`);

        const solverSimulationSettingsExport = SolverSimulationSettings.export(simSettings);

        pending = 0;

        while (sets.length > 0) {
            // await new Promise(resolve => setTimeout(resolve, 500));
            // Don't bother queueing an unnecessary amount of jobs because the job request is heavy
            while (pending >= WORKER_POOL.maxWorkers + 2) {
                // TODO not very good
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            // Take from the end of the list, modifying in place
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
                update({
                    done: totalSimmed,
                    total: numSets,
                });
            });

            this.jobs.push(task);
            task.promise.then(() => {
                // Small delay to let GC catch up
                setTimeout(() => {
                    pending -= 1;
                }, 500);
            });

            pending += 1;
        }

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

        if (totalSimmed !== numSets) {
            console.log(`MISMATCH: Simmed ${totalSimmed} / ${numSets} sets`);
        }
        else {
            console.log(`Simmed ${totalSimmed} sets`);
        }

        allResults.sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            return b.dps - a.dps;
        });

        return [this._sheet.importGearSet(allResults.at(0).set), allResults.at(0).dps];
    }
}
