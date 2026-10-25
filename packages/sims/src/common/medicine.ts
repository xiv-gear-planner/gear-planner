import {FoodStatBonus, MedicineItem, RawStatKey} from "@xivgear/xivmath/geartypes";
import {OgcdAbility} from "@xivgear/core/sims/sim_types";
import {fl} from "@xivgear/xivmath/xivmath";
import {camel2title, toRelPct} from "@xivgear/util/strutils";

export type PotionEnableOption = true | false | 'auto';

export type PotionOptions = {
    usePotion: PotionEnableOption;
}

/**
 * Build a potion action from the medicine equipped on a gear set.
 */
export function makeMedicinePotion(medicine: MedicineItem | undefined): Readonly<OgcdAbility> | undefined {
    if (!medicine) {
        return undefined;
    }

    const medicineBonuses = Object.entries(medicine.bonuses).flatMap(([rawStat, bonus]) =>
        bonus ? [[rawStat as RawStatKey, bonus] as [RawStatKey, FoodStatBonus]] : []
    );
    return {
        name: medicine.nameTranslation.asCurrentLang,
        id: 35106,
        itemId: medicine.id,
        type: 'ogcd',
        attackType: 'Item',
        translate: false,
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
                        medicineBonuses.forEach(([stat, bonus]) => {
                            bonuses[stat] = Math.min(fl(stats[stat] * (bonus.percentage / 100)), bonus.max);
                        });
                    },
                },
                descriptionExtras: medicineBonuses.map(([stat, bonus]) =>
                    `${toRelPct(bonus.percentage / 100, 0)}% ${camel2title(stat)} (max ${bonus.max})`
                ),
            },
        ],
    };
}
