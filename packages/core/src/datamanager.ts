import {JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {
    FoodItem,
    GearItem,
    IlvlSyncInfo,
    JobMultipliers,
    Materia,
    OccGearSlotKey,
    RawStatKey
} from "@xivgear/xivmath/geartypes";
import {NewApiDataManager} from "./datamanager_new";

/**
 * Mapping for BaseParam to BaseParamInfo.
 */
export type BaseParamMap = { [rawStat in RawStatKey]?: BaseParamInfo }


export type BaseParamInfo = {
    slots: BaseParamSlotInfo,
    /**
     * meldParam is job-specific weighting for stats.
     */
    meldParam: number[],
}
/**
 * Mapping from gear slot to the stat 'weighting' of that gear slot for a particular base param.
 *
 * These values are usually between 67 and 140 (excluding shields).
 */
export type BaseParamSlotInfo = Record<OccGearSlotKey, number>

export interface DataManager {
    readonly primaryClassJob: JobName;
    readonly allItems: GearItem[];
    readonly allFoodItems: FoodItem[];
    readonly allMateria: Materia[];
    readonly baseParams: BaseParamMap;
    readonly minIlvl: number;
    readonly maxIlvl: number;
    readonly minIlvlFood: number;
    readonly maxIlvlFood: number;
    readonly ilvlSync: number | undefined;
    readonly level: number;

    /**
     * Retrieve a gear item by item ID. Returns undefined if the item cannot be found.
     * If forceNq is true, will only look for an NQ version.
     *
     * @param id
     * @param forceNq
     */
    itemById(id: number, forceNq?: boolean): GearItem | undefined;

    /**
     * Retrieve a materia by item ID. Returns undefined if the item cannot be found.
     *
     * @param id
     */
    materiaById(id: number): Materia | undefined;

    /**
     * Retrieve a food item by item ID. Returns undefined if the item cannot be found.
     *
     * @param id
     */
    foodById(id: number): FoodItem | undefined;

    /**
     * Asynchronously load the data.
     */
    loadData(): Promise<void>;

    /**
     * Get the multipliers for a particular job.
     *
     * @param job
     */
    multipliersForJob(job: JobName): JobMultipliers;

    /**
     * For a given ilvl, return the sync information. May return undefined if we do not have information for the given
     * ilvl.
     * @param ilvl
     */
    getIlvlSyncInfo(ilvl: number): IlvlSyncInfo | undefined;

    /**
     * Get the implicit max ilvl for a particular level of character. Can be different for weapons vs non-weapons.
     * For example, if the highest ilvl at level 80 is 535 for weapons, then getImplicitIlvlSync(80, true) will return
     * 535. Returns undefined if the max cannot be determined.
     *
     * @param level
     * @param isWeapon
     */
    getImplicitIlvlSync(level: number, isWeapon: boolean): number | undefined;
}

export type DmJobs = [primary: JobName, ...alts: JobName[]]

export function makeDataManager(classJob: DmJobs, level: SupportedLevel, ilvlSync?: number | undefined): DataManager {
    return new NewApiDataManager(classJob, level, ilvlSync);
}
