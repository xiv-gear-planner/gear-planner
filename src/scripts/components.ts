import {
    CustomCell,
    CustomColumn,
    CustomRow,
    CustomTable,
    HeaderRow,
    SingleCellRowOrHeaderSelect,
    SingleSelectionModel,
    SpecialRow,
    TitleRow
} from "./tables";
import {CharacterGearSet, EquippedItem,} from "./gear";
import {DataManager} from "./datamanager";
import {
    EquipSlotKey,
    FoodItem,
    GearItem,
    GearSlot,
    ItemDisplaySettings,
    ItemSlotExport,
    JobData,
    Materia,
    MateriaAutoFillController,
    MeldableMateriaSlot,
    PartyBonusAmount,
    RawStatKey,
    SetExport,
    SheetExport,
    SimExport,
    Substat
} from "./geartypes";
import {
    getDefaultSims,
    getRegisteredSimSpecs,
    getSimSpecByStub,
    SimCurrentResult, simpleAutoResultTable, simpleMappedResultTable,
    SimResult,
    SimSettings,
    SimSpec,
    Simulation
} from "./simulation";
import {
    getClassJobStats,
    getRaceStats,
    JOB_DATA,
    JobName,
    LEVEL_ITEMS,
    MAIN_STATS,
    MateriaSubstat,
    MateriaSubstats,
    RACE_STATS,
    RaceName,
    SupportedLevel,
    SupportedLevels
} from "./xivconstants";
import {openSheetByKey, setTitle, showNewSheetForm} from "./main";
import {getSetFromEtro} from "./external/etro_import";
import {Inactivitytimer} from "./util/inactivitytimer";
import {
    DataSelect,
    FieldBoundDataSelect,
    FieldBoundTextField,
    labelFor,
    makeActionButton,
    quickElement
} from "./components/util";
import {LoadingBlocker} from "./components/loader";
import {FoodItemsTable, GearItemsTable} from "./components/items";
import {GearEditToolbar} from "./components/gear_edit_toolbar";
import {startShortLink} from "./components/shortlink_components";
import {camel2title} from "./util/strutils";

export const SHARED_SET_NAME = 'Imported Set';

export type GearSetSel = SingleCellRowOrHeaderSelect<CharacterGearSet>;

interface MultiplierStat {
    stat: number,
    multiplier: number
}

interface ChanceStat {
    stat: number,
    chance: number,
    multiplier: number
}

function multiplierStatDisplay(stats: MultiplierStat) {
    const outerDiv = document.createElement("div");
    const leftSpan = document.createElement("span");
    leftSpan.textContent = stats.stat.toString();
    outerDiv.appendChild(leftSpan);
    const rightSpan = document.createElement("span");
    rightSpan.textContent = (`(x${stats.multiplier.toFixed(3)})`)
    rightSpan.classList.add("extra-stat-info");
    outerDiv.appendChild(rightSpan);
    return outerDiv;
}

function chanceStatDisplay(stats: ChanceStat) {
    const outerDiv = document.createElement("div");
    const leftSpan = document.createElement("span");
    leftSpan.textContent = stats.stat.toString();
    outerDiv.appendChild(leftSpan);
    const rightSpan = document.createElement("span");
    rightSpan.textContent = (`(${(stats.chance * 100.0).toFixed(1)}%x${stats.multiplier.toFixed(3)})`)
    rightSpan.classList.add("extra-stat-info");
    outerDiv.appendChild(rightSpan);
    return outerDiv;
}

class SimResultData<ResultType extends SimResult> {
    constructor(
        public readonly simInst: Simulation<ResultType, any, any>,
        public readonly result: SimCurrentResult<ResultType>
    ) {
    }
    //
    // makeResultDisplay() {
    //     if (this.simInst.makeResultDisplay) {
    //         return this.simInst.makeResultDisplay(this.result);
    //     }
    //     else {
    //         return simpleAutoResultTable(this.result);
    //     }
    // }
}

/**
 * A table of gear sets
 */
export class GearPlanTable extends CustomTable<CharacterGearSet, GearSetSel> {

    private sheet: GearPlanSheet;

    constructor(sheet: GearPlanSheet, setSelection: (item: CharacterGearSet | Simulation<any, any, any> | SimResultData<any> | undefined) => void) {
        super();
        this.sheet = sheet;
        this.classList.add("gear-plan-table");
        this.setupColumns();
        const selModel = new SingleSelectionModel<CharacterGearSet, GearSetSel>();
        super.selectionModel = selModel;
        selModel.addListener({
            onNewSelection(newSelection: GearSetSel) {
                if (newSelection instanceof CustomRow) {
                    setSelection(newSelection.dataItem);
                }
                else if (newSelection instanceof CustomColumn && newSelection.dataValue['makeConfigInterface']) {
                    setSelection(newSelection.dataValue as Simulation<any, any, any>);
                }
                else if (newSelection instanceof CustomCell && newSelection.colDef.dataValue?.spec) {
                    setSelection(new SimResultData(newSelection.colDef.dataValue, newSelection.value));
                }
                else if (newSelection === undefined) {
                    setSelection(undefined);
                }
            }
        })
    }

    get sims(): Simulation<any, any, any>[] {
        return this.sheet.sims;
    }

    get gearSets(): CharacterGearSet[] {
        return this.sheet.sets;
    }

