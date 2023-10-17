import {CustomTable, HeaderRow} from "../../tables";
import {GcdAbility, OgcdAbility, UsedAbility} from "../sim_types";
import {CombinedBuffEffect} from "../sim_processors";
import {toRelPct} from "../../util/strutils";

export class AbilitiesUsedTable extends CustomTable<UsedAbility> {

    constructor(abilitiesUsed: UsedAbility[]) {
        super();
        this.classList.add('abilities-used-table');
        this.columns = [
            {
                shortName: 'time',
                displayName: 'Time',
                getter: used => used.usedAt,
                renderer: time => {
                    const minute = Math.floor(time / 60);
                    const second = time % 60;
                    return document.createTextNode(`${minute}:${second.toFixed(2).padStart(5, '0')}`);
                }
            },
            {
                shortName: 'ability',
                displayName: 'Ability',
                getter: used => used.ability,
                renderer: (ability: GcdAbility | OgcdAbility) => {
                    if (ability.type === "gcd") {
                        return document.createTextNode(ability.name);
                    }
                    else {
                        return document.createTextNode(' ⤷ ' + ability.name);
                    }
                }
            },
            {
                shortName: 'unbuffed-pot',
                displayName: 'Pot',
                getter: used => used.ability.potency
            },
            {
                shortName: 'expected-damage',
                displayName: 'Damage',
                getter: used => used,
                renderer: used => {
                    let text = used.damage.expected.toFixed(2);
                    if ('portion' in used) {
                        text += '*';
                    }
                    return document.createTextNode(text);
                },
                colStyler: (value, colElement, internalElement) => {
                    if ('portion' in value) {
                        colElement.title = `This ability would not have fit completely within the allotted time.\nIt has been pro-rated to ${Math.floor(value.portion * 100)}% of the original damage.`
                    }
                },
            },
            {
                shortName: 'Total Buffs',
                displayName: 'Total Buffs',
                getter: used => used.combinedEffects,
                renderer: (effects: CombinedBuffEffect) => {
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
                getter: used => used.buffs,
                renderer: buffs => document.createTextNode(buffs.map(buff => buff.name).join(', ')),
            }
        ];
        this.data = [new HeaderRow(), ...abilitiesUsed];
    }
}

customElements.define('abilities-used-table', AbilitiesUsedTable, {extends: 'table'});
