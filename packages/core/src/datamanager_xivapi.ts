import {
    getClassJobStats,
    JobName,
    LEVEL_ITEMS,
    MATERIA_LEVEL_MAX_NORMAL, MATERIA_LEVEL_MAX_OVERMELD, MATERIA_LEVEL_MIN_RELEVANT, MATERIA_SLOTS_MAX, statById,
    SupportedLevel
} from "@xivgear/xivmath/xivconstants";
import {
    DisplayGearSlot, DisplayGearSlotInfo, DisplayGearSlotKey, FoodItem, GearAcquisitionSource,
    GearItem,
    JobMultipliers,
    Materia, MateriaSlot,
    OccGearSlotKey,
    RawStatKey, RawStats, RelicStatModel
} from "@xivgear/xivmath/geartypes";
import {xivApiGet, xivApiIconUrl, XivApiResultSingle} from "./external/xivapi";
import {BaseParamToStatKey, RelevantBaseParam, xivApiStatMapping} from "./external/xivapitypes";
import {requireArrayTyped, requireBool, requireNumber, requireString} from "./external/data_validators";
import {getRelicStatModelFor} from "./relicstats/relicstats";
import {BaseParamMap, DataManager} from "./datamanager";
import { applyStatCaps } from "./gear";

const itemColumns = [
    // Basic item properties
    'ID', 'Icon', 'Name',
    'LevelItem.nonexistent',
    // Equip slot restrictions
    'ClassJobCategory', 'EquipSlotCategory', 'IsUnique',
    // Stats
    'BaseParam', 'BaseParamValue', 'BaseParamSpecial', 'BaseParamValueSpecial',
    // Weapon stats
    'DamageMag', 'DamagePhys', 'DelayMs',
    // Materia
    'MateriaSlotCount', 'IsAdvancedMeldingPermitted',
    // Stuff for determining correct WD for HQ crafted items
    'CanBeHq',
    // Helps determine acquisition type
    'Rarity',
    // TODO need replacement
    // 'GameContentLinks'
    'Delayms'
] as const;
const itemColsExtra = [
    'LevelItem'
] as const;
export type XivApiItemDataRaw = XivApiResultSingle<typeof itemColumns, typeof itemColsExtra>;
// 'Item' is only there because I need to figure out how to keep the type checking happy
const matCols = ['Item[].Name', 'Item[].Icon', 'Item[].LevelItem@as(raw)', 'BaseParam.nonexistent', 'Value'] as const;
// TODO: make a better way of doing this. matColsTrn represents the columns that are transitively included by way of
// including a sub-column.
const matColsTrn = ['Item', 'BaseParam'] as const;
export type XivApiMateriaDataRaw = XivApiResultSingle<typeof matCols, typeof matColsTrn>;
// Food cols on the base Item table
const foodBaseItemCols = ['Icon', 'Name', 'LevelItem', 'ItemAction'] as const;
export type XivApiFoodDataRaw = XivApiResultSingle<typeof foodBaseItemCols>;
// Food cols on the FoodItem table
const foodItemFoodCols = ['BaseParam', 'ValueHQ', 'MaxHQ'] as const;
export type XivApiFoodItemDataRaw = XivApiResultSingle<typeof foodItemFoodCols>;
export type IlvlSyncInfo = {
    readonly ilvl: number;
    substatCap(slot: OccGearSlotKey, statsKey: RawStatKey): number;
}

export function queryBaseParams() {
    return xivApiGet({
        requestType: "list",
        sheet: 'BaseParam',
        columns: ['Name', 'OneHandWeaponPercent', 'TwoHandWeaponPercent', 'BraceletPercent', 'ChestPercent', 'EarringPercent', 'FeetPercent', 'HandsPercent', 'HeadPercent', 'LegsPercent', 'NecklacePercent', 'OffHandPercent', 'RingPercent'] as const,
        columnsTrn: []
    }).then(data => {
        console.log(`Got ${data.Results.length} BaseParams`);
        return data;
    });
}