    selectGearSet(set: CharacterGearSet | undefined) {
        console.log('selectGearSet');
        if (set === undefined) {
            this.selectionModel.clearSelection();
        }
        else {
            const row: CustomRow<CharacterGearSet> = this.dataRowMap.get(set);
            if (row) {
                this.selectionModel.clickRow(row);
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
            else {
                console.log(`Tried to select set ${set.name}, but couldn't find it in our row mapping.`);
            }
        }
        this.refreshSelection();
    }

    dataChanged() {
        const curSelection = this.selectionModel.getSelection();
        super.data = [new HeaderRow(), ...this.gearSets];
        // Special case for deleting the currently selected row
        if (curSelection instanceof CustomRow && !(this.gearSets.includes(curSelection.dataItem))) {
            this.selectionModel.clearSelection();
        }
    }

    simsChanged() {
        this.setupColumns();
    }

    //
    // addSim(sim: Simulation<any, any, any>) {
    //     this._sims.push(sim);
    //     this.setupColumns();
    // }
    //
    // delSim(sim: Simulation<any, any, any>) {
    //     this._sims = this._sims.filter(s => s !== sim);
    //     this.setupColumns();
    // }

    private setupColumns() {
        const statColWidth = 40;
        const chanceStatColWidth = 160;
        const multiStatColWidth = 120;
        const columns: typeof this._columns = [
            {
                shortName: "actions",
                displayName: "",
                getter: gearSet => gearSet,
                renderer: gearSet => {
                    const div = document.createElement("div");
                    div.appendChild(makeActionButton('🗑️', () => this.sheet.delGearSet(gearSet)));
                    div.appendChild(makeActionButton('📃', () => this.sheet.cloneAndAddGearSet(gearSet, true)));
                    return div;
                }
            },
            {
                shortName: "setname",
                displayName: "Set Name",
                getter: gearSet => gearSet.name,
                // initialWidth: 300,
            },
            {
                shortName: "gcd",
                displayName: "GCD",
                getter: gearSet => Math.min(gearSet.computedStats.gcdMag(2.5), gearSet.computedStats.gcdPhys(2.5)),
                initialWidth: statColWidth + 10,
            },
            {
                shortName: "wd",
                displayName: "WD",
                getter: gearSet => Math.max(gearSet.computedStats.wdMag, gearSet.computedStats.wdPhys),
                initialWidth: statColWidth,
            },
            {
                shortName: "vit",
                displayName: "VIT",
                getter: gearSet => gearSet.computedStats.vitality,
                initialWidth: statColWidth,
            },
            {
                shortName: "dex",
                displayName: "DEX",
                getter: gearSet => gearSet.computedStats.dexterity,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('dexterity'),
            },
            {
                shortName: "strength",
                displayName: "STR",
                getter: gearSet => gearSet.computedStats.strength,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('strength'),
            },
            {
                shortName: "mind",
                displayName: "MND",
                getter: gearSet => gearSet.computedStats.mind,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('mind'),
            },
            {
                shortName: "int",
                displayName: "INT",
                getter: gearSet => gearSet.computedStats.intelligence,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('intelligence'),
            },
            {
                shortName: "crit",
                displayName: "CRT",
                getter: gearSet => ({
                    stat: gearSet.computedStats.crit,
                    chance: gearSet.computedStats.critChance,
                    multiplier: gearSet.computedStats.critMulti
                }) as ChanceStat,
                renderer: chanceStatDisplay,
                initialWidth: chanceStatColWidth,
                condition: () => this.sheet.isStatRelevant('crit'),
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: gearSet => ({
                    stat: gearSet.computedStats.dhit,
                    chance: gearSet.computedStats.dhitChance,
                    multiplier: gearSet.computedStats.dhitMulti
                }) as ChanceStat,
                renderer: chanceStatDisplay,
                initialWidth: chanceStatColWidth,
                condition: () => this.sheet.isStatRelevant('dhit'),
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: gearSet => ({
                    stat: gearSet.computedStats.determination,
                    multiplier: gearSet.computedStats.detMulti
                }) as MultiplierStat,
                renderer: multiplierStatDisplay,
                initialWidth: multiStatColWidth,
                condition: () => this.sheet.isStatRelevant('determination'),
            },
            {
                shortName: "sks",
                displayName: "SKS",
                getter: gearSet => gearSet.computedStats.skillspeed,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('skillspeed'),
            },
            {
                shortName: "sps",
                displayName: "SPS",
                getter: gearSet => gearSet.computedStats.spellspeed,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('spellspeed'),
            },
            {
                shortName: "piety",
                displayName: "PIE",
                getter: gearSet => gearSet.computedStats.piety,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('piety'),
            },
            {
                shortName: "tenacity",
                displayName: "TNC",
                getter: gearSet => ({
                    stat: gearSet.computedStats.tenacity,
                    multiplier: gearSet.computedStats.tncMulti
                }) as MultiplierStat,
                renderer: multiplierStatDisplay,
                initialWidth: multiStatColWidth,
                condition: () => this.sheet.isStatRelevant('tenacity'),
            },
        ]
        for (const sim of this.sims) {
            columns.push({
                dataValue: sim,
                shortName: "sim-col-" + sim.shortName,
                get displayName() {
                    return sim.displayName;
                },
                getter: gearSet => this.sheet.getSimResult(sim, gearSet),
                renderer: result => new SimResultMiniDisplay(this, sim, result),
                allowHeaderSelection: true,
                allowCellSelection: true
            });
        }
        this.columns = columns;
    }

    // TODO: this is kinda bad, cross-talk between columns despite there being no reason to do so,
    // plus you want changes to immediately invalidate. I guess setting the inactivity time to 0 works?
    private dirtySimColColors: Simulation<any, any, any>[] = [];
    private readonly simColColorsTimer = new Inactivitytimer(0, () => this.reprocessSimColsColor());

    requestProcessSimColColor(sim: Simulation<any, any, any>) {
        if (!this.dirtySimColColors.includes(sim)) {
            this.dirtySimColColors.push(sim);
            this.simColColorsTimer.ping();
        }
    }

    reprocessSimColsColor() {
        for (let sim of this.dirtySimColColors) {
            this.reprocessSimColColor(sim);
        }
        this.dirtySimColColors = [];
    }

    reprocessAllSimColColors() {
        this.dirtySimColColors = [...this.sims];
        this.simColColorsTimer.ping();
    }

    reprocessSimColColor(sim: Simulation<any, any, any>) {
        const col = this.columns.find(col => col.dataValue === sim);
        if (!col) {
            return;
        }
        const cells: CustomCell<any, any>[] = this._rows.flatMap(row => {
            if (row instanceof CustomRow) {
                const cell = row.dataColMap.get(col);
                if (cell) {
                    return [cell];
                }
            }
            return [];
        });
        let invalid = false;
        const processed: [CustomCell<any, any>, number][] = [];
        for (let cell of cells) {
            const value: SimCurrentResult<SimResult> = cell.value;
            if (value.status !== 'Done') {
                invalid = true;
                break;
            }
            processed.push([cell, value.result.mainDpsResult]);
        }
        cells.forEach(cell => cell.classList.remove('sim-column-worst'));
        cells.forEach(cell => cell.classList.remove('sim-column-best'));
        cells.forEach(cell => cell.classList.remove('sim-column-valid'));
        if (cells.length < 2) {
            return;
        }
        else if (invalid) {
            cells.forEach(cell => cell.classList.add('sim-column-pending'));
        }
        else {
            cells.forEach(cell => cell.classList.remove('sim-column-pending'));
            processed.sort((cellA, cellB) => (cellA[1] - cellB[1]));
            const worst = processed[0];
            const best = processed[processed.length - 1];
            const worstValue = worst[1];
            const bestValue = best[1];
            const delta = bestValue - worstValue;
            if (delta === 0) {
                return;
            }
            worst[0].classList.add('sim-column-worst');
            best[0].classList.add('sim-column-best');
            for (let [cell, value] of processed) {
                cell.classList.add('sim-column-valid');
                const relative = (value - worstValue) / delta * 100;
                cell.style.setProperty('--sim-result-relative', relative.toFixed(1) + '%');
            }
        }
    }
}
class SimResultDetailDisplay<X extends SimResult> extends HTMLElement {
    private _result: SimCurrentResult<X>;
    private sim: Simulation<X, any, any>;
    constructor(simDetailResultDisplay: SimResultData<any>) {
        super();
        this._result = simDetailResultDisplay.result;
        this.sim = simDetailResultDisplay.simInst;
        this.update();
        this._result.resultPromise.then(result => this.update(), error => this.update());
    }

    update() {
        if (this._result.status === 'Done') {
            if (this.sim.makeResultDisplay) {
                this.replaceChildren(this.sim.makeResultDisplay(this._result.result))
            }
            else {
                this.replaceChildren(simpleAutoResultTable(this._result.result));
            }
        }
        else {
            this.textContent = this._result.status;
        }
        // this.gearPlanTable.requestProcessSimColColor(this.sim);
    }
}


export class SimResultMiniDisplay extends HTMLElement {
    private _result: SimCurrentResult<any>;

    constructor(private gearPlanTable: GearPlanTable, private sim: Simulation<any, any, any>, simCurrentResult: SimCurrentResult<any>) {
        super();
        this._result = simCurrentResult;
        this.update();
        this._result.resultPromise.then(result => this.update(), error => this.update());
    }

