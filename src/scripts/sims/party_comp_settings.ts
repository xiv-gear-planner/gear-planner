import {JobName} from "../xivconstants";
import {Buff} from "./sim_types";
import {ALL_BUFFS, BuffName} from "./buffs";
import {FieldBoundCheckBox, labeledCheckbox} from "../components/util";

export type BuffSettingsExport = {
    /**
     * Enabled jobs
     */
    jobs: JobName[],
    /**
     * Enabled buffs
     */
    buffs: BuffName[]
}

class JobSettings {
    constructor(public readonly job: JobName, private readonly buffs: BuffSetting[], public enabled: boolean) {

    }

    get allBuffs() {
        return [...this.buffs];
    }

    get enabledBuffs() {
        return this.enabled ? this.buffs.filter(buff => buff.enabled) : [];
    }
}

class BuffSetting {
    constructor(public readonly buff: Buff, public enabled: boolean) {

    }

}

export class BuffSettingsManager {
    private readonly jobs: readonly JobSettings[];

    constructor(exported?: BuffSettingsExport) {
        const jobBuffMapping: { [k in JobName]?: Buff[] } = ALL_BUFFS.reduce(((map, val) => {
            const job = val.job;
            if (job in map) {
                map[job].push(val);
            }
            else {
                map[job] = [val];
            }
            return map;
        }), {});
        this.jobs = Object.entries(jobBuffMapping).map(([job, buffs]) => {
            const buffSettings: BuffSetting[] = buffs.map(buff => {
                const enabled = exported ? exported.buffs.includes(buff.name as BuffName) : !(buff.optional);
                return new BuffSetting(buff, enabled);
            })
            return new JobSettings(job as JobName, buffSettings, exported?.jobs?.includes(job as JobName));
        });
    }

    exportSetting(): BuffSettingsExport {
        return {
            jobs: this.jobs.filter(jobSetting => jobSetting.enabled)
                .map(jobSetting => jobSetting.job),
            buffs: this.individuallyEnabledBuffs.map(buff => buff.name as BuffName),
        }
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

export class BuffSettingsArea extends HTMLElement {
    constructor(settings: BuffSettingsManager, updateCallback: () => void) {
        super();
        this.classList.add('buff-settings-area')
        const header = document.createElement('h3');
        header.textContent = 'Party Comp/Raid Buffs';
        this.appendChild(header);

        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.append(tbody);
        settings.allJobs.forEach(job => {
            const row = document.createElement('tr');

            const jobCell = document.createElement('td');
            const jobCb = new FieldBoundCheckBox(job, 'enabled');
            jobCb.addListener(updateCallback);
            jobCell.append(labeledCheckbox(job.job, jobCb));
            row.append(jobCell);

            const buffsCell = document.createElement('td');
            job.allBuffs.forEach(buff => {
                const buffCb = new FieldBoundCheckBox(buff, 'enabled');
                buffCb.addListener(updateCallback);
                buffsCell.append(labeledCheckbox(buff.buff.name, buffCb));
                jobCb.addAndRunListener(val => buffCb.disabled = !val);
            })
            row.append(buffsCell);
            tbody.append(row);
        });
        this.append(table);
    }
}

customElements.define('buff-settings-area', BuffSettingsArea);

