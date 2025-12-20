import {xivApiIconUrl, xivApiSingleCols} from "@xivgear/core/external/xivapi";
import {requireNumber} from "@xivgear/core/external/data_validators";

export interface XivApiItemData {
    ID: number,
    Icon: {
        id: number,
    }
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
        this.classList.add('item-rarity-normal');
        this.setAttribute('intrinsicsize', '40x40');
        // We do not want alt text on these because it will appear as the image is loaded
        getDataFor(itemId).then(data => {
            const iconId = requireNumber(data.Icon['id']);
            const lr = xivApiIconUrl(iconId, false);
            const hr = xivApiIconUrl(iconId, true);
            this.src = lr;
            this.srcset = `${lr} 1.5x, ${hr} 2x`;
        });
    }
}

customElements.define("ffxiv-item-icon", ItemIcon, {extends: "img"});