    update() {
        if (this._result.status === 'Done') {
            this.textContent = this._result.result.mainDpsResult.toFixed(2);
            let tooltip: string;
            if (this.sim.makeToolTip) {
                tooltip = this.sim.makeToolTip(this._result);
            }
            else {
                tooltip = Object.entries(this._result.result).map(entry => `${camel2title(entry[0])}: ${entry[1]}`)
                    .join('\n');
            }
            this.setAttribute('title', tooltip);
        }
        else {
            this.textContent = this._result.status;
        }
        this.gearPlanTable.requestProcessSimColColor(this.sim);
    }
}


/**
 * The set editor portion. Includes the tab as well as controls for the set name and such.
 */
export class GearSetEditor extends HTMLElement {
    private readonly sheet: GearPlanSheet;
    private readonly gearSet: CharacterGearSet;
    private gearTables: GearItemsTable[] = [];

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet) {
        super();
        this.sheet = sheet;
        this.gearSet = gearSet;
        this.setup();
    }

    setup() {
        // const header = document.createElement("h1");
        // header.textContent = "Gear Set Editor";
        // this.appendChild(header)
        this.replaceChildren();

        // Name editor
        const nameEditor = new FieldBoundTextField(this.gearSet, 'name');
        nameEditor.classList.add("gear-set-name-editor");
        this.appendChild(nameEditor);

        const buttonArea = quickElement('div', ['gear-set-editor-button-area', 'button-row'], [
            makeActionButton('Copy Link to Set', () => {
                startShortLink(JSON.stringify(this.sheet.exportGearSet(this.gearSet, true)));
            }),
            makeActionButton('Copy Set as JSON', () => {
                navigator.clipboard.writeText(JSON.stringify(this.sheet.exportGearSet(this.gearSet, true)));
            })
        ]);

        this.appendChild(buttonArea);

        // Put items in categories by slot
        // Not enough to just use the items, because rings can be in either ring slot, so we
        // need options to reflect that.
        const itemMapping: Map<GearSlot, GearItem[]> = new Map();
        this.sheet.itemsForDisplay.forEach((item) => {
            let slot = item.gearSlot;
            if (itemMapping.has(slot)) {
                itemMapping.get(slot).push(item);
            }
            else {
                itemMapping.set(slot, [item]);
            }
        })

        const leftSideSlots = ['Head', 'Body', 'Hand', 'Legs', 'Feet'] as const;
        const rightSideSlots = ['Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight'] as const;

        const weaponTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, this.sheet.classJobStats.offhand ? ['Weapon', 'OffHand'] : ['Weapon']);
        const leftSideDiv = document.createElement('div');
        const rightSideDiv = document.createElement('div');

        this.gearTables = [weaponTable];

        for (let slot of leftSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot]);
            leftSideDiv.appendChild(table);
            this.gearTables.push(table);
        }
        for (let slot of rightSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot]);
            rightSideDiv.appendChild(table);
            this.gearTables.push(table);
        }
        // const leftSideTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, ['Head', 'Body', 'Hand', 'Legs', 'Feet']);
        // const rightSideTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, ['Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight']);

        weaponTable.classList.add('weapon-table');
        leftSideDiv.classList.add('left-side-gear-table');
        rightSideDiv.classList.add('right-side-gear-table');

        this.appendChild(weaponTable);
        this.appendChild(leftSideDiv);
        this.appendChild(rightSideDiv);

        // // Gear table
        // const gearTable = new GearItemsTable(sheet, gearSet, itemMapping);
        // // gearTable.id = "gear-items-table";
        // this.appendChild(gearTable);

        // Food table
        const foodTable = new FoodItemsTable(this.sheet, this.gearSet);
        foodTable.classList.add('food-table');
        // foodTable.id = "food-items-table";
        this.appendChild(foodTable);
    }

    refreshMateria() {
        this.gearTables.forEach(tbl => tbl.refreshMateria());
    }
}

function formatSimulationConfigArea<SettingsType extends SimSettings>(
    sheet: GearPlanSheet,
    sim: Simulation<any, SettingsType, any>,
    refreshColumn: (item: Simulation<any, SettingsType, any>) => void,
    deleteColumn: (item: Simulation<any, SettingsType, any>) => void,
    refreshHeaders: () => void): HTMLElement {
    const outerDiv = document.createElement("div");
    outerDiv.id = 'sim-config-area-outer';
    outerDiv.classList.add('sim-config-area-outer');

    // const header = document.createElement("h1");
    // header.textContent = "Configuring " + sim.displayName;
    // outerDiv.appendChild(header);
    const titleEditor = new FieldBoundTextField(sim, 'displayName');
    titleEditor.addListener(val => {
        refreshHeaders();
    });
    titleEditor.classList.add('sim-name-editor');
    outerDiv.appendChild(titleEditor);

    const rerunButton = makeActionButton("Rerun", () => refreshColumn(sim));
    outerDiv.appendChild(rerunButton);
    const deleteButton = makeActionButton("Delete", () => deleteColumn(sim));
    outerDiv.appendChild(deleteButton);

    // TODO: actually wire up the auto-saving
    const originalSettings: SettingsType = sim.settings;
    const updateCallback = () => sheet.requestSave();
    const settingsProxyHandler: ProxyHandler<SettingsType> = {
        set(target, prop, value, receiver) {
            target[prop] = value;
            updateCallback();
            return true;
        }
    }
    const settingsProxy = new Proxy(originalSettings, settingsProxyHandler);
    const customInterface = sim.makeConfigInterface(settingsProxy, updateCallback);
    customInterface.id = 'sim-config-area-inner';
    customInterface.classList.add('sim-config-area-inner');
    outerDiv.appendChild(customInterface);

    return outerDiv;
}

export const defaultItemDisplaySettings: ItemDisplaySettings = {
    minILvl: 640,
    maxILvl: 999,
    minILvlFood: 610,
    maxILvlFood: 999
} as const;

/**
 * The top-level gear manager element
 */
export class GearPlanSheet extends HTMLElement {

    name: string;
    readonly classJobName: JobName;
    readonly level: SupportedLevel;
    private _race: RaceName | undefined;
    private _partyBonus: PartyBonusAmount;
    private readonly _itemDisplaySettings: ItemDisplaySettings = {...defaultItemDisplaySettings};

    private _gearPlanTable: GearPlanTable;
    private readonly _saveKey: string | undefined;
    private _sets: CharacterGearSet[] = [];
    private _sims: Simulation<any, any, any>[] = [];
    private dataManager: DataManager;
    // private buttonRow: HTMLDivElement;
    private _relevantMateria: Materia[];
    private _relevantFood: FoodItem[];
    private readonly _importedData: SheetExport;
    private readonly _loadingScreen: LoadingBlocker;
    private _gearEditToolBar: GearEditToolbar;
    private _selectFirstRowByDefault: boolean = false;
    private readonly tableArea: HTMLDivElement;
    private readonly buttonsArea: HTMLDivElement;
    private readonly editorArea: HTMLDivElement;
    private readonly midBarArea: HTMLDivElement;
    // TODO: SimResult alone might not be enough since we'd want it to refresh automatically if settings are changed
    private _editorItem: CharacterGearSet | Simulation<any, any, any> | SimResultData<SimResult> | undefined;
    private materiaAutoFillPrio: MateriaSubstat[];
    private materiaAutoFillSelectedItems: boolean;
    private _materiaAutoFillController: MateriaAutoFillController;
    private readonly saveTimer: Inactivitytimer;
    private setupDone: boolean = false;


    /**
     * Try to load a sheet by its save key
     *
     * @param sheetKey The key to load
     * @returns The sheet if found, otherwise null
     */
    static fromSaved(sheetKey: string): GearPlanSheet | null {
        const exported = GearPlanSheet.loadSaved(sheetKey);
        return exported ? new GearPlanSheet(sheetKey, exported) : null;
    }

