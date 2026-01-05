import {JOB_DATA, JOB_IDS, JobName} from "@xivgear/xivmath/xivconstants";
import {xivApiIconUrl} from "@xivgear/core/external/xivapi";
import {RoleKey, ROLES} from "@xivgear/xivmath/geartypes";

export class JobIcon extends HTMLImageElement {
    constructor(jobOrRole: JobName | RoleKey) {
        super();
        this.alt = jobOrRole;
        this.title = jobOrRole;
        this.classList.add('ffxiv-job-icon');
        this.setAttribute('intrinsicsize', '64x64');

        let iconId: number | null = null;
        let className: 'ffxiv-role-dps' | 'ffxiv-role-healer' | 'ffxiv-role-tank' | 'ffxiv-job-missing' | null = null;

        // Try to look up job first
        const id = JOB_IDS[jobOrRole as JobName];
        if (id) {
            const jobDataConst = JOB_DATA[jobOrRole as JobName];
            switch (jobDataConst.role) {
                case "Healer":
                    className = 'ffxiv-role-healer';
                    break;
                case "Tank":
                    className = 'ffxiv-role-tank';
                    break;
                case "Melee":
                case "Ranged":
                case "Caster":
                    className = 'ffxiv-role-dps';
            }
            // No real sheet to map these.
            // Rather, it seems that it's just 062100 + id (or 062000 if you don't want the border)
            iconId = 62100 + id;
        }
        else if (ROLES.includes(jobOrRole as RoleKey)) {
            const role = jobOrRole as RoleKey;
            switch (role) {
                case "Healer":
                    className = 'ffxiv-role-healer';
                    iconId = 62582;
                    break;
                case "Tank":
                    className = 'ffxiv-role-tank';
                    iconId = 62581;
                    break;
                case "Melee":
                    className = 'ffxiv-role-dps';
                    iconId = 62584;
                    break;
                case "Ranged":
                    className = 'ffxiv-role-dps';
                    iconId = 62586;
                    break;
                case "Caster":
                    className = 'ffxiv-role-dps';
                    iconId = 62587;
                    break;
                default:
                    className = 'ffxiv-job-missing';
                    return;
            }
        }
        else {
            this.classList.add('ffxiv-job-missing');
            return;
        }


        const loadListener = () => {
            this.classList.add('loaded');
        };

        if (iconId !== null) {
            // setXivApiIcon(this, iconId, [32, 32], [32, 32]);
            this.src = xivApiIconUrl(iconId, true);
        }
        if (className !== null) {
            this.classList.add(className);
        }

        // const jobAltHolder = quickElement('span', ['icon-alt-holder'], [jobOrRole]);
        // this.append(jobAltHolder);
        this.style.setProperty('--job-name', jobOrRole);

        this.addEventListener('load', loadListener);
        this.addEventListener('error', e => {
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
