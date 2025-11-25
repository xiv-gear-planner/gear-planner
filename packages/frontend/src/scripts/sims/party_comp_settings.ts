import {NamedSection} from "../components/general/section";
import {BuffSettingsManager} from "@xivgear/core/sims/common/party_comp_settings";
import {el, FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {jobAbbrevTranslated} from "../components/job/job_name_translator";
import {statusNameTranslated} from "../components/sim/status_effects";

/**
 * Provides the settings area for configuring party buffs.
 */
export class BuffSettingsArea extends NamedSection {
    constructor(settings: BuffSettingsManager, updateCallback: () => void) {
        super('Party Comp/Raid Buffs');
        this.classList.add('buff-settings-area');

        const table = el('table', {}, [
            el('tbody', {},
                settings.allJobs.map(job => {

                    const jobCell = el('td');
                    const jobCb = new FieldBoundCheckBox(job, 'enabled');
                    jobCb.addListener(updateCallback);
                    jobCell.append(labeledCheckbox(jobAbbrevTranslated(job.job), jobCb));

                    const buffsCell = el('td');
                    job.allBuffs.forEach(buff => {
                        const buffCb = new FieldBoundCheckBox(buff, 'enabled');
                        buffCb.addListener(updateCallback);
                        buffsCell.append(labeledCheckbox(statusNameTranslated(buff.buff), buffCb));
                        jobCb.addAndRunListener(val => buffCb.disabled = !val);
                    });

                    return el('tr', {}, [jobCell, buffsCell]);
                })
            ),
        ]);
        this.contentArea.append(table);
    }
}

customElements.define('buff-settings-area', BuffSettingsArea);