    static fromScratch(sheetKey: string, sheetName: string, classJob: JobName, level: SupportedLevel): GearPlanSheet {
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
            // ctor will auto-fill the rest
        }
        const gearPlanSheet = new GearPlanSheet(sheetKey, fakeExport);
        gearPlanSheet.addDefaultSims();
        gearPlanSheet._selectFirstRowByDefault = true;
        return gearPlanSheet;
    }

    static fromExport(importedData: SheetExport): GearPlanSheet {
        return new GearPlanSheet(undefined, importedData);
    }

    static fromSetExport(importedData: SetExport): GearPlanSheet {
        const gearPlanSheet = this.fromExport({
            race: undefined,
            sets: [importedData],
            // TODO: default sims
            sims: [],
            name: SHARED_SET_NAME,
            saveKey: undefined,
            job: importedData.job,
            level: importedData.level,
            partyBonus: 0,
            itemDisplaySettings: defaultItemDisplaySettings,
        });
        gearPlanSheet.addDefaultSims();
        gearPlanSheet._selectFirstRowByDefault = true;
        return gearPlanSheet;
    }

    private static loadSaved(sheetKey: string): SheetExport | null {
        const item = localStorage.getItem(sheetKey);
        if (item) {
            return JSON.parse(item) as SheetExport;
        }
        else {
            return null;
        }
    }

    // Can't make ctor private for custom element, but DO NOT call this directly - use fromSaved or fromScratch
    constructor(sheetKey: string, importedData: SheetExport) {
        super();
        console.log(importedData);
        this.classList.add('gear-sheet');
        this.classList.add('loading');
        this._importedData = importedData;
        this._saveKey = sheetKey;
        this.tableArea = document.createElement("div");
        this.tableArea.classList.add('gear-sheet-table-area', 'hide-when-loading');
        this.buttonsArea = document.createElement("div");
        this.buttonsArea.classList.add('gear-sheet-buttons-area', 'hide-when-loading', 'show-hide-parent');
        this.editorArea = document.createElement("div");
        this.editorArea.classList.add('gear-sheet-editor-area', 'hide-when-loading');
        this.midBarArea = document.createElement("div");
        this.midBarArea.classList.add('gear-sheet-midbar-area', 'hide-when-loading');
        this.appendChild(this.tableArea);
        this.appendChild(this.midBarArea);
        this.appendChild(this.editorArea);

        const flexPadding = quickElement('div', ['flex-padding-item'], []);
        this.appendChild(flexPadding);

        this.name = importedData.name;
        this.level = importedData.level ?? 90;
        this._race = importedData.race;
        this._partyBonus = importedData.partyBonus ?? 0;
        this.classJobName = importedData.job ?? 'WHM';
        this.dataManager = new DataManager();
        if (importedData.itemDisplaySettings) {
            Object.assign(this._itemDisplaySettings, importedData.itemDisplaySettings);
        }
        else {
            Object.assign(this._itemDisplaySettings, LEVEL_ITEMS[this.level].defaultDisplaySettings);
        }
        this.materiaAutoFillPrio = importedData.mfp ?? [...MateriaSubstats.filter(stat => this.isStatRelevant(stat))];
        this.materiaAutoFillSelectedItems = importedData.mfni ?? false;

        // Early gui setup
        this._loadingScreen = new LoadingBlocker();
        this.saveTimer = new Inactivitytimer(1_000, () => this.saveData());
        this.appendChild(this._loadingScreen);
        this.setupEditorArea();
    }

    private set editorItem(item: typeof this._editorItem) {
        this._editorItem = item;
        this.resetEditorArea();
    }

    private resetEditorArea() {
        const item = this._editorItem;
        try {
            if (!item) {
                this.setupEditorArea();
            }
            else if (item instanceof CharacterGearSet) {
                // TODO: should dataManager flow through to this?
                this.setupEditorArea(new GearSetEditor(this, item));
                this.refreshToolbar();
            }
            else if (item['makeConfigInterface']) {
                this.setupEditorArea(formatSimulationConfigArea(this, item as Simulation<any, any, any>, col => this._gearPlanTable.refreshColumn(col), col => this.delSim(col), () => this._gearPlanTable.refreshColHeaders()));
            }
            else if (item instanceof SimResultData) {
                this.setupEditorArea(new SimResultDetailDisplay(item));
            }
            else {
                this.setupEditorArea();
            }
        }
        catch (e) {
            console.error("Error in selection change: ", e);
            this.setupEditorArea(document.createTextNode("Error!"));
        }
    }


    setupRealGui() {
        const buttonsArea = this.buttonsArea;
        const showHideButton = makeActionButton('≡', () => {
            const cls = 'showing';
            buttonsArea.classList.contains(cls) ? buttonsArea.classList.remove(cls) : buttonsArea.classList.add(cls);
        });
        showHideButton.classList.add('show-hide-button');
        buttonsArea.appendChild(showHideButton);

        this._gearPlanTable = new GearPlanTable(this, item => this.editorItem = item);
        // Buttons and controls at the bottom of the table
        // this.buttonRow.id = 'gear-sheet-button-row';
        const addRowButton = makeActionButton("New Gear Set", () => {
            const newSet = new CharacterGearSet(this);
            newSet.name = "New Set";
            this.addGearSet(newSet, true);
        })
        buttonsArea.appendChild(addRowButton)

        const renameButton = makeActionButton("Rename Sheet", () => {
            const newName = prompt("Enter a new name for the sheet: ", this.name);
            if (newName !== null && newName !== this.name) {
                this.name = newName;
                this.requestSave();
                setTitle(this.name);
            }
        });
        buttonsArea.appendChild(renameButton);

        const saveAsButton = makeActionButton("Save As", () => {
            const defaultName = this.name === SHARED_SET_NAME ? 'Imported Set' : this.name + ' copy';
            const newName = prompt("Enter a name for the new sheet: ", defaultName);
            if (newName === null) {
                return;
            }
            console.log('New name', newName);
            const newSaveKey = this.saveAs(newName);
            // TODO: should this be provided as a ctor arg instead?
            openSheetByKey(newSaveKey);
        });
        buttonsArea.appendChild(saveAsButton)

        const newSimButton = makeActionButton("Add Simulation", () => {
            this.showAddSimDialog();
        });
        buttonsArea.appendChild(newSimButton);

        const exportSheetButton = makeActionButton("Export", () => {
            this.setupEditorArea(this.makeSheetExportArea());
        });
        buttonsArea.appendChild(exportSheetButton);

        const importGearSetButton = makeActionButton("Import Sets", () => {
            this.setupEditorArea(this.makeImportSetArea());
        });
        buttonsArea.appendChild(importGearSetButton);

        const gearUpdateTimer = new Inactivitytimer(1_000, () => {
            if (this._editorAreaNode instanceof GearSetEditor) {
                this._editorAreaNode.setup();
            }
            this.saveData();
        });

        const raceDropdown = new FieldBoundDataSelect<GearPlanSheet, RaceName>(
            this,
            'race',
            r => {
                return r ?? "Select a Race/Clan";
            },
            [undefined, ...Object.keys(RACE_STATS) as RaceName[]]);
        buttonsArea.appendChild(raceDropdown);

        const partySizeDropdown = new FieldBoundDataSelect<GearPlanSheet, PartyBonusAmount>(
            this,
            'partyBonus',
            value => {
                if (value === 0) {
                    return 'No Party Bonus';
                }
                else {
                    return `${value} Unique Roles`;
                }
            },
            [0, 1, 2, 3, 4, 5]
        )
        buttonsArea.appendChild(partySizeDropdown);

        if (!this._saveKey) {
            const unsavedWarning = document.createElement('h4');
            unsavedWarning.textContent = 'This imported sheet will not be saved unless you use the "Save As" button below.'
            this.tableArea.appendChild(unsavedWarning);
        }
        // const tableAreaInner = quickElement('div', ['gear-sheet-table-area-inner'], [this._gearPlanTable, this.buttonsArea]);
        this.tableArea.appendChild(this._gearPlanTable);
        this.tableArea.appendChild(buttonsArea);
        // this.tableArea.appendChild(tableAreaInner);
        this._gearPlanTable.dataChanged();
        this._loadingScreen.remove();
        this.classList.remove('loading');
        // console.log(`${this._selectFirstRowByDefault} ${this.sets.length}`);


        const outer = this;
        const matFillCtrl: MateriaAutoFillController = {

            get autoFillNewItem() {
                return outer.materiaAutoFillSelectedItems;
            },
            set autoFillNewItem(enabled: boolean) {
                outer.materiaAutoFillSelectedItems = enabled;
                outer.requestSave();
            },
            get statPrio() {
                return outer.materiaAutoFillPrio;
            },
            set statPrio(prio) {
                outer.materiaAutoFillPrio = prio;
                outer.requestSave();
            },
            callback(): void {
                outer.requestSave();
            },
            fillAll(): void {
                let set;
                if ((set = outer._editorItem) instanceof CharacterGearSet) {
                    set.fillMateria(this.statPrio, true);
                    if (outer._editorAreaNode instanceof GearSetEditor) {
                        outer._editorAreaNode.refreshMateria();
                    }
                }
            },
            fillEmpty(): void {
                let set;
                if ((set = outer._editorItem) instanceof CharacterGearSet) {
                    set.fillMateria(this.statPrio, false);
                    if (outer._editorAreaNode instanceof GearSetEditor) {
                        outer._editorAreaNode.refreshMateria();
                    }
                }
            }

        };
        this._materiaAutoFillController = matFillCtrl;
        const toolbar = new GearEditToolbar(
            this,
            this._itemDisplaySettings,
            () => gearUpdateTimer.ping(),
            matFillCtrl
        );
        toolbar.addEventListener('touchstart', (ev) => {
            if (ev.target === toolbar && ev.touches.length === 1) {
                ev.preventDefault();
            }
        });
        toolbar.addEventListener('pointerdown', (ev) => {
            if (ev.target !== toolbar) {
                return;
            }
            ev.preventDefault();
            const initialY = ev.pageY;
            const initialHeight = this.tableArea.clientHeight;
            const eventListener = (ev: MouseEvent) => {
                const delta = ev.pageY - initialY;
                const newHeightPx = initialHeight + delta;
                const newHeightPct = newHeightPx / document.body.clientHeight * 100;
                // const newHeight = newHeightPx + 'px';
                const newHeight = newHeightPct + 'vh';
                this.tableArea.style.minHeight = newHeight;
                this.tableArea.style.maxHeight = newHeight;
                this.tableArea.style.flexBasis = newHeight;
            }
            const after = (ev: MouseEvent) => {
                document.removeEventListener('pointermove', eventListener);
                document.removeEventListener('pointerup', after);
            }
            document.addEventListener('pointermove', eventListener);
            document.addEventListener('pointerup', after);
        });
        this._gearEditToolBar = toolbar;

        if (this._selectFirstRowByDefault && this.sets.length >= 1) {
            this._gearPlanTable.selectGearSet(this.sets[0])
        }

        this.setupDone = true;
    }

    async loadData() {
        console.log("Loading sheet...");
        console.log("Reading data")
        const saved = this._importedData;
        this.dataManager.classJob = this.classJobName;
        this.dataManager.level = this.level;
        const lvlItemInfo = LEVEL_ITEMS[this.level];
        this.dataManager.minIlvl = lvlItemInfo.minILvl;
        this.dataManager.maxIlvl = lvlItemInfo.maxILvl;
        this.dataManager.minIlvlFood = lvlItemInfo.minILvlFood;
        this.dataManager.maxIlvlFood = lvlItemInfo.maxILvlFood;
        await this.dataManager.loadData();
        for (let importedSet of saved.sets) {
            this.addGearSet(this.importGearSet(importedSet));
        }
        if (saved.sims) {
            for (let simport of saved.sims) {
                const simSpec = getSimSpecByStub(simport.stub);
                if (simSpec === undefined) {
                    console.error("Sim no longer present: " + simport.stub);
                    continue;
                }
                try {
                    const rehydratedSim = simSpec.loadSavedSimInstance(simport.settings);
                    if (simport.name) {
                        rehydratedSim.displayName = simport.name;
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
        this._relevantFood = this.dataManager.allFoodItems.filter(food => this.isStatRelevant(food.primarySubStat) || this.isStatRelevant(food.secondarySubStat));
        this.setupRealGui();
    }

    saveData() {
        if (!this.setupDone) {
            // Don't clobber a save with empty data because the sheet hasn't loaded!
            return;
        }
        if (this._saveKey) {
            console.info("Saving sheet " + this.name);
            const fullExport = this.exportSheet(false);
            localStorage.setItem(this._saveKey, JSON.stringify(fullExport));
        }
        else {
            console.info("Ignoring request to save sheet because it has no save key");
        }
    }

    requestSave() {
        this.saveTimer.ping();
    }

    get materiaAutoFillController() {
        return this._materiaAutoFillController;
    }

    private _editorAreaNode: Node | undefined;

    private setupEditorArea(node: (Node & { toolbar?: Node }) | undefined = undefined) {
        this._editorAreaNode = node;
        if (node === undefined) {
            this.editorArea.replaceChildren();
            this.editorArea.style.display = 'none';
            this.midBarArea.replaceChildren();
            this.midBarArea.style.display = 'none';
        }
        else {
            this.editorArea.replaceChildren(node);
            this.editorArea.style.display = '';
            // midbar should be displayed no matter what since it also provides the visual delineation between
            // the top half and the bottom half, even if it isn't needed for displaying any content.
            this.midBarArea.style.display = '';
            // if ('makeToolBar' in node) {
            if (node instanceof GearSetEditor) {
                this.midBarArea.replaceChildren(this._gearEditToolBar);
            }
            else if ('toolbar' in node) {
                this.midBarArea.replaceChildren(node.toolbar);
            }
            else {
                this.midBarArea.replaceChildren();
            }
        }
    }

    /**
     * Copy this sheet to a new save slot.
     *
     * @param name
     * @returns The saveKey of the new sheet.
     */
    saveAs(name: string): string {
        const exported = this.exportSheet(true);
        exported.name = name;
        const newKey = getNextSheetInternalName();
        localStorage.setItem(newKey, JSON.stringify(exported));
        return newKey;
    }

    exportSheet(external: boolean = false): SheetExport {
        // TODO: make this async
        const sets: SetExport[] = []
        for (let set of this._sets) {
            sets.push(this.exportGearSet(set));
        }
        let simsExport: SimExport[] = [];
        for (let sim of this._sims) {
            simsExport.push({
                stub: sim.spec.stub,
                settings: sim.exportSettings(),
                name: sim.displayName
            });
        }
        const out: SheetExport = {
            name: this.name,
            sets: sets,
            level: this.level,
            job: this.classJobName,
            partyBonus: this._partyBonus,
            race: this._race,
            sims: simsExport,
            itemDisplaySettings: this._itemDisplaySettings,
            mfni: this.materiaAutoFillSelectedItems,
            mfp: this.materiaAutoFillPrio
        };
        if (!external) {
            out.saveKey = this._saveKey;
        }
        return out;

    }

    addGearSet(gearSet: CharacterGearSet, select: boolean = false) {
        this._sets.push(gearSet);
        if (this._gearPlanTable) {
            this._gearPlanTable.dataChanged();
        }
        gearSet.addListener(() => {
            if (this._gearPlanTable) {
                this._gearPlanTable.refreshRowData(gearSet);
                this.refreshToolbar();
            }
            this.saveData();
        });
        this.saveData();
        if (select && this._gearPlanTable) {
            this._gearPlanTable.selectGearSet(gearSet);
        }
    }

    refreshToolbar() {
        if (this._editorItem instanceof CharacterGearSet) {
            this._gearEditToolBar?.refresh(this._editorItem);
        }
    }

    delGearSet(gearSet: CharacterGearSet) {
        this._sets = this._sets.filter(gs => gs !== gearSet);
        if (this._gearPlanTable) {
            this._gearPlanTable.dataChanged();
            this._gearPlanTable.reprocessAllSimColColors();
        }
        this.saveData();
    }

    addSim(sim: Simulation<any, any, any>) {
        this._sims.push(sim);
        if (this._gearPlanTable) {
            this.gearPlanTable.simsChanged();
        }
        this.saveData();
    }

    delSim(sim: Simulation<any, any, any>) {
        this._sims = this._sims.filter(s => s !== sim);
        if (this._gearPlanTable) {
            this.gearPlanTable.simsChanged();
        }
        this.saveData();
    }

    cloneAndAddGearSet(gearSet: CharacterGearSet, select: boolean) {
        const cloned = this.importGearSet(this.exportGearSet(gearSet));
        cloned.name = cloned.name + ' copy';
        this.addGearSet(cloned, select);
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
        for (let equipmentKey in set.equipment) {
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
            food: set.food ? set.food.id : undefined
        };
        if (external) {
            out.job = this.classJobName;
            out.level = this.level;
        }
        return out;
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
        for (let equipmentSlot in importedSet.items) {
            const importedItem: ItemSlotExport = importedSet.items[equipmentSlot];
            if (!importedItem) {
                continue;
            }
            const baseItem = this.dataManager.itemById(importedItem.id);
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
            if (importedItem.relicStats) {
                Object.assign(equipped.relicStats, importedItem.relicStats);
            }
            set.equipment[equipmentSlot] = equipped;
        }
        if (importedSet.food) {
            set.food = this.dataManager.foodById(importedSet.food);
        }
        return set;
    }

    // TODO: this needs to only update when we have updated that specific gear set, not any random gear set.
    // If this gear set was not updated, then a cached result should be returned.
    getSimResult(simulation: Simulation<any, any, any>, set: CharacterGearSet): SimCurrentResult<SimResult> {
        const simPromise = simulation.simulate(set);
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
                console.log("sim err", error)
                out.status = 'Error';
                out.error = error;
                console.error("Sim Error!", error);
                reject(error);
            });
        });
        return out;
    }

    showAddSimDialog() {
        const addSimDialog = new AddSimDialog(this);
        this.appendChild(addSimDialog);
        addSimDialog.showModal();
    }

    recalcAll() {
        for (let set of this._sets) {
            set.forceRecalc();
        }
    }

    get saveKey() {
        return this._saveKey;
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

    get gearPlanTable(): GearPlanTable {
        return this._gearPlanTable;
    }

    get sets(): CharacterGearSet[] {
        return this._sets;
    }

    get sims(): Simulation<any, any, any>[] {
        return this._sims;
    }

    get relevantFood(): FoodItem[] {
        return this._relevantFood;
    }

    get relevantMateria(): Materia[] {
        return this._relevantMateria;
    }

    get partyBonus(): PartyBonusAmount {
        return this._partyBonus;
    }

    set partyBonus(partyBonus: PartyBonusAmount) {
        this._partyBonus = partyBonus;
        this.recalcAll();
    }

    get itemsForDisplay(): GearItem[] {
        return this.dataManager.allItems.filter(item => item.ilvl >= this._itemDisplaySettings.minILvl && item.ilvl <= this._itemDisplaySettings.maxILvl);
    }

    get foodItemsForDisplay(): FoodItem[] {
        return this._relevantFood.filter(item => item.ilvl >= this._itemDisplaySettings.minILvlFood && item.ilvl <= this._itemDisplaySettings.maxILvlFood);
    }

    private makeSheetExportArea(): HTMLElement {
        const outerDiv = document.createElement("div");
        outerDiv.id = 'sheet-export-area';

        const heading = document.createElement('h1');
        heading.textContent = 'Export Full Sheet';
        outerDiv.appendChild(heading);

        const explanation = document.createElement('p');
        explanation.textContent = 'This is for exporting an entire sheet. To export an individual gear set, select the gear set and use the export button in the gear set editor area.'
        outerDiv.appendChild(explanation);

        const exportSheetToClipboard = makeActionButton('Export Sheet JSON to Clipboard', () => {
            navigator.clipboard.writeText(JSON.stringify(this.exportSheet(true)));
        });

        const exportSheetLinkToClipboard = makeActionButton('Copy Link to Sheet', () => {
            startShortLink(JSON.stringify(this.exportSheet(true)));
        });
        outerDiv.appendChild(quickElement('div', ['button-row'], [exportSheetLinkToClipboard, exportSheetToClipboard]))

        return outerDiv;
    }

    private makeImportSetArea() {
        const area = new ImportSetArea(this);
        area.id = 'set-import-area';
        return area;
    }

    getBestMateria(stat: MateriaSubstat, meldSlot: MeldableMateriaSlot) {
        const highGradeAllowed = meldSlot.materiaSlot.allowsHighGrade;
        const maxGradeAllowed = meldSlot.materiaSlot.maxGrade;
        const materiaFilter = (materia: Materia) => {
            if (materia.isHighGrade && !highGradeAllowed) {
                return false;
            }
            return materia.materiaGrade <= maxGradeAllowed && materia.primaryStat == stat;
        };
        const sortedOptions = this.relevantMateria.filter(materiaFilter).sort((first, second) => second.primaryStatValue - first.primaryStatValue);
        return sortedOptions.length >= 1 ? sortedOptions[0] : undefined;
    }

    addDefaultSims() {
        const sims = getDefaultSims(this.classJobName, this.level);
        for (let simSpec of sims) {
            try {
                this.addSim(simSpec.makeNewSimInstance());
            }
            catch (e) {
                console.error(`Error adding default sim ${simSpec.displayName} (${simSpec.stub})`, e);
            }
        }
    }

}

