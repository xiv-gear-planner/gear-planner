import {OgcdAbility} from "../sim_types";
import {fl, mainStatMulti} from "@xivgear/xivmath/xivmath";
import {RawStatKey} from "@xivgear/xivmath/geartypes";
import {capitalizeFirstLetter} from "../../util/strutils";

function applyPotionBuff(initialValue: number, bonus: number, cap: number): number {
    const effectiveBonus = Math.min(fl(initialValue * bonus), cap);
    return initialValue + effectiveBonus;
}

function makeTincture(grade: number, stat: RawStatKey, id: number, itemId: number, bonus: number, cap: number): Readonly<OgcdAbility> {
    const statName = capitalizeFirstLetter(stat);
    return {
        name: `Grade ${grade} Tincture of ${statName}`,
        // TODO: ID is an item, not an ability - can possibily use attackType === item to check
        // if the icon needs to be an item ability?
        // For now, going with the same thing you'd see in an ACT log
        id: id,
        itemId: itemId,
        type: 'ogcd',
        attackType: 'Item',
        animationLock: 1.5,
        potency: null,
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

export const tincture8mind = makeTincture(8, 'mind', 0x20FCFAB, 39731, 0.08, 209);
