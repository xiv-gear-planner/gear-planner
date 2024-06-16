import {EquippedItem, Substat} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet} from "@xivgear/core/gear";
import {FieldBoundDataSelect, FieldBoundIntField} from "@xivgear/common-ui/components/util";

export function makeRelicStatEditor(equipment: EquippedItem, stat: Substat, set: CharacterGearSet): HTMLElement {
    const gearItem = equipment.gearItem;
    // If the stat is excluded, disable editing ONLY if the user had not already entered a value. Otherwise, they'd be
    // stuck with a value that they can't clear.
    if (gearItem.relicStatModel.type && gearItem.relicStatModel.excludedStats.includes(stat) && !equipment.relicStats[stat]) {
        const div = document.createElement('div');
        div.classList.add('relic-stat-excluded');
        div.title = 'You cannot use this relic stat on this class';
        return div;
    }
    else if (gearItem.relicStatModel.type === 'unknown' || gearItem.relicStatModel.type === 'customrelic') {
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
        };
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
        };
        reval();
        input['revalidate'] = reval;
        // Disgusting
        input.addListener(() => {
            setTimeout(() => {
                set.forceRecalc();
                const row = input.closest('tr');
                const inputs = row.querySelectorAll('select, input');
                console.log('inputs', []);
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
    return document.createElement('span');
}