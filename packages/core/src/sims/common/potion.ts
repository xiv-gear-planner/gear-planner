import {OgcdAbility} from "../sim_types";
import {fl, mainStatMulti} from "@xivgear/xivmath/xivmath";
import {RawStatKey} from "@xivgear/xivmath/geartypes";

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
        animationLock: 1.1,
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

export const tincture8mind = makePotion('Grade 8 Tincture of Mind', 'mind', 39731, 0.1, 262);
export const gemdraught1str = makePotion('Grade 1 Gemdraught of Strength', 'strength', 44157, 0.1, 351);
export const gemdraught1dex = makePotion('Grade 1 Gemdraught of Dexterity', 'dexterity', 44158, 0.1, 351);
export const gemdraught1int = makePotion('Grade 1 Gemdraught of Intelligence', 'intelligence', 44160, 0.1, 351);
export const gemdraught1mind = makePotion('Grade 1 Gemdraught of Mind', 'mind', 44161, 0.1, 351);