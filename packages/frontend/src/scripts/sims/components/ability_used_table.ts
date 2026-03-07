import {col, CustomColumnSpec, CustomTable, HeaderRow, LazyTableStrategy} from "@xivgear/common-ui/table/tables";
import {toRelPct} from "@xivgear/util/strutils";
import {AbilityIcon, actionNameTranslated} from "../../components/sim/abilities";
import {BuffListDisplay} from "./buff_list_display";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {AutoAttack, Buff, CombinedBuffEffect, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {ItemIcon} from "../../components/items/item_icon";
import {quickElement} from "@xivgear/common-ui/components/util";

/**
 * Format a time into the format x:yy.zz
 *
 * @param time The time (in seconds). Supports positive and negative values.
 */
function formatTime(time: number) {
    const negative = time < 0;
    // noinspection AssignmentToFunctionParameterJS
    time = Math.abs(time);
    const minute = Math.floor(time / 60);
    const second = time % 60;
    return (`${negative ? '-' : ''}${minute}:${second.toFixed(2).padStart(5, '0')}`);
}


function roundTime(time: number): string {
    return time.toFixed(3);
}

function alignedValue(left: string, right: string): HTMLElement {
    return quickElement('div', ['split-aligned-value'], [quickElement('span', [], [left]), quickElement('span', [], [right])]);
}

const lazy: LazyTableStrategy = {
    immediateRows: 100,
    minRows: 250,
};

export class AbilitiesUsedTable extends CustomTable<DisplayRecordFinalized> {

    constructor(abilitiesUsed: readonly DisplayRecordFinalized[], extraColumns: CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[], scrollRoot: HTMLElement = null) {
        super();
        this.lazyRenderStrategy = {
            ...lazy,
            altRoot: scrollRoot,
        };
        this.style.tableLayout = 'fixed';
        this.classList.add('abilities-used-table');
        this.columns = [
            col({
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
                            title += `Cast: ${roundTime(original.castTimeFromStart)}\n`;
                            title += `Snapshot At: ${roundTime(original.snapshotTimeFromStart)}\n`;
                            title += `Application Delay: ${roundTime(original.appDelay)}\n`;
                            title += `Cast Start to Application: ${roundTime(original.appDelayFromStart)}\n`;
                            title += `Effective Recast: ${roundTime(original.totalTimeTaken)}`;
                        }
                        else { // instant
                            title += `Application Delay: ${original.appDelayFromStart}\nAnimation Lock: ${original.totalTimeTaken}`;
                        }
                        colElement.title = title;
                    }
                },
            }),
            col({
                shortName: 'ability',
                displayName: 'Ability',
                getter: used => isFinalizedAbilityUse(used) ? used.ability : used.label,
                renderer: (ability: GcdAbility | OgcdAbility | AutoAttack | string) => {
                    if (ability instanceof Object) {
                        const out = document.createElement('div');
                        out.classList.add('ability-cell');
                        if (ability.type === 'autoattack') {
                            out.classList.add('ability-autoattack');
                        }
                        else if (ability.type !== "gcd") {
                            out.classList.add('ability-ogcd');
                        }
                        if (!ability.noIcon) {
                            if (ability.itemId) {
                                out.appendChild(new ItemIcon(ability.itemId));
                                out.classList.add('ability-item');
                            }
                            else if (ability.id) {
                                out.appendChild(new AbilityIcon(ability.id));
                            }
                        }
                        const abilityNameSpan = actionNameTranslated(ability);
                        out.appendChild(abilityNameSpan);
                        return out;
                    }
                    else {
                        return document.createTextNode(ability);
                    }
                },
                titleSetter: (ability) => {
                    if (ability instanceof Object) {
                        if (ability.itemId) {
                            return `${ability.name}: Item #${ability.itemId}`;
                        }
                        else if (ability.id > 0) {
                            return `${ability.name}: Action #${ability.id}`;
                        }
                        else {
                            return ability.name;
                        }
                    }
                    return null;
                },
            }),
            col({
                shortName: 'unbuffed-pot',
                displayName: 'Pot',
                getter: used => {
                    return isFinalizedAbilityUse(used) ? used.totalPotency : null;
                },
                renderer: (value: number | null, rowValue: DisplayRecordFinalized) => {
                    if (value !== null && isFinalizedAbilityUse(rowValue)) {
                        if (isFinalizedAbilityUse(rowValue) && rowValue.ability.type === 'autoattack') {
                            return alignedValue(value.toString(), '*');
                        }
                        else {
                            return alignedValue(value.toString(), '');
                        }
                    }
                    else {
                        return alignedValue('--', '');
                    }
                },
                colStyler: (value: number | null, colElement, _, rowValue: DisplayRecordFinalized) => {
                    if (isFinalizedAbilityUse(rowValue) && rowValue.ability.type === 'autoattack') {
                        colElement.title = `${value} is the original potency, and does not reflect the weapon delay multiplier. However, the damage amount does reflect it.`;
                        colElement.append(quickElement('span', ['extra-indicator'], ['*']));
                    }
                },
            }),
            col({
                shortName: 'expected-damage',
                displayName: 'Damage',
                getter: used => used,
                renderer: (used: DisplayRecordFinalized) => {
                    if (isFinalizedAbilityUse(used)) {
                        if (!used.totalDamage) {
                            return alignedValue('--', '');
                        }
                        const text = used.totalDamage.toFixed(1);
                        if (used.partialRate !== null
                            || (used.dotInfo && used.dotInfo.fullDurationTicks !== "indefinite" && used.dotInfo.actualTickCount < used.dotInfo.fullDurationTicks)
                            || (used.channelInfo && used.channelInfo.actualTickCount < used.channelInfo.fullDurationTicks)) {
                            return alignedValue(text, '*');
                        }
                        return alignedValue(text, '');
                    }
                    else {
                        return null;
                    }
                },
                colStyler: (value: DisplayRecordFinalized, colElement, internalElement) => {
                    if (isFinalizedAbilityUse(value)) {
                        const title: string[] = [];
                        if (value.partialRate !== null) {
                            title.push(`This ability would not have fit completely within the allotted time.\nIt has been pro-rated to ${Math.floor(value.partialRate * 100)}% of the original damage.\n`);
                        }
                        if (value.dotInfo) {
                            if (value.dotInfo.fullDurationTicks === 'indefinite') {
                                title.push(`This ability is an indefinite DoT. It dealt ${value.dotInfo.actualTickCount} ticks of ${value.dotInfo.damagePerTick.expected.toFixed(3)} each.\n`);
                            }
                            else {
                                title.push(`This ability is a DoT. It dealt ${value.dotInfo.actualTickCount}/${value.dotInfo.fullDurationTicks} ticks of ${value.dotInfo.damagePerTick.expected.toFixed(3)} each.\n`);
                            }
                        }
                        if (value.channelInfo) {
                            title.push(`This ability is a channel. It dealt ${value.channelInfo.actualTickCount}/${value.channelInfo.fullDurationTicks} ticks of ${value.channelInfo.damagePerTick.expected.toFixed(3)} each.\n`);
                        }
                        if (title.length > 0) {
                            colElement.title = title.join('\n');
                        }
                    }
                },
            }),
            ...extraColumns,
            col({
                shortName: 'Total Buffs',
                displayName: 'Total Buffs',
                getter: used => isFinalizedAbilityUse(used) ? used.combinedEffects : undefined,
                renderer: (effects: CombinedBuffEffect) => {
                    if (effects === undefined) {
                        return null;
                    }
                    const out: string[] = [];
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
                },
            }),
            col({
                shortName: 'buffs',
                displayName: 'Buffs Active',
                getter: (used: DisplayRecordFinalized) => 'buffs' in used ? used.buffs : [],
                renderer: (buffs: Buff[]) => {
                    return new BuffListDisplay(buffs);
                },
            }),
        ];
        this.setNewData(abilitiesUsed);
    }

    setNewData(used: readonly DisplayRecordFinalized[]) {
        // With lazy rendering, faster to not attempt reuse
        this.dataRowMap.clear();
        this.data = [new HeaderRow(), ...used];
    }
}

customElements.define('abilities-used-table', AbilitiesUsedTable, {extends: 'table'});
