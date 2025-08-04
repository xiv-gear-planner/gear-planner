/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: get back to fixing this at some point
import {
    ALL_COMBAT_JOBS,
    CURRENT_MAX_LEVEL,
    defaultItemDisplaySettings,
    DefaultMateriaFillPrio,
    getClassJobStats,
    getDefaultDisplaySettings,
    getRaceStats,
    JOB_DATA,
    JobName,
    LEVEL_ITEMS,
    MAIN_STATS,
    MateriaSubstat,
    RaceName,
    SupportedLevel
} from "@xivgear/xivmath/xivconstants";
import {
    EquippedItem,
    EquipSlotKey,
    EquipSlots,
    FoodItem,
    GearItem,
    IlvlSyncInfo,
    ItemDisplaySettings,
    ItemSlotExport,
    JobData,
    JobDataConst,
    Materia,
    MateriaAutoFillController,
    MateriaAutoFillPrio,
    MateriaFillMode,
    MeldableMateriaSlot,
    OccGearSlotKey,
    PartyBonusAmount,
    RawStatKey,
    SetExport,
    SetExportExternalSingle,
    SetStatsExport,
    SheetExport,
    SheetStatsExport,
    SimExport,
    Substat
} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet, isSameOrBetterItem, SyncInfo} from "./gear";
import {DataManager, DmJobs, makeDataManager} from "./datamanager";
import {Inactivitytimer} from "@xivgear/util/inactivitytimer";
import {writeProxy} from "@xivgear/util/proxies";
import {SHARED_SET_NAME} from "@xivgear/core/imports/imports";
import {SimCurrentResult, SimResult, Simulation} from "./sims/sim_types";
import {getDefaultSims, getRegisteredSimSpecs, getSimSpecByStub} from "./sims/sim_registry";
import {DUMMY_SHEET_MGR, SheetManager} from "./persistence/saved_sheets";
import {CustomItem} from "./customgear/custom_item";
import {CustomFood} from "./customgear/custom_food";
import {statsSerializationProxy} from "@xivgear/xivmath/xivstats";
import {isMateriaAllowed} from "./materia/materia_utils";
import {SpecialStatType} from "@xivgear/data-api-client/dataapi";

export type SheetCtorArgs = ConstructorParameters<typeof GearPlanSheet>
export type SheetContstructor<SheetType extends GearPlanSheet> = (...values: SheetCtorArgs) => SheetType;

/**
 * SheetProvider is the base class for turning sheet exports or fresh sheets into rehydrated sheet objects.
 */
export class SheetProvider<SheetType extends GearPlanSheet> {

    constructor(private readonly sheetConstructor: SheetContstructor<SheetType>, private readonly sheetManager: SheetManager) {
    }

    private construct(...args: SheetCtorArgs): SheetType {
        return this.sheetConstructor(...args);
    }

    /**
     * Produce a sheet from a SheetExport
     *
     * @param importedData
     */
    fromExport(importedData: SheetExport): SheetType {
        const sheet = this.construct(undefined, importedData, this.sheetManager);
        // If sims are not specified at all in the import, add the defaults.
        // Note that this will not add sims if they are specified as [], only
        // if unspecified.
        // We check the import data here as the sheet will have sims = [] at this
        // point.
        if (importedData.sims === undefined) {
            sheet.addDefaultSims();
        }
        return sheet;
    }

    /**
     * Produce a sheet from a single-set export.
     *
     * @param importedData
     */
    fromSetExport(...importedData: SetExportExternalSingle[]): SheetType {
        if (importedData.length === 0) {
            throw Error("Imported sets cannot be be empty");
        }
        const gearPlanSheet = this.fromExport({
            race: importedData[0].race ?? undefined,
            sets: [...importedData],
            sims: importedData[0].sims ?? [],
            name: importedData[0].name ?? SHARED_SET_NAME,
            saveKey: undefined,
            job: importedData[0].job!,
            level: importedData[0].level!,
            ilvlSync: importedData[0].ilvlSync,
            partyBonus: importedData[0].partyBonus ?? 0,
            itemDisplaySettings: defaultItemDisplaySettings,
            // TODO: make these smarter - make them deduplicate identical items
            customItems: importedData.flatMap(imp => imp.customItems ?? []),
            customFoods: importedData.flatMap(imp => imp.customFoods ?? []),
            timestamp: importedData[0].timestamp,
            isMultiJob: false,
            specialStats: importedData[0].specialStats ?? null,
        });
        if (importedData[0].sims === undefined) {
            gearPlanSheet.addDefaultSims();
        }
        // TODO
        // gearPlanSheet._selectFirstRowByDefault = true;
        return gearPlanSheet;
    }

    /**
     * Create a new sheet from scratch
     *
     * @param sheetKey The save key for the sheet
     * @param sheetName The name of the sheet
     * @param classJob The class/job of the sheet
     * @param level The level of the sheet
     * @param ilvlSync The ilvl sync of the sheet, or undefined if the sheet should not have an ilvl sync.
     * @param multiJob Whether to create a multi-job sheet.
     */
    fromScratch(sheetKey: string, sheetName: string, classJob: JobName, level: SupportedLevel, ilvlSync: number | undefined, multiJob: boolean): SheetType {
        const fakeExport: SheetExport = {
            job: classJob,
            level: level,
            name: sheetName,
            partyBonus: classJob === 'BLU' ? 1 : 5,
            race: undefined,
            saveKey: sheetKey,
            sets: [{
                name: "Default Set",
                items: {},
            }],
            sims: [],
            ilvlSync: ilvlSync,
            isMultiJob: multiJob,
            // ctor will auto-fill the rest
        };
        const gearPlanSheet = this.construct(sheetKey, fakeExport, this.sheetManager);
        gearPlanSheet.addDefaultSims();
        // TODO
        // gearPlanSheet._selectFirstRowByDefault = true;
        return gearPlanSheet;
    }