class ImportSetArea extends HTMLElement {
    private readonly loader: LoadingBlocker;
    private readonly importButton: HTMLButtonElement;
    private readonly textArea: HTMLTextAreaElement;

    constructor(private sheet: GearPlanSheet) {
        super();

        const heading = document.createElement('h1');
        heading.textContent = 'Import Gear Set(s)';
        this.appendChild(heading);

        const explanation = document.createElement('p');
        explanation.textContent = 'This is for importing gear set(s) into this sheet. If you would like to import a full sheet export (including sim settings) to a new sheet, use the "Import Sheet" at the top of the page. '
            + 'You can import a gear planner URL or JSON, or an Etro URL.';
        this.appendChild(explanation);

        const textAreaDiv = document.createElement("div");
        textAreaDiv.id = 'set-import-textarea-holder';

        this.textArea = document.createElement("textarea");
        this.textArea.id = 'set-import-textarea';
        textAreaDiv.appendChild(this.textArea);
        this.loader = new LoadingBlocker();
        this.loader.classList.add('with-bg');


        textAreaDiv.appendChild(this.loader);
        this.appendChild(textAreaDiv);
        // textAreaDiv.appendChild(document.createElement("br"));

        this.importButton = makeActionButton("Import", () => this.doImport());
        this.appendChild(this.importButton);
        this.ready = true;
    }

