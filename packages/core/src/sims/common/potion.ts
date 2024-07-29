import {OgcdAbility} from "../sim_types";
import {fl, mainStatMulti} from "@xivgear/xivmath/xivmath";
import {RawStatKey} from "@xivgear/xivmath/geartypes";
import {camel2title} from "@xivgear/core/util/strutils";

function applyPotionBuff(initialValue: number, bonus: number, cap: number): number {
    const effectiveBonus = Math.min(fl(initialValue * bonus), cap);
    return initialValue + effectiveBonus;
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
                    modifyStats: original => {
                        const stats = {...original};
                        stats[stat] = applyPotionBuff(stats[stat], bonus, cap);
                        if (stat === stats.jobStats.mainStat) {
                            stats.mainStatMulti = mainStatMulti(stats.levelStats, stats.jobStats, stats[stats.jobStats.mainStat]);
                            stats.aaStatMulti = mainStatMulti(stats.levelStats, stats.jobStats, stats[stats.jobStats.autoAttackStat]);
                        }
                        return stats;
                    }
                }
            }
        ],

    };
}

function makeGemdraught(stat: RawStatKey, grade: number): Readonly<OgcdAbility> {
    const statToPotItemId = {
        mind: 44161,
        strength: 44157,
        dexterity: 44158,
        intelligence: 44160,
    }
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
// 7.05
export const gemdraught2str = makeGemdraught('strength', 2);
export const gemdraught2dex = makeGemdraught('dexterity', 2);
export const gemdraught2int = makeGemdraught('intelligence', 2);
export const gemdraught2mind = makeGemdraught('mind', 2);