    /**
     * Try to load a sheet by its save key
     *
     * @param sheetKey The key to load
     * @returns The sheet if found, otherwise null
     */
    fromSaved(sheetKey: string): SheetType | null {
        const handle = this.sheetManager.getByKey(sheetKey);
        const data = handle?.dataNow;
        if (data) {
            return this.construct(sheetKey, handle.dataNow, this.sheetManager);
        }
        return null;
    }
}

export const HEADLESS_SHEET_PROVIDER = new SheetProvider((...args) => new GearPlanSheet(...args), DUMMY_SHEET_MGR);


// TODO: core shouldn't reference localStorage

/**
 * Base class for a sheet. For graphical usage, see GearPlanSheetGui.
 */
export class GearPlanSheet {
    // General sheet properties
    private _sheetName: string;
    private _description: string | undefined;
    readonly classJobName: JobName;
    readonly altJobs: JobName[];
    readonly isMultiJob: boolean;
    readonly level: SupportedLevel;
    readonly ilvlSync: number | undefined;
    private _race: RaceName | undefined;
    private _partyBonus: PartyBonusAmount;
    private readonly _saveKey: string | undefined;
    private readonly _importedData: SheetExport;

    // Sheet data
    private _sets: CharacterGearSet[] = [];
    private _sims: Simulation<any, any, any>[] = [];

    // Data helpers
    private dataManager!: DataManager;
    private _relevantMateria!: Materia[];
    private _dmRelevantFood!: FoodItem[];

    // Custom items
    private _customItems: CustomItem[] = [];
    private _customFoods: CustomFood[] = [];

    // Materia autofill
    protected materiaAutoFillPrio: MateriaAutoFillPrio;
    // protected materiaAutoFillSelectedItems: boolean;
    protected materiaFillMode: MateriaFillMode;

    // Display settings
    private _showAdvancedStats: boolean = false;
    private readonly _itemDisplaySettings: ItemDisplaySettings = {...defaultItemDisplaySettings};

    // Init related
    private _setupDone: boolean = false;
    private saveEnabled: boolean = false;

    // Display state
    private _isViewOnly: boolean = false;
    isEmbed: boolean = false;

    // Temporal state
    private readonly saveTimer: Inactivitytimer;

    protected _timestamp: Date;

    // Occult Crescent et al
    private _activeSpecialStat: SpecialStatType | null = null;

    protected sheetManager: SheetManager;

    // Can't make ctor private for custom element, but DO NOT call this directly - use fromSaved or fromScratch
    constructor(sheetKey: string | undefined, importedData: SheetExport, manager: SheetManager) {
        console.log(importedData);
        this.sheetManager = manager;
        this._importedData = importedData;
        this._saveKey = sheetKey;
        this._sheetName = importedData.name;
        this.level = importedData.level ?? CURRENT_MAX_LEVEL;
        this._race = importedData.race;
        this._partyBonus = importedData.partyBonus ?? 0;
        // TODO: why does this default to WHM? Shouldn't it just throw?
        this.classJobName = importedData.job ?? 'WHM';
        this.isMultiJob = importedData.isMultiJob ?? false;
        this._activeSpecialStat = (importedData.specialStats ?? null) as SpecialStatType | null;
        this.altJobs = this.isMultiJob ? [
            ...ALL_COMBAT_JOBS.filter(job => JOB_DATA[job].role === JOB_DATA[this.classJobName].role
                // Don't include the primary job in the list of alt jobs
                && job !== this.classJobName),
        ] : [];
        this.ilvlSync = importedData.ilvlSync;
        this._description = importedData.description;
        if (importedData.itemDisplaySettings) {
            Object.assign(this._itemDisplaySettings, importedData.itemDisplaySettings);
        }
        else {
            const defaults = getDefaultDisplaySettings(this.level, this.classJobName);
            Object.assign(this._itemDisplaySettings, defaults);
            // TODO: investigate if this logic is worth doing
            // if (this.ilvlSync) {
            //     const modifiedDefaults = {...defaults};
            //     modifiedDefaults.minILvl = Math.max(modifiedDefaults.minILvl, this.ilvlSync - 10);
            //     modifiedDefaults.maxILvl = Math.max(modifiedDefaults.maxILvl, this.ilvlSync + 40);
            // }
            // else {
            // }
        }
        this.materiaAutoFillPrio = {
            statPrio: importedData.mfp ?? [...DefaultMateriaFillPrio.filter(stat => this.isStatRelevant(stat))],
            // Just picking a bogus value so the user understands what it is
            minGcd: importedData.mfMinGcd ?? 2.05,
        };
        this.materiaFillMode = importedData.mfm ?? 'retain_item';

        if (importedData.customItems) {
            importedData.customItems.forEach(ci => {
                this._customItems.push(CustomItem.fromExport(ci, this));
            });
        }
        if (importedData.customFoods) {
            importedData.customFoods.forEach(ci => {
                this._customFoods.push(CustomFood.fromExport(ci));
            });
        }
        if (importedData.timestamp) {
            this._timestamp = new Date(importedData.timestamp);
        }
        else {
            this._timestamp = new Date();
        }

        // Early gui setup
        this.saveTimer = new Inactivitytimer(1_000, () => this.saveData());
    }

    /**
     * The key under which this sheet should be saved in LocalStorage.
     */
    get saveKey() {
        return this._saveKey;
    }

