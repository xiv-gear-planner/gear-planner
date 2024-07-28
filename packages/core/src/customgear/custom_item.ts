import {
    DisplayGearSlot,
    DisplayGearSlotInfo,
    DisplayGearSlotKey,
    GearAcquisitionSource,
    GearItem,
    MateriaSlot,
    OccGearSlotKey,
    RawStats
} from "@xivgear/xivmath/geartypes";
import {xivApiIconUrl} from "../external/xivapi";
import {CURRENT_MAX_LEVEL, LEVEL_ITEMS, MATERIA_LEVEL_MAX_NORMAL} from "@xivgear/xivmath/xivconstants";

export type CustomItemExport = {
    ilvl: number;
    largeMateriaSlots: number;
    smallMateriaSlots: number;
    materiaGrade: number;
    name: string;
    fakeId: number;
    slot: OccGearSlotKey;
    isUnique: boolean;
    stats: RawStats;
}

export class CustomItem implements GearItem {

    unsyncedVersion: GearItem = this;
    isCustomRelic: boolean = false;
    // TODO: syncing and stat caps not supported
    isSyncedDown: boolean = false;
    relicStatModel = undefined;
    // unsyncedVersion: GearItem = null;
    acquisitionType: GearAcquisitionSource = 'custom';

    // TODO
    primarySubstat: keyof RawStats = null;
    secondarySubstat: keyof RawStats = null;
    // statCaps: { determination?: number; piety?: number; crit?: number; dhit?: number; spellspeed?: number; skillspeed?: number; tenacity?: number; hp?: number; vitality?: number; strength?: number; dexterity?: number; intelligence?: number; mind?: number; wdPhys?: number; wdMag?: number; weaponDelay?: number; };
    // TODO: syncing and stat caps not supported
    statCaps = {};
    // TODO
    iconUrl: URL = new URL(xivApiIconUrl(26270));
    private _data: CustomItemExport;

    private constructor(exportedData: CustomItemExport) {
        this._data = exportedData;
    }

    private static defaults(): Omit<CustomItemExport, 'fakeId' | 'name' | 'slot'> {
        return {
            isUnique: false,
            ilvl: LEVEL_ITEMS[CURRENT_MAX_LEVEL].minILvl,
            largeMateriaSlots: 2,
            smallMateriaSlots: 0,
            materiaGrade: MATERIA_LEVEL_MAX_NORMAL,
            stats: new RawStats(),
        };
    }

    static fromExport(exportedData: CustomItemExport): CustomItem {
        // Copy the defaults so that new fields can be added to existing items
        return new CustomItem({
            ...this.defaults(),
            ...exportedData
        });
    }

    static fromScratch(fakeId: number, slot: OccGearSlotKey): CustomItem {
        const data: CustomItemExport = {
            ...this.defaults(),
            fakeId: fakeId,
            name: "My Custom " + slot,
            slot: slot,
        };
        return new CustomItem(data);
    }

    export(): CustomItemExport {
        return {...this._data};
    }

    get ilvl() {
        return this._data.ilvl;
    }

    get isUnique() {
        return this._data.isUnique;
    }

    get name() {
        return this._data.name;
    }

    get occGearSlotName() {
        return this._data.slot;
    }

    get displayGearSlot(): DisplayGearSlot {
        return DisplayGearSlotInfo[this.displayGearSlotName];
    }

    get stats() {
        return this._data.stats;
    }

    get displayGearSlotName(): DisplayGearSlotKey {
        if (this.occGearSlotName == 'Weapon1H' || this.occGearSlotName == 'Weapon2H') {
            return 'Weapon';
        }
        return this.occGearSlotName;
    }

    get materiaSlots(): MateriaSlot[] {
        const out: MateriaSlot[] = [];
        for (let i = 0; i < this._data.largeMateriaSlots; i++) {
            out.push({
                maxGrade: this._data.materiaGrade,
                allowsHighGrade: true
            });
        }
        for (let i = 0; i < this._data.smallMateriaSlots; i++) {
            out.push({
                maxGrade: this._data.materiaGrade - 1,
                allowsHighGrade: false
            });
        }
        return out;
    }

    get id() {
        return this._data.fakeId;
    }

    get customData(): CustomItemExport {
        return this._data;
    }

}