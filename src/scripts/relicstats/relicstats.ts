import {GearItem, Substat} from "../geartypes";
import {BaseParamMap} from "../datamanager";
import {CharacterGearSet, EquippedItem} from "../gear";
import {FieldBoundDataSelect, FieldBoundIntField} from "../components/util";
import {ALL_SUB_STATS, STAT_ABBREVIATIONS} from "../xivconstants";

type BaseRelicStatModel = {
    /**
     * Validate an item according to this relic model.
     * Returns a list of validation errors. An empty list implies success.
     *
     * @param item The item
     * @param statToReport Specify this to report issues specific to one stat. Messages may be tailored to one stat,
     * and validation issues will only be reported if that particular stat is actually contributing to the problem.
     */
    validate(item: EquippedItem, statToReport?: Substat): string[]
}

type EwRelicStatModel = BaseRelicStatModel & {
    type: 'ewrelic'
    smallValue: number
    largeValue: number
    numLarge: number
    numSmall: number
}

type CustomRelicStatModel = BaseRelicStatModel & {
    type: 'customrelic'
    totalCap: number
}

type UnknownRelicStatModel = BaseRelicStatModel & {
    type: 'unknown'
}

export type RelicStatModel = EwRelicStatModel | CustomRelicStatModel | UnknownRelicStatModel


function ewRelic(large: number, small: number): EwRelicStatModel {
    return {
        type: 'ewrelic',
        numSmall: 1,
        numLarge: 2,
        smallValue: small,
        largeValue: large,
        validate(item: EquippedItem, statToReport?: Substat): string[] {
            const out = [];
            let smalls = 0;
            let larges = 0;
            // If examining a single stat, only flag these as issues for this particular stat if this stat
            // is actually contributing to the problem.
            let reportSmall = !statToReport;
            let reportLarge = !statToReport;
            const caps = item.gearItem.unsyncedVersion.statCaps;
            for (const stat of ALL_SUB_STATS) {
                const current = item.relicStats[stat];
                const cap = caps[stat];
                if (current && cap && current > cap && (!statToReport || statToReport === stat)) {
                    out.push(`Stat ${STAT_ABBREVIATIONS[stat]} must be ${cap} or lower. `);
                }
                // Keep track of small/large counts
                if (current == this.smallValue) {
                    smalls++;
                    if (stat === statToReport) {
                        reportSmall = true;
                    }
                }
                else if (current == this.largeValue) {
                    larges++;
                    if (stat === statToReport) {
                        reportLarge = true;
                    }
                }
                // Also report if we have a non-zero value that is neither large nor small
                else if (current !== 0 && (!statToReport || statToReport === stat)) {
                    out.push(`{current} is not a valid ${STAT_ABBREVIATIONS[stat]} amount - it should either be ${this.largeValue} or ${this.smallValue}`);
                }
            }
            if ((smalls > this.numSmall && reportSmall) || (larges > this.numLarge && reportLarge)) {
                out.push(`This relic should have two large stats and one small stat`);
            }
            return out;

        }
    }
}

function customRelic(total: number): CustomRelicStatModel {
    return {
        type: 'customrelic',
        totalCap: total,
        validate(item: EquippedItem, statToReport?: Substat): string[] {
            const out = [];
            let runningTotal = 0;
            const caps = item.gearItem.unsyncedVersion.statCaps;
            for (const stat of ALL_SUB_STATS) {
                const current = item.relicStats[stat];
                const cap = caps[stat];
                if (current && cap && current > cap && (!statToReport || statToReport === stat)) {
                    out.push(`Stat ${STAT_ABBREVIATIONS[stat]} must be ${cap} or lower. `);
                }
                if (current) {
                    runningTotal += current;
                }
            }
            // Warn for overcap
            if (runningTotal > this.totalCap) {
                const overcap = runningTotal - this.totalCap;
                // If reporting specific stat, make sure that stat is non-zero, and tailor the message based on whether
                // you would be able to fix the issue by reducing only that stat.
                if (statToReport) {
                    const reportingStatAmount = item.relicStats[statToReport];
                    // Skip if the stat being reported is zero to begin with
                    if (reportingStatAmount > 0) {
                        // If the issue can be fixed by reducing only the current stat, report that to the user
                        if (overcap <= reportingStatAmount) {
                            const reduceTo = reportingStatAmount - overcap;
                            out.unshift(`Sum of stats must be ${this.totalCap} or lower (currently ${runningTotal}). You could fix this by reducing ${STAT_ABBREVIATIONS[statToReport]} to ${reduceTo}.`);
                        }
                        else {
                            // Report the generic message if not
                            out.unshift(`Sum of stats must be ${this.totalCap} or lower (currently ${runningTotal}).`);
                        }
                    }
                }
                // Otherwise, just report the generic message
                else {
                    out.unshift(`Sum of stats must be ${this.totalCap} or lower (currently ${runningTotal}).`);
                }
            }
            return out;
        }
    }
}