    get metaSaveKey() {
        return this._saveKey + '-meta';
    }

    /**
     * Whether to show advanced stats.
     */
    get showAdvancedStats() {
        return this._showAdvancedStats;
    }

    set showAdvancedStats(show: boolean) {
        this._showAdvancedStats = show;
    }

    /**
     * Whether setup/loading is done.
     */
    get setupDone() {
        return this._setupDone;
    }

    /**
     * Whether this sheet is in view-only mode.
     */
    get isViewOnly() {
        return this._isViewOnly;
    }

    /**
     * The materia autofill controller for this sheet.
     *
     * This only has a real implementation in GearPlanSheetGui, since materia autofilling is a gui-only feature.
     */
    get materiaAutoFillController(): MateriaAutoFillController {
        const outer = this;
        return {
            get autoFillMode() {
                return outer.materiaFillMode;
            },
            set autoFillMode(mode: MateriaFillMode) {
                outer.materiaFillMode = mode;
                outer.requestSave();
            },
            get prio() {
                return writeProxy<MateriaAutoFillPrio>(outer.materiaAutoFillPrio, () => outer.requestSave());
            },
            callback(): void {
                outer.requestSave();
            },
            fillAll(): void {
                console.log('fillAll not implemented');
            },
            fillEmpty(): void {
                console.log('fillEmpty not implemented');
            },
            lockEmpty(): void {
                console.log('lockEmpty not implemented');
            },
            lockFilled(): void {
                console.log('lockFilled not implemented');
            },
            unequipUnlocked(): void {
                console.log('unequipUnlocked not implemented');
            },
            unlockAll(): void {
                console.log('unlockAll not implemented');
            },

        };
    }

    /**
     * Enable view-only mode. Cannot be disabled once enabled.
     */
    setViewOnly() {
        this._isViewOnly = true;
    }

    get allJobs(): DmJobs {
        return [this.classJobName, ...this.altJobs];
    }

    /**
     * Load the sheet data fully. Create a DataManager internally.
     */
    async load() {
        const dataManager = makeDataManager(this.allJobs, this.level, this.ilvlSync);
        await dataManager.loadData();
        await this.loadFromDataManager(dataManager);
    }

    /**
     * Load the sheet data from a DataManager. The DataManager must already be loaded before calling this method.
     * This can be used for things like meld solving, where a worker can load a DM once and then re-use it.
     *
     * @param dataManager The DataManager to use.
     */
    async loadFromDataManager(dataManager: DataManager) {
        console.log("Loading sheet...");
        console.log("Reading data");
        const saved = this._importedData;
        const lvlItemInfo = LEVEL_ITEMS[this.level];
        this.dataManager = dataManager;
        this._relevantMateria = this.dataManager.allMateria.filter(mat => {
            return mat.materiaGrade <= lvlItemInfo.maxMateria
                // && mat.materiaGrade >= lvlItemInfo.minMateria
                && this.isStatRelevant(mat.primaryStat);
        });
        this.recheckCustomItems();
        for (const importedSet of saved.sets) {
            this.addGearSet(this.importGearSet(importedSet));
        }
        if (saved.sims) {
            for (const simport of saved.sims) {
                const simSpec = getSimSpecByStub(simport.stub);
                if (simSpec === undefined) {
                    console.error("Sim no longer present: " + simport.stub);
                    continue;
                }
                try {
                    const rehydratedSim: Simulation<any, any, any> = simSpec.loadSavedSimInstance(simport.settings);
                    if (simport.name) {
                        rehydratedSim.displayName = simport.name;
                    }
                    if (rehydratedSim.settings.includeInExport === undefined) {
                        rehydratedSim.settings.includeInExport = true;
                    }
                    this.addSim(rehydratedSim);
                }
                catch (e) {
                    console.error("Error loading sim settings", e);
                }
            }
        }
        this._dmRelevantFood = this.dataManager.allFoodItems.filter(food => this.isStatRelevant(food.primarySubStat) || this.isStatRelevant(food.secondarySubStat));
        // This is set when importing - but it needs to know about items first. Thus we have to redo this now.
        this.activeSpecialStat = this._activeSpecialStat;
        this._setupDone = true;
        setTimeout(() => {
            this.saveEnabled = true;
        }, 500);
    }

    /**
     * Save data for this sheet now.
     */
    saveData() {
        if (!this.saveEnabled) {
            // Don't clobber a save with empty data because the sheet hasn't loaded!
            return;
        }
        if (this.saveKey) {
            console.log("Saving sheet " + this.sheetName);
            this._timestamp = new Date();
            this.sheetManager.saveData(this);
        }
        else {
            console.debug("Ignoring request to save sheet because it has no save key");
        }
    }

    /**
     * Request a save to be completed asynchronously. The actual save is only performed once no more requestSave() calls
     * have happened for a certain timeout, thus allowing multiple modifications to be coalesced into a single save
     * operation.
     */
    requestSave(): void {
        // We want saving to be temporarily suppressed prior to the sheet fully loading, so that we don't get a useless
        // save if you open a sheet and don't change anything.
        if (!this.saveEnabled) {
            return;
        }
        this.saveTimer.ping();
    }

    /**
     * The name of the sheet.
     */
    get sheetName() {
        return this._sheetName;
    }

    set sheetName(name: string) {
        this._sheetName = name;
        this.requestSave();
    }

    /**
     * The description of the sheet.
     */
    get description(): string | undefined {
        return this._description;
    }

    set description(desc: string) {
        this._description = desc;
        this.requestSave();
    }

