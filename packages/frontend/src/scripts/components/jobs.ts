import {JobName} from "@xivgear/xivmath/xivconstants";
import {xivApiGet, xivApiIconUrl} from "@xivgear/core/external/xivapi";
import {requireNumber, requireString} from "@xivgear/core/external/data_validators";

let loaded = false;
const jobIconMap = new Map<JobName, string>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
async function ensureJobDataLoaded() {
    if (loaded) {
        return;
    }
    await xivApiGet({
        requestType: 'list',
        sheet: 'ClassJob',
        columns: ['Abbreviation', 'Icon'] as const,
    }).then(results => {
        results.Results.forEach(value => {
            jobIconMap.set(requireString(value.Abbreviation) as JobName, xivApiIconUrl(requireNumber(value.Icon['id'])));
        });
        loaded = true;
    });
}

// This isn't currently used anywhere...
export class JobIcon extends HTMLImageElement {
    constructor(job: JobName) {
        super();
        this.classList.add('ffxiv-job-icon');
        ensureJobDataLoaded().then(() => this.src = jobIconMap.get(job));
    }
}

customElements.define("ffxiv-job-icon", JobIcon, {extends: "img",});
