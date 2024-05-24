import {xivApiSingleCols} from "@xivgear/core/external/xivapi";

export interface XivApiAbilityData {
    ID: number,
    Icon: string
}

const abilityIconMap = new Map<number, Promise<XivApiAbilityData>>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
async function getDataFor(abilityId: number): Promise<XivApiAbilityData> {
    if (abilityIconMap.has(abilityId)) {
        return abilityIconMap.get(abilityId);
    }
    else {
        const out = xivApiSingleCols('Action', abilityId, ['ID', 'Icon'] as const) as Promise<XivApiAbilityData>;
        abilityIconMap.set(abilityId, out);
        return out;
    }
}

export class AbilityIcon extends HTMLImageElement {
    constructor(abilityId: number) {
        super();
        this.classList.add('ffxiv-ability-icon');
        this.setAttribute('intrinsicsize', '64x64');
        getDataFor(abilityId).then(data => this.src = "https://xivapi.com/" + data.Icon);
    }
}

customElements.define("ffxiv-ability-icon", AbilityIcon, {extends: "img"});