    /**
     * Copy this sheet to a new save slot.
     *
     * @param name New name. Leave unspecified/undefined to keep existing name.
     * @param job New job. Leave unspecified/undefined to keep existing job.
     * @param level New level. Leave unspecified/undefined to keep existing level.
     * @param ilvlSync New ilvl sync. Leave unspecified or use special value 'keep' to keep existing ilvl sync.
     * @returns The saveKey of the new sheet.
     */
    saveAs(name: string, job: JobName, level: SupportedLevel, ilvlSync: number | 'keep' | undefined, multiJob: boolean): string {
        const exported = this.exportSheet(true);
        if (name !== undefined) {
            exported.name = name;
        }
        if (job !== undefined) {
            exported.job = job;
        }
        if (level !== undefined) {
            exported.level = level;
        }
        if (ilvlSync !== 'keep') {
            exported.ilvlSync = ilvlSync;
        }
        exported.isMultiJob = multiJob;
        if (!multiJob) {
            exported.sets.forEach(setExport => {
                setExport.jobOverride = null;
            });
        }
        return this.sheetManager.saveAs(exported);
    }

    exportSims(external: boolean): SimExport[] {
        return this._sims.filter(sim => !external || sim.settings.includeInExport).map(sim =>
            ({
                stub: sim.spec.stub,
                settings: sim.exportSettings(),
                name: sim.displayName,
            }));
    }

    exportSheet(): SheetExport;
    exportSheet(external: boolean): SheetExport;
    exportSheet(external: boolean, fullStats: false): SheetExport;
    exportSheet(external: boolean, fullStats: true): SheetStatsExport;

    /**
     * Export the sheet to serialized form.
     *
     * @param external  Whether this is an external (shared publicly) or internal (saved locally). Certain properties,
     * such as the save key, are not useful for external exports, so they are omitted.
     * @param fullStats Whether to include the computedStats in the result. If true, returns SheetStatsExport instead
     * of the plain SheetExport.
     */
    exportSheet(external: boolean = false, fullStats: boolean = false): SheetExport | SheetStatsExport {
        const sets = this._sets.map(set => {
            const rawExport = this.exportGearSet(set, false);
            if (fullStats) {
                const augGs: SetStatsExport = {
                    ...rawExport,
                    computedStats: statsSerializationProxy(set.computedStats),
                };
                return augGs;
            }
            return rawExport;
        });
        const simsExport: SimExport[] = this.exportSims(external);
        const out: SheetExport = {
            name: this.sheetName,
            sets: sets,
            level: this.level,
            job: this.classJobName,
            partyBonus: this._partyBonus,
            race: this._race,
            sims: simsExport,
            itemDisplaySettings: this._itemDisplaySettings,
            mfm: this.materiaFillMode,
            mfp: this.materiaAutoFillPrio.statPrio,
            mfMinGcd: this.materiaAutoFillPrio.minGcd,
            ilvlSync: this.ilvlSync,
            description: this.description,
            customItems: this._customItems.map(ci => ci.export()),
            customFoods: this._customFoods.map(cf => cf.export()),
            timestamp: this.timestamp.getTime(),
            isMultiJob: this.isMultiJob,
            specialStats: this.activeSpecialStat ?? null,
        };
        if (!external) {
            out.saveKey = this._saveKey;
        }
        return out;

    }

    /**
     * Add a new gear set.
     *
     * @param gearSet The set to add.
     * @param index The index at which to insert the set. If omitted, it is added to the end.
     */
    addGearSet(gearSet: CharacterGearSet, index?: number) {
        if (index === undefined) {
            this._sets.push(gearSet);
        }
        else {
            this._sets.splice(index, 0, gearSet);
        }
        gearSet.addListener(() => {
            this.requestSave();
        });
        this.saveData();
    }

    /**
     * Delete a gear set.
     *
     * @param gearSet
     */
    delGearSet(gearSet: CharacterGearSet) {
        this._sets = this._sets.filter(gs => gs !== gearSet);
        this.saveData();
    }

    /**
     * Move a gear set to a new index.
     *
     * @param gearSet The set to move.
     * @param to      The index to which the gearset should be re-ordered.
     */
    reorderSet(gearSet: CharacterGearSet, to: number) {
        const sets = [...this._sets];
        const from = sets.indexOf(gearSet);
        if (from === to) {
            return;
        }
        if (from < 0 || to < 0) {
            return;
        }
        const removed = sets.splice(from, 1)[0];
        sets.splice(to, 0, removed);
        this._sets = sets;
    }

    /**
     * Clones the given gear set and adds it as a new gear set.
     *
     * This will add it prior to the next separator, since separators are typically used to delineate categories
     * of sets.
     *
     * @param gearSet
     */
    cloneAndAddGearSet(gearSet: CharacterGearSet) {
        const cloned = this.importGearSet(this.exportGearSet(gearSet));
        cloned.name += ' copy';
        const toIndex: number | undefined = this.clonedSetPlacement(gearSet);
        this.addGearSet(cloned, toIndex);
    }

    /**
     * Determine the placement index for a cloned set. Helper method of {@link #cloneAndAddGearSet}.
     *
     * @param originalSet The set being cloned.
     * @protected
     */
    protected clonedSetPlacement(originalSet: CharacterGearSet): number | undefined {
        const originalIndex = this.sets.indexOf(originalSet);
        if (originalIndex >= 0) {
            for (let i = originalIndex + 1; i < this.sets.length; i++) {
                if (this.sets[i].isSeparator) {
                    return i;
                }
            }
        }
        // fall back
        return undefined;

    }

