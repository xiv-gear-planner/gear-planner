import {StatusIcon} from "../../components/status_effects";
import {toRelPct} from "@xivgear/util/strutils";
import {Buff} from "@xivgear/core/sims/sim_types";


export function describeBuff(buff: Buff) {
    const baseName = buff.stacks ? `${buff.name} (${buff.stacks} stacks)` : buff.name;
    if ('descriptionOverride' in buff) {
        return `${baseName}: ${buff.descriptionOverride}`;
    }
    const parts: string[] = [];
    const effects = buff.effects;
    if (effects.dmgIncrease) {
        parts.push(`${toRelPct(effects.dmgIncrease, 1)}% dmg`);
    }
    if (effects.critChanceIncrease) {
        parts.push(`${toRelPct(effects.critChanceIncrease, 1)}% crit chance`);
    }
    if (effects.dhitChanceIncrease) {
        parts.push(`${toRelPct(effects.dhitChanceIncrease, 1)}% DH chance`);
    }
    if (effects.haste) {
        parts.push(`${effects.haste}% haste`);
    }
    if ('descriptionExtras' in buff) {
        parts.push(...buff.descriptionExtras);
    }
    if (parts.length > 0) {
        return `${baseName}: ${parts.join(', ')}`;
    }
    else {
        return baseName;
    }
}

export class BuffListDisplay extends HTMLDivElement {
    constructor(buffs: Buff[]) {
        super();
        this.classList.add('active-buffs-list');
        let tooltip = '';
        const textOnly: Buff[] = [];
        let hasImage = false;
        for (const buff of buffs) {
            tooltip += describeBuff(buff) + '\n';
            if (buff.statusId !== undefined && buff.statusId > 0) {
                this.appendChild(new StatusIcon(buff.statusId, buff.stacks));
                hasImage = true;
            }
            else {
                textOnly.push(buff);
            }
        }
        if (textOnly.length > 0) {
            const textPart = document.createElement('span');
            let textOut = textOnly.map(buff => buff.name).join(', ');
            if (hasImage) {
                textOut = ', ' + textOut;
            }
            textPart.textContent = textOut;
            this.appendChild(textPart);
        }
        this.title = tooltip;
    }
}


customElements.define('buff-list-display', BuffListDisplay, {extends: 'div'});
