/* eslint-disable @typescript-eslint/no-explicit-any */                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                // TODO: get back to fixing this at some point
import {
    CURRENT_MAX_LEVEL,
    defaultItemDisplaySettings,
    DefaultMateriaFillPrio,
    getClassJobStats,
    getDefaultDisplaySettings,
    getRaceStats,
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
    FoodItem,
    GearItem,
    ItemDisplaySettings,
    ItemSlotExport,
    JobData,
    Materia,
    MateriaAutoFillController,
    MateriaAutoFillPrio,
    MateriaFillMode,
    MeldableMateriaSlot,
    OccGearSlotKey,
    PartyBonusAmount,
    RawStatKey,
    SetExport,
    SetStatsExport,
    SheetExport,
    SheetStatsExport,
    SimExport,
    Substat
} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet, isSameOrBetterItem} from "./gear";
import {DataManager, makeDataManager} from "./datamanager";
import {Inactivitytimer} from "./util/inactivitytimer";
import {writeProxy} from "./util/proxies";
import {SHARED_SET_NAME} from "@xivgear/core/imports/imports";
import {SimCurrentResult, SimResult, Simulation} from "./sims/sim_types";
import {getDefaultSims, getRegisteredSimSpecs, getSimSpecByStub} from "./sims/sim_registry";
import {getNextSheetInternalName} from "./persistence/saved_sheets";
import {CustomItem} from "./customgear/custom_item";
import {CustomFood} from "./customgear/custom_food";
import {IlvlSyncInfo} from "./datamanager_xivapi";
import {toSerializableForm} from "@xivgear/xivmath/xivstats";
import {isMateriaAllowed} from "./materia/materia_utils";

export type SheetCtorArgs = ConstructorParameters<typeof GearPlanSheet>
export type SheetContstructor<SheetType extends GearPlanSheet> = (...values: SheetCtorArgs) => SheetType;

export class SheetProvider<SheetType extends GearPlanSheet> {

    constructor(private readonly sheetConstructor: SheetContstructor<SheetType>) {
    }

    private construct(...args: SheetCtorArgs): SheetType {
        return this.sheetConstructor(...args);
    }

    fromExport(importedData: SheetExport): SheetType {
        return this.construct(undefined, importedData);
    }

    fromSetExport(...importedData: SetExport[]): SheetType {
        if (importedData.length === 0) {
            throw Error("Imported sets cannot be be empty");
        }
        const gearPlanSheet = this.fromExport({
            race: undefined,
            sets: [...importedData],
            sims: importedData[0].sims ?? [],
            name: importedData[0].name ?? SHARED_SET_NAME,
            saveKey: undefined,
            job: importedData[0].job,
            level: importedData[0].level,
            ilvlSync: importedData[0].ilvlSync,
            partyBonus: 0,
            itemDisplaySettings: defaultItemDisplaySettings,
            // TODO: make these smarter - make them deduplicate identical items
            customItems: importedData.flatMap(imp => imp.customItems ?? []),
            customFoods: importedData.flatMap(imp => imp.customFoods ?? []),
        });
        if (importedData[0].sims === undefined) {
            gearPlanSheet.addDefaultSims();
        }
        // TODO
        // gearPlanSheet._selectFirstRowByDefault = true;
        return gearPlanSheet;
    }

    fromScratch(sheetKey: string, sheetName: string, classJob: JobName, level: SupportedLevel, ilvlSync: number | undefined): SheetType {
        const fakeExport: SheetExport = {
            job: classJob,
            level: level,
            name: sheetName,
            partyBonus: 0,
            race: undefined,
            saveKey: sheetKey,
            sets: [{
                name: "Default Set",
                items: {}
            }],
            sims: [],
            ilvlSync: ilvlSync
            // ctor will auto-fill the rest
        };
        const gearPlanSheet = this.construct(sheetKey, fakeExport);
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
        const exported = loadSaved(sheetKey);
        return exported ? this.construct(sheetKey, exported) : null;
    }
}

export const HEADLESS_SHEET_PROVIDER = new SheetProvider((...args) => new GearPlanSheet(...args));


function loadSaved(sheetKey: string): SheetExport | null {
    const item = localStorage.getItem(sheetKey);
    if (item) {
        return JSON.parse(item) as SheetExport;
    }
    else {
        return null;
    }
}

export class GearPlanSheet {
    // General sheet properties
    _sheetName: string;
    _description: string;
    readonly classJobName: JobName;
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
    private dataManager: DataManager;
    private _relevantMateria: Materia[];
    private _dmRelevantFood: FoodItem[];