    exportGearSet(set: CharacterGearSet): SetExport;
    exportGearSet(set: CharacterGearSet, external: false): SetExport;
    exportGearSet(set: CharacterGearSet, external: true): SetExportExternalSingle;
    /**
     * Export a CharacterGearSet to a SetExport so that it can safely be serialized for saving or sharing.
     *
     * @param set The set to export.
     * @param external true to include fields which are useful for exporting but not saving (e.g. including job name
     * for single set exports).
     */
    exportGearSet(set: CharacterGearSet, external: boolean = false): SetExport | SetExportExternalSingle {
        const items: { [K in EquipSlotKey]?: ItemSlotExport } = {};
        for (const k in set.equipment) {
            const equipmentKey = k as EquipSlotKey;
            const inSlot: EquippedItem | null = set.equipment[equipmentKey];
            if (inSlot) {
                const exportedItem: ItemSlotExport = {
                    // TODO: determine if it makes more sense to just serialize empty materia slots as {}
                    // The advantage is that {} is a lot smaller than {"id":-1}, and exports are already long
                    // On the other hand, *most* real exports would have slots filled (BiS etc)
                    id: inSlot.gearItem.id,
                    materia: inSlot.melds.map(meld => {
                        return {
                            id: meld.equippedMateria?.id ?? -1,
                            locked: meld.locked,
                        };
                    }),
                };
                if (inSlot.relicStats && Object.entries(inSlot.relicStats)) {
                    exportedItem.relicStats = {...inSlot.relicStats};
                }
                if (inSlot.gearItem.isNqVersion) {
                    exportedItem.forceNq = true;
                }
                items[equipmentKey] = exportedItem;
            }
        }
        const out: SetExport = {
            name: set.name,
            items: items,
            food: set.food ? set.food.id : undefined,
            description: set.description,
            isSeparator: set.isSeparator,
        };
        if (external) {
            const ext = out as SetExportExternalSingle;
            ext.job = this.classJobName;
            ext.level = this.level;
            ext.ilvlSync = this.ilvlSync;
            ext.sims = this.exportSims(true);
            ext.customItems = this._customItems.map(ci => ci.export());
            ext.customFoods = this._customFoods.map(cf => cf.export());
            ext.partyBonus = this._partyBonus;
            ext.race = this._race;
            ext.job = set.job;
            ext.specialStats = this.activeSpecialStat;
        }
        else {
            if (set.relicStatMemory) {
                out.relicStatMemory = set.relicStatMemory.export();
            }
            if (set.materiaMemory) {
                out.materiaMemory = set.materiaMemory.export();
            }
            if (set.jobOverride) {
                out.jobOverride = set.jobOverride;
            }
        }
        return out;
    }

    /**
     * Return an item from the DataManager by its ID. Returns undefined if the item could not be found.
     *
     * @param id The item ID. For custom items, use the custom item's fake ID.
     * @param forceNq If true, searches for an NQ version of an otherwise-HQ item.
     */
    itemById(id: number, forceNq: boolean = false): GearItem | undefined {
        const custom = this._customItems.find(ci => ci.id === id);
        if (custom) {
            return custom;
        }
        else {
            return this.dataManager.itemById(id, forceNq);
        }
    }

    /**
     * Return a food item from the DataManager by its ID. Returns undefined if the item could not be found.
     *
     * @param id The item ID. For custom items, use the custom item's fake ID.
     */
    foodById(id: number): FoodItem | undefined {
        const custom = this._customFoods.find(cf => cf.id === id);
        if (custom) {
            return custom;
        }
        else {
            return this.dataManager.foodById(id);
        }
    }

    /**
     * Return the ilvl sync info for a particular level.
     *
     * @param ilvl
     */
    ilvlSyncInfo(ilvl: number): IlvlSyncInfo | undefined {
        return this.dataManager?.getIlvlSyncInfo(ilvl);
    }

    /**
     * Return the highest ilvl of non-custom items in a particular slot
     *
     * @param slot
     */
    highestIlvlForSlot(slot: OccGearSlotKey): number {
        return Math.max(...this.dataManager.allItems.filter(item => item.occGearSlotName === slot)
            .map(item => item.ilvl));
    }

    /**
     * Returns the highest
     * @param slot
     */
    highestIlvlItemForSlot(slot: OccGearSlotKey): GearItem | undefined {
        return this.dataManager.allItems.filter(item => item.occGearSlotName === slot)
            .sort((a, b) => b.ilvl - a.ilvl)[0];
    }

    /**
     * Get the next free custom item ID.
     * @private
     */
    private get nextCustomItemId() {
        if (this._customItems.length === 0) {
            return 10_000_000_000_000 + Math.floor(Math.random() * 1_000_000);
        }
        else {
            return Math.max(...this._customItems.map(ci => ci.id)) + 1;
        }
    }

    /**
     * Returns the starting set of data for a new custom item.
     * @param slot The slot for which to make the custom item.
     */
    newCustomItem(slot: OccGearSlotKey): CustomItem {
        const item = CustomItem.fromScratch(this.nextCustomItemId, slot, this);
        this._customItems.push(item);
        this.recheckCustomItems();
        this.requestSave();
        return item;
    }

    /**
     * Returns the starting set of data for a new custom food.
     */
    newCustomFood(): CustomFood {
        const food = CustomFood.fromScratch(this.nextCustomItemId);
        this._customFoods.push(food);
        this.requestSave();
        return food;
    }

    /**
     * All custom items in this sheet.
     */
    get customItems() {
        return [...this._customItems];
    }

    /**
     * All custom food items in this sheet.
     */
    get customFood() {
        return [...this._customFoods];
    }

