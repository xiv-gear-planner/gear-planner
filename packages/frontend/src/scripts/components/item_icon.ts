import {xivApiIconUrl, xivApiSingleCols} from "@xivgear/core/external/xivapi";
import {requireNumber} from "@xivgear/core/external/data_validators";

export interface XivApiItemData {
    ID: number,
    Icon: string
}

const itemIconMap = new Map<number, Promise<XivApiItemData>>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
async function getDataFor(itemId: number): Promise<XivApiItemData> {
    if (itemIconMap.has(itemId)) {
        return itemIconMap.get(itemId);
    }
    else {
        const out = xivApiSingleCols('Item', itemId, ['ID', 'Icon'] as const) as Promise<XivApiItemData>;
        itemIconMap.set(itemId, out);
        return out;
    }
}

// This ItemIcon class is NOT used for general item icons - only potion icons in the abilities used table!
export class ItemIcon extends HTMLImageElement {
    constructor(itemId: number) {
        super();
        this.classList.add('ffxiv-ability-icon');
        this.setAttribute('intrinsicsize', '64x64');
        getDataFor(itemId).then(data => this.src = xivApiIconUrl(requireNumber(data.Icon['id']), false));
    }
}

customElements.define("ffxiv-item-icon", ItemIcon, {extends: "img"});
