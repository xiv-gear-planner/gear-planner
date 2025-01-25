import {JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {FoodItem, GearItem, JobMultipliers, Materia, OccGearSlotKey, RawStatKey} from "@xivgear/xivmath/geartypes";
// import {XivApiDataManager} from "./datamanager_xivapi";
import {NewApiDataManager} from "./datamanager_new";
import {IlvlSyncInfo} from "./datamanager_xivapi";

/**
 * Mapping for BaseParam to BaseParamInfo.
 */
export type BaseParamMap = { [rawStat in RawStatKey]?: BaseParamInfo }

/**
 * Mapping from gear slot to the stat 'weighting' of that gear slot for a particular base param.
 *
 * These values are usually between 67 and 140 (excluding shields).
 */
export type BaseParamInfo = Record<OccGearSlotKey, number>

export interface DataManager {
    readonly classJob: JobName;
    readonly allItems: GearItem[];
    readonly allFoodItems: FoodItem[];
    readonly allMateria: Materia[];
    readonly baseParams: BaseParamMap;
    readonly minIlvl: number;
    readonly maxIlvl: number;
    readonly minIlvlFood: number;
    readonly maxIlvlFood: number;
    readonly ilvlSync: number;
    readonly level: number;

    itemById(id: number): GearItem | undefined;

    materiaById(id: number): Materia | undefined;

    foodById(id: number): FoodItem | undefined;

    loadData(): Promise<void>;

    multipliersForJob(job: JobName): JobMultipliers;

    getIlvlSyncInfo(ilvl: number): IlvlSyncInfo | undefined;

    getImplicitIlvlSync(level: number, isWeapon: boolean): number | undefined;
}

export function makeDataManager(classJob: JobName, level: SupportedLevel, ilvlSync?: number | undefined): DataManager {
    return new NewApiDataManager(classJob, level, ilvlSync);
}
