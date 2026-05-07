import {ComputedSetStats, EquipmentSet, GearItem, RawStatKey} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet} from "../gear";

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
        },
    } as CharacterGearSet;
}
