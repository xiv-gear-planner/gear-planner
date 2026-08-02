import {JOB_DATA, JOB_IDS, JobName} from "@xivgear/xivmath/xivconstants";
import {xivApiIconUrl} from "@xivgear/core/external/xivapi";
import {RoleKey, ROLES} from "@xivgear/xivmath/geartypes";

type NonCombatJob = 'CRP' | 'BSM' | 'ARM' | 'GSM' | 'LTW' | 'WVR' | 'ALC' | 'CUL' | 'MIN' | 'BTN' | 'FSH';
type ItemBrowserRole = RoleKey | 'DoH' | 'DoL';

const NON_COMBAT_JOB_IDS: Record<NonCombatJob, number> = {
    CRP: 8,
    BSM: 9,
    ARM: 10,
    GSM: 11,
    LTW: 12,
    WVR: 13,
    ALC: 14,
    CUL: 15,
    MIN: 16,
    BTN: 17,
    FSH: 18,
};

export class JobIcon extends HTMLImageElement {
    constructor(jobOrRole: JobName | NonCombatJob | ItemBrowserRole) {
        super();
        this.alt = jobOrRole;
        this.title = jobOrRole;
        this.classList.add('ffxiv-job-icon');
        this.setAttribute('intrinsicsize', '64x64');

        let iconId: number | null = null;
        let className: 'ffxiv-role-dps' | 'ffxiv-role-healer' | 'ffxiv-role-tank' | 'ffxiv-role-doh' | 'ffxiv-role-dol' | 'ffxiv-job-missing' | null = null;

        const id = JOB_IDS[jobOrRole as JobName];
        const nonCombatId = NON_COMBAT_JOB_IDS[jobOrRole as NonCombatJob];
        if (id || nonCombatId) {
            const jobDataConst = JOB_DATA[jobOrRole as JobName];
            if (nonCombatId) {
                className = ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'].includes(jobOrRole as NonCombatJob)
                    ? 'ffxiv-role-doh'
                    : 'ffxiv-role-dol';
            }
            else switch (jobDataConst.role) {
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
            iconId = 62100 + (id || nonCombatId);
        }
        else if (ROLES.includes(jobOrRole as RoleKey) || jobOrRole === 'DoH' || jobOrRole === 'DoL') {
            const role = jobOrRole as ItemBrowserRole;
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
                case "DoH":
                    className = 'ffxiv-role-doh';
                    iconId = 62146;
                    break;
                case "DoL":
                    className = 'ffxiv-role-dol';
                    iconId = 62146;
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
            this.src = xivApiIconUrl(iconId, true);
        }
        if (className !== null) {
            this.classList.add(className);
        }

        this.style.setProperty('--job-name', jobOrRole);
        this.addEventListener('load', loadListener);
        this.addEventListener('error', e => {
            e.preventDefault();
            this.classList.remove('loaded');
            this.classList.add('image-error-loading');
            this.removeEventListener('load', loadListener);
        });
    }
}

customElements.define('job-icon', JobIcon, {extends: "img"});
