import {processRawMateriaInfo, XivApiFoodInfo, XivApiGearInfo} from "./gear";
import {
    getClassJobStats,
    JobName,
    LEVEL_ITEMS,
    MATERIA_LEVEL_MAX_NORMAL,
    SupportedLevel
} from "@xivgear/xivmath/xivconstants";
import {GearItem, JobMultipliers, Materia, OccGearSlotKey, RawStatKey,} from "@xivgear/xivmath/geartypes";
import {xivApiGet, XivApiResultSingle, xivApiSingleCols} from "./external/xivapi";
import {BaseParamToStatKey, RelevantBaseParam, xivApiStatMapping} from "./external/xivapitypes";
import {getRelicStatModelFor} from "./relicstats/relicstats";

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
const matCols = ['Item[].Name', 'Item[].Icon', 'BaseParam.nonexistent', 'Value'] as const;
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
        columns: ['Name', 'OneHandWeaponPercent', 'TwoHandWeaponPercent', 'BraceletPercent', 'ChestPercent', 'EarringPercent', 'FeetPercent', 'HandsPercent', 'HeadPercent', 'LegsPercent', 'NecklacePercent', 'OHPercent', 'RingPercent'] as const,
        columnsTrn: []
    }).then(data => {
        console.log(`Got ${data.Results.length} BaseParams`);
        return data;
    });
}

/**
 * Mapping from gear slot to the stat 'weighting' of that gear slot for a particular base param.
 *
 * These values are usually between 67 and 140 (excluding shields).
 */
export type BaseParamInfo = Record<OccGearSlotKey, number>
/**
 * Mapping for BaseParam to BaseParamInfo.
 */
export type BaseParamMap = { [rawStat in RawStatKey]?: BaseParamInfo }

export interface DataManagerIntf {
    readonly classJob: JobName;
    readonly allItems: XivApiGearInfo[];
    readonly allFoodItems: XivApiFoodInfo[];
    readonly allMateria: Materia[];
    readonly baseParams: BaseParamMap;
    readonly minIlvl: number;
    readonly maxIlvl: number;
    readonly minIlvlFood: number;
    readonly maxIlvlFood: number;
    readonly ilvlSync: number;
    readonly level: number;

    getIlvlSyncData(baseParamPromise: ReturnType<typeof queryBaseParams>, ilvl: number): Promise<IlvlSyncInfo> | Promise<{
        ilvl: number;
        substatCap(slot: OccGearSlotKey, statsKey: RawStatKey): number
    }>;

    itemById(id: number): (GearItem | undefined);

    materiaById(id: number): (Materia | undefined);

    foodById(id: number): XivApiFoodInfo;

    loadData(): Promise<void>;

    multipliersForJob(job: JobName): JobMultipliers;
}

export class DataManager implements DataManagerIntf {

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
                    Body: value['ChestPercent'] as number,
                    Ears: value['EarringPercent'] as number,
                    Feet: value['FeetPercent'] as number,
                    Hand: value['HandsPercent'] as number,
                    Head: value['HeadPercent'] as number,
                    Legs: value['LegsPercent'] as number,
                    Neck: value['NecklacePercent'] as number,
                    OffHand: value['OHPercent'] as number,
                    Ring: value['RingPercent'] as number,
                    Weapon2H: value['TwoHandWeaponPercent'] as number,
                    Weapon1H: value['OneHandWeaponPercent'] as number,
                    Wrist: value['BraceletPercent'] as number
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
                            console.log('Applying relic model');
                            item.relicStatModel = getRelicStatModelFor(item, this._baseParams, this._classJob);
                            console.log('Applied', item.relicStatModel)
                        }
                    }));
                }
                else {
                    extraPromises.push(itemIlvlPromise.then(native => {
                        item.applyIlvlData(native);
                        if (item.isCustomRelic) {
                            console.log('Applying relic model');
                            item.relicStatModel = getRelicStatModelFor(item, this._baseParams, this._classJob);
                            console.log('Applied', item.relicStatModel)
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
                    requestType:'list',
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
}