export class XivApiDataManager implements DataManager {

    private readonly _minIlvl: number;
    private readonly _maxIlvl: number;
    private readonly _minIlvlFood: number;
    private readonly _maxIlvlFood: number;
    private readonly _classJob: JobName;
    private readonly _level: SupportedLevel;
    private readonly _ilvlSync: number | undefined;

    public constructor(classJob: JobName, level: SupportedLevel, ilvlSync?: number | undefined) {
        this._classJob = classJob;
        this._level = level;
        const lvlData = LEVEL_ITEMS[this._level];
        this._minIlvl = lvlData.minILvl;
        this._maxIlvl = lvlData.maxILvl;
        this._minIlvlFood = lvlData.minILvlFood;
        this._maxIlvlFood = lvlData.maxILvlFood;
        this._ilvlSync = ilvlSync;
    }

    private _allItems: XivApiGearInfo[];
    private _allMateria: Materia[];
    private _allFoodItems: XivApiFoodInfo[];
    private _jobMultipliers: Map<JobName, JobMultipliers>;
    private _baseParams: BaseParamMap;
    private _isyncPromise: Promise<Map<number, IlvlSyncInfo>>;
    private _isyncData: Map<number, IlvlSyncInfo>;

    async getIlvlSyncData(baseParamPromise: ReturnType<typeof queryBaseParams>, ilvl: number) {
        if (this._isyncPromise === undefined) {
            this._isyncPromise = Promise.all([baseParamPromise, xivApiGet({
                requestType: 'list',
                columns: ['*'] as const,
                sheet: 'ItemLevel',
                perPage: 500,
                // Optimize these by not pulling a second unnecessary page
                startPage: this._minIlvl > 500 ? 1 : 0,
                pageLimit: 2,
            })]).then(responses => {
                const outMap = new Map<number, IlvlSyncInfo>();
                const jobStats = getClassJobStats(this._classJob);
                for (const row of responses[1].Results) {
                    const ilvl = row.ID;
                    const ilvlStatModifiers = new Map<RawStatKey, number>();
                    // Unroll the ItemLevel object into a direct mapping from RawStatKey => modifier
                    for (const respElementKey in row) {
                        if (respElementKey in xivApiStatMapping) {
                            ilvlStatModifiers.set(xivApiStatMapping[respElementKey], row[respElementKey]);
                        }
                    }
                    // BaseParam data is trickier. First, we need to convert from a list to a map, where the keys are the stat.
                    const baseParams = this._baseParams;
                    outMap.set(ilvl, {
                        ilvl: ilvl,
                        substatCap(slot: OccGearSlotKey, statsKey: RawStatKey): number {
                            const ilvlModifier: number = ilvlStatModifiers.get(statsKey as RawStatKey);
                            const baseParamModifier = baseParams[statsKey as RawStatKey][slot];
                            const multi = jobStats.itemStatCapMultipliers?.[statsKey];
                            if (multi) {
                                return Math.round(multi * Math.round(ilvlModifier * baseParamModifier / 1000));
                            }
                            else {
                                return Math.round(ilvlModifier * baseParamModifier / 1000);
                            }
                        },
                    } as const);

                }
                this._isyncData = outMap;
                return outMap;
            });
        }
        const data = await this._isyncPromise;
        if (data.has(ilvl)) {
            return data.get(ilvl);
        }
        else {
            console.error(`ilvl ${ilvl} not found`);
            return null;
        }
    }

    itemById(id: number): (GearItem | undefined) {
        return this._allItems.find(item => item.id === id);
    }

    materiaById(id: number): (Materia | undefined) {
        if (id < 0) {
            return undefined;
        }
        return this._allMateria.find(item => item.id === id);
    }

    foodById(id: number) {
        return this._allFoodItems.find(food => food.id === id);
    }


