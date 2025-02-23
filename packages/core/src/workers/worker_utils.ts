import {CharacterGearSet} from "../gear";
import {
    EquippedItem,
    EquipSlotKey,
    ItemsSlotsExport,
    MicroSetExport,
    MicroSlotExport,
    SetExport
} from "@xivgear/xivmath/geartypes";

export function setToMicroExport(set: CharacterGearSet): MicroSetExport {
    const slots: MicroSlotExport[] = [];
    for (const equipmentKey in set.equipment) {
        const inSlot: EquippedItem = set.equipment[equipmentKey];
        if (inSlot) {
            const exportedItem: MicroSlotExport = [
                equipmentKey as EquipSlotKey,
                // TODO: determine if it makes more sense to just serialize empty materia slots as {}
                // The advantage is that {} is a lot smaller than {"id":-1}, and exports are already long
                // On the other hand, *most* real exports would have slots filled (BiS etc)
                inSlot.gearItem.id,
                inSlot.melds.map(meld => {
                    return meld.equippedMateria?.id ?? null;
                }),
                (inSlot.relicStats && Object.entries(inSlot.relicStats)) ? {...inSlot.relicStats} : null,
            ];
            slots.push(exportedItem);
        }
    }
    return {
        slots: slots,
    };
}

export function microExportToFullExport(s: MicroSetExport): SetExport {
    const fakeItemsImport: Partial<ItemsSlotsExport> = {};
    s.slots.forEach(s => {
        const slotName = s[0];
        fakeItemsImport[slotName] = {
            id: s[1],
            materia: s[2].map(m => ({id: m ?? -1})),
            relicStats: s[3] ?? undefined,
        };
    });
    return {
        items: fakeItemsImport,
        name: "",
    };
}