    // Custom items
    private _customItems: CustomItem[] = [];
    private _customFoods: CustomFood[] = [];

    // Materia autofill
    protected materiaAutoFillPrio: MateriaAutoFillPrio;
    // protected materiaAutoFillSelectedItems: boolean;
    protected materiaFillMode: MateriaFillMode;

    // Display settings
    private _showAdvancedStats: boolean;
    private readonly _itemDisplaySettings: ItemDisplaySettings = {...defaultItemDisplaySettings};

    // Init related
    private _setupDone: boolean = false;

    // Display state
    _isViewOnly: boolean = false;
    isEmbed: boolean;

    // Temporal state
    private readonly saveTimer: Inactivitytimer;


    // Can't make ctor private for custom element, but DO NOT call this directly - use fromSaved or fromScratch
    constructor(sheetKey: string, importedData: SheetExport) {
        console.log(importedData);
        this._importedData = importedData;
        this._saveKey = sheetKey;
        this._sheetName = importedData.name;
        this.level = importedData.level ?? CURRENT_MAX_LEVEL;
        this._race = importedData.race;
        this._partyBonus = importedData.partyBonus ?? 0;
        this.classJobName = importedData.job ?? 'WHM';
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
            minGcd: importedData.mfMinGcd ?? 2.05
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

        // Early gui setup
        this.saveTimer = new Inactivitytimer(1_000, () => this.saveData());
    }

    get saveKey() {
        return this._saveKey;
    }

    get showAdvancedStats() {
        return this._showAdvancedStats;
    }

    set showAdvancedStats(show: boolean) {
        this._showAdvancedStats = show;
    }

    get setupDone() {
        return this._setupDone;
    }

    get isViewOnly() {
        return this._isViewOnly;
    }

