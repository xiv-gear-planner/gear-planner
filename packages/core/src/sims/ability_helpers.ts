import {STANDARD_APPLICATION_DELAY} from "@xivgear/xivmath/xivconstants";
import {Ability, ComboData} from "./sim_types";

/**
 * Returns the application delay of an ability (from time of snapshot to time of damage/effects applying).
 *
 * @param ability The ability in question
 */
export function appDelay(ability: Ability) {
    return ability.appDelay ?? STANDARD_APPLICATION_DELAY;
}

function defaultComboData(ability: Ability, hasOtherCombos: boolean): ComboData {
    if (ability.type === 'gcd' && hasOtherCombos) {
        return {
            comboBehavior: 'break',
            comboKey: "all"
        }
    }
    else {
        return {
            comboBehavior: 'nobreak',
            comboKey: "all"
        }
    }
}

export type FinalizedComboData = {
    combos: ComboData[],
    others: ComboData
}

/**
 * Given an ability with 'raw' combo data, complete the data.
 *
 * First, if there is not a
 *
 * @param ability
 */
export function completeComboData(ability: Ability): FinalizedComboData {
    const all = ability.combos ?? [];
    const combos = [];
    let others: ComboData = null;
    for (const combo of all) {
        const key = combo.comboKey ?? 'default';
        // For continuations, validate that they actually continue off of something that
        // is eligible to start a combo.
        if (combo.comboBehavior === 'continue') {
            combo.comboFrom.forEach((from: Ability) => {
                const found = from.combos?.find(fromCombo => {
                    const otherKey = fromCombo.comboKey ?? 'default';
                    if (otherKey === key) {
                        return fromCombo.comboBehavior === 'start' || fromCombo.comboBehavior === 'continue';
                    }
                    return false;
                });
                if (!found) {
                    console.error(`Ability '${ability.name}' wants to continue combo from '${from.name}' for combo key '${key}', but that skill cannot start this combo.`);
                }
            });
        }
        if (key === "all") {
            others = combo;
        }
        else {
            combos.push({
                ...combo,
                comboKey: key
            });
        }
    }
    if (others === null) {
        if (combos.length > 0) {
            others = defaultComboData(ability, true);
        }
        else {
            others = defaultComboData(ability, false);
        }
    }
    return {
        combos: combos,
        others: others,
    };
}

/**
 * Check that two abilities are equal, based on the ability ID.
 *
 * @param left The first ability to compare.
 * @param right The second ability to compare.
 */
export function abilityEquals(left: Ability, right: Ability) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    if (left.id !== undefined && right.id !== undefined) {
        return left.id === right.id;
    }
    console.warn(`abilityEquals indeterminate (args '${JSON.stringify(left)}' and '${JSON.stringify(right)}`);
    return false;
}