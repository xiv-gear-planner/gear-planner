import {xivApiSingle, xivApiSingleCols} from "../external/xivapi";

export interface XivApiStatusData {
    ID: number,
    Icon: string
}

const statusIconMap = new Map<number, Promise<XivApiStatusData>>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
async function getDataFor(statusId: number): Promise<XivApiStatusData> {
    if (statusIconMap.has(statusId)) {
        return statusIconMap.get(statusId);
    }
    else {
        const out = xivApiSingleCols('Status', statusId, ['ID', 'Icon'] as const);
        statusIconMap.set(statusId, out);
        return out;
    }
}

export class StatusIcon extends HTMLImageElement {
    constructor(statusId: number) {
        super();
        this.classList.add('ffxiv-ability-icon');
        this.setAttribute('intrinsicsize', '24x32');
        getDataFor(statusId).then(data => this.src = "https://xivapi.com/" + data.Icon);
    }
}

customElements.define("ffxiv-status-icon", StatusIcon, {extends: "img"});