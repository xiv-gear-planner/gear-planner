import {CustomFoodExport, FoodBonuses, FoodItem, FoodStatBonus, Substat} from "@xivgear/xivmath/geartypes";
import {CURRENT_MAX_LEVEL, LEVEL_ITEMS} from "@xivgear/xivmath/xivconstants";
import {xivApiIconUrl} from "../external/xivapi";
import {toTranslatable, TranslatableString} from "@xivgear/i18n/translation";

function defaultBonus(): FoodStatBonus {
    return {
        max: 100,
        percentage: 10,
    };
}

export class CustomFood implements FoodItem {

    private _data: CustomFoodExport;
    iconUrl: URL = new URL(xivApiIconUrl(26270));

    private constructor(exportedData: CustomFoodExport) {
        this._data = exportedData;
    }

    private static defaults(): Omit<CustomFoodExport, 'fakeId' | 'name'> {
        return {
            ilvl: LEVEL_ITEMS[CURRENT_MAX_LEVEL].minILvl,
            vitalityBonus: defaultBonus(),
            primaryStat: null,
            primaryStatBonus: defaultBonus(),
            secondaryStat: null,
            secondaryStatBonus: defaultBonus(),
        };
    }

    static fromExport(exportedData: CustomFoodExport): CustomFood {
        // Copy the defaults so that new fields can be added to existing items
        return new CustomFood({
            ...this.defaults(),
            ...exportedData,
        });
    }

    static fromScratch(fakeId: number): CustomFood {
        const data: CustomFoodExport = {
            ...this.defaults(),
            fakeId: fakeId,
            name: "My Custom Food",
        };
        return new CustomFood(data);
    }

    export(): CustomFoodExport {
        return {...this._data};
    }

    get ilvl(): number {
        return this._data.ilvl;
    }

    get name(): string {
        return this._data.name;
    }

    get nameTranslation(): TranslatableString {
        return toTranslatable(this.name);
    }

    get id(): number {
        return this._data.fakeId;
    }

    get bonuses(): FoodBonuses {
        const out: FoodBonuses = {
            vitality: this._data.vitalityBonus,
        };
        if (this.secondarySubStat) {
            out[this._data.secondaryStat] = this._data.secondaryStatBonus;
        }
        // Primary is done after so that it will take priority in the event that the user specifies the same
        // stat for both.
        if (this.primarySubStat) {
            out[this._data.primaryStat] = this._data.primaryStatBonus;
        }
        return out;
    }

    get primarySubStat(): Substat | undefined {
        return this._data.primaryStat;
    }

    get secondarySubStat(): Substat | undefined {
        return this._data.secondaryStat;
    }

    get customData(): CustomFoodExport {
        return this._data;
    }

}