    set ready(ready: boolean) {
        if (ready) {
            this.loader.hide();
            this.importButton.disabled = false;
        }
        else {
            this.loader.show();
            this.importButton.disabled = true;
        }
    }

    checkJob(importedJob: JobName, plural: boolean): boolean {
        if (importedJob !== this.sheet.classJobName) {
            // TODO: *try* to import some sims, or at least load up the defaults.
            let msg;
            if (plural) {
                msg = `You are trying to import ${importedJob} set(s) into a ${this.sheet.classJobName} sheet. Class-specific items, such as weapons, will need to be re-selected.`;
            }
            else {
                msg = `You are trying to import a ${importedJob} set into a ${this.sheet.classJobName} sheet. Class-specific items, such as weapons, will need to be re-selected.`;
            }
            return confirm(msg);
        }
        else {
            return true;
        }

    }

    doImport() {
        const text = this.textArea.value.trim();
        // First check for Etro link
        const importSheetUrlRegex = RegExp(".*/importsheet/(.*)$");
        const importSetUrlRegex = RegExp(".*/importset/(.*)$");
        const etroRegex = RegExp("https:\/\/etro\.gg\/gearset\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
        const sheetExec = importSheetUrlRegex.exec(text);
        if (sheetExec !== null) {
            this.doJsonImport(decodeURIComponent(sheetExec[1]));
            return;
        }
        const setExec = importSetUrlRegex.exec(text);
        if (setExec !== null) {
            this.doJsonImport(decodeURIComponent(setExec[1]));
            return;
        }
        const etroExec = etroRegex.exec(text);
        if (etroExec !== null) {
            this.ready = false;
            getSetFromEtro(etroExec[1]).then(set => {
                if (!this.checkJob(set.job, false)) {
                    this.ready = true;
                    return;
                }
                this.sheet.addGearSet(this.sheet.importGearSet(set), true);
                console.log("Loaded set from Etro");
            }, err => {
                this.ready = true;
                console.error("Error loading set from Etro", err);
                alert('Error loading Etro set');
            });
            return;
        }
        try {
            this.doJsonImport(text);
        }
        catch (e) {
            console.error('Import error', e);
            alert('Error importing');
        }
    }

    doJsonImport(text: string) {
        const rawImport = JSON.parse(text);
        if ('sets' in rawImport && rawImport.sets.length) {
            if (!this.checkJob(rawImport.job, true)) {
                return;
            }
            // import everything
            if (confirm(`This will import ${rawImport.sets.length} gear sets into this sheet.`)) {
                const sets: SetExport[] = rawImport.sets;
                const imports = sets.map(set => this.sheet.importGearSet(set));
                for (let i = 0; i < imports.length; i++) {
                    // Select the first imported set
                    const set = imports[i];
                    this.sheet.addGearSet(set, i === 0);
                }
            }
        }
        else if ('name' in rawImport && 'items' in rawImport) {
            if (!this.checkJob(rawImport.job, false)) {
                return;
            }
            this.sheet.addGearSet(this.sheet.importGearSet(rawImport), true);
        }
        else {
            alert("That doesn't look like a valid sheet or set");
        }

    }
}

export class ImportSheetArea extends HTMLElement {
    private readonly loader: LoadingBlocker;
    private readonly importButton: HTMLButtonElement;
    private readonly textArea: HTMLTextAreaElement;