    async loadData() {
        const baseParamPromise = queryBaseParams().then(data => {
            this._baseParams = data.Results.reduce<{
                [rawStat in RawStatKey]?: Record<OccGearSlotKey, number>
            }>((baseParams, value) => {
                // Each individual item also gets converted
                baseParams[BaseParamToStatKey[value.Name as RelevantBaseParam]] = {
                    Body: requireNumber(value.ChestPercent),
                    Ears: requireNumber(value.EarringPercent),
                    Feet: requireNumber(value.FeetPercent),
                    Hand: requireNumber(value.HandsPercent),
                    Head: requireNumber(value.HeadPercent),
                    Legs: requireNumber(value.LegsPercent),
                    Neck: requireNumber(value.NecklacePercent),
                    OffHand: requireNumber(value.OffHandPercent),
                    Ring: requireNumber(value.RingPercent),
                    Weapon2H: requireNumber(value.TwoHandWeaponPercent),
                    Weapon1H: requireNumber(value.OneHandWeaponPercent),
                    Wrist: requireNumber(value.BraceletPercent)
                };
                return baseParams;
            }, {});
            return data;
        });
        const extraPromises = [];
        console.log("Loading items");


        const itemsPromise = xivApiGet({
            requestType: 'search',
            sheet: 'Item',
            columns: itemColumns,
            columnsTrn: itemColsExtra,
            // EquipSlotCategory! => EquipSlotCategory is not null => filters out now-useless belts
            filters: [`LevelItem>=${this._minIlvl}`, `LevelItem<=${this._maxIlvl}`, `ClassJobCategory.${this._classJob}=1`, 'EquipSlotCategory>0'],
        })
            .then(async (data) => {
                if (data) {
                    console.log(`Got ${data.Results.length} Items`);
                    return data.Results;
                }
                else {
                    console.error(`Got No Items!`);
                    return null;
                }
            }).then((rawItems) => {
                this._allItems = rawItems
                    .filter(i => {
                        return i['Stats'] !== null
                            || (i['ClassJobCategory']?.['BLU'] === 1 && i['EquipSlotCategory']?.['MainHand'] === 1); // Don't filter out BLU weapons
                    })
                    .map(i => new XivApiGearInfo(i));
                // TODO: put up better error
            }, (e) => console.error(e));
        const statsPromise = Promise.all([itemsPromise, baseParamPromise]).then(() => {
            console.log(`Finishing item calculations for ${this._allItems.length} items`);
            this._allItems.forEach(item => {
                const itemIlvlPromise = this.getIlvlSyncData(baseParamPromise, item.ilvl);
                if (this._ilvlSync) {
                    const ilvlSyncPromise = this.getIlvlSyncData(baseParamPromise, this._ilvlSync);
                    extraPromises.push(Promise.all([itemIlvlPromise, ilvlSyncPromise]).then(([native, sync]) => {
                        item.applyIlvlData(native, sync);
                        if (item.isCustomRelic) {
                            // console.debug('Applying relic model');
                            item.relicStatModel = getRelicStatModelFor(item, this._baseParams, this._classJob);
                            // console.debug('Applied', item.relicStatModel)
                        }
                    }));
                }
                else {
                    extraPromises.push(itemIlvlPromise.then(native => {
                        item.applyIlvlData(native);
                        if (item.isCustomRelic) {
                            // console.debug('Applying relic model');
                            item.relicStatModel = getRelicStatModelFor(item, this._baseParams, this._classJob);
                            // console.debug('Applied', item.relicStatModel)
                        }
                    }));
                }
            });
        });

        // Materia
        console.log("Loading materia");
        const materiaPromise = xivApiGet({
            requestType: 'list',
            sheet: 'Materia',
            columns: matCols,
            columnsTrn: matColsTrn,
            pageLimit: 1,
            perPage: 50
        })
            .then((data) => {
                if (data) {
                    console.log(`Got ${data.Results.length} Materia Types`);
                    this._allMateria = data.Results
                        // TODO: if a materia is discontinued but should still be available for old
                        // sets, this will not work.
                        .filter(i => i['Value'][MATERIA_LEVEL_MAX_NORMAL - 1])
                        .flatMap(item => {
                            return processRawMateriaInfo(item);
                        });
                    console.log(`Processed ${this._allMateria.length} total Materia items`);
                }
                else {
                    console.error('Got No Materia!');
                }
            }, e => {
                console.error(e);
            });
        console.log("Loading food");
        const foodPromise = xivApiGet({
            requestType: 'search',
            sheet: 'Item',
            // filters: ['ItemKind=5', 'ItemSearchCategory=45', `LevelItem>=${this._minIlvlFood}`, `LevelItem<=${this._maxIlvlFood}`],
            filters: ['ItemSearchCategory=45', `LevelItem>=${this._minIlvlFood}`, `LevelItem<=${this._maxIlvlFood}`],
            columns: foodBaseItemCols
        })
            .then((data) => {
                console.log(`Got ${data.Results.length} Food Items`);
                return data.Results;
            })
            .then(async (rawFoods) => {
                const foodIds = rawFoods.map(item => item.ItemAction['fields']['Data'][1] as number);
                const food = await xivApiGet({
                    requestType: 'list',
                    sheet: 'ItemFood',
                    columns: foodItemFoodCols,
                    rows: foodIds,
                });
                const foodMap = new Map(food.Results.map(result => [result.ID, result]));

                return rawFoods.map(item => {
                    const itemFoodData = foodMap.get(item.ItemAction['fields']['Data'][1]);
                    return new XivApiFoodInfo(item, itemFoodData);
                });
            })
            .then((processedFoods) => processedFoods.filter(food => Object.keys(food.bonuses).length > 1))
            .then((foods) => this._allFoodItems = foods,
                e => console.error(e));
        console.log("Loading jobs");
        const jobsPromise = xivApiGet({
            requestType: "list",
            sheet: "ClassJob",
            columns: ['Abbreviation', 'ModifierDexterity', 'ModifierIntelligence', 'ModifierMind', 'ModifierStrength', 'ModifierVitality', 'ModifierHitPoints'] as const
        })
            .then(data => {
                console.log(`Got ${data.Results.length} Jobs`);
                return data.Results;
            })
            .then(rawJobs => {
                this._jobMultipliers = new Map<JobName, JobMultipliers>();
                for (const rawJob of rawJobs) {
                    this._jobMultipliers.set(rawJob['Abbreviation'] as JobName, {
                        dexterity: rawJob.ModifierDexterity as number,
                        intelligence: rawJob.ModifierIntelligence as number,
                        mind: rawJob.ModifierMind as number,
                        strength: rawJob.ModifierStrength as number,
                        vitality: rawJob.ModifierVitality as number,
                        hp: rawJob.ModifierHitPoints as number,
                    });
                }
            });
        const ilvlPromise = this.getIlvlSyncData(baseParamPromise, 710);
        await Promise.all([baseParamPromise, itemsPromise, statsPromise, materiaPromise, foodPromise, jobsPromise, ilvlPromise]);
        await Promise.all(extraPromises);
    }