    /**
     * Delete the given custom item, first asking for confirmation if the item is equipped on any set.
     *
     * @param item The item to delete.
     * @param confirmationCallback A callback to be called to confirm the deletion of an item which is currently
     * equipped. Receives the names of sets as the first parameter.
     */
    deleteCustomItem(item: CustomItem, confirmationCallback: (equipppedOnsets: string[]) => boolean): boolean {
        const setsWithThisItem = this.sets.filter(set => set.allEquippedItems.includes(item));
        if (setsWithThisItem.length > 0) {
            const confirmed = confirmationCallback(setsWithThisItem.map(set => set.name));
            if (!confirmed) {
                return false;
            }
        }
        this.forceDeleteCustomItem(item);
        return true;
    }

    /**
     * Delete a custom item without confirmation. Will unequip the item from any sets which currently use it.
     *
     * @param item The item to delete.
     */
    forceDeleteCustomItem(item: CustomItem) {
        // Unequip existing
        this.sets.forEach(set => {
            EquipSlots.forEach(slot => {
                if (set.getItemInSlot(slot) === item) {
                    set.setEquip(slot, null);
                }
            });
        });
        const idx = this._customItems.indexOf(item);
        if (idx > -1) {
            this._customItems.splice(idx, 1);
        }
        this.recheckCustomItems();
        this.recalcAll();
    }

    /**
     * Delete the given custom food item, first asking for confirmation if the item is equipped on any set.
     *
     * @param item The food item to delete
     * @param confirmationCallback A callback to be called to confirm the deletion of an item which is currently
     * equipped. Receives the names of sets as the first parameter.
     */
    deleteCustomFood(item: CustomFood, confirmationCallback: (equipppedOnsets: string[]) => boolean) {
        const setsWithThisItem = this.sets.filter(set => set.food === item);
        if (setsWithThisItem.length > 0) {
            const confirmed = confirmationCallback(setsWithThisItem.map(set => set.name));
            if (!confirmed) {
                return false;
            }
        }
        this.forceDeleteCustomFood(item);
        return true;
    }

    forceDeleteCustomFood(item: CustomFood) {
        // Unequip existing
        this.sets.forEach(set => {
            if (set.food === item) {
                set.food = undefined;
            }
        });
        const idx = this._customFoods.indexOf(item);
        if (idx > -1) {
            this._customFoods.splice(idx, 1);
        }
        this.recalcAll();
    }

    /**
     * Import a sim from a sim export. Does not add it to the simulations - you still need to do that if you would like
     * the sim to appear on the sheet (see {@link #addSim}).
     *
     * @param simExport The data to import.
     */
    importSim(simExport: SimExport): Simulation<any, any, any> | null {
        const simSpec = getSimSpecByStub(simExport.stub);
        if (simSpec === undefined) {
            return null;
        }
        const rehydratedSim = simSpec.loadSavedSimInstance(simExport.settings);
        rehydratedSim.displayName = simExport.name ?? undefined;
        rehydratedSim.settings.includeInExport ??= true;
        return rehydratedSim;
    }

    /**
     * Convert a SetExport back to a CharacterGearSet.
     *
     * This does not add the set to the sheet or do anything other than conversion.
     *
     * @param importedSet
     */
    importGearSet(importedSet: SetExport): CharacterGearSet {
        const set = new CharacterGearSet(this);
        set.name = importedSet.name;
        set.description = importedSet.description;
        if (importedSet.isSeparator) {
            set.isSeparator = true;
        }
        else {

            for (const equipmentSlot in importedSet.items) {
                const importedItem: ItemSlotExport | undefined = importedSet.items[equipmentSlot as EquipSlotKey];
                if (!importedItem) {
                    continue;
                }
                const baseItem = this.itemById(importedItem.id, importedItem.forceNq);
                if (!baseItem) {
                    continue;
                }
                const equipped = new EquippedItem(baseItem);
                for (let i = 0; i < Math.min(equipped.melds.length, importedItem.materia.length); i++) {
                    const importedMateria = importedItem.materia[i];
                    if (importedMateria === undefined) {
                        continue;
                    }
                    const id = importedMateria.id;
                    const mat = this.dataManager.materiaById(id);
                    const slot = equipped.melds[i];
                    if (slot === undefined) {
                        console.error(`mismatched materia slot! i == ${i}, slots length == ${equipped.melds.length}`);
                    }
                    slot.locked = importedMateria.locked ?? false;
                    if (mat) {
                        slot.equippedMateria = mat;
                    }
                }
                if (importedItem.relicStats && equipped.gearItem.isCustomRelic) {
                    Object.assign(equipped.relicStats!, importedItem.relicStats);
                }
                set.equipment[equipmentSlot as EquipSlotKey] = equipped;
            }
            if (importedSet.food) {
                set.food = this.foodById(importedSet.food);
            }
            if (importedSet.relicStatMemory) {
                set.relicStatMemory.import(importedSet.relicStatMemory);
            }
            if (importedSet.materiaMemory) {
                set.materiaMemory.import(importedSet.materiaMemory);
            }
            if (importedSet.jobOverride) {
                set.earlySetJobOverride(importedSet.jobOverride);
            }
            // When importing a single set into a multi-job sheet, set the job override
            else if ('job' in importedSet && importedSet.job && this.isMultiJob) {
                set.earlySetJobOverride((importedSet as SetExportExternalSingle).job ?? null);
            }
        }
        return set;
    }

