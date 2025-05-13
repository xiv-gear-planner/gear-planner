import {ALL_COMBAT_JOBS, JOB_IDS, JobName} from "@xivgear/xivmath/xivconstants";
import {xivApiIconUrl} from "@xivgear/core/external/xivapi";

export function getJobIcons(style: 'framed' | 'frameless', condition: (job: JobName) => boolean = () => true): URL[] {
    const out = [];
    for (const jobKey of ALL_COMBAT_JOBS) {
        if (!condition(jobKey)) {
            continue;
        }
        const id = JOB_IDS[jobKey];
        if (id) {
            out.push(new URL(xivApiIconUrl((style === 'framed' ? 62000 : 0) + id, true)));
        }
    }
    return out;
}
