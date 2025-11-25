import {xivApiIconUrl, xivApiSingleCols} from "@xivgear/core/external/xivapi";
import {AnyStringIndex} from "@xivgear/util/util_types";
import {getCurrentLanguage} from "@xivgear/i18n/translation";
import {Buff} from "@xivgear/core/sims/sim_types";
import {quickElement} from "@xivgear/common-ui/components/util";

export interface XivApiStatusData {
    ID: number,
    IconFunc: (stacks: number, highRes: boolean) => string,
    Name: string,
}

const statusIconMap = new Map<number, Promise<XivApiStatusData>>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
async function getDataFor(statusId: number): Promise<XivApiStatusData> {
    if (statusIconMap.has(statusId)) {
        return statusIconMap.get(statusId);
    }
    else {
        const dataPromise = xivApiSingleCols('Status', statusId, ['ID', 'Icon', 'MaxStacks', 'Name'] as const, getCurrentLanguage());
        const out: Promise<XivApiStatusData> = dataPromise.then(data => {
            return {
                ID: data.ID as number,
                IconFunc: (stacks: number, highRes: boolean) => {
                    // Clamp between 1 and the max stack counts. This avoids invalid stack counts as well as making
                    // 1-stack and non-stack buffs (both of which use the base icon ID) behave the same.
                    const effectiveStackCount = Math.max(1, Math.min(data.MaxStacks as number, stacks));
                    // 0/1 stack uses the base value, 2 stacks is base+1, 3 is base+2, etc.
                    const stackOffset = effectiveStackCount - 1;
                    const iconId = ((data.Icon as AnyStringIndex).id as number) + stackOffset;
                    return xivApiIconUrl(iconId, highRes);
                },
                Name: data.Name as string,
            } satisfies XivApiStatusData;
        });

        statusIconMap.set(statusId, out);
        return out;
    }
}

export class StatusIcon extends HTMLImageElement {
    constructor(statusId: number, stacks: number = 0) {
        super();
        this.classList.add('ffxiv-ability-icon');
        this.setAttribute('intrinsicsize', '24x32');
        getDataFor(statusId).then(data => {
            const effStacks = stacks ?? 0;
            const lowRes = data.IconFunc(effStacks, false);
            const highRes = data.IconFunc(effStacks, true);
            this.src = lowRes;
            this.srcset = `${lowRes}, ${highRes} 2x`;
            // this.sizes = `(min-width: 26px) 48w,\n24w`;
        });
    }
}

function shouldTranslate(buff: Buff) {
    return buff.statusId > 0 && (buff.translate ?? getCurrentLanguage() !== 'en');
}

export function statusNameTranslated(buff: Buff): HTMLSpanElement {
    const text = quickElement('span', ['status-name'], [buff.name]);
    // Don't translate 'auto-attack' in en, just leave it as the original string
    if (shouldTranslate(buff)) {
        getDataFor(buff.statusId).then(data => {
            text.textContent = data.Name;
        });
    }
    return text;
}

export async function translatedStatusName(buff: Buff): Promise<string> {
    if (shouldTranslate(buff)) {
        return (await getDataFor(buff.statusId)).Name;
    }
    else {
        return Promise.resolve(buff.name);
    }
}

customElements.define("ffxiv-status-icon", StatusIcon, {extends: "img"});
