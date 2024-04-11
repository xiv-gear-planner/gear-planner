// import assert from "node:assert";
import {ComputedSetStats, EquipmentSet, GearItem} from "../geartypes";
import {CharacterGearSet} from "../gear";

export function assertClose(actual: number, expected: number, error: number) {
    const delta = actual - expected;
    if (Math.abs(delta) > error) {
        throw Error(`Delta of ${delta} is greater than error of ${error} (actual: ${actual}, expected: ${expected})`);
    }
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
        }
    } as CharacterGearSet;
}