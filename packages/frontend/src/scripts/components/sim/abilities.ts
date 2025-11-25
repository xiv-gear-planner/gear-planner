import {xivApiIconUrl, xivApiSingleCols} from "@xivgear/core/external/xivapi";
import {XivApiIcon} from "@xivgear/common-ui/util/types";
import {getCurrentLanguage} from "@xivgear/i18n/translation";
import {quickElement} from "@xivgear/common-ui/components/util";
import {Ability} from "@xivgear/core/sims/sim_types";
import {requireNumber} from "@xivgear/core/external/data_validators";

interface XivApiAbilityData {
    Icon: XivApiIcon,
    Name: string,
}

const actionDataMap = new Map<number, Promise<XivApiAbilityData>>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
async function getDataFor(abilityId: number): Promise<XivApiAbilityData> {
    if (actionDataMap.has(abilityId)) {
        return actionDataMap.get(abilityId);
    }
    else {
        const out = xivApiSingleCols('Action', abilityId, ['Icon', 'Name'] as const, getCurrentLanguage()) as Promise<XivApiAbilityData>;
        actionDataMap.set(abilityId, out);
        return out;
    }
}

export class AbilityIcon extends HTMLImageElement {
    constructor(abilityId: number) {
        super();
        this.classList.add('ffxiv-ability-icon');
        this.setAttribute('intrinsicsize', '40x40');
        getDataFor(abilityId).then(data => {
            const iconId = requireNumber(data.Icon.id);
            const lr = xivApiIconUrl(iconId, false);
            const hr = xivApiIconUrl(iconId, true);
            this.src = lr;
            this.srcset = `${lr} 2x, ${hr} 4x`;
        });
    }
}

export function actionNameTranslated(ability: Ability): HTMLSpanElement {
    const text = quickElement('span', ['ability-name'], [ability.name]);
    // Don't translate 'auto-attack' in en, just leave it as the original string
    const shouldTranslate: boolean = ability.translate ?? getCurrentLanguage() !== 'en';
    if (shouldTranslate) {
        getDataFor(ability.id).then(data => {
            text.textContent = data.Name;
        });
    }
    return text;
}

customElements.define("ffxiv-ability-icon", AbilityIcon, {extends: "img"});
