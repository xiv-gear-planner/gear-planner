import {
    getClassJobStats,
    JobName,
    LEVEL_ITEMS,
    MATERIA_LEVEL_MAX_NORMAL,
    MATERIA_LEVEL_MAX_OVERMELD,
    MATERIA_LEVEL_MIN_RELEVANT,
    MATERIA_SLOTS_MAX,
    statById,
    SupportedLevel
} from "@xivgear/xivmath/xivconstants";
import {
    DisplayGearSlot,
    DisplayGearSlotInfo,
    DisplayGearSlotKey,
    FoodItem,
    GearAcquisitionSource,
    GearItem,
    JobMultipliers,
    Materia,
    MateriaSlot,
    OccGearSlotKey,
    RawStatKey,
    RawStats,
    RelicStatModel
} from "@xivgear/xivmath/geartypes";
import {BaseParamToStatKey, RelevantBaseParam} from "./external/xivapitypes";
import {getRelicStatModelFor} from "./relicstats/relicstats";
import {requireNumber, requireString} from "./external/data_validators";
import {DataApiClient, FoodStatBonus, GearAcquisitionSource as AcqSrc} from "@xivgear/data-api-client/dataapi";
import {BaseParamMap, DataManager} from "./datamanager";
import {IlvlSyncInfo} from "./datamanager_xivapi";
import {applyStatCaps} from "./gear";

type ApiClientRawType<X extends keyof DataApiClient<never>, Y extends keyof DataApiClient<never>[X]> = DataApiClient<never>[X][Y]

type ItemType = Awaited<ReturnType<ApiClientRawType<'items', 'items'>>>['data']['items'][number]
type MateriaType = Awaited<ReturnType<ApiClientRawType<'materia', 'materia'>>>['data']['items'][number]
type FoodType = Awaited<ReturnType<ApiClientRawType<'food', 'foodItems'>>>['data']['items'][number]
// type BaseParamType = Awaited<ReturnType<ApiClientRawType<'baseParams', 'baseParams'>>>['data']['items'][number]
// type JobType = Awaited<ReturnType<ApiClientRawType<'jobs', 'jobs'>>>['data']['items'][number]
// type ItemLevelType = Awaited<ReturnType<ApiClientRawType<'itemLevel', 'itemLevels'>>>['data']['items'][number]

async function retryFetch(...params: Parameters<typeof fetch>): Promise<Response> {
    let tries = 5;
    while (true) {
        tries--;
        const result = await fetch(...params);
        // TODO: add other errors here?
        if (tries > 0 && result.status === 503 && result.statusText === 'Not Ready') {
            console.log("data api not ready, retrying", params[0]);
            await new Promise(r => setTimeout(r, 5_000 + (Math.random() * 1000)));
            continue;
        }
        if (result.status >= 400) {
            const content = JSON.stringify(await result.json());
            console.error(`Data API error: ${result.status}: ${result.statusText}`, params[0], content);
            throw Error(`Data API error: ${result.status}: ${result.statusText} (${params[0]}\n${content}`);
        }
        return result;
    }
}

const apiClient = new DataApiClient<never>({
    baseUrl: "https://data.xivgear.app",
    // baseUrl: "https://betadata.xivgear.app",
    // baseUrl: "http://localhost:8085",
    customFetch: retryFetch
});

export function setDataApi(baseUrl: string) {
    apiClient.baseUrl = baseUrl;
}

export class NewApiDataManager implements DataManager {

    private readonly _minIlvl: number;
    private readonly _maxIlvl: number;
    private readonly _minIlvlFood: number;
    private readonly _maxIlvlFood: number;
    private readonly _classJob: JobName;
    private readonly _level: SupportedLevel;
    private readonly _ilvlSync: number | undefined;
    private readonly apiClient: DataApiClient<never>;

    public constructor(classJob: JobName, level: SupportedLevel, ilvlSync?: number | undefined) {
        this._classJob = classJob;
        this._level = level;
        const lvlData = LEVEL_ITEMS[this._level];
        this._minIlvl = lvlData.minILvl;
        this._maxIlvl = lvlData.maxILvl;
        this._minIlvlFood = lvlData.minILvlFood;
        this._maxIlvlFood = lvlData.maxILvlFood;
        this._ilvlSync = ilvlSync;
        this.apiClient = apiClient;
    }