    // TODO
    constructor(private sheetOpenCallback: (GearPlanSheet) => Promise<any>) {
        super();

        const heading = document.createElement('h1');
        heading.textContent = 'Import Sheet';
        this.appendChild(heading);

        const explanation = document.createElement('p');
        explanation.textContent = 'This will import into a new sheet. You can paste a gear planner link, gear planner JSON, or an Etro link.';
        this.appendChild(explanation);

        const textAreaDiv = document.createElement("div");
        textAreaDiv.id = 'set-import-textarea-holder';

        this.textArea = document.createElement("textarea");
        this.textArea.id = 'set-import-textarea';
        textAreaDiv.appendChild(this.textArea);
        this.loader = new LoadingBlocker();
        this.loader.classList.add('with-bg');


        textAreaDiv.appendChild(this.loader);
        this.appendChild(textAreaDiv);
        textAreaDiv.appendChild(document.createElement("br"));

        this.importButton = makeActionButton("Import", () => this.doImport());
        this.appendChild(this.importButton);
        this.ready = true;
    }

    set ready(ready: boolean) {
        if (ready) {
            this.loader.hide();
            this.importButton.disabled = false;
        }
        else {
            this.loader.show();
            this.importButton.disabled = true;
        }
    }

    doImport() {
        const text = this.textArea.value;
        // First check for Etro link
        const importSheetUrlRegex = RegExp(".*/importsheet/(.*)$");
        const importSetUrlRegex = RegExp(".*/importset/(.*)$");
        const sheetExec = importSheetUrlRegex.exec(text);
        if (sheetExec !== null) {
            this.doJsonImport(decodeURIComponent(sheetExec[1]));
            return;
        }
        const setExec = importSetUrlRegex.exec(text);
        if (setExec !== null) {
            this.doJsonImport(decodeURIComponent(setExec[1]));
            return;
        }
        const etroRegex = RegExp("https:\/\/etro\.gg\/gearset\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
        const etroExec = etroRegex.exec(text);
        // TODO: check level as well
        if (etroExec !== null) {
            this.ready = false;
            getSetFromEtro(etroExec[1]).then(set => {
                this.sheetOpenCallback(GearPlanSheet.fromSetExport(set));
                console.log("Loaded set from Etro");
            }, err => {
                this.ready = true;
                console.error("Error loading set from Etro", err);
                alert('Error loading Etro set');
            });
            return;
        }
        try {
            this.doJsonImport(text);
        }
        catch (e) {
            console.error('Import error', e);
            alert('Error importing');
        }
    }

    doJsonImport(text: string) {
        const rawImport = JSON.parse(text);
        if ('sets' in rawImport && rawImport.sets.length) {
            this.sheetOpenCallback(GearPlanSheet.fromExport(rawImport));
        }
        else if ('name' in rawImport && 'items' in rawImport) {
            this.sheetOpenCallback(GearPlanSheet.fromSetExport(rawImport));
        }
        else {
            alert("That doesn't look like a valid sheet or set");
        }
    }
}

class AddSimDialog extends HTMLDialogElement {
    private readonly table: CustomTable<SimSpec<any, any>, SingleCellRowOrHeaderSelect<SimSpec<any, any>>>;

