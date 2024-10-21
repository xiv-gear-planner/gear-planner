import {OgcdAbility} from "../sim_types";
import {fl} from "@xivgear/xivmath/xivmath";
import {RawStatKey} from "@xivgear/xivmath/geartypes";
import {camel2title} from "@xivgear/core/util/strutils";

function potionBonus(initialValue: number, bonus: number, cap: number): number {
    return Math.min(fl(initialValue * bonus), cap);
}

function makePotion(name: string, stat: RawStatKey, itemId: number, bonus: number, cap: number): Readonly<OgcdAbility> {
    return {
        name,
        id: 35106,
        itemId: itemId,
        type: 'ogcd',
        attackType: 'Item',
        animationLock: 0.6,
        potency: null,
        cooldown: {
            time: 270,
        },
        activatesBuffs: [
            {
                name: 'Medicated',
                duration: 30,
                statusId: 0x31,
                effects: {
                    modifyStats: (stats, bonuses) => {
                        bonuses[stat] = potionBonus(stats[stat], bonus, cap);
                    },
                },
            }
        ],

    };
}

export const GemdraughtGrades = [1, 2] as const;
export type GemdraughtGrade = typeof GemdraughtGrades[number];
export function makeGemdraught(stat: RawStatKey, grade: GemdraughtGrade): Readonly<OgcdAbility> {
    const statToPotItemId = {
        mind: 44161,
        strength: 44157,
        dexterity: 44158,
        intelligence: 44160,
    };
    const gradeToStatCap = [351, 392];

    return makePotion(`Grade ${grade} Gemdraught of ${camel2title(stat)}`, stat, statToPotItemId[stat], 0.1, gradeToStatCap[grade - 1]);
}

// 6.x
export const tincture8mind = makePotion('Grade 8 Tincture of Mind', 'mind', 39731, 0.1, 262);
// 7.0
export const gemdraught1str = makeGemdraught('strength', 1);
export const gemdraught1dex = makeGemdraught('dexterity', 1);
export const gemdraught1int = makeGemdraught('intelligence', 1);
export const gemdraught1mind = makeGemdraught('mind', 1);

// Latest
const MAX_GEMDRAUGHT_GRADE = GemdraughtGrades.slice(-1)[0];
export const potionMaxStr = makeGemdraught('strength', MAX_GEMDRAUGHT_GRADE);
export const potionMaxDex = makeGemdraught('dexterity', MAX_GEMDRAUGHT_GRADE);
export const potionMaxInt = makeGemdraught('intelligence', MAX_GEMDRAUGHT_GRADE);
export const potionMaxMind = makeGemdraught('mind', MAX_GEMDRAUGHT_GRADE);