    multipliersForJob(job: JobName): JobMultipliers {
        if (!this._jobMultipliers) {
            throw Error("You must wait for loadData() before calling this method");
        }
        const multi = this._jobMultipliers.get(job);
        if (!multi) {
            throw Error(`No data for job ${job}`)
        }
        return multi;
    }

    get allItems(): XivApiGearInfo[] {
        return this._allItems;
    }

    get allFoodItems(): XivApiFoodInfo[] {
        return this._allFoodItems;
    }

    get allMateria(): Materia[] {
        return this._allMateria;
    }

    get baseParams(): BaseParamMap {
        return this._baseParams;
    }

    get minIlvl(): number {
        return this._minIlvl;
    }

    get maxIlvl(): number {
        return this._maxIlvl;
    }

    get minIlvlFood(): number {
        return this._minIlvlFood;
    }

    get maxIlvlFood(): number {
        return this._maxIlvlFood;
    }

    get ilvlSync(): number | undefined {
        return this._ilvlSync;
    }

    get level(): SupportedLevel {
        return this._level;
    }

    get classJob(): JobName {
        return this._classJob;
    }

    getIlvlSyncInfo(ilvl: number): IlvlSyncInfo {
        return this._isyncData.get(ilvl);
    }
}

// noinspection RedundantIfStatementJS
export class XivApiGearInfo implements GearItem {
    id: number;
    name: string;
    iconUrl: URL;
    ilvl: number;
    displayGearSlot: DisplayGearSlot;
    displayGearSlotName: DisplayGearSlotKey;
    occGearSlotName: OccGearSlotKey;
    stats: RawStats;
    primarySubstat: keyof RawStats | null;
    secondarySubstat: keyof RawStats | null;
    materiaSlots: MateriaSlot[];
    isCustomRelic: boolean;
    isUnique: boolean;
    unsyncedVersion: XivApiGearInfo;
    acquisitionType: GearAcquisitionSource;
    statCaps: {
        [K in RawStatKey]?: number
    };
    isSyncedDown: boolean;
    syncedDownTo: number | null;
    relicStatModel: RelicStatModel;