    // Does not actually support any filling since the top-level sheet does not support selection
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
            refreshOnly(): void {
                console.log('nothing to refresh');
            }

        }
    }

    setViewOnly() {
        this._isViewOnly = true;
    }

    async load() {
        console.log("Loading sheet...");
        console.log("Reading data");
        const saved = this._importedData;
        const lvlItemInfo = LEVEL_ITEMS[this.level];
        this.dataManager = makeDataManager(this.classJobName, this.level, this.ilvlSync);
        await this.dataManager.loadData();
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
        this._relevantMateria = this.dataManager.allMateria.filter(mat => {
            return mat.materiaGrade <= lvlItemInfo.maxMateria
                && mat.materiaGrade >= lvlItemInfo.minMateria
                && this.isStatRelevant(mat.primaryStat);
        });
        this._dmRelevantFood = this.dataManager.allFoodItems.filter(food => this.isStatRelevant(food.primarySubStat) || this.isStatRelevant(food.secondarySubStat));
        this._setupDone = true;
        this.recheckCustomItems();
    }

    saveData() {
        if (!this.setupDone) {
            // Don't clobber a save with empty data because the sheet hasn't loaded!
            return;
        }
        if (this.saveKey) {
            console.log("Saving sheet " + this.sheetName);
            const fullExport = this.exportSheet(false);
            localStorage.setItem(this.saveKey, JSON.stringify(fullExport));
        }
        else {
            console.info("Ignoring request to save sheet because it has no save key");
        }
    }

    requestSave() {
        this.saveTimer.ping();
    }

    get sheetName() {
        return this._sheetName;
    }

    set sheetName(name: string) {
        this._sheetName = name;
        this.requestSave();
    }

    get description() {
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
    saveAs(name?: string, job?: JobName, level?: SupportedLevel, ilvlSync: number | 'keep' = 'keep'): string {
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
        const newKey = getNextSheetInternalName();
        localStorage.setItem(newKey, JSON.stringify(exported));
        return newKey;
    }

    exportSims(external: boolean): SimExport[] {
        return this._sims.filter(sim => !external || sim.settings.includeInExport).map(sim =>
            ({
                stub: sim.spec.stub,
                settings: sim.exportSettings(),
                name: sim.displayName
            }));
    }

    exportSheet(): SheetExport;
    exportSheet(external: boolean): SheetExport;
    exportSheet(external: boolean, fullStats: false): SheetExport;
    exportSheet(external: boolean, fullStats: true): SheetStatsExport;

    exportSheet(external: boolean = false, fullStats: boolean = false): SheetExport | SheetStatsExport {
        // TODO: make this async
        const sets = this._sets.map(set => {
            const rawExport = this.exportGearSet(set, false);
            if (fullStats) {
                const augGs: SetStatsExport = {
                    ...rawExport,
                    computedStats: toSerializableForm(set.computedStats)
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
        };
        if (!external) {
            out.saveKey = this._saveKey;
        }
        return out;

    }

    addGearSet(gearSet: CharacterGearSet) {
        this._sets.push(gearSet);
        gearSet.addListener(() => {
            this.requestSave();
        });
        this.saveData();
    }

    delGearSet(gearSet: CharacterGearSet) {
        this._sets = this._sets.filter(gs => gs !== gearSet);
        this.saveData();
    }

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

    cloneAndAddGearSet(gearSet: CharacterGearSet) {
        const cloned = this.importGearSet(this.exportGearSet(gearSet));
        cloned.name = cloned.name + ' copy';
        this.addGearSet(cloned);
    }

    /**
     * Export a CharacterGearSet to a SetExport so that it can safely be serialized for saving or sharing.
     *
     * @param set The set to export.
     * @param external true to include fields which are useful for exporting but not saving (e.g. including job name
     * for single set exports).
     */
    exportGearSet(set: CharacterGearSet, external: boolean = false): SetExport {
        const items: { [K in EquipSlotKey]?: ItemSlotExport } = {};
        for (const equipmentKey in set.equipment) {
            const inSlot: EquippedItem = set.equipment[equipmentKey];
            if (inSlot) {
                const exportedItem: ItemSlotExport = {
                    // TODO: determine if it makes more sense to just serialize empty materia slots as {}
                    // The advantage is that {} is a lot smaller than {"id":-1}, and exports are already long
                    // On the other hand, *most* real exports would have slots filled (BiS etc)
                    id: inSlot.gearItem.id,
                    materia: inSlot.melds.map(meld => {
                        return {id: meld.equippedMateria?.id ?? -1}
                    }),
                };
                if (inSlot.relicStats && Object.entries(inSlot.relicStats)) {
                    exportedItem.relicStats = {...inSlot.relicStats};
                }
                items[equipmentKey] = exportedItem;
            }
        }
        const out: SetExport = {
            name: set.name,
            items: items,
            food: set.food ? set.food.id : undefined,
            description: set.description,
            isSeparator: set.isSeparator
        };
        if (external) {
            out.job = this.classJobName;
            out.level = this.level;
            out.ilvlSync = this.ilvlSync;
            out.sims = this.exportSims(true);
            out.customItems = this._customItems.map(ci => ci.export());
            out.customFoods = this._customFoods.map(cf => cf.export());
        }
        else {
            if (set.relicStatMemory) {
                out.relicStatMemory = set.relicStatMemory.export();
            }
            if (set.materiaMemory) {
                out.materiaMemory = set.materiaMemory.export();
            }
        }
        return out;
    }

    itemById(id: number): GearItem {
        const custom = this._customItems.find(ci => ci.id === id);
        if (custom) {
            return custom;
        }
        else {
            return this.dataManager.itemById(id);
        }
    }

    foodById(id: number): FoodItem {
        const custom = this._customFoods.find(cf => cf.id === id);
        if (custom) {
            return custom;
        }
        else {
            return this.dataManager.foodById(id);
        }
    }

    ilvlSyncInfo(ilvl: number): IlvlSyncInfo | undefined {
        return this.dataManager?.getIlvlSyncInfo(ilvl);
    }

    private get nextCustomItemId() {
        if (this._customItems.length === 0) {
            // TODO: make this random + larger
            return 10_000_000_000_000 + Math.floor(Math.random() * 1_000_000);
        }
        else {
            return Math.max(...this._customItems.map(ci => ci.id)) + 1;
        }
    }

    newCustomItem(slot: OccGearSlotKey): CustomItem {
        const item = CustomItem.fromScratch(this.nextCustomItemId, slot, this);
        this._customItems.push(item);
        this.recheckCustomItems();
        this.requestSave();
        return item;
    }

    newCustomFood(): CustomFood {
        const food = CustomFood.fromScratch(this.nextCustomItemId);
        this._customFoods.push(food);
        this.requestSave();
        return food;
    }

    get customItems() {
        return [...this._customItems];
    }

    get customFood() {
        return [...this._customFoods];
    }

    deleteCustomItem(item: CustomItem) {
        // TODO: this should check if you have this item equipped on any sets, or ask
        const idx = this._customItems.indexOf(item);
        if (idx > -1) {
            this._customItems.splice(idx, 1);
        }
        this.recheckCustomItems();
        this.recalcAll();
    }

    deleteCustomFood(item: CustomFood) {
        // TODO: this should check if you have this item equipped on any sets, or ask
        const idx = this._customFoods.indexOf(item);
        if (idx > -1) {
            this._customFoods.splice(idx, 1);
        }
        this.recalcAll();
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
                const importedItem: ItemSlotExport = importedSet.items[equipmentSlot];
                if (!importedItem) {
                    continue;
                }
                const baseItem = this.itemById(importedItem.id);
                if (!baseItem) {
                    continue;
                }
                const equipped = new EquippedItem(baseItem);
                for (let i = 0; i < Math.min(equipped.melds.length, importedItem.materia.length); i++) {
                    const id = importedItem.materia[i].id;
                    const mat = this.dataManager.materiaById(id);
                    if (!mat) {
                        continue;
                    }
                    equipped.melds[i].equippedMateria = mat;
                }
                if (importedItem.relicStats && equipped.gearItem.isCustomRelic) {
                    Object.assign(equipped.relicStats, importedItem.relicStats);
                }
                set.equipment[equipmentSlot] = equipped;
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
            error: undefined
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

    recalcAll() {
        for (const set of this._sets) {
            set.forceRecalc();
        }
    }

    get classJobStats() {
        return this.statsForJob(this.classJobName);
    }

    private get classJobEarlyStats() {
        return getClassJobStats(this.classJobName);
    }

    statsForJob(job: JobName): JobData {
        return {
            ...getClassJobStats(job),
            jobStatMultipliers: this.dataManager.multipliersForJob(job)
        };
    }

    isStatRelevant(stat: RawStatKey) {
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

    get relevantSims() {
        return getRegisteredSimSpecs().filter(simSpec => simSpec.supportedJobs === undefined ? true : simSpec.supportedJobs.includes(this.dataManager.classJob));
    }

    get raceStats() {
        return getRaceStats(this._race);
    }

    get race() {
        return this._race;
    }

    set race(race) {
        this._race = race;
        this.recalcAll();
    }

    get sets(): CharacterGearSet[] {
        return this._sets;
    }

    get sims(): Simulation<any, any, any>[] {
        return this._sims;
    }

    addSim(sim: Simulation<any, any, any>) {
        this._sims.push(sim);
        this.saveData();
    }

    delSim(sim: Simulation<any, any, any>) {
        this._sims = this._sims.filter(s => s !== sim);
        this.saveData();
    }

    get relevantFood(): FoodItem[] {
        return [...this._dmRelevantFood, ...this._customFoods];
    }

    get relevantMateria(): Materia[] {
        return this._relevantMateria;
    }

    getRelevantMateriaFor(slot: MeldableMateriaSlot) {
        return this._relevantMateria.filter(mat => mat.ilvl <= slot.materiaSlot.ilvl);
    }

    get partyBonus(): PartyBonusAmount {
        return this._partyBonus;
    }

    set partyBonus(partyBonus: PartyBonusAmount) {
        this._partyBonus = partyBonus;
        this.recalcAll();
    }

    get itemsForDisplay(): GearItem[] {
        return [
            ...this.dataManager.allItems.filter(item => {
                return item.ilvl >= this._itemDisplaySettings.minILvl
                    && (item.ilvl <= this._itemDisplaySettings.maxILvl
                        || item.isCustomRelic && this._itemDisplaySettings.higherRelics);
            }),
            ...this._customItems];
    }

    onGearDisplaySettingsUpdate() {

    }

    get itemDisplaySettings(): ItemDisplaySettings {
        return writeProxy(this._itemDisplaySettings, () => this.onGearDisplaySettingsUpdate());
    }

    get foodItemsForDisplay(): FoodItem[] {
        // TODO: sorting?
        return [...this._dmRelevantFood.filter(item => item.ilvl >= this._itemDisplaySettings.minILvlFood && item.ilvl <= this._itemDisplaySettings.maxILvlFood), ...this._customFoods];
    }

    getBestMateria(stat: MateriaSubstat, meldSlot: MeldableMateriaSlot): Materia | undefined {
        const materiaFilter = (materia: Materia) => {
            return isMateriaAllowed(materia, meldSlot.materiaSlot) && materia.primaryStat == stat;
        };
        const sortedOptions = this.relevantMateria.filter(materiaFilter).sort((first, second) => second.primaryStatValue - first.primaryStatValue);
        return sortedOptions.length >= 1 ? sortedOptions[0] : undefined;
    }

    getMateriaById(materiaId: number): Materia | undefined {
        return this.dataManager.materiaById(materiaId);
    }

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

    recheckCustomItems() {
        for (const customItem of this._customItems) {
            customItem.recheckStats();
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
                && isSameOrBetterItem(otherItem, thisItem);
        });
    }
}