    constructor(private sheet: GearPlanSheet) {
        super();
        this.id = 'add-sim-dialog';
        const header = document.createElement("h2");
        header.textContent = "Add Simulation";
        this.appendChild(header);
        const form = document.createElement("form");
        form.method = 'dialog';

        this.table = new CustomTable();
        const selModel: SingleSelectionModel<SimSpec<any, any>> = new SingleSelectionModel();
        this.table.selectionModel = selModel;
        this.table.columns = [
            {
                shortName: 'sim-space-name',
                displayName: 'Name',
                fixedWidth: 500,
                getter: item => item.displayName,
            }
        ]
        this.table.data = this.sheet.relevantSims;
        form.appendChild(this.table);

        const buttonDiv = document.createElement("div");
        const submitButton = makeActionButton("Add", () => this.submit());
        const cancelButton = makeActionButton("Cancel", () => this.close());
        buttonDiv.appendChild(submitButton);
        buttonDiv.appendChild(cancelButton);

        selModel.addListener({
            onNewSelection(newSelection) {
                submitButton.disabled = !(newSelection instanceof CustomRow);
            }
        })

        form.appendChild(buttonDiv);

        this.appendChild(form);
    }

    show() {
        this.showModal();
        // this.style.display = 'block';
    }

    close() {
        super.close();
        // this.style.display = 'none';
        // TODO: uncomment after testing
        this.remove();
    }

    submit() {
        const sel = this.table.selectionModel.getSelection();
        if (sel instanceof CustomRow) {
            this.sheet.addSim(sel.dataItem.makeNewSimInstance());
            this.close();
        }
    }

}


function deleteSheetByKey(saveKey: string) {
    localStorage.removeItem(saveKey);
}

function startNewSheet() {
    showNewSheetForm();
}

export class SheetPickerTable extends CustomTable<SheetExport> {
    constructor() {
        super();
        this.classList.add("gear-sheets-table");
        this.columns = [
            {
                shortName: "sheetactions",
                displayName: "",
                getter: sheet => sheet,
                renderer: (sheet: SheetExport) => {
                    const div = document.createElement("div");
                    div.appendChild(makeActionButton('Open', () => openSheetByKey(sheet.saveKey)));
                    div.appendChild(makeActionButton('Delete️', () => {
                        deleteSheetByKey(sheet.saveKey);
                        this.readData();
                    }));
                    return div;
                },
            },
            {
                shortName: "sheetjob",
                displayName: "Job",
                getter: sheet => sheet.job,
                fixedWidth: 60,
            },
            {
                shortName: "sheetlevel",
                displayName: "Lvl",
                getter: sheet => sheet.level,
                fixedWidth: 50,
            },
            {
                shortName: "sheetname",
                displayName: "Sheet Name",
                getter: sheet => sheet.name,
            }
        ]
        this.readData();
    }

    readData() {
        const data: typeof this.data = [];
        data.push(new SpecialRow((table) => {
            const div = document.createElement("div");
            div.appendChild(makeActionButton("New Sheet", () => startNewSheet()));
            return div;
        }))
        const items: SheetExport[] = [];
        for (let localStorageKey in localStorage) {
            if (localStorageKey.startsWith("sheet-save-")) {
                const imported = JSON.parse(localStorage.getItem(localStorageKey)) as SheetExport;
                if (imported.saveKey) {
                    items.push(imported);
                }
            }
        }
        if (items.length === 0) {
            data.push(new TitleRow("You don't have any sheets. Click 'New Sheet' to get started."));
        }
        else {
            items.sort((left, right) => {
                return parseInt(right.saveKey.split('-')[2]) - parseInt(left.saveKey.split('-')[2]);
            })
            data.push(...items);
        }
        this.data = data;
    }
}

function getNextSheetInternalName() {
    const lastRaw = localStorage.getItem("last-sheet-number");
    const lastSheetNum = lastRaw ? parseInt(lastRaw) : 0;
    const next = lastSheetNum + 1;
    localStorage.setItem("last-sheet-number", next.toString());
    const randomStub = Math.floor(Math.random() * 65536);
    return "sheet-save-" + next + '-' + randomStub.toString(16).toLowerCase();
}

export class NewSheetForm extends HTMLFormElement {
    private readonly nameInput: HTMLInputElement;
    private readonly jobDropdown: DataSelect<JobName>;
    private readonly levelDropdown: DataSelect<SupportedLevel>;
    private readonly fieldSet: HTMLFieldSetElement;
    private readonly sheetOpenCallback: (GearPlanSheet) => Promise<any>;

    constructor(sheetOpenCallback: (GearPlanSheet) => Promise<any>) {
        super();
        this.sheetOpenCallback = sheetOpenCallback;
        // Header
        const header = document.createElement("h1");
        header.textContent = "New Gear Planning Sheet";
        this.id = "new-sheet-form";
        this.appendChild(header);

        this.fieldSet = document.createElement("fieldset");

        // Sheet Name
        this.nameInput = document.createElement("input");
        this.nameInput.id = "new-sheet-name-input";
        this.nameInput.required = true;
        this.nameInput.type = 'text';
        this.nameInput.width = 400;
        this.fieldSet.appendChild(labelFor("Sheet Name: ", this.nameInput));
        this.fieldSet.appendChild(this.nameInput);
        this.fieldSet.appendChild(document.createElement("br"));

        // Job selection
        // @ts-ignore
        this.jobDropdown = new DataSelect<JobName>(Object.keys(JOB_DATA), item => item, () => this.recheck());
        this.jobDropdown.id = "new-sheet-job-dropdown";
        this.jobDropdown.required = true;
        this.fieldSet.appendChild(labelFor('Job: ', this.jobDropdown));
        this.fieldSet.appendChild(this.jobDropdown);
        this.fieldSet.appendChild(document.createElement("br"));

        // Level selection
        this.levelDropdown = new DataSelect<SupportedLevel>([...SupportedLevels], item => item.toString(), () => this.recheck(), Math.max(...SupportedLevels) as SupportedLevel);
        this.levelDropdown.id = "new-sheet-level-dropdown";
        this.levelDropdown.required = true;
        this.fieldSet.appendChild(labelFor('Level: ', this.levelDropdown));
        this.fieldSet.appendChild(this.levelDropdown);
        this.fieldSet.appendChild(document.createElement("br"));

        this.appendChild(this.fieldSet);
        this.appendChild(document.createElement("br"));

        this.submitButton = document.createElement("button");
        this.submitButton.type = 'submit';
        this.submitButton.textContent = "New Sheet";
        this.appendChild(this.submitButton);

        onsubmit = (ev) => {
            this.doSubmit();
        }
    }

    recheck() {
        // TODO
    }

    private doSubmit() {
        const nextSheetSaveStub = getNextSheetInternalName();
        const gearPlanSheet = GearPlanSheet.fromScratch(nextSheetSaveStub, this.nameInput.value, this.jobDropdown.selectedItem, this.levelDropdown.selectedItem);
        this.sheetOpenCallback(gearPlanSheet).then(() => gearPlanSheet.requestSave());
    }
}

export interface XivApiJobData {
    Name: string,
    Abbreviation: string,
    ID: number,
    Icon: string
}

customElements.define("gear-set-editor", GearSetEditor);
customElements.define("gear-plan-table", GearPlanTable, {extends: "table"});
customElements.define("gear-plan", GearPlanSheet);
customElements.define("gear-sheet-picker", SheetPickerTable, {extends: "table"});
customElements.define("new-sheet-form", NewSheetForm, {extends: "form"});
customElements.define("sim-result-display", SimResultMiniDisplay);
customElements.define("sim-result-detail-display", SimResultDetailDisplay);
customElements.define("add-sim-dialog", AddSimDialog, {extends: "dialog"});
customElements.define("import-set-area", ImportSetArea);
customElements.define("import-sheet-area", ImportSheetArea);
