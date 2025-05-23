import {NamedSection} from "../components/section";
import {BuffSettingsManager} from "@xivgear/core/sims/common/party_comp_settings";
import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {jobAbbrevTranslated} from "../components/job_name_translator";
import {statusNameTranslated} from "../components/status_effects";

/**
 * Provides the settings area for configuring party buffs.
 */
export class BuffSettingsArea extends NamedSection {
    constructor(settings: BuffSettingsManager, updateCallback: () => void) {
        super('Party Comp/Raid Buffs');
        this.classList.add('buff-settings-area');

        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.append(tbody);
        settings.allJobs.forEach(job => {
            const row = document.createElement('tr');

            const jobCell = document.createElement('td');
            const jobCb = new FieldBoundCheckBox(job, 'enabled');
            jobCb.addListener(updateCallback);
            jobCell.append(labeledCheckbox(jobAbbrevTranslated(job.job), jobCb));
            row.append(jobCell);

            const buffsCell = document.createElement('td');
            job.allBuffs.forEach(buff => {
                const buffCb = new FieldBoundCheckBox(buff, 'enabled');
                buffCb.addListener(updateCallback);
                buffsCell.append(labeledCheckbox(statusNameTranslated(buff.buff), buffCb));
                jobCb.addAndRunListener(val => buffCb.disabled = !val);
            });
            row.append(buffsCell);
            tbody.append(row);
        });
        this.contentArea.append(table);
    }
}

customElements.define('buff-settings-area', BuffSettingsArea);

