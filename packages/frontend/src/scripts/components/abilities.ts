import {xivApiIconUrl, xivApiSingleCols} from "@xivgear/core/external/xivapi";
import {XivApiIcon} from "@xivgear/common-ui/util/types";

interface XivApiAbilityData {
    Icon: XivApiIcon
}

const abilityIconMap = new Map<number, Promise<XivApiAbilityData>>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
async function getDataFor(abilityId: number): Promise<XivApiAbilityData> {
    if (abilityIconMap.has(abilityId)) {
        return abilityIconMap.get(abilityId);
    }
    else {
        const out = xivApiSingleCols('Action', abilityId, ['Icon'] as const) as Promise<XivApiAbilityData>;
        abilityIconMap.set(abilityId, out);
        return out;
    }
}

export class AbilityIcon extends HTMLImageElement {
    constructor(abilityId: number) {
        super();
        this.classList.add('ffxiv-ability-icon');
        this.setAttribute('intrinsicsize', '64x64');
        getDataFor(abilityId).then(data => this.src = xivApiIconUrl(data.Icon.id, false));
    }
}

customElements.define("ffxiv-ability-icon", AbilityIcon, {extends: "img"});
