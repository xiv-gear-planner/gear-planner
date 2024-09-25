// import assert from "node:assert";
import {ComputedSetStats, EquipmentSet, GearItem, RawStatKey} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet} from "../gear";

/**
 * "Close enough" equality check for when floating point roundoffs cause an issue.
 *
 * You should not blindly trust this. The problem is that sometimes, that roundoff error can still be a problem.
 * e.g. floor(2.3 * 100) => floor(229.9999...) => 229 instead of the expected 230
 *
 * @param actual Actual value
 * @param expected Expected value
 * @param error Maximum allowable error
 */
export function assertClose(actual: number, expected: number, error: number = 0.000001) {
    const delta = actual - expected;
    if (Math.abs(delta) > error) {
        throw Error(`Delta of ${delta} is greater than error of ${error} (actual: ${actual}, expected: ${expected})`);
    }
}

export function isClose(actual: number, expected: number, error: number = 0.000001): boolean {
    const delta = actual - expected;
    return Math.abs(delta) <= error;

}

export function makeFakeSet(stats: ComputedSetStats): CharacterGearSet {
    return {
        get computedStats(): ComputedSetStats {
            return stats;
        },
        getItemInSlot(slot: keyof EquipmentSet): GearItem | null {
            // This works for the time being because the sim is only using this to prevent auto-attacks if you
            // did not equip a weapon.
            if (slot === 'Weapon') {
                return {
                    foo: 'bar',
                } as unknown as GearItem;
            }
            else {
                return null;
            }
        },
        isStatRelevant(stat: RawStatKey): boolean {
            return ['piety', 'crit', 'dhit', 'spellspeed', 'determination'].includes(stat);
        }
    } as CharacterGearSet;
}