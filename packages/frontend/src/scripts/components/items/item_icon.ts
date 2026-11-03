import {xivApiIconUrl, xivApiSingleCols} from "@xivgear/core/external/xivapi";
import {requireNumber} from "@xivgear/core/external/data_validators";

export interface XivApiItemData {
    ID: number,
    Icon: {
        id: number,
    }
}

const itemIconMap = new Map<number, Promise<number>>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
function getDataFor(itemId: number): Promise<number> {
    const cached = itemIconMap.get(itemId);
    if (cached) {
        return cached;
    }
    else {
        const out = xivApiSingleCols('Item', itemId, ['ID', 'Icon'] as const) as Promise<XivApiItemData>;
        const iconId = out.then(data => requireNumber(data.Icon['id']));
        itemIconMap.set(itemId, iconId);
        return iconId;
    }
}

type IdLookup = (id: number) => Promise<number>;

/**
 * ItemIcon is an extension of HTMLImageElement specifically for xivapi icon URLs. It handles switching between the
 * normal resolution and high resolution versions of the icon using the srcset attribute. Also, it displays the
 * placeholder background for a normal-rarity icon while the data loads.
 */
export class ItemIcon extends HTMLImageElement {
    /**
     * Construct an ItemIcon from an icon ID.
     *
     * @param iconId
     */
    static forIconId(iconId: number): ItemIcon {
        return new ItemIcon(iconId, async id => id);
    }

    /**
     * Construct an ItemIcon from an item ID. This requires two roundtrips: one to lookup the icon ID for the item,
     * and then the actual image load. However, IDs are cached, so the next ItemIcon for the same item ID will be
     * much faster.
     *
     * @param itemId
     */
    static forItemId(itemId: number): ItemIcon {
        return new ItemIcon(itemId, getDataFor);
    }

    constructor(id: number, idLookup: IdLookup) {
        super();
        // Simulation result tables display item uses like abilities, so they use the ability icon styling.
        this.classList.add('ffxiv-ability-icon');
        this.classList.add('item-rarity-normal');
        this.setAttribute('intrinsicsize', '40x40');
        // We do not want alt text on these because it will appear as the image is loaded
        idLookup(id).then(iconId => {
            const lr = xivApiIconUrl(iconId, false);
            const hr = xivApiIconUrl(iconId, true);
            this.src = lr;
            this.srcset = `${lr} 1.5x, ${hr} 2x`;
        });
    }
}

customElements.define("ffxiv-item-icon", ItemIcon, {extends: "img"});
