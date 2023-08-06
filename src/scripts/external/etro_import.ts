import {EquipSlotKeys, ItemSlotExport, SetExport} from "../geartypes";
import {JobName, MATERIA_SLOTS_MAX} from "../xivconstants";

const ETRO_SLOTS = ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'ears', 'neck', 'wrists', 'fingerL', 'fingerR'] as const;
// Works
type ETRO_SLOT_KEY = typeof ETRO_SLOTS[number];

export const ETRO_GEAR_SLOT_MAP: Record<ETRO_SLOT_KEY, EquipSlotKeys> = {
    weapon: "Weapon",
    head: "Head",
    body: "Body",
    hands: "Hand",
    legs: "Legs",
    feet: "Feet",
    // offhand:
    ears: "Ears",
    neck: "Neck",
    wrists: "Wrist",
    fingerL: "RingLeft",
    fingerR: "RingRight",
} as const;

type EtroGearData = {
    [K in keyof (typeof ETRO_GEAR_SLOT_MAP)]: number | null;
}

type EtroOtherData = {
    jobAbbrev: JobName,
    name: string,
    food: number | null,
    materia: { [slot: (number | string)]: EtroMateria },
}

type EtroSet = EtroGearData & EtroOtherData;

export interface EtroMateria {
    [slot: number]: number
}

export async function getSetFromEtro(etroSetId: string) {
    const response: EtroSet = await fetch(`https://etro.gg/api/gearsets/${etroSetId}/`).then(response => response.json()) as EtroSet;

    const items: {
        [K in EquipSlotKeys]?: ItemSlotExport
    } = {};
    for (let slot of ETRO_SLOTS) {
        const itemId = response[slot];
        if (!itemId) {
            continue;
        }
        const slotKey = ETRO_GEAR_SLOT_MAP[slot];
        let materiaKey;
        if (slotKey === 'RingLeft') {
            materiaKey = itemId + 'L';
        }
        else if (slotKey === 'RingRight') {
            materiaKey = itemId + 'R';
        }
        else {
            materiaKey = itemId;
        }
        const materiaData = response.materia[materiaKey];
        const materiaOut: ({ id: number } | undefined)[] = [];
        if (materiaData) {
            for (let i = 1; i <= MATERIA_SLOTS_MAX; i++) {
                const materiaMaybe = materiaData[i];
                if (materiaMaybe) {
                    materiaOut.push({id: materiaMaybe});
                }
                else {
                    materiaOut.push({id: -1});
                }
            }
        }
        items[slotKey] = {
            id: itemId,
            materia: materiaOut
        }
    }
    const setImport: SetExport = {
        name: response.name,
        job: response.jobAbbrev,
        food: response.food,
        items: items
    }
    return setImport;

}