    private _allItems: DataApiGearInfo[];
    private _allMateria: Materia[];
    private _allFoodItems: DataApiFoodInfo[];
    private _jobMultipliers: Map<JobName, JobMultipliers>;
    private _baseParams: BaseParamMap;
    private _isyncPromise: Promise<Map<number, IlvlSyncInfo>>;
    private _isyncData: Map<number, IlvlSyncInfo>;
    private _maxIlvlForEquipLevel: Map<number, number>;
    private _maxIlvlForEquipLevelWeapon: Map<number, number>;

    private queryBaseParams() {
        return this.apiClient.baseParams.baseParams();
    }

    async getIlvlSyncData(baseParamPromise: ReturnType<typeof this.queryBaseParams>, ilvl: number) {
        if (this._isyncPromise === undefined) {
            this._isyncPromise = Promise.all([baseParamPromise, this.apiClient.itemLevel.itemLevels()]).then(responses => {
                const outMap = new Map<number, IlvlSyncInfo>();
                const jobStats = getClassJobStats(this._classJob);
                for (const row of responses[1].data.items) {
                    const ilvl = row.rowId;
                    // Unroll the ItemLevel object into a direct mapping from RawStatKey => modifier
                    // BaseParam data is trickier. First, we need to convert from a list to a map, where the keys are the stat.
                    const baseParams = this._baseParams;
                    outMap.set(ilvl, {
                        ilvl: ilvl,
                        substatCap(slot: OccGearSlotKey, statsKey: RawStatKey): number {
                            let ilvlModifier: number | null;
                            switch (statsKey) {
                            case "hp":
                                ilvlModifier = row.HP;
                                break;
                            case "vitality":
                                ilvlModifier = row.vitality;
                                break;
                            case "strength":
                                ilvlModifier = row.strength;
                                break;
                            case "dexterity":
                                ilvlModifier = row.dexterity;
                                break;
                            case "intelligence":
                                ilvlModifier = row.intelligence;
                                break;
                            case "mind":
                                ilvlModifier = row.mind;
                                break;
                            case "piety":
                                ilvlModifier = row.piety;
                                break;
                            case "crit":
                                ilvlModifier = row.criticalHit;
                                break;
                            case "dhit":
                                ilvlModifier = row.directHitRate;
                                break;
                            case "determination":
                                ilvlModifier = row.determination;
                                break;
                            case "tenacity":
                                ilvlModifier = row.tenacity;
                                break;
                            case "spellspeed":
                                ilvlModifier = row.spellSpeed;
                                break;
                            case "skillspeed":
                                ilvlModifier = row.skillSpeed;
                                break;
                            case "wdPhys":
                                ilvlModifier = row.physicalDamage;
                                break;
                            case "wdMag":
                                ilvlModifier = row.magicalDamage;
                                break;
                            case "weaponDelay":
                                ilvlModifier = row.delay;
                                break;
                            default:
                                console.warn(`Bad ilvl modifer! ${statsKey}:${slot}`);
                                ilvlModifier = null;
                                break;

                            }
                            const baseParamModifier = baseParams[statsKey as RawStatKey][slot];
                            const jobCap = jobStats.itemStatCapMultipliers?.[statsKey];
                            if (jobCap !== undefined) {
                                return Math.round(jobCap * Math.round(ilvlModifier * baseParamModifier / 1000));
                            } else {
                                return Math.round(ilvlModifier * baseParamModifier / 1000);
                            }
                        }
                    } as const);

                }
                this._isyncData = outMap;
                return outMap;
            });
        }
        const data = await this._isyncPromise;
        if (data.has(ilvl)) {
            return data.get(ilvl);
        } else {
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
        const baseParamPromise = this.queryBaseParams().then(data => {
            this._baseParams = data.data.items.reduce<{
                [rawStat in RawStatKey]?: Record<OccGearSlotKey, number>
            }>((baseParams, value) => {
                // Each individual item also gets converted
                baseParams[BaseParamToStatKey[value.name as RelevantBaseParam]] = {
                    Body: requireNumber(value.chestPercent),
                    Ears: requireNumber(value.earringPercent),
                    Feet: requireNumber(value.feetPercent),
                    Hand: requireNumber(value.handsPercent),
                    Head: requireNumber(value.headPercent),
                    Legs: requireNumber(value.legsPercent),
                    Neck: requireNumber(value.necklacePercent),
                    OffHand: requireNumber(value.offHandPercent),
                    Ring: requireNumber(value.ringPercent),
                    Weapon2H: requireNumber(value.twoHandWeaponPercent),
                    Weapon1H: requireNumber(value.oneHandWeaponPercent),
                    Wrist: requireNumber(value.braceletPercent)
                };
                return baseParams;
            }, {});
            return data;
        });
        const extraPromises = [];
        console.log("Loading items");


        const itemsPromise = this.apiClient.items.items({job: this._classJob})
            .then(async (data) => {
                if (data) {
                    console.log(`Got ${data.data.items.length} Items`);
                    return data.data.items;
                } else {
                    console.error(`Got No Items!`);
                    return null;
                }
            }).then((rawItems) => {
                this._allItems = rawItems
                    .filter(i => {
                        // TODO: can this just be server-side?
                        try {
                            return Object.keys(i.baseParamMapHQ).length > 0
                                || (i.classJobs.includes('BLU') && i.equipSlotCategory.mainHand === 1); // Don't filter out BLU weapons
                        } catch (e) {
                            console.log(e);
                            throw e;
                        }
                    })
                    .map(i => new DataApiGearInfo(i));
                this._maxIlvlForEquipLevel = new Map();
                this._maxIlvlForEquipLevelWeapon = new Map();
                this._allItems.forEach(item => {
                    // Track maximum ilvl seen for a particular equip level
                    if (item.displayGearSlotName === 'Weapon' || item.displayGearSlotName === 'OffHand') {
                        this._maxIlvlForEquipLevelWeapon.set(item.equipLvl, Math.max(item.ilvl, this._maxIlvlForEquipLevelWeapon.get(item.equipLvl) ?? 0));
                    } else {
                        this._maxIlvlForEquipLevel.set(item.equipLvl, Math.max(item.ilvl, this._maxIlvlForEquipLevel.get(item.equipLvl) ?? 0));
                    }
                });
                // TODO: put up better error
            }, (e) => console.error(e));
        const statsPromise = Promise.all([itemsPromise, baseParamPromise]).then(() => {
            console.log(`Finishing item calculations for ${this._allItems.length} items`);
            this._allItems.forEach(item => {
                const itemIlvlPromise = this.getIlvlSyncData(baseParamPromise, item.ilvl);
                let isyncLvl: number | null;
                // Downsync by ilvl directly
                if (this._ilvlSync && this._ilvlSync < item.ilvl) {
                    isyncLvl = this._ilvlSync;
                } else if (this._level < item.equipLvl) { // Downsync by equip lvl, infer correct ilvl
                    isyncLvl = this._maxIlvlForEquipLevel.get(this._level);
                } else {
                    isyncLvl = null;
                }
                const ilvlSyncPromise: Promise<IlvlSyncInfo> = isyncLvl === null ? Promise.resolve(undefined) : this.getIlvlSyncData(baseParamPromise, isyncLvl);
                extraPromises.push(Promise.all([itemIlvlPromise, ilvlSyncPromise]).then(([native, sync]) => {
                    item.applyIlvlData(native, sync, this._level);
                    if (item.isCustomRelic) {
                        console.debug('Applying relic model');
                        item.relicStatModel = getRelicStatModelFor(item, this._baseParams, this._classJob);
                        console.debug('Applied', item.relicStatModel);
                    }
                }));
            });
        });

        // Materia
        console.log("Loading materia");
        const materiaPromise = this.apiClient.materia.materia()
            .then((data) => {
                if (data) {
                    console.log(`Got ${data.data.items.length} Materia Types`);
                    this._allMateria = data.data.items
                        // TODO: if a materia is discontinued but should still be available for old
                        // sets, this will not work.
                        .filter(i => i.value[MATERIA_LEVEL_MAX_NORMAL - 1])
                        .flatMap(item => {
                            return processRawMateriaInfo(item);
                        });
                    console.log(`Processed ${this._allMateria.length} total Materia items`);
                } else {
                    console.error('Got No Materia!');
                }
            }, e => {
                console.error(e);
            });
        console.log("Loading food");
        const foodPromise = this.apiClient.food.foodItems()
            .then((data) => {
                console.log(`Got ${data.data.items.length} Food Items`);
                return data.data.items;
            })
            .then((rawFoods) => {
                return rawFoods.map(item => {
                    // TODO: API types prefixing so they don't collide
                    return new DataApiFoodInfo(item);
                });
            })
            .then((processedFoods) => processedFoods.filter(food => Object.keys(food.bonuses).length > 1))
            .then((foods) => this._allFoodItems = foods,
                e => console.error(e));
        console.log("Loading jobs");
        const jobsPromise = this.apiClient.jobs.jobs()
            .then(data => {
                console.log(`Got ${data.data.items.length} Jobs`);
                return data.data.items;
            })
            .then(rawJobs => {
                this._jobMultipliers = new Map<JobName, JobMultipliers>();
                for (const rawJob of rawJobs) {
                    this._jobMultipliers.set(rawJob.abbreviation as JobName, {
                        dexterity: rawJob.modifierDexterity,
                        intelligence: rawJob.modifierIntelligence,
                        mind: rawJob.modifierMind,
                        strength: rawJob.modifierStrength,
                        vitality: rawJob.modifierVitality,
                        hp: rawJob.modifierHitPoints
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
            throw Error(`No data for job ${job}`);
        }
        return multi;
    }

    get allItems(): DataApiGearInfo[] {
        return this._allItems;
    }

    get allFoodItems(): DataApiFoodInfo[] {
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

    getIlvlSyncInfo(ilvl: number): IlvlSyncInfo | undefined {
        return this._isyncData.get(ilvl);
    }
}

// noinspection RedundantIfStatementJS
export class DataApiGearInfo implements GearItem {
    readonly id: number;
    readonly name: string;
    readonly iconUrl: URL;
    readonly equipLvl: number;
    readonly ilvl: number;
    readonly displayGearSlot: DisplayGearSlot;
    readonly displayGearSlotName: DisplayGearSlotKey;
    readonly occGearSlotName: OccGearSlotKey;
    stats: RawStats;
    primarySubstat: keyof RawStats | null;
    secondarySubstat: keyof RawStats | null;
    materiaSlots: MateriaSlot[];
    readonly isCustomRelic: boolean;
    readonly isUnique: boolean;
    unsyncedVersion: DataApiGearInfo;
    readonly acquisitionType: GearAcquisitionSource;
    statCaps: {
        [K in RawStatKey]?: number
    };
    isSyncedDown: boolean;
    relicStatModel: RelicStatModel;
    syncedDownTo: number | null;

    constructor(data: ItemType) {
        this.id = data.rowId;
        this.name = data.name;
        this.equipLvl = data.equipLevel;
        this.ilvl = data.ilvl;
        this.iconUrl = new URL(data.icon.pngIconUrl);
        const eqs = data.equipSlotCategory;
        if (!eqs) {
            console.error('EquipSlotCategory was null!', data);
        } else if (eqs.mainHand) {
            this.displayGearSlotName = 'Weapon';
            if (eqs.offHand) {
                this.occGearSlotName = 'Weapon2H';
            } else {
                this.occGearSlotName = 'Weapon1H';
            }
        } else if (eqs.offHand) {
            this.displayGearSlotName = 'OffHand';
            this.occGearSlotName = 'OffHand';
        } else if (eqs.head) {
            this.displayGearSlotName = 'Head';
            this.occGearSlotName = 'Head';
        } else if (eqs.body) {
            this.displayGearSlotName = 'Body';
            this.occGearSlotName = 'Body';
        } else if (eqs.gloves) {
            this.displayGearSlotName = 'Hand';
            this.occGearSlotName = 'Hand';
        } else if (eqs.legs) {
            this.displayGearSlotName = 'Legs';
            this.occGearSlotName = 'Legs';
        } else if (eqs.feet) {
            this.displayGearSlotName = 'Feet';
            this.occGearSlotName = 'Feet';
        } else if (eqs.ears) {
            this.displayGearSlotName = 'Ears';
            this.occGearSlotName = 'Ears';
        } else if (eqs.neck) {
            this.displayGearSlotName = 'Neck';
            this.occGearSlotName = 'Neck';
        } else if (eqs.wrists) {
            this.displayGearSlotName = 'Wrist';
            this.occGearSlotName = 'Wrist';
        } else if (eqs.fingerL || eqs.fingerR) {
            this.displayGearSlotName = 'Ring';
            this.occGearSlotName = 'Ring';
        } else {
            console.error("Unknown slot data!", eqs);
        }
        this.displayGearSlot = this.displayGearSlotName ? DisplayGearSlotInfo[this.displayGearSlotName] : undefined;
        const weaponDelayRaw = (data.delayMs);
        this.stats = new RawStats();
        this.stats.wdPhys = (data.damagePhysHQ);
        this.stats.wdMag = (data.damageMagHQ);
        this.stats.weaponDelay = weaponDelayRaw ? (weaponDelayRaw / 1000.0) : 0;
        for (const key in data.baseParamMapHQ) {
            const intKey = parseInt(key);
            const baseParam = statById(intKey);
            if (baseParam === undefined) {
                // console.warn(`Undefined baseParam! ${key}`);
                continue;
            }
            this.stats[baseParam] = data.baseParamMapHQ[key];
        }
        this.isUnique = data.unique;
        this.computeSubstats();
        this.materiaSlots = [];
        const baseMatCount: number = data.materiaSlotCount;
        if (baseMatCount === 0) {
            // If there are no materia slots, then it might be a custom relic
            // TODO: is this branch still needed?
            if (this.displayGearSlot !== DisplayGearSlotInfo.OffHand) {
                // Offhands never have materia slots
                this.isCustomRelic = true;
            } else if (!this.primarySubstat) {
                // If there is no primary substat on the item, then consider it a relic
                this.isCustomRelic = true;
            } else {
                // Otherwise, it's just a random item that just so happens to not have materia slots
                this.isCustomRelic = false;
            }
        } else {
            // If it has materia slots, it definitely isn't a custom relic
            this.isCustomRelic = false;
            // Is overmelding allowed?
            const overmeld: boolean = data.advancedMeldingPermitted;
            // The materia slot count represents slots that are always meldable
            for (let i = 0; i < baseMatCount; i++) {
                // TODO: figure out grade automatically
                this.materiaSlots.push({
                    maxGrade: MATERIA_LEVEL_MAX_NORMAL,
                    allowsHighGrade: true,
                    ilvl: data.ilvl
                });
            }
            if (overmeld) {
                // If we can also overmeld, then push a *single* high-grade slot, and then the rest are only for
                // small materia.
                this.materiaSlots.push({
                    maxGrade: MATERIA_LEVEL_MAX_NORMAL,
                    allowsHighGrade: true,
                    ilvl: data.ilvl
                });
                for (let i = this.materiaSlots.length; i < MATERIA_SLOTS_MAX; i++) {
                    this.materiaSlots.push({
                        maxGrade: MATERIA_LEVEL_MAX_OVERMELD,
                        allowsHighGrade: false,
                        ilvl: data.ilvl
                    });
                }
            }
        }
        const acqSrcRaw: AcqSrc = data.acquisitionSource;
        switch (acqSrcRaw) {
        case AcqSrc.NormalRaid:
            this.acquisitionType = 'normraid';
            break;
        case AcqSrc.SavageRaid:
            this.acquisitionType = 'raid';
            break;
        case AcqSrc.Tome:
            this.acquisitionType = 'tome';
            break;
        case AcqSrc.AugTome:
            this.acquisitionType = 'augtome';
            break;
        case AcqSrc.Crafted:
            this.acquisitionType = 'crafted';
            break;
        case AcqSrc.AugCrafted:
            this.acquisitionType = 'augcrafted';
            break;
        case AcqSrc.Relic:
            this.acquisitionType = 'relic';
            break;
        case AcqSrc.Dungeon:
            this.acquisitionType = 'dungeon';
            break;
        case AcqSrc.ExtremeTrial:
            this.acquisitionType = 'extrial';
            break;
        case AcqSrc.Ultimate:
            this.acquisitionType = 'ultimate';
            break;
        case AcqSrc.Artifact:
            this.acquisitionType = 'artifact';
            break;
        case AcqSrc.AllianceRaid:
            this.acquisitionType = 'alliance';
            break;
        case AcqSrc.Criterion:
            this.acquisitionType = 'criterion';
            break;
        case AcqSrc.Other:
            this.acquisitionType = 'other';
            break;
        case AcqSrc.Custom:
            this.acquisitionType = 'custom';
            break;
        case AcqSrc.Unknown:
            this.acquisitionType = 'other';
            break;
        default:
            this.acquisitionType = 'other';
            break;
        }
    }

    private computeSubstats() {
        const sortedStats = Object.entries({
            crit: this.stats.crit,
            dhit: this.stats.dhit,
            determination: this.stats.determination,
            spellspeed: this.stats.spellspeed,
            skillspeed: this.stats.skillspeed,
            piety: this.stats.piety,
            tenacity: this.stats.tenacity
        })
            .sort((left, right) => {
                if (left[1] > right[1]) {
                    return 1;
                } else if (left[1] < right[1]) {
                    return -1;
                }
                return 0;
            })
            .filter(item => item[1])
            .reverse();
        if (sortedStats.length < 2) {
            this.primarySubstat = null;
            this.secondarySubstat = null;
        } else {
            this.primarySubstat = sortedStats[0][0] as keyof RawStats;
            this.secondarySubstat = sortedStats[1][0] as keyof RawStats;
        }
    }

    applyIlvlData(nativeIlvlInfo: IlvlSyncInfo, syncIlvlInfo?: IlvlSyncInfo, level?: number) {
        const statCapsNative = {};
        Object.entries(this.stats).forEach(([stat, _]) => {
            statCapsNative[stat] = nativeIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
        });
        this.statCaps = statCapsNative;
        if (syncIlvlInfo && (syncIlvlInfo.ilvl < this.ilvl || level < this.equipLvl)) {
            this.unsyncedVersion = {
                ...this
            };
            this.syncedDownTo = syncIlvlInfo.ilvl;
            this.materiaSlots = [];
            const statCapsSync = {};
            Object.entries(this.stats).forEach(([stat, v]) => {
                statCapsSync[stat] = syncIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
            });
            this.stats = applyStatCaps(this.stats, statCapsSync);
            this.statCaps = statCapsSync;
            this.computeSubstats();
            this.isSyncedDown = true;
        } else {
            this.unsyncedVersion = this;
            this.syncedDownTo = null;
            this.isSyncedDown = false;
        }
    }
}

export class DataApiFoodInfo implements FoodItem {
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

    constructor(data: FoodType) {
        this.id = requireNumber(data.rowId);
        this.name = requireString(data.name);
        this.iconUrl = new URL(data.icon.pngIconUrl);
        this.ilvl = requireNumber(data.levelItem);
        for (const rawKey in data.bonusesHQ) {
            if (rawKey === '0') {
                continue;
            }
            const actualKey = statById(parseInt(rawKey));
            const bonus: FoodStatBonus = data.bonusesHQ[rawKey];
            this.bonuses[actualKey] = bonus;
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

export function processRawMateriaInfo(data: MateriaType): Materia[] {
    const out: Materia[] = [];
    for (let i = MATERIA_LEVEL_MIN_RELEVANT - 1; i < MATERIA_LEVEL_MAX_NORMAL; i++) {
        const itemData = data.item[i];
        const itemId = itemData.rowId;
        const itemName = itemData.name;
        const stats = new RawStats();
        // TODO: use statById in more places
        const stat = statById(data.baseParam);
        if (!stat || !itemName) {
            continue;
        }
        stats[stat] = data.value[i];
        const grade = (i + 1);
        out.push({
            name: itemName,
            id: itemId,
            iconUrl: new URL(itemData.icon.pngIconUrl),
            stats: stats,
            primaryStat: stat,
            primaryStatValue: stats[stat],
            materiaGrade: grade,
            isHighGrade: (grade % 2) === 0,
            ilvl: itemData.ilvl ?? 0
        });
    }
    return out;
}
