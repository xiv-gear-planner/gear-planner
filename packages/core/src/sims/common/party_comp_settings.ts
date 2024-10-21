import {JobName} from "@xivgear/xivmath/xivconstants";
import {ALL_BUFFS, BuffSaveKey} from "@xivgear/core/sims/buffs";
import {PartyBuff} from "@xivgear/core/sims/sim_types";

export type BuffSettingsExport = {
    /**
     * Enabled jobs
     */
    jobs: JobName[],
    /**
     * Enabled buffs
     */
    buffs: BuffSaveKey[]
}

class JobSettings {
    constructor(public readonly job: JobName, private readonly buffs: BuffSetting[], public enabled: boolean) {

    }

    get allBuffs() {
        return [...this.buffs,];
    }

    get enabledBuffs() {
        return this.enabled ? this.buffs.filter(buff => buff.enabled) : [];
    }
}

class BuffSetting {
    constructor(public readonly buff: PartyBuff, public enabled: boolean) {

    }

}

export class BuffSettingsManager {
    private readonly jobs: readonly JobSettings[];

    static fromSaved(saved: BuffSettingsExport) {
        return new BuffSettingsManager(saved.jobs, saved.buffs);
    }

    static defaultForJob(job: JobName) {
        return new BuffSettingsManager([job,]);
    }

    private static makeJobBuffMapping(): { [k in JobName]?: PartyBuff[] } {
        return ALL_BUFFS.reduce(((map, val) => {
            const job = val.job;
            if (job in map) {
                map[job].push(val);
            }
            else {
                map[job] = [val,];
            }
            return map;
        }), {});
    }

    private static getBuffKey(buff: PartyBuff): BuffSaveKey {
        return (buff.saveKey ?? buff.name) as BuffSaveKey;
    }

    private constructor(enabledJobs: JobName[], enabledBuffs?: BuffSaveKey[]) {
        const jobBuffMapping = BuffSettingsManager.makeJobBuffMapping();
        this.jobs = Object.entries(jobBuffMapping).map(([job, buffs,]) => {
            const buffSettings: BuffSetting[] = buffs.map(buff => {
                if (enabledBuffs === undefined) {
                    return new BuffSetting(buff, !(buff.optional));
                }

                const enabled = enabledBuffs.findIndex(b => b === BuffSettingsManager.getBuffKey(buff)) !== -1;
                return new BuffSetting(buff, enabled);
            });
            return new JobSettings(job as JobName, buffSettings, enabledJobs.includes(job as JobName));
        });
    }

    exportSetting(): BuffSettingsExport {
        return {
            jobs: this.jobs.filter(jobSetting => jobSetting.enabled)
                .map(jobSetting => jobSetting.job),
            buffs: this.individuallyEnabledBuffs.map(buff => BuffSettingsManager.getBuffKey(buff)),
        };
    }

    get allJobs() {
        return this.jobs;
    }

    get enabledBuffs() {
        return this.jobs.flatMap(job => job.enabledBuffs)
            .map(buffSetting => buffSetting.buff);
    }

    private get individuallyEnabledBuffs() {
        return this.jobs.flatMap(job => job.allBuffs)
            .filter(buffSetting => buffSetting.enabled)
            .map(buffSetting => buffSetting.buff);
    }
}