    // TODO: this needs to only update when we have updated that specific gear set, not any random gear set.
    // If this gear set was not updated, then a cached result should be returned.
    getSimResult(simulation: Simulation<any, any, any>, set: CharacterGearSet): SimCurrentResult<SimResult> {
        const simPromise = (async () => {
            // Intentionally de-prioritize this over other tasks so that it doesn't slow down an initial sheet load.
            await new Promise(resolve => setTimeout(resolve, 0));
            return await simulation.simulate(set);
        })();
        const out: SimCurrentResult<any> = {
            result: undefined,
            resultPromise: undefined,
            status: 'Running',
            error: undefined,
        };
        out.resultPromise = new Promise((resolve, reject) => {
            simPromise.then(result => {
                out.status = 'Done';
                out.result = result;
                resolve(out);
            }, error => {
                out.status = 'Error';
                out.error = error;
                console.error("Sim Error!", error);
                reject(error);
            });
        });
        return out;
    }

    /**
     * Force a full recalc of every set. For example, this should be called after a custom item is edited, or
     * after a race/party size change.
     */
    recalcAll() {
        for (const set of this._sets) {
            set.forceRecalc();
        }
    }

    /**
     * Get the class/job stats for the sheet's class/job.
     */
    get classJobStats(): JobData {
        return this.statsForJob(this.classJobName);
    }

    private get classJobEarlyStats(): JobDataConst {
        return getClassJobStats(this.classJobName);
    }

    /**
     * Get the class/job stats for a different class/job.
     *
     * @param job
     */
    statsForJob(job: JobName): JobData {
        return {
            ...getClassJobStats(job),
            jobStatMultipliers: this.dataManager.multipliersForJob(job),
        };
    }

    /**
     * Determine whether a stat is relevant to this sheet based on its job.
     * @param stat
     */
    isStatRelevant(stat: RawStatKey | undefined): boolean {
        if (!this.classJobEarlyStats) {
            // Not sure what the best way to handle this is
            return true;
        }
        if (MAIN_STATS.includes(stat as typeof MAIN_STATS[number])) {
            return (stat === this.classJobEarlyStats.mainStat);
        }
        if (this.classJobEarlyStats.irrelevantSubstats) {
            return !this.classJobEarlyStats.irrelevantSubstats.includes(stat as Substat);
        }
        else {
            return true;
        }
    }

    /**
     * Get sims which might be relevant to this sheet.
     */
    get relevantSims() {
        return getRegisteredSimSpecs().filter(simSpec => {
            const jobs = simSpec.supportedJobs;
            // If the sim is jobless (e.g. potency ratio), always display it
            if (jobs === undefined) {
                return true;
            }
            else {
                // Otherwise, make sure there is at least one job overlapping.
                return jobs.find(job => this.allJobs.includes(job)) !== undefined;
            }
        });
    }

    /**
     * Get the currently-selected race's stats.
     */
    get raceStats() {
        return getRaceStats(this._race);
    }

    /**
     * Get the currently-selected race.
     */
    get race() {
        return this._race;
    }

    set race(race) {
        this._race = race;
        this.recalcAll();
    }

    /**
     * Get all sets on this sheet.
     */
    get sets(): CharacterGearSet[] {
        return this._sets;
    }

    /**
     * Get all sims on this sheet.
     */
    get sims(): Simulation<any, any, any>[] {
        return this._sims;
    }

    /**
     * Add a sim to this sheet.
     *
     * @param sim
     */
    addSim(sim: Simulation<any, any, any>) {
        this._sims.push(sim);
        this.saveData();
    }

    /**
     * Delete a sim from this sheet.
     *
     * @param sim
     */
    delSim(sim: Simulation<any, any, any>) {
        this._sims = this._sims.filter(s => s !== sim);
        this.saveData();
    }

    /**
     * Get materia which are relevant to this sheet.
     */
    get relevantMateria(): Materia[] {
        return this._relevantMateria;
    }

    /**
     * Get materia which are relevant within a specific slot. On top of needing to be class-relevant, it must fit
     * in the slot.
     *
     * @param slot
     */
    getRelevantMateriaFor(slot: MeldableMateriaSlot) {
        const materia = this._relevantMateria.filter(mat => mat.ilvl <= slot.materiaSlot.ilvl);
        // Sort materia from highest to lowest
        materia.sort((left, right) => {
            if (left.materiaGrade > right.materiaGrade) {
                return -1;
            }
            else if (left.materiaGrade < right.materiaGrade) {
                return 1;
            }
            return 0;
        });
        if (materia.length === 0) {
            return [];
        }
        // Find highest grade materia
        const maxGrade = materia[0].materiaGrade;
        // Find lowest grade that we want to display - three grades lower. e.g. if the gear can support materia X,
        // then we want to display X, IX for pentamelds, as well as IIX and VIII for budget sets.
        const minDisplayGrade = maxGrade - 3;
        return materia.filter(mat => mat.materiaGrade >= minDisplayGrade);
    }

    /**
     * Get the current party bonus amount.
     */
    get partyBonus(): PartyBonusAmount {
        return this._partyBonus;
    }

    set partyBonus(partyBonus: PartyBonusAmount) {
        this._partyBonus = partyBonus;
        this.recalcAll();
    }

    /**
     * Get all items which are relevant, and are not filtered out by display settings. Custom items are always displayed
     * regardless of filtering.
     */
    get itemsForDisplay(): GearItem[] {
        const settings = this._itemDisplaySettings;
        return [
            ...this.dataManager.allItems.filter(item => {
                return item.ilvl >= settings.minILvl
                    && (item.ilvl <= settings.maxILvl
                        || item.isCustomRelic && settings.higherRelics)
                    && (!item.isNqVersion || settings.showNq);
            }),
            ...this._customItems];
    }