    constructor(data: XivApiItemDataRaw) {
        this.id = requireNumber(data.ID);
        this.name = requireString(data.Name);
        this.ilvl = requireNumber(data.LevelItem['value']);
        this.iconUrl = new URL(xivApiIconUrl(requireNumber(data.Icon['id']), true));
        const eqs = data.EquipSlotCategory['fields'];
        if (!eqs) {
            console.error('EquipSlotCategory was null!', data);
        }
        else if (eqs['MainHand']) {
            this.displayGearSlotName = 'Weapon';
            if (eqs['OffHand']) {
                this.occGearSlotName = 'Weapon2H'
            }
            else {
                this.occGearSlotName = 'Weapon1H';
            }
        }
        else if (eqs['OffHand']) {
            this.displayGearSlotName = 'OffHand';
            this.occGearSlotName = 'OffHand';
        }
        else if (eqs['Head']) {
            this.displayGearSlotName = 'Head';
            this.occGearSlotName = 'Head';
        }
        else if (eqs['Body']) {
            this.displayGearSlotName = 'Body';
            this.occGearSlotName = 'Body';
        }
        else if (eqs['Gloves']) {
            this.displayGearSlotName = 'Hand';
            this.occGearSlotName = 'Hand';
        }
        else if (eqs['Legs']) {
            this.displayGearSlotName = 'Legs';
            this.occGearSlotName = 'Legs';
        }
        else if (eqs['Feet']) {
            this.displayGearSlotName = 'Feet';
            this.occGearSlotName = 'Feet';
        }
        else if (eqs['Ears']) {
            this.displayGearSlotName = 'Ears';
            this.occGearSlotName = 'Ears';
        }
        else if (eqs['Neck']) {
            this.displayGearSlotName = 'Neck';
            this.occGearSlotName = 'Neck';
        }
        else if (eqs['Wrists']) {
            this.displayGearSlotName = 'Wrist';
            this.occGearSlotName = 'Wrist';
        }
        else if (eqs['FingerL'] || eqs['FingerR']) {
            this.displayGearSlotName = 'Ring';
            this.occGearSlotName = 'Ring';
        }
        else {
            console.error("Unknown slot data!", eqs);
        }
        this.displayGearSlot = this.displayGearSlotName ? DisplayGearSlotInfo[this.displayGearSlotName] : undefined;
        const weaponDelayRaw = requireNumber(data.Delayms);
        this.stats = new RawStats();
        this.stats.wdPhys = requireNumber(data.DamagePhys);
        this.stats.wdMag = requireNumber(data.DamageMag);
        this.stats.weaponDelay = weaponDelayRaw ? (weaponDelayRaw / 1000.0) : 0;
        for (const i in requireArrayTyped(data.BaseParam, 'object')) {
            const paramName = requireString(data.BaseParam[i]['fields']['Name']);
            if (!paramName) {
                continue;
            }
            const paramValue = requireNumber(data.BaseParamValue[i]);
            const actualStatKey = BaseParamToStatKey[paramName];
            if (!actualStatKey) {
                // TODO: primary/secondary attribute bonus hits this
                console.warn(`Bad stat key: ${paramName}`);
            }
            else {
                this.stats[actualStatKey] = paramValue;
            }
        }
        if (data.CanBeHq) {
            for (const i in requireArrayTyped(data.BaseParamSpecial, 'object')) {
                const paramId = requireNumber(data.BaseParamSpecial[i]['value']);
                if (paramId <= 0) {
                    continue;
                }
                const paramName = requireString(data.BaseParamSpecial[i]['fields']['Name']);
                const paramValue = requireNumber(data.BaseParamValueSpecial[i]);
                if (paramId === 12) {
                    this.stats.wdPhys += paramValue;
                }
                else if (paramId === 13) {
                    this.stats.wdMag += paramValue;
                }
                else {
                    const paramKey = BaseParamToStatKey[paramName];
                    if (paramKey) {
                        this.stats[paramKey] += paramValue;
                    }
                }
            }
        }
        this.isUnique = Boolean(data.IsUnique);
        this.computeSubstats();
        this.materiaSlots = [];
        const baseMatCount: number = requireNumber(data.MateriaSlotCount);
        if (baseMatCount === 0) {
            // If there are no materia slots, then it might be a custom relic
            // TODO: is this branch still needed?
            if (this.displayGearSlot !== DisplayGearSlotInfo.OffHand) {
                // Offhands never have materia slots
                this.isCustomRelic = true;
            }
            else if (!this.primarySubstat) {
                // If there is no primary substat on the item, then consider it a relic
                this.isCustomRelic = true;
            }
            else {
                // Otherwise, it's just a random item that just so happens to not have materia slots
                this.isCustomRelic = false;
            }
        }
        else {
            // If it has materia slots, it definitely isn't a custom relic
            this.isCustomRelic = false;
            // Is overmelding allowed?
            const overmeld: boolean = requireBool(data.IsAdvancedMeldingPermitted);
            // The materia slot count represents slots that are always meldable
            for (let i = 0; i < baseMatCount; i++) {
                // TODO: figure out grade automatically
                this.materiaSlots.push({
                    maxGrade: MATERIA_LEVEL_MAX_NORMAL,
                    allowsHighGrade: true,
                    ilvl: this.ilvl
                });
            }
            if (overmeld) {
                // If we can also overmeld, then push a *single* high-grade slot, and then the rest are only for
                // small materia.
                this.materiaSlots.push({
                    maxGrade: MATERIA_LEVEL_MAX_NORMAL,
                    allowsHighGrade: true,
                    ilvl: this.ilvl
                });
                for (let i = this.materiaSlots.length; i < MATERIA_SLOTS_MAX; i++) {
                    this.materiaSlots.push({
                        maxGrade: MATERIA_LEVEL_MAX_OVERMELD,
                        allowsHighGrade: false,
                        ilvl: this.ilvl
                    });
                }
            }
        }
        // Try to guess the acquisition source of an item
        // Disabled since new xivapi does not provide this in an easy form
        // try {
        //     const rarity: number = data.Rarity as number;
        //     // Check if it is craftable by checking if any recipes result in this item
        //     const isCraftable = data.GameContentLinks?.['Recipe'];
        //     // Check if it is buyable by checking if any shops sell it
        //     const hasShop = data.GameContentLinks?.['SpecialShop'];
        //     // TODO: nothing results in 'normraid'
        //     switch (rarity) {
        //         case 1:
        //             if (isCraftable) {
        //                 this.acquisitionType = 'crafted';
        //             }
        //             break;
        //         // Green
        //         case 2:
        //             if (this.name.includes('Augmented')) {
        //                 this.acquisitionType = 'augcrafted';
        //             }
        //             else {
        //                 if (isCraftable) {
        //                     this.acquisitionType = 'crafted';
        //                 }
        //                 else {
        //                     this.acquisitionType = 'dungeon';
        //                 }
        //             }
        //             break;
        //         // Blue
        //         case 3: {
        //             // TODO: how to differentiate raid vs tome vs aug tome?
        //             // Aug tome: it has "augmented" in the name, easy
        //             const isWeaponOrOH = this.occGearSlotName === 'Weapon2H' || this.occGearSlotName === 'Weapon1H' || this.occGearSlotName === 'OffHand';
        //             if (ARTIFACT_ITEM_LEVELS.includes(this.ilvl)) {
        //                 // Ambiguous due to start-of-expac ex trials
        //                 if (isWeaponOrOH) {
        //                     this.acquisitionType = 'other';
        //                 }
        //                 else {
        //                     this.acquisitionType = 'artifact';
        //                 }
        //             }
        //             // Start-of-expac uncapped tome gear
        //             else if (BASIC_TOME_GEAR_ILVLS.includes(this.ilvl)) {
        //                 this.acquisitionType = 'tome';
        //             }
        //             const chkRelIlvl = (relativeToRaidTier: number) => {
        //                 return RAID_TIER_ILVLS.includes(this.ilvl - relativeToRaidTier);
        //             };
        //             if (chkRelIlvl(0)) {
        //                 if (this.name.includes('Augmented')) {
        //                     this.acquisitionType = 'augtome';
        //                 }
        //                 else {
        //                     this.acquisitionType = 'raid';
        //                 }
        //             }
        //             else if (chkRelIlvl(-10)) {
        //                 if (hasShop) {
        //                     this.acquisitionType = 'tome';
        //                 }
        //                 else {
        //                     this.acquisitionType = 'alliance';
        //                 }
        //             }
        //             else if (chkRelIlvl(-20)) {
        //
        //                 if (isWeaponOrOH) {
        //                     this.acquisitionType = 'extrial';
        //                 }
        //                 else {
        //                     // Ambiguous - first-of-the-expac extreme trial accessories and normal raid
        //                     // accessories share the same ilvl
        //                     this.acquisitionType = 'other';
        //                 }
        //             }
        //             else if ((chkRelIlvl(-5) || chkRelIlvl(-15)) && isWeaponOrOH) {
        //                 this.acquisitionType = 'extrial';
        //             }
        //             else if (this.ilvl % 10 === 5) {
        //                 if (isWeaponOrOH) {
        //                     if (chkRelIlvl(5)) {
        //                         if (this.name.includes('Ultimate')) {
        //                             this.acquisitionType = 'ultimate';
        //                         }
        //                         else {
        //                             this.acquisitionType = 'raid';
        //                         }
        //                     }
        //                 }
        //             }
        //             break;
        //         }
        //         // Purple
        //         case 4:
        //             this.acquisitionType = 'relic';
        //             break;
        //     }
        // }
        // catch (e) {
        //     console.error("Error determining item rarity", data);
        // }
        // if (!this.acquisitionType) {
        //     console.warn(`Unable to determine acquisition source for item ${this.name} (${this.id})`, data);
        //     this.acquisitionType = 'other';
        // }
        this.acquisitionType = 'other';
    }

