import {CustomTable, HeaderRow} from "../../tables";
import {AutoAttack, Buff, GcdAbility, OgcdAbility} from "../sim_types";
import {CombinedBuffEffect, DisplayRecordFinalized, isFinalizedAbilityUse} from "../sim_processors";
import {toRelPct} from "../../util/strutils";
import {AbilityIcon} from "../../components/abilities";
import {StatusIcon} from "../../components/status_effects";

function formatTime(time: number) {
    const negative = time < 0;
    // noinspection AssignmentToFunctionParameterJS
    time = Math.abs(time);
    const minute = Math.floor(time / 60);
    const second = time % 60;
    return (`${negative ? '-' : ''}${minute}:${second.toFixed(2).padStart(5, '0')}`)
}


function roundTime(time: number): string {
    return time.toFixed(3);
}

function formatBuffTooltip(buff: Buff) {
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
        parts.push(`${toRelPct(effects.haste, 1)}% haste`);
    }
    if (parts) {
        return `${buff.name}: ${parts.join(', ')}`;
    }
    else {
        return buff.name;
    }
}

export class AbilitiesUsedTable extends CustomTable<DisplayRecordFinalized> {

    constructor(abilitiesUsed: readonly DisplayRecordFinalized[]) {
        super();
        this.style.tableLayout = 'fixed';
        this.classList.add('abilities-used-table');
        this.columns = [
            {
                shortName: 'time',
                displayName: 'Time',
                getter: used => used,
                renderer: (used: DisplayRecordFinalized) => {
                    return document.createTextNode(formatTime(used.usedAt));
                },
                colStyler: (value: DisplayRecordFinalized, colElement, internalElement) => {
                    if ('original' in value) {
                        const original = value.original;
                        let title = `Used at: ${roundTime(value.usedAt)}s\n`;
                        // cast
                        if (value.original.castTimeFromStart) {
                            title += `Cast: ${roundTime(original.castTimeFromStart)}\n`
                            title += `Snapshot At: ${roundTime(original.snapshotTimeFromStart)}\n`
                            title += `Application Delay: ${roundTime(original.appDelay)}\n`
                            title += `Cast Start to Application: ${roundTime(original.appDelayFromStart)}\n`
                            title += `Effective Recast: ${roundTime(original.totalTimeTaken)}`;
                        }
                        // instant
                        else {
                            title += `Application Delay: ${original.appDelayFromStart}\nAnimation Lock: ${original.totalTimeTaken}`;
                        }
                        colElement.title = title;
                    }
                }
            },
            {
                shortName: 'ability',
                displayName: 'Ability',
                getter: used => isFinalizedAbilityUse(used) ? used.ability : used.label,
                renderer: (ability: GcdAbility | OgcdAbility | AutoAttack | string) => {
                    if (ability instanceof Object) {
                        const out = document.createElement('div');
                        out.classList.add('ability-cell');
                        if (ability.type === 'autoattack') {
                            out.appendChild(document.createTextNode('* '));
                        }
                        else if (ability.type !== "gcd") {
                            out.appendChild(document.createTextNode(' ⤷ '));
                        }
                        if (ability.id) {
                            out.appendChild(new AbilityIcon(ability.id));
                        }
                        const abilityNameSpan = document.createElement('span');
                        abilityNameSpan.textContent = ability.name;
                        abilityNameSpan.classList.add('ability-name');
                        out.appendChild(abilityNameSpan);
                        return out;
                    }
                    else {
                        return document.createTextNode(ability);
                    }
                }
            },
            {
                shortName: 'unbuffed-pot',
                displayName: 'Pot',
                getter: used => isFinalizedAbilityUse(used) ? used.totalPotency : '--',
            },
            {
                shortName: 'expected-damage',
                displayName: 'Damage',
                getter: used => used,
                renderer: (used: DisplayRecordFinalized) => {
                    if (isFinalizedAbilityUse(used)) {

                        if (!used.totalDamage) {
                            return document.createTextNode('--');
                        }
                        let text = used.totalDamage.toFixed(2);
                        if (used.partialRate !== null || (used.dotInfo && used.dotInfo.actualTickCount < used.dotInfo.fullDurationTicks)) {
                            text += '*';
                        }
                        return document.createTextNode(text);
                    }
                    else {
                        return null;
                    }
                },
                colStyler: (value: DisplayRecordFinalized, colElement, internalElement) => {
                    if (isFinalizedAbilityUse(value)) {
                        let title: string[] = [];
                        if (value.partialRate !== null) {
                            title.push(`This ability would not have fit completely within the allotted time.\nIt has been pro-rated to ${Math.floor(value.partialRate * 100)}% of the original damage.\n`);
                        }
                        if (value.dotInfo) {
                            title.push(`This ability is a DoT. It dealt ${value.dotInfo.actualTickCount}/${value.dotInfo.fullDurationTicks} ticks of ${value.dotInfo.damagePerTick.expected} each.\n`);
                        }
                        if (title.length > 0) {
                            colElement.title = title.join('\n');
                        }
                    }
                },
            },
            {
                shortName: 'Total Buffs',
                displayName: 'Total Buffs',
                getter: used => isFinalizedAbilityUse(used) ? used.combinedEffects : undefined,
                renderer: (effects: CombinedBuffEffect) => {
                    if (effects === undefined) {
                        return null;
                    }
                    let out: string[] = [];
                    if (effects.dmgMod !== 1) {
                        const dmgModRelative = effects.dmgMod - 1;
                        out.push(`${toRelPct(dmgModRelative, 1)}% dmg`);
                    }
                    if (effects.dhitChanceIncrease) {
                        out.push(`${toRelPct(effects.dhitChanceIncrease, 1)}% DHT`);
                    }
                    if (effects.critChanceIncrease) {
                        out.push(`${toRelPct(effects.critChanceIncrease, 1)}% CRT`);
                    }
                    if (effects.haste) {
                        out.push(`${effects.haste}% Haste`);
                    }
                    return document.createTextNode(out.join(', '));
                }
            },
            {
                shortName: 'buffs',
                displayName: 'Buffs Active',
                getter: used => used['buffs'] ?? [],
                renderer: (buffs: Buff[]) => {
                    const out = document.createElement('div');
                    out.classList.add('active-buffs-list');
                    let tooltip = '';
                    const textOnly: Buff[] = [];
                    let hasImage = false;
                    for (let buff of buffs) {
                        tooltip += formatBuffTooltip(buff) + '\n';
                        if (buff.statusId !== undefined) {
                            out.appendChild(new StatusIcon(buff.statusId));
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
                        out.appendChild(textPart);
                    }
                    out.title = tooltip;
                    return out;
                    // return document.createTextNode('foo');
                },
            }
        ];
        this.data = [new HeaderRow(), ...abilitiesUsed];
        // this.style.tableLayout = 'auto';
    }
}

customElements.define('abilities-used-table', AbilitiesUsedTable, {extends: 'table'});
