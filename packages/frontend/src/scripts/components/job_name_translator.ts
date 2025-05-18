import {JobName} from "@xivgear/xivmath/xivconstants";
import {API_CLIENT, ApiJobType, checkResponse} from "@xivgear/core/data_api_client";
import {RoleKey} from "@xivgear/xivmath/geartypes";
import {quickElement} from "@xivgear/common-ui/components/util";
import {toTranslatable} from "@xivgear/i18n/translation";

let dataPromise: Promise<Map<JobName, ApiJobType>> | null = null;

function getDataPromise(): Promise<Map<JobName, ApiJobType>> {
    if (dataPromise === null) {
        dataPromise = API_CLIENT.jobs.jobs().then(raw => {
            checkResponse(raw);
            const map = new Map<JobName, ApiJobType>();
            raw.data.items.forEach(job => {
                map.set(job.abbreviation as JobName, job);
            });
            return map;
        });
    }
    return dataPromise;
}

export function jobAbbrevTranslated(job: JobName | RoleKey): HTMLSpanElement {
    const text = quickElement('span', ['job-name-translation'], [job]);
    getDataPromise().then(pr => {
        // If it is a role key, then it will miss on this lookup and do nothing, which is as good as we can get without
        // a programmatic source.
        const translation = pr.get(job as JobName)?.abbreviationTranslations;
        if (translation) {
            text.textContent = toTranslatable(job, translation).asCurrentLang;
        }
    });
    return text;
}