// TODO: you need to not be able to edit certain stats, like DH for healers
export function getRelicStatModelFor(gearItem: GearItem, baseParams: BaseParamMap): RelicStatModel | null {
    if (!gearItem.isCustomRelic) {
        return null;
    }
    // BaseParam tells you that 2h = 140%, 1h = 100%, and shield = 40%
    // Just use crit, it should be the same for all of them
    const slotModifier = baseParams['crit'][gearItem.occGearSlotName] / 140;
    const statCap = gearItem.unsyncedVersion.statCaps['crit'];
    switch (gearItem.ilvl) {
        // EW relics are 2 capped stats, and one 72
        case 665:
            return ewRelic(statCap, Math.round(72 * slotModifier));
        case 645:
            return ewRelic(statCap, Math.round(72 * slotModifier));
        case 535:
            return customRelic(Math.round(468 * slotModifier));
        case 515:
            return customRelic(Math.round(462 * slotModifier));
    }
    return {
        type: "unknown",
        validate(item: EquippedItem, statToReport?: Substat): string[] {
            const out = [];
            const caps = item.gearItem.unsyncedVersion.statCaps;
            for (const stat in (statToReport ? [statToReport] : ALL_SUB_STATS)) {
                const current = item.relicStats[stat];
                const cap = caps
                if (current && cap && current > cap) {
                    out.push(`Stat ${STAT_ABBREVIATIONS[stat]} must be ${cap} or lower.`);
                }
            }
            return out;
        }
    }
}

export function makeRelicStatEditor(equipment: EquippedItem, stat: Substat, set: CharacterGearSet): HTMLElement {
    const gearItem = equipment.gearItem;
    if (gearItem.relicStatModel.type === 'unknown' || gearItem.relicStatModel.type === 'customrelic') {
        const inputSubstatCap = gearItem.unsyncedVersion.statCaps[stat] ?? 1000;
        const input = new FieldBoundIntField(equipment.relicStats, stat, {
            postValidators: [ctx => {
                if (ctx.newValue < 0) {
                    ctx.failValidation('Must be greater than zero');
                }
                else if (ctx.newValue > inputSubstatCap) {
                    ctx.failValidation(`Must be ${inputSubstatCap} or lower`);
                }
            }]
        });
        const cap = gearItem.statCaps[stat] ?? 9999;
        input.type = 'number';
        input.pattern = '[0-9]*';
        input.inputMode = 'number';
        input.classList.add('gear-items-table-relic-stat-input');
        const reval = () => {
            // TODO: move this to EquippedItem or somewhere else where the set-level validations can happen
            const validationFailures = equipment.gearItem.relicStatModel.validate(equipment, stat);
            if (validationFailures.length === 0) {
                input.classList.remove('relic-validation-failed');
                const newValue = equipment.relicStats[stat];
                if (newValue > cap) {
                    input.title = `Synced down:\n${newValue}/${cap}`;
                }
                else {
                    input.removeAttribute('title');
                    delete input.title;
                }
            }
            else {
                input.classList.add('relic-validation-failed');
                input.title = validationFailures.join('\n');
            }
        }
        reval();
        input['revalidate'] = reval;
        // Disgusting
        input.addListener(() => {
            setTimeout(() => {
                set.forceRecalc();
                const row = input.closest('tr');
                const inputs = row.querySelectorAll('select, input');
                inputs.forEach(inp => {
                    const reval = inp['revalidate'];
                    if (reval) {
                        reval();
                    }
                })
            }, 10);

        });
        return input;
    }
    else if (gearItem.relicStatModel.type === 'ewrelic') {
        const inputSubstatCap = gearItem.unsyncedVersion.statCaps[stat] ?? 1000;
        const input = new FieldBoundDataSelect(equipment.relicStats, stat, val => val.toString(), [0, gearItem.relicStatModel.smallValue, gearItem.relicStatModel.largeValue]);
        input.addEventListener('mousedown', e => e.stopPropagation());
        const cap = gearItem.statCaps[stat] ?? 9999;
        input.classList.add('gear-items-table-relic-stat-input');
        input.classList.add('relic-stat-dropdown');
        const reval = () => {
            // TODO: move this to EquippedItem or somewhere else where the set-level validations can happen
            const validationFailures = equipment.gearItem.relicStatModel.validate(equipment, stat);
            if (validationFailures.length === 0) {
                input.classList.remove('relic-validation-failed');
                const newValue = equipment.relicStats[stat];
                if (newValue > cap) {
                    input.title = `Synced down:\n${newValue}/${cap}`;
                }
                else {
                    input.removeAttribute('title');
                    delete input.title;
                }
            }
            else {
                input.classList.add('relic-validation-failed');
                input.title = validationFailures.join('\n');
            }
        }
        reval();
        input['revalidate'] = reval;
        // Disgusting
        input.addListener(() => {
            setTimeout(() => {
                set.forceRecalc();
                const row = input.closest('tr');
                const inputs = row.querySelectorAll('select, input');
                console.log('inputs', [])
                inputs.forEach(inp => {
                    console.log('foo')
                    const reval = inp['revalidate'];
                    if (reval) {
                        reval();
                    }
                })
            }, 10);

        });
        return input;

    }
    return document.createElement('span');
}
