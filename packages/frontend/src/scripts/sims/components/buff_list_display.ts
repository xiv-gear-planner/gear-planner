import {Buff} from "../sim_types";
import {StatusIcon} from "../../components/status_effects";
import {toRelPct} from "../../util/strutils";


export function describeBuff(buff: Buff) {
    if ('descriptionOverride' in buff) {
        return `${buff.name}: ${buff.descriptionOverride}`;
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
        return `${buff.name}: ${parts.join(', ')}`;
    }
    else {
        return buff.name;
    }
}

export class BuffListDisplay extends HTMLDivElement {
    constructor(buffs: Buff[]) {
        super();
        this.classList.add('active-buffs-list');
        let tooltip = '';
        const textOnly: Buff[] = [];
        let hasImage = false;
        for (let buff of buffs) {
            tooltip += describeBuff(buff) + '\n';
            if (buff.statusId !== undefined) {
                this.appendChild(new StatusIcon(buff.statusId));
                hasImage = true;
            }
            else {
                textOnly.push(buff);
            }
        }
        if (textOnly.length > 0) {
            const textPart = document.createElement('span');
            let textOut = textOnly.map(buff => buff.name).join(', ')
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