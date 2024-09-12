import {
    DisplayGearSlot,
    DisplayGearSlotInfo,
    DisplayGearSlotKey,
    GearAcquisitionSource,
    GearItem,
    MateriaSlot,
    OccGearSlotKey,
    RawStatKey,
    RawStats
} from "@xivgear/xivmath/geartypes";
import {xivApiIconUrl} from "../external/xivapi";
import {CURRENT_MAX_LEVEL, LEVEL_ITEMS, MATERIA_LEVEL_MAX_NORMAL} from "@xivgear/xivmath/xivconstants";
import {IlvlSyncInfo} from "../datamanager_xivapi";
import {applyStatCaps} from "../gear";
import {GearPlanSheet} from "../sheet";

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
    respectCaps: boolean;
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
    statCaps = {};
    iconUrl: URL = new URL(xivApiIconUrl(26270));
    syncedDownTo: number | null;
    private _data: CustomItemExport;

    private constructor(exportedData: CustomItemExport, private readonly sheet: GearPlanSheet) {
        this._data = exportedData;
        this.recheckStats();
    }

    private static defaults(): Omit<CustomItemExport, 'fakeId' | 'name' | 'slot' | 'respectCaps'> {
        return {
            isUnique: false,
            ilvl: LEVEL_ITEMS[CURRENT_MAX_LEVEL].minILvl,
            largeMateriaSlots: 2,
            smallMateriaSlots: 0,
            materiaGrade: MATERIA_LEVEL_MAX_NORMAL,
            stats: new RawStats(),
        };
    }

    static fromExport(exportedData: CustomItemExport, sheet: GearPlanSheet): CustomItem {
        // Copy the defaults so that new fields can be added to existing items
        return new CustomItem({
            ...this.defaults(),
            // respectCaps is false for existing items to not cause changes to sheets
            respectCaps: false,
            ...exportedData
        }, sheet);
    }

    static fromScratch(fakeId: number, slot: OccGearSlotKey, sheet: GearPlanSheet): CustomItem {
        const data: CustomItemExport = {
            ...this.defaults(),
            fakeId: fakeId,
            name: "My Custom " + slot,
            // respectCaps is true for new items
            respectCaps: true,
            slot: slot,
        };
        return new CustomItem(data, sheet);
    }

    recheckStats(): void {
        const nativeInfo = this.sheet.ilvlSyncInfo(this.ilvl);
        const syncIlvl = this.sheet.ilvlSync;
        const syncInfo = syncIlvl === undefined ? undefined : this.sheet.ilvlSyncInfo(syncIlvl);
        this.applyIlvlData(nativeInfo, syncInfo);
    }

    export(): CustomItemExport {
        return {...this._data};
    }

    get ilvl() {
        return this._data.ilvl;
    }

    set ilvl(ilvl: number) {
        this._data.ilvl = ilvl;
        this.recheckStats();
    }

    get respectCaps() {
        return this._data.respectCaps;
    }

    set respectCaps(respectCaps: boolean) {
        this._data.respectCaps = respectCaps;
        this.recheckStats();
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

    get stats(): RawStats {
        return applyStatCaps(this._data.stats, this.statCaps);
    }

    get displayGearSlotName(): DisplayGearSlotKey {
        if (this.occGearSlotName == 'Weapon1H' || this.occGearSlotName == 'Weapon2H') {
            return 'Weapon';
        }
        return this.occGearSlotName;
    }

    // TODO: this should be read-only
    get materiaSlots(): MateriaSlot[] {
        if (this.isSyncedDown) {
            return [];
        }
        const out: MateriaSlot[] = [];
        for (let i = 0; i < this._data.largeMateriaSlots; i++) {
            out.push({
                maxGrade: this._data.materiaGrade,
                allowsHighGrade: true,
                ilvl: this.ilvl
            });
        }
        for (let i = 0; i < this._data.smallMateriaSlots; i++) {
            out.push({
                maxGrade: this._data.materiaGrade - 1,
                allowsHighGrade: false,
                ilvl: this.ilvl
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

    private applyIlvlData(nativeIlvlInfo: IlvlSyncInfo, syncIlvlInfo?: IlvlSyncInfo) {
        if (this.respectCaps && nativeIlvlInfo) {
            const statCapsNative = {};
            Object.entries(this.stats).forEach(([stat, _]) => {
                statCapsNative[stat] = nativeIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
            });
            this.statCaps = statCapsNative;
            if (syncIlvlInfo && syncIlvlInfo.ilvl < this.ilvl) {
                this.unsyncedVersion = {
                    ...this,
                    stats: {...this.customData.stats}
                };
                const statCapsSync = {};
                Object.entries(this.stats).forEach(([stat, v]) => {
                    statCapsSync[stat] = syncIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
                });
                this.statCaps = statCapsSync;
                this.isSyncedDown = true;
                this.syncedDownTo = syncIlvlInfo.ilvl;
            }
            else {
                this.unsyncedVersion = this;
                this.isSyncedDown = false;
                this.syncedDownTo = null;
            }
        }
        else {
            this.statCaps = {};
            this.unsyncedVersion = this;
            this.isSyncedDown = false;
        }
        this.computeSubstats();
    }

    private computeSubstats() {
        const sortedStats = Object.entries({
            crit: this.customData.stats.crit,
            dhit: this.customData.stats.dhit,
            determination: this.customData.stats.determination,
            spellspeed: this.customData.stats.spellspeed,
            skillspeed: this.customData.stats.skillspeed,
            piety: this.customData.stats.piety,
            tenacity: this.customData.stats.tenacity,
        })
            .sort((left, right) => {
                if (left[1] > right[1]) {
                    return 1;
                }
                else if (left[1] < right[1]) {
                    return -1;
                }
                return 0;
            })
            .filter(item => item[1])
            .reverse();
        if (sortedStats.length < 2) {
            this.primarySubstat = null;
            this.secondarySubstat = null;
        }
        else {
            this.primarySubstat = sortedStats[0][0] as keyof RawStats;
            this.secondarySubstat = sortedStats[1][0] as keyof RawStats;
        }
    }

}