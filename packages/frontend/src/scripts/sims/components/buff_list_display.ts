import {StatusIcon, translatedStatusName} from "../../components/status_effects";
import {toRelPct} from "@xivgear/util/strutils";
import {Buff} from "@xivgear/core/sims/sim_types";


export function describeBuff(buff: Buff, nameOverride: string | null) {
    const effectiveName = nameOverride ?? buff.name;
    const baseName = buff.stacks ? `${effectiveName} (${buff.stacks} stacks)` : effectiveName;
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

type BuffInfo = {
    buff: Buff,
    translation: string | null,
}

/**
 * Element which displays a list of buffs.
 */
export class BuffListDisplay extends HTMLDivElement {

    private readonly buffInfo: BuffInfo[] = [];
    private dirtyTooltip: boolean = false;

    constructor(buffs: Buff[]) {
        super();
        this.classList.add('active-buffs-list');
        if (buffs.length === 0) {
            return;
        }
        const textOnly: Buff[] = [];
        let hasImage = false;
        for (const buff of buffs) {
            const bi: BuffInfo = {
                buff: buff,
                translation: null,
            };
            this.buffInfo.push(bi);
            if (buff.statusId !== undefined && buff.statusId > 0) {
                this.appendChild(new StatusIcon(buff.statusId, buff.stacks));
                hasImage = true;
            }
            else {
                textOnly.push(buff);
            }
            translatedStatusName(buff).then(name => {
                // Ignore no-ops
                if (name === bi.buff.name) {
                    return;
                }
                bi.translation = name;
                this.reformatTooltipLazy();
            });
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
        this.reformatTooltipNow();
    }

    reformatTooltipLazy(): void {
        console.log('reformatLazy');
        if (!this.dirtyTooltip) {
            this.dirtyTooltip = true;
            // Unlikely that the user will try to view the tooltip within 500ms, so coalesce tooltip updates into a
            // single op within a particular timeout.
            setTimeout(() => this.reformatTooltipNow(), 500);
        }
    }

    reformatTooltipNow(): void {
        console.log('reformatNow');
        this.dirtyTooltip = false;
        let tooltip = '';
        this.buffInfo.forEach(bi => {
            const buff = bi.buff;
            const translated = bi.translation;
            tooltip += describeBuff(buff, translated) + '\n';
        });
        this.title = tooltip;
    }
}


customElements.define('buff-list-display', BuffListDisplay, {extends: 'div'});
