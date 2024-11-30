import {EquipSlotKey, ItemSlotExport, SetExportExternalSingle} from "@xivgear/xivmath/geartypes";
import {JobName, MATERIA_SLOTS_MAX, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {BaseParamToStatKey, RelevantBaseParam} from "./xivapitypes";
import {queryBaseParams} from "../datamanager_xivapi";

const ETRO_SLOTS = ['weapon', 'offHand', 'head', 'body', 'hands', 'legs', 'feet', 'ears', 'neck', 'wrists', 'fingerL', 'fingerR'] as const;
// Works
type ETRO_SLOT_KEY = typeof ETRO_SLOTS[number];

const ETRO_GEAR_SLOT_MAP: Record<ETRO_SLOT_KEY, EquipSlotKey> = {
    weapon: "Weapon",
    offHand: "OffHand",
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
    level: SupportedLevel
}

type EtroRelicsData = {
    relics?: {
        [K in keyof (typeof ETRO_GEAR_SLOT_MAP)]: string | null;
    }
}

type EtroSet = EtroGearData & EtroOtherData & EtroRelicsData;

type EtroRelic = {
    baseItem: {
        id: number
    }
    param0Value: number;
    param1Value: number;
    param2Value: number;
    param3Value: number;
    param4Value: number;
    param5Value: number;
    param0: number | null;
    param1: number | null;
    param2: number | null;
    param3: number | null;
    param4: number | null;
    param5: number | null;
}

interface EtroMateria {
    [slot: number]: number
}

export async function getSetFromEtro(etroSetId: string) {
    console.log('Fetching etro set', etroSetId);
    const response: EtroSet = await fetch(`https://etro.gg/api/gearsets/${etroSetId}/`).then(response => response.json()) as EtroSet;

    const items: {
        [K in EquipSlotKey]?: ItemSlotExport
    } = {};
    for (const slot of ETRO_SLOTS) {
        let itemId = response[slot];
        let relicStats: ItemSlotExport['relicStats'];
        if (!itemId) {
            // If a slot is null, it either isn't equipped, or is a relic
            const relicId = response.relics?.[slot];
            if (relicId) {
                relicStats = {};
                const relicData = await getEtroRelic(relicId);
                itemId = relicData.baseItem.id;
                // TODO: convert this to use new datamanager
                const baseParams = (await queryBaseParams()).Results;
                for (let i = 0; i <= 5; i++) {
                    const paramId = relicData[`param${i}`];
                    if (!paramId) {
                        break;
                    }
                    const paramData = baseParams.find(item => item.ID === paramId);
                    const stat = BaseParamToStatKey[paramData.Name as RelevantBaseParam];
                    relicStats[stat] = relicData[`param${i}Value`];
                }
            }
            else {
                continue;
            }

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
        const materiaData = response.materia ? response.materia[materiaKey] : false;
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
        if (relicStats) {
            items[slotKey] = {
                id: itemId,
                materia: materiaOut,
                relicStats: relicStats,
            };
        }
        else {
            items[slotKey] = {
                id: itemId,
                materia: materiaOut,
            };
        }
    }
    let food: number | undefined;
    if (response.food) {
        console.log('Fetching etro food', response.food);
        food = await fetch(`https://etro.gg/api/food/${response.food}/`).then(response => response.json()).then(json => json['item']);
    }
    else {
        food = undefined;
    }
    const setImport: SetExportExternalSingle = {
        name: response.name,
        job: response.jobAbbrev,
        food: food,
        items: items,
        level: response.level,
    };
    return setImport;
}

async function getEtroRelic(relicUuid: string): Promise<EtroRelic> {
    console.log('Fetching etro relic', relicUuid);
    return await fetch(`https://etro.gg/api/relic/${relicUuid}/`).then(response => response.json()) as EtroRelic;
}