    /**
     * Overridable hook for when gear display settings are updated.
     */
    gearDisplaySettingsUpdateLater() {

    }

    gearDisplaySettingsUpdateNow() {

    }

    /**
     * The item display settings. Uses a proxy which automatically calls {@link #gearDisplaySettingsUpdateLater} after
     * any fields are modified.
     */
    get itemDisplaySettings(): ItemDisplaySettings {
        return writeProxy(this._itemDisplaySettings, () => this.gearDisplaySettingsUpdateLater());
    }

    /**
     * Food items which are relevant and pass the filter. Custom foods will be displayed regardless of filtering.
     */
    get foodItemsForDisplay(): FoodItem[] {
        const settings = this._itemDisplaySettings;
        return [...this._dmRelevantFood.filter(item => {
            return item.ilvl >= settings.minILvlFood && item.ilvl <= settings.maxILvlFood
                // Unless the user has opted into showing one-stat-relevant food, only show food with two relevant substats.
                // _dmRelevantFood is already filtered to food which has at least one relevant stat.
                && (settings.showOneStatFood || (this.isStatRelevant(item.primarySubStat) && this.isStatRelevant(item.secondarySubStat)));
        }), ...this._customFoods];
    }

    /**
     * Relevant food for the meld/food solver. Will return all of the highest level food with two valid stats and all custom food.
     */
    get relevantFoodForSolver(): FoodItem[] {
        return [...this._dmRelevantFood.filter(item => {
            return item.ilvl >= defaultItemDisplaySettings.minILvlFood
                // Filter to only two relevant substats (i.e. no tenacity for healers)
                && (this.isStatRelevant(item.primarySubStat) && this.isStatRelevant(item.secondarySubStat));
        }), ...this._customFoods];
    }

    /**
     * Get the best possible materia for a particular slot of the given stat.
     *
     * @param stat
     * @param meldSlot
     */
    getBestMateria(stat: MateriaSubstat, meldSlot: MeldableMateriaSlot): Materia | undefined {
        const materiaFilter = (materia: Materia) => {
            return isMateriaAllowed(materia, meldSlot.materiaSlot) && materia.primaryStat === stat;
        };
        const sortedOptions = this.relevantMateria.filter(materiaFilter).sort((first, second) => second.primaryStatValue - first.primaryStatValue);
        return sortedOptions.length >= 1 ? sortedOptions[0] : undefined;
    }

    /**
     * Retrieve a particular materia by its item ID. Returns undefined if the materia does not exist.
     *
     * @param materiaId
     */
    getMateriaById(materiaId: number): Materia | undefined {
        return this.dataManager.materiaById(materiaId);
    }

    /**
     * Add any sims which are considered to be "default" sims for this class and level.
     */
    addDefaultSims() {
        const sims = getDefaultSims(this.classJobName, this.level);
        for (const simSpec of sims) {
            try {
                this.addSim(simSpec.makeNewSimInstance());
            }
            catch (e) {
                console.error(`Error adding default sim ${simSpec.displayName} (${simSpec.stub})`, e);
            }
        }
    }

    /**
     * Recompute custom item stats, and force a recalc of sets.
     *
     * This should be called after custom items are modified.
     */
    recheckCustomItems() {
        for (const customItem of this._customItems) {
            customItem.recheckSync();
        }
        this._sets.forEach(set => set.forceRecalc());
    }

    /**
     * Get items that could replace the given item - either identical or better.
     *
     * @param thisItem
     */
    getAltItemsFor(thisItem: GearItem): GearItem[] {
        // Ignore this for relics - consider them to be incompatible until we can
        // figure out a good way to do this.
        if (thisItem.isCustomRelic) {
            return [];
        }
        return this.dataManager.allItems.filter(otherItem => {
            // Cannot be the same item
            return otherItem.id !== thisItem.id
                // Must be same slot
                && otherItem.occGearSlotName === thisItem.occGearSlotName
                // Must be better or same stats
                && isSameOrBetterItem(otherItem, thisItem)
                // Only allow items up to current max level for this job
                && otherItem.equipLvl <= this.classJobStats.maxLevel;
        });
    }

    /**
     * Get the consolidated level/ilevel sync info.
     */
    get syncInfo(): SyncInfo {
        const levelSync = this.level === CURRENT_MAX_LEVEL ? null : this.level;
        const explicitIlvlSync = this.ilvlSync ?? null;
        if (explicitIlvlSync !== null) {
            // Explicit ilvl sync
            return {
                lvlSync: levelSync,
                ilvlSync: explicitIlvlSync,
                ilvlSyncIsExplicit: true,
            };
        }
        else {
            if (levelSync !== null) {
                // Implicit ilvl sync
                const implicitSync = this.dataManager.getImplicitIlvlSync(levelSync, true);
                if (implicitSync === undefined) {
                    return {
                        lvlSync: levelSync,
                        ilvlSync: null,
                    };
                }
                else {
                    return {
                        lvlSync: levelSync,
                        ilvlSync: implicitSync,
                        ilvlSyncIsExplicit: false,
                    };
                }
            }
            else {
                return {
                    lvlSync: levelSync,
                    ilvlSync: null,
                };
            }
        }
    }


    get timestamp(): Date {
        return this._timestamp;
    }

    get activeSpecialStat(): SpecialStatType | null {
        return this._activeSpecialStat;
    }

    set activeSpecialStat(value: SpecialStatType | null) {
        this._activeSpecialStat = value;
        this.dataManager.allItems.forEach(item => {
            item.activeSpecialStat = value;
        });
        this.recalcAll();
    }
}
