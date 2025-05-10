import {JOB_DATA, JOB_IDS, JobName} from "@xivgear/xivmath/xivconstants";
import {xivApiIconUrl} from "@xivgear/core/external/xivapi";

export class JobIcon extends HTMLImageElement {
    constructor(job: JobName) {
        super();
        this.alt = job;
        this.title = job;
        this.classList.add('ffxiv-job-icon');
        this.setAttribute('intrinsicsize', '64x64');
        const jobDataConst = JOB_DATA[job];
        switch (jobDataConst.role) {
            case "Healer":
                this.classList.add('ffxiv-role-healer');
                break;
            case "Tank":
                this.classList.add('ffxiv-role-tank');
                break;
            case "Melee":
            case "Ranged":
            case "Caster":
                this.classList.add('ffxiv-role-dps');
        }
        const id = JOB_IDS[job];
        if (!id) {
            this.classList.add('ffxiv-job-missing');
            return;
        }
        // No real sheet to map these.
        // Rather, it seems that it's just 062100 + id (or 062000 if you don't want the border)
        const iconId = 62100 + id;
        this.src = xivApiIconUrl(iconId, true);
        const loadListener = () => {
            this.classList.add('loaded');
        };

        // const jobAltHolder = quickElement('span', ['icon-alt-holder'], [job]);
        // this.append(jobAltHolder);
        this.style.setProperty('--job-name', job);

        this.addEventListener('load', loadListener);
        this.addEventListener('error', (e) => {
            e.preventDefault();
            this.classList.remove('loaded');
            this.classList.add('image-error-loading');
            this.removeEventListener('load', loadListener);
            // this.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
        });
    }
}

export class FramelessJobIcon extends HTMLImageElement {
    constructor(job: JobName) {
        super();
        this.classList.add('ffxiv-frameless-job-icon');
        this.setAttribute('intrinsicsize', '64x64');
        const id = JOB_IDS[job];
        if (!id) {
            this.classList.add('ffxiv-job-missing');
            return;
        }
        // No real sheet to map these.
        // Rather, it seems that it's just 062100 + id (or 062000 if you don't want the border)
        const iconId = 62000 + id;
        this.src = xivApiIconUrl(iconId, true);
        this.style.setProperty('--job-name', job);
    }
}

customElements.define('job-icon', JobIcon, {extends: "img"});
customElements.define('frameless-job-icon', FramelessJobIcon, {extends: "img"});