    private computeSubstats() {
        const sortedStats = Object.entries({
            crit: this.stats.crit,
            dhit: this.stats.dhit,
            determination: this.stats.determination,
            spellspeed: this.stats.spellspeed,
            skillspeed: this.stats.skillspeed,
            piety: this.stats.piety,
            tenacity: this.stats.tenacity,
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

    /**
     * TODO fix docs for this
     */
    applyIlvlData(nativeIlvlInfo: IlvlSyncInfo, syncIlvlInfo?: IlvlSyncInfo) {
        const statCapsNative = {};
        Object.entries(this.stats).forEach(([stat, _]) => {
            statCapsNative[stat] = nativeIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
        });
        this.statCaps = statCapsNative;
        if (syncIlvlInfo && syncIlvlInfo.ilvl < this.ilvl) {
            this.unsyncedVersion = {
                ...this
            };
            this.materiaSlots = [];
            const statCapsSync = {};
            Object.entries(this.stats).forEach(([stat, v]) => {
                statCapsSync[stat] = syncIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
            });
            this.stats = applyStatCaps(this.stats, statCapsSync);
            this.statCaps = statCapsSync;
            this.computeSubstats();
            this.isSyncedDown = true;
            this.syncedDownTo = syncIlvlInfo.ilvl;
        }
        else {
            this.unsyncedVersion = this;
            this.isSyncedDown = false;
            this.syncedDownTo = null;
        }
    }
}

export class XivApiFoodInfo implements FoodItem {
    bonuses: {
        [K in RawStatKey]?: {
            percentage: number;
            max: number
        }
    } = {};
    iconUrl: URL;
    id: number;
    name: string;
    ilvl: number;
    primarySubStat: RawStatKey | undefined;
    secondarySubStat: RawStatKey | undefined;

    constructor(data: XivApiFoodDataRaw, foodData: XivApiFoodItemDataRaw) {
        this.id = requireNumber(data.ID);
        this.name = requireString(data.Name);
        this.iconUrl = new URL(xivApiIconUrl(requireNumber(data.Icon['id'])));
        this.ilvl = requireNumber(data.LevelItem['value']);
        for (const index in requireArrayTyped(foodData.BaseParam, 'object')) {
            const baseParamName = requireString(foodData['BaseParam'][index].fields.Name) as RelevantBaseParam;
            this.bonuses[BaseParamToStatKey[baseParamName]] = {
                percentage: requireNumber(foodData.ValueHQ[index]),
                max: requireNumber(foodData.MaxHQ[index]),
            }
        }
        const sortedStats = Object.entries(this.bonuses).sort((entryA, entryB) => entryB[1].max - entryA[1].max).map(entry => entry[0] as RawStatKey).filter(stat => stat !== 'vitality');
        if (sortedStats.length >= 1) {
            this.primarySubStat = sortedStats[0];
        }
        if (sortedStats.length >= 2) {
            this.secondarySubStat = sortedStats[1];
        }
    }
}

export function processRawMateriaInfo(data: XivApiMateriaDataRaw): Materia[] {
    const out: Materia[] = [];
    for (let i = MATERIA_LEVEL_MIN_RELEVANT - 1; i < MATERIA_LEVEL_MAX_NORMAL; i++) {
        const itemData = data.Item[i];
        const itemFields = itemData['fields'];
        const itemId = requireNumber(itemData['row_id']);
        const itemName = requireString(itemFields["Name"]);
        const stats = new RawStats();
        // TODO: use statById in more places
        const stat = statById(requireNumber(data.BaseParam['row_id']));
        if (!stat || !itemName) {
            continue;
        }
        stats[stat] = requireNumber(data.Value[i]);
        const grade = (i + 1);
        out.push({
            name: itemName,
            id: itemId,
            iconUrl: new URL(xivApiIconUrl(requireNumber(itemFields['Icon']['id']), true)),
            stats: stats,
            primaryStat: stat,
            primaryStatValue: stats[stat],
            materiaGrade: grade,
            isHighGrade: (grade % 2) === 0,
            ilvl: itemFields['LevelItem'] ?? 0
        });
    }
    return out;
}
