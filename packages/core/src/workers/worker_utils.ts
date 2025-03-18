import {CharacterGearSet} from "../gear";
import {
    EquippedItem,
    EquipSlotKey,
    ItemsSlotsExport,
    MicroSetExport,
    MicroSlotExport,
    RelicStatsExport,
    SetExport
} from "@xivgear/xivmath/geartypes";

export function setToMicroExport(set: CharacterGearSet): MicroSetExport {
    const slots: MicroSlotExport[] = [];
    for (const equipmentKey in set.equipment) {
        const inSlot: EquippedItem = set.equipment[equipmentKey as EquipSlotKey];
        if (inSlot) {
            if (inSlot.gearItem.isCustomRelic) {
                const exportedItem: MicroSlotExport = [
                    equipmentKey as EquipSlotKey,
                    // TODO: determine if it makes more sense to just serialize empty materia slots as {}
                    // The advantage is that {} is a lot smaller than {"id":-1}, and exports are already long
                    // On the other hand, *most* real exports would have slots filled (BiS etc)
                    // To indicate NQ items, add .5 to the item ID
                    inSlot.gearItem.id,
                    "relic",
                    (inSlot.relicStats && Object.entries(inSlot.relicStats)) ? {...inSlot.relicStats} : null,
                ];
                slots.push(exportedItem);

            }
            else {
                const exportedItem: MicroSlotExport = [
                    equipmentKey as EquipSlotKey,
                    // TODO: determine if it makes more sense to just serialize empty materia slots as {}
                    // The advantage is that {} is a lot smaller than {"id":-1}, and exports are already long
                    // On the other hand, *most* real exports would have slots filled (BiS etc)
                    inSlot.gearItem.id + (inSlot.gearItem.isNqVersion ? 0.5 : 0),
                    ...inSlot.melds.map(meld => {
                        return meld.equippedMateria?.id ?? null;
                    }),
                ];
                slots.push(exportedItem);
            }
        }
    }
    if (set.food?.id) {
        slots.push(["food", set.food?.id]);
    }
    return slots;
}

export function microExportToFullExport(s: MicroSetExport): SetExport {
    const fakeItemsImport: ItemsSlotsExport = {};
    let foodId: number | null = null;
    s.forEach(s => {
        const slotName = s[0];
        if (slotName === "food") {
            foodId = s[1];
        }
        else {
            if (s[2] === 'relic') {
                fakeItemsImport[slotName] = {
                    id: s[1],
                    materia: [],
                    relicStats: s[3] as RelicStatsExport,
                };
            }
            else {
                const itemIdRaw = s[1];
                const mod = itemIdRaw % 1;
                if (mod !== 0) {
                    fakeItemsImport[slotName] = {
                        id: Math.floor(s[1]),
                        forceNq: true,
                        materia: s.slice(2).map(m => ({id: (m as number) ?? -1})),
                    };
                }
                else {
                    fakeItemsImport[slotName] = {
                        id: s[1],
                        materia: s.slice(2).map(m => ({id: (m as number) ?? -1})),
                    };
                }
            }
        }
    });
    return {
        items: fakeItemsImport,
        food: foodId,
        name: "",
    };
}
