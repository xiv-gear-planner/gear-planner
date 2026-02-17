import {
    CustomItemExport,
    DisplayGearSlotInfo,
    DisplayGearSlotKey,
    DisplayGearSlotMapping,
    EquipSlotKey,
    EquipSlotMap,
    EquipSlotValue,
    GearAcquisitionSource,
    GearItem,
    IlvlSyncInfo,
    MateriaSlot,
    NormalOccGearSlotKey,
    RawStatKey,
    RawStats,
    RawStatsPart
} from "@xivgear/xivmath/geartypes";
import {xivApiIconUrl} from "../external/xivapi";
import {CURRENT_MAX_LEVEL, JobName, LEVEL_ITEMS, MATERIA_LEVEL_MAX_NORMAL} from "@xivgear/xivmath/xivconstants";
import {applyStatCaps} from "../gear";
import {GearPlanSheet} from "../sheet";
import {toTranslatable} from "@xivgear/i18n/translation";
import {SpecialStatType} from "@xivgear/data-api-client/dataapi";

class CustomItemSlotMapping implements EquipSlotMap {
    readonly Body: EquipSlotValue = 'none';
    readonly Ears: EquipSlotValue = 'none';
    readonly Feet: EquipSlotValue = 'none';
    readonly Hand: EquipSlotValue = 'none';
    readonly Head: EquipSlotValue = 'none';
    readonly Legs: EquipSlotValue = 'none';
    readonly Neck: EquipSlotValue = 'none';
    readonly OffHand: EquipSlotValue = 'none';
    readonly RingLeft: EquipSlotValue = 'none';
    readonly RingRight: EquipSlotValue = 'none';
    readonly Weapon: EquipSlotValue = 'none';
    readonly Wrist: EquipSlotValue = 'none';

    constructor(slot: NormalOccGearSlotKey) {
        switch (slot) {
            case "Weapon2H":
                this.Weapon = 'equip';
                this.OffHand = 'block';
                break;
            case "Weapon1H":
                this.Weapon = 'equip';
                break;
            case "Ring":
                this.RingLeft = 'equip';
                this.RingRight = 'equip';
                break;
            default:
                this[slot] = 'equip';
        }
    }

    canEquipTo(slot: EquipSlotKey): boolean {
        return this[slot] === 'equip';
    }

    getBlockedSlots(): EquipSlotKey[] {
        return [];
    }

}

export class CustomItem implements GearItem {

    isNqVersion: boolean = false;
    unsyncedVersion: GearItem = this;
    isCustomRelic: boolean = false;
    isSyncedDown: boolean = false;
    relicStatModel: undefined = undefined;
    acquisitionType: GearAcquisitionSource = 'custom';
    readonly rarity = 1;

    primarySubstat: keyof RawStats = null;
    secondarySubstat: keyof RawStats = null;
    statCaps: Partial<RawStats> = {};
    // TODO: pull this out into a constant somewhere
    iconUrl: URL = new URL(xivApiIconUrl(26270));
    syncedDownTo: number | null;
    private _data: CustomItemExport;
    readonly slotMapping: CustomItemSlotMapping;

    private constructor(exportedData: CustomItemExport, private readonly sheet: GearPlanSheet, private readonly isUnsyncCopy: boolean = false) {
        this._data = exportedData;
        this.recheckSync();
        this.slotMapping = new CustomItemSlotMapping(this.occGearSlotName);
    }

    private static defaults(): Omit<CustomItemExport, 'fakeId' | 'name' | 'slot' | 'respectCaps'> {
        return {
            isUnique: false,
            ilvl: LEVEL_ITEMS[CURRENT_MAX_LEVEL].minILvl,
            equipLvl: CURRENT_MAX_LEVEL,
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
            ...exportedData,
        }, sheet);
    }

    static fromScratch(fakeId: number, slot: NormalOccGearSlotKey, sheet: GearPlanSheet): CustomItem {
        const data: CustomItemExport = {
            ...this.defaults(),
            fakeId: fakeId,
            name: "My Custom " + slot,
            // respectCaps is true for new items
            respectCaps: true,
            slot: slot,
        };
        // Copy relevant features of the highest ilvl available for that slot
        const highest = sheet.highestIlvlItemForSlot(slot).unsyncedVersion;
        data.ilvl = highest.ilvl;
        data.stats.vitality = highest.stats.vitality;
        data.stats.strength = highest.stats.strength;
        data.stats.dexterity = highest.stats.dexterity;
        data.stats.intelligence = highest.stats.intelligence;
        data.stats.mind = highest.stats.mind;
        if (slot === 'Weapon2H' || slot === 'Weapon1H') {
            data.stats.weaponDelay = highest.stats.weaponDelay;
            data.stats.wdMag = highest.stats.wdMag;
            data.stats.wdPhys = highest.stats.wdPhys;
        }
        return new CustomItem(data, sheet);
    }

    recheckSync(): void {
        // If this is a copy of an item which exists for no reason but to act as another custom item's
        // unsyncedVersion, we do not want to apply stat caps. In fact, it will result in an infinite recursion if
        // we try, because it will try to generate its own unsynced copy.
        if (this.isUnsyncCopy) {
            return;
        }
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
        this.recheckSync();
    }

    get equipLvl() {
        return this._data.equipLvl;
    }

    set equipLvl(equipLvl: number) {
        this._data.equipLvl = equipLvl;
        this.recheckSync();
    }

    get respectCaps() {
        return this._data.respectCaps;
    }

    set respectCaps(respectCaps: boolean) {
        this._data.respectCaps = respectCaps;
        this.recheckSync();
    }

    get isUnique() {
        return this._data.isUnique;
    }

    get name() {
        return this._data.name;
    }

    get nameTranslation() {
        return toTranslatable(this.name);
    }

    get occGearSlotName(): NormalOccGearSlotKey {
        return this._data.slot;
    }

    get displayGearSlot(): DisplayGearSlotInfo {
        return DisplayGearSlotMapping[this.displayGearSlotName];
    }

    get stats(): RawStats {
        return applyStatCaps(this._data.stats, this.statCaps);
    }

    get displayGearSlotName(): DisplayGearSlotKey {
        if (this.occGearSlotName === 'Weapon1H' || this.occGearSlotName === 'Weapon2H') {
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
                ilvl: this.ilvl,
            });
        }
        for (let i = 0; i < this._data.smallMateriaSlots; i++) {
            out.push({
                maxGrade: this._data.materiaGrade - 1,
                allowsHighGrade: false,
                ilvl: this.ilvl,
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
            const statCapsNative: RawStatsPart = {};
            Object.entries(this.stats).forEach(([stat, _]) => {
                statCapsNative[stat as RawStatKey] = nativeIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
            });
            this.statCaps = statCapsNative;
            if (syncIlvlInfo && syncIlvlInfo.ilvl < this.ilvl) {
                this.unsyncedVersion = new CustomItem({...this._data}, this.sheet, true);
                const statCapsSync: RawStatsPart = {};
                Object.entries(this.stats).forEach(([stat, v]) => {
                    statCapsSync[stat as RawStatKey] = syncIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
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

    // Don't restrict jobs on custom items, assume the user knows what they're doing
    usableByJob(job: JobName): boolean {
        return true;
    }

    get activeSpecialStat(): null {
        return null;
    }

    set activeSpecialStat(_ignored: SpecialStatType | null) {
    }

}
