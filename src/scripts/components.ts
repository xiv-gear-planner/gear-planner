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
    EquipmentSet,
    EquipSlotKeys,
    EquipSlots,
    FoodItem,
    GearItem,
    GearSlot,
    GearSlotItem,
    ItemSlotExport,
    Materia,
    MeldableMateriaSlot,
    RawStatKey,
    RawStats,
    SetExport,
    SheetExport,
    SimExport,
    StatBonus
} from "./geartypes";
import {potRatioSimSpec, getSims, getSimSpecByStub, SimCurrentResult, SimResult, SimSpec, Simulation} from "./simulation";
import {
    getJobStats,
    JOB_DATA,
    JobName,
    STAT_ABBREVIATIONS,
    STAT_FULL_NAMES,
    SupportedLevel,
    SupportedLevels
} from "./xivconstants";
import {openSheetByKey, setEditorAreaContent, showNewSheetForm} from "./main";
import {whmSheetSpec} from "./sims/whm_sheet_sim";
import {closeModal, setModal} from "./modalcontrol";

type GearSetSel = SingleCellRowOrHeaderSelect<CharacterGearSet>;

function makeActionButton(label: string, action: () => void) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener('click', ev => {
        ev.stopPropagation();
        action();
    });
    return button;
}

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

/**
 * A table of gear sets
 */
export class GearPlanTable extends CustomTable<CharacterGearSet, GearSetSel> {

    private gearSets: CharacterGearSet[] = [];
    private sims: Simulation<any, any, any>[] = [];
    private sheet: GearPlanSheet;

    constructor(sheet: GearPlanSheet, setSelection: (item: CharacterGearSet | Simulation<any, any, any> | undefined) => void) {
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
                else if (newSelection === undefined) {
                    setSelection(undefined);
                }
            }
        })
    }

    selectGearSet(set: CharacterGearSet | undefined) {
        if (set === undefined) {
            this.selectionModel.clearSelection();
        }
        else {
            const row: CustomRow<CharacterGearSet> = this.dataRowMap.get(set);
            if (row) {
                this.selectionModel.clickRow(row);
            }
        }
        this.refreshSelection();
    }

    addRow(...toAdd: CharacterGearSet[]) {
        for (let gearSet of toAdd) {
            gearSet.addListener(() => this.refreshRowData(gearSet));
            this.gearSets.push(gearSet);
        }
        this.dataChanged();
    }

    delRow(...toDelete: CharacterGearSet[]) {
        this.gearSets = this.gearSets.filter(gs => {
            return !toDelete.includes(gs);
        });
        this.dataChanged();
    }

    dataChanged() {
        const curSelection = this.selectionModel.getSelection();
        super.data = [new HeaderRow(), ...this.gearSets];
        // Special case for deleting the currently selected row
        if (curSelection instanceof CustomRow && !(this.gearSets.includes(curSelection.dataItem))) {
            this.selectionModel.clearSelection();
        }
    }

    addSim(sim: Simulation<any, any, any>) {
        this.sims.push(sim);
        this.setupColumns();
    }

    delSim(sim: Simulation<any, any, any>) {
        this.sims = this.sims.filter(s => s !== sim);
        this.setupColumns();
    }

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
                    div.appendChild(makeActionButton('📃', () => this.sheet.addGearSet(gearSet.clone(), true)));
                    return div;
                }
            },
            {
                shortName: "setname",
                displayName: "Set Name",
                getter: gearSet => gearSet.name,
                initialWidth: 300,
            },
            {
                shortName: "gcd",
                displayName: "GCD",
                getter: gearSet => Math.min(gearSet.computedStats.gcdMag, gearSet.computedStats.gcdPhys),
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
                // TODO: make dataManager retrieve this object once
                condition: () => getJobStats(this.sheet.dataManager.classJob).mainStat === 'dexterity',
            },
            {
                shortName: "strength",
                displayName: "STR",
                getter: gearSet => gearSet.computedStats.strength,
                initialWidth: statColWidth,
                condition: () => getJobStats(this.sheet.dataManager.classJob).mainStat === 'strength',
            },
            {
                shortName: "mind",
                displayName: "MND",
                getter: gearSet => gearSet.computedStats.mind,
                initialWidth: statColWidth,
                condition: () => getJobStats(this.sheet.dataManager.classJob).mainStat === 'mind',
            },
            {
                shortName: "int",
                displayName: "INT",
                getter: gearSet => gearSet.computedStats.intelligence,
                initialWidth: statColWidth,
                condition: () => getJobStats(this.sheet.dataManager.classJob).mainStat === 'intelligence',
            },
            {
                shortName: "crit",
                displayName: "CRT",
                getter: gearSet => ({
                    stat: gearSet.computedStats.crit,
                    chance: gearSet.computedStats.critChance,
                    multiplier: gearSet.computedStats.critMulti
                }) as ChanceStat,
                renderer: (stats: ChanceStat) => {
                    return chanceStatDisplay(stats);
                },
                initialWidth: chanceStatColWidth,
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: gearSet => ({
                    stat: gearSet.computedStats.dhit,
                    chance: gearSet.computedStats.dhitChance,
                    multiplier: gearSet.computedStats.dhitMulti
                }) as ChanceStat,
                renderer: (stats: ChanceStat) => {
                    return chanceStatDisplay(stats);
                },
                initialWidth: chanceStatColWidth,
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: gearSet => ({
                    stat: gearSet.computedStats.determination,
                    multiplier: gearSet.computedStats.detMulti
                }) as MultiplierStat,
                renderer: (stats: MultiplierStat) => {
                    // TODO: make these fancy
                    return multiplierStatDisplay(stats);
                },
                initialWidth: multiStatColWidth,
            },
            {
                shortName: "sps",
                displayName: "SPS",
                getter: gearSet => gearSet.computedStats.spellspeed,
                initialWidth: statColWidth,
            },
            {
                shortName: "piety",
                displayName: "PIE",
                getter: gearSet => gearSet.computedStats.piety,
                initialWidth: statColWidth,
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
                renderer: result => new SimResultDisplay(result),
                allowHeaderSelection: true,
            });
        }
        this.columns = columns;
    }
}

export class SimResultDisplay extends HTMLElement {
    private _result: SimCurrentResult<any>;

    constructor(simCurrentResult: SimCurrentResult<any>) {
        super();
        this._result = simCurrentResult;
        this.update();
        this._result.resultPromise.then(result => this.update(), error => this.update());
    }

    update() {
        if (this._result.status === 'Done') {
            this.textContent = this._result.result.mainDpsResult.toFixed(2);
            const tooltip = Object.entries(this._result.result).map(entry => `${entry[0]}: ${entry[1]}`)
                .join('\n');
            this.setAttribute('title', tooltip);
        }
        else {
            this.textContent = this._result.status;
        }
    }
}

/**
 * Helper to add classes to cells for stats
 *
 * @param cell
 * @param stat
 * @param statCssStub
 */
function statCellStyler(cell: CustomCell<GearSlotItem, any>, stat: keyof RawStats, statCssStub: string) {

    cell.classList.add("stat-" + statCssStub);
    if (cell.dataItem.item.primarySubstat === stat) {
        cell.classList.add("primary");
    }
    else if (cell.dataItem.item.secondarySubstat === stat) {
        cell.classList.add("secondary");
    }
    if (cell._value === 0) {
        cell.classList.add("stat-zero");
    }
}

function foodStatCellStyler(cell: CustomCell<FoodItem, any>, stat: keyof RawStats, statCssStub: string) {

    cell.classList.add("stat-" + statCssStub);
    if (cell.dataItem.primarySubStat === stat) {
        cell.classList.add("primary");
    }
    else if (cell.dataItem.secondarySubStat === stat) {
        cell.classList.add("secondary");
    }
    if (cell._value === 0) {
        cell.classList.add("stat-zero");
    }
}

function statBonusDisplay(value: StatBonus) {
    if (value) {
        return document.createTextNode(`+${value.percentage}% (max ${value.max})`);
    }
    else {
        return document.createTextNode("");
    }
}

class FoodItemsTable extends CustomTable<FoodItem, FoodItem> {
    constructor(dataManager: DataManager, gearSet: CharacterGearSet) {
        super();
        this.classList.add("food-items-table");
        const foodStatColWidth = 120;
        super.columns = [
            {
                shortName: "ilvl",
                displayName: "iLvl",
                getter: item => item.ilvl,
            },
            {
                shortName: "icon",
                displayName: "",
                getter: item => {
                    return item.iconUrl;
                },
                renderer: img => {
                    const image = document.createElement('img');
                    image.src = img.toString();
                    return image;
                },
            },
            {
                shortName: "itemname",
                displayName: "Name",
                getter: item => {
                    return item.name;
                },
                initialWidth: 200,
            },
            {
                shortName: "vit",
                displayName: "VIT",
                getter: item => {
                    return item.bonuses.vitality;
                },
                renderer: value => statBonusDisplay(value),
                initialWidth: foodStatColWidth,
                colStyler: (value, cell) => foodStatCellStyler(cell, 'vitality', 'vit'),
            },
            {
                shortName: "crit",
                displayName: "CRT",
                getter: item => {
                    return item.bonuses.crit;
                },
                renderer: value => statBonusDisplay(value),
                initialWidth: foodStatColWidth,
                colStyler: (value, cell, node) => foodStatCellStyler(cell, 'crit', 'crit')
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: item => {
                    return item.bonuses.dhit;
                },
                renderer: value => statBonusDisplay(value),
                initialWidth: foodStatColWidth,
                colStyler: (value, cell, node) => foodStatCellStyler(cell, 'dhit', 'dhit')
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: item => {
                    return item.bonuses.determination;
                },
                renderer: value => statBonusDisplay(value),
                initialWidth: foodStatColWidth,
                colStyler: (value, cell, node) => foodStatCellStyler(cell, 'determination', 'det'),
            },
            {
                shortName: "sps",
                displayName: "SPS",
                getter: item => {
                    return item.bonuses.spellspeed;
                },
                renderer: value => statBonusDisplay(value),
                initialWidth: foodStatColWidth,
                colStyler: (value, cell, node) => foodStatCellStyler(cell, 'spellspeed', 'sps')
            },
            {
                shortName: "piety",
                displayName: "PIE",
                getter: item => {
                    return item.bonuses.piety;
                },
                renderer: value => statBonusDisplay(value),
                initialWidth: foodStatColWidth,
                colStyler: (value, cell, node) => foodStatCellStyler(cell, 'piety', 'piety')
            },
        ]
        super.selectionModel = {
            clickCell(cell: CustomCell<FoodItem, FoodItem>) {

            },
            clickColumnHeader(col: CustomColumn<FoodItem>) {

            },
            clickRow(row: CustomRow<FoodItem>) {
                gearSet.food = row.dataItem;
            },
            getSelection(): FoodItem {
                return gearSet.food;
            },
            isCellSelectedDirectly(cell: CustomCell<FoodItem, FoodItem>) {
                return false;
            },
            isColumnHeaderSelected(col: CustomColumn<FoodItem>) {
                return false;
            },
            isRowSelected(row: CustomRow<FoodItem>) {
                return gearSet.food === row.dataItem;
            },
            clearSelection(): void {

            }
        }
        super.data = [new HeaderRow(), ...dataManager.foodItems];
    }
}

/**
 * Table for displaying gear options for all slots
 */
class GearItemsTable extends CustomTable<GearSlotItem, EquipmentSet> {

    constructor(dataManager: DataManager, gearSet: CharacterGearSet, itemMapping: Map<GearSlot, GearItem[]>) {
        super();
        this.classList.add("gear-items-table");
        super.columns = [
            {
                shortName: "ilvl",
                displayName: "iLvl",
                getter: item => {
                    return item.item.ilvl.toString();
                },
            },
            {
                shortName: "icon",
                displayName: "",
                getter: item => {
                    return item.item.iconUrl;
                },
                renderer: img => {
                    const image = document.createElement('img');
                    image.src = img.toString();
                    return image;
                },
            },
            {
                shortName: "itemname",
                displayName: "Name",
                getter: item => {
                    return item.item.name;
                },
                initialWidth: 300,
            },
            {
                shortName: "mats",
                displayName: "Mat",
                getter: item => {
                    return item.item.materiaSlots.length;
                },
                initialWidth: 30,
            },
            {
                shortName: "wd",
                displayName: "WD",
                getter: item => {
                    // return Math.max(item.item.stats.wdMag, item.item.stats.wdPhys);
                    return Math.max(item.item.stats.wdMag, item.item.stats.wdPhys);
                },
                renderer: value => {
                    if (value) {
                        return document.createTextNode(value);
                    }
                    else {
                        return document.createTextNode("");
                    }
                },
                initialWidth: 30,
            },
            {
                shortName: "vit",
                displayName: "VIT",
                getter: item => {
                    return item.item.stats.vitality;
                },
                initialWidth: 30,
            },
            {
                shortName: "mind",
                displayName: "MND",
                getter: item => {
                    return item.item.stats.mind;
                },
                initialWidth: 30,
            },
            {
                shortName: "crit",
                displayName: "CRT",
                getter: item => {
                    return item.item.stats.crit;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCellStyler(cell, 'crit', 'crit')
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: item => {
                    return item.item.stats.dhit;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCellStyler(cell, 'dhit', 'dhit')
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: item => {
                    return item.item.stats.determination;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCellStyler(cell, 'determination', 'det'),
            },
            {
                shortName: "sps",
                displayName: "SPS",
                getter: item => {
                    return item.item.stats.spellspeed;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCellStyler(cell, 'spellspeed', 'sps')
            },
            {
                shortName: "piety",
                displayName: "PIE",
                getter: item => {
                    return item.item.stats.piety;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCellStyler(cell, 'piety', 'piety')
            },
        ]
        const data: (TitleRow | HeaderRow | GearSlotItem)[] = [];
        const slotMateriaManagers = [];
        for (const [name, slot] of Object.entries(EquipSlots)) {
            data.push(new TitleRow(slot.name));
            data.push(new HeaderRow());
            const itemsInSlot = itemMapping.get(slot.gearSlot);
            for (const gearItem of itemsInSlot) {
                data.push({
                    slot: slot,
                    item: gearItem,
                    slotName: name
                });
            }
            const matMgr = new AllSlotMateriaManager(dataManager, gearSet, name);
            slotMateriaManagers.push(matMgr);
            data.push(new SpecialRow(tbl => matMgr));
        }
        super.selectionModel = {
            clickCell(cell: CustomCell<GearSlotItem, any>) {

            },
            clickColumnHeader(col: CustomColumn<GearSlotItem>) {

            },
            clickRow(row: CustomRow<GearSlotItem>) {
                gearSet.setEquip(row.dataItem.slotName, row.dataItem.item);
                for (let matMgr of slotMateriaManagers) {
                    matMgr.refresh();
                }
            },
            getSelection(): EquipmentSet {
                return gearSet.equipment;
            },
            isCellSelectedDirectly(cell: CustomCell<GearSlotItem, any>) {
                return false;
            },
            isColumnHeaderSelected(col: CustomColumn<GearSlotItem>) {
                return false;
            },
            isRowSelected(row: CustomRow<GearSlotItem>) {
                return gearSet.getItemInSlot(row.dataItem.slotName) === row.dataItem.item;
            },
            clearSelection() {
                // no-op
            }
        };
        this.data = data;
    }
}

/**
 * The set editor portion. Includes the tab as well as controls for the set name and such.
 */
export class GearSetEditor extends HTMLElement {
    constructor(gearPlanner: GearPlanSheet, gearSet: CharacterGearSet, dataManager: DataManager) {
        super();
        // const header = document.createElement("h1");
        // header.textContent = "Gear Set Editor";
        // this.appendChild(header)

        // Name editor
        const nameEditor = new FieldBoundTextField(gearSet, 'name');
        nameEditor.classList.add("gear-set-name-editor");
        this.appendChild(nameEditor);

        // Put items in categories by slot
        // Not enough to just use the items, because rings can be in either ring slot, so we
        // need options to reflect that.
        let itemMapping: Map<GearSlot, GearItem[]> = new Map();
        dataManager.items.forEach((item) => {
            let slot = item.gearSlot;
            if (itemMapping.has(slot)) {
                itemMapping.get(slot).push(item);
            }
            else {
                itemMapping.set(slot, [item]);
            }
        })


        // Gear table
        const gearTable = new GearItemsTable(dataManager, gearSet, itemMapping);
        gearTable.id = "gear-items-table";
        this.appendChild(gearTable);

        // Food table
        const foodTable = new FoodItemsTable(dataManager, gearSet);
        foodTable.id = "food-items-table";
        this.appendChild(foodTable);
    }
}

function formatSimulationConfigArea(
    sim: Simulation<any, any, any>,
    refreshColumn: (item: Simulation<any, any, any>) => void,
    deleteColumn: (item: Simulation<any, any, any>) => void,
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

    const customInterface = sim.makeConfigInterface();
    customInterface.id = 'sim-config-area-inner';
    customInterface.classList.add('sim-config-area-inner');
    outerDiv.appendChild(customInterface);

    return outerDiv;
}

/**
 * The top-level gear manager element
 */
export class GearPlanSheet extends HTMLElement {
    gearPlanTable: GearPlanTable;
    private _saveKey: string;
    name: string;
    sets: CharacterGearSet[] = [];
    sims: Simulation<any, any, any>[] = [];
    dataManager: DataManager;
    job: JobName;
    level: SupportedLevel;
    private _editorAreaSetup: (...nodes: Node[]) => void;
    private buttonRow: HTMLDivElement;

    constructor(dataManager: DataManager, sheetKey: string, defaultName?: string, editorAreaSetup?: (...nodes: Node[]) => void) {
        super();
        if (!sheetKey) {
            console.error("No sheet key!")
        }
        if (editorAreaSetup) {
            this._editorAreaSetup = editorAreaSetup;
        }
        else {
            const editorArea = document.createElement("div");
            editorArea.id = "editor-area";
            this.appendChild(editorArea);
            this._editorAreaSetup = editorArea.replaceChildren;
        }
        this.dataManager = dataManager;
        this.gearPlanTable = new GearPlanTable(this, item => {
            try {
                if (!item) {
                    this._editorAreaSetup();
                }
                else if (item instanceof CharacterGearSet) {
                    this._editorAreaSetup(new GearSetEditor(this, item, dataManager));
                }
                else if (item['makeConfigInterface']) {
                    this._editorAreaSetup(formatSimulationConfigArea(item as Simulation<any, any, any>, col => this.gearPlanTable.refreshColumn(col), col => this.delSim(col), () => this.gearPlanTable.refreshColHeaders()));
                }
                else {
                    this._editorAreaSetup();
                }
            } catch (e) {
                console.error("Error in selection change: ", e);
                this._editorAreaSetup(document.createTextNode("Error!"));
            }
        });
        this.buttonRow = document.createElement("div");
        this.buttonRow.id = 'gear-sheet-button-row';
        const addRowButton = makeActionButton("New Gear Set", () => {
            const newSet = new CharacterGearSet(this.dataManager);
            newSet.name = "New Set";
            this.addGearSet(newSet, true);
        })
        this.buttonRow.appendChild(addRowButton)
        const newSimButton = makeActionButton("Add Simulation", () => {
            this.showAddSimDialog();
        })
        this.buttonRow.appendChild(newSimButton);
        this.appendChild(this.gearPlanTable);
        this.appendChild(this.buttonRow);
        this._saveKey = sheetKey;
        this.name = defaultName;
    }

    async loadData() {
        console.log("Loading sheet...");
        const saved = JSON.parse(localStorage.getItem(this._saveKey)) as SheetExport;
        if (saved) {
            console.log("Found Saved Data")
            this.name = saved.name;
            this.level = saved.level ?? 90;
            this.job = saved.job ?? 'WHM';
            this.dataManager.classJob = this.job;
            this.dataManager.level = this.level;
            await this.dataManager.loadData();
            for (let importedSet of saved.sets) {
                const set = new CharacterGearSet(this.dataManager);
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
                        equipped.melds[i].equippedMatiera = mat;
                    }
                    set.equipment[equipmentSlot] = equipped;
                }
                if (importedSet.food) {
                    set.food = this.dataManager.foodById(importedSet.food);
                }
                this.addGearSet(set);
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
                    } catch (e) {
                        console.error("Error loading sim settings", e);
                    }
                }
            }
        }
        else {
            const set = new CharacterGearSet(this.dataManager);
            set.name = "Default Set";
            this.addGearSet(set, true);
            if (!this.name) {
                this.name = "Default Sheet";
            }
            this.job = 'WHM';
            this.level = 90;
            this.dataManager.classJob = this.job;
            this.dataManager.level = this.level;
            this.addSim(whmSheetSpec.makeNewSimInstance());
            this.addSim(potRatioSimSpec.makeNewSimInstance());
            await this.dataManager.loadData();
        }
        // needed for empty table
        this.gearPlanTable.dataChanged();
    }

    saveData() {
        console.log("Saving sheet " + this.name);
        // TODO: make this async
        const sets: SetExport[] = []
        for (let set of this.sets) {
            const items: { [K in EquipSlotKeys]?: ItemSlotExport } = {};
            for (let equipmentKey in set.equipment) {
                const inSlot: EquippedItem = set.equipment[equipmentKey];
                if (inSlot) {
                    items[equipmentKey] = {
                        id: inSlot.gearItem.id,
                        materia: inSlot.melds.map(meld => {
                            return {id: meld.equippedMatiera?.id ?? -1}
                        }),
                    };
                }
            }
            const setExport: SetExport = {
                name: set.name,
                items: items,
                food: set.food ? set.food.id : undefined
            };
            sets.push(setExport);
        }
        let simsExport: SimExport[] = [];
        for (let sim of this.sims) {
            simsExport.push({
                stub: sim.spec.stub,
                settings: sim.exportSettings(),
                name: sim.displayName
            });
        }
        const fullExport: SheetExport = {
            name: this.name,
            sets: sets,
            level: this.level,
            job: this.job,
            saveKey: this._saveKey,
            sims: simsExport,
        }
        localStorage.setItem(this._saveKey, JSON.stringify(fullExport));
    }

    addGearSet(gearSet: CharacterGearSet, select: boolean = false) {
        this.sets.push(gearSet);
        this.gearPlanTable.addRow(gearSet);
        gearSet.addListener(() => this.saveData());
        this.saveData();
        if (select) {
            this.gearPlanTable.selectGearSet(gearSet);
        }
    }

    delGearSet(gearSet: CharacterGearSet) {
        this.sets = this.sets.filter(gs => gs !== gearSet);
        this.gearPlanTable.delRow(gearSet);
        this.saveData();
    }

    addSim(sim: Simulation<any, any, any>) {
        this.sims.push(sim);
        this.gearPlanTable.addSim(sim);
        this.saveData();
    }

    delSim(sim: Simulation<any, any, any>) {
        this.sims = this.sims.filter(s => s !== sim);
        this.gearPlanTable.delSim(sim);
        this.saveData();
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

    get saveKey() {
        return this._saveKey;
    }
}

class AddSimDialog extends HTMLDialogElement {
    private _sheet: GearPlanSheet;
    private table: CustomTable<SimSpec<any, any>, SingleCellRowOrHeaderSelect<SimSpec<any, any>>>;

    constructor(sheet: GearPlanSheet) {
        super();
        this.id = 'add-sim-dialog';
        this._sheet = sheet;
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
        this.table.data = getSims();
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
        // this.remove();
    }

    submit() {
        const sel = this.table.selectionModel.getSelection();
        if (sel instanceof CustomRow) {
            this._sheet.addSim(sel.dataItem.makeNewSimInstance());
            this.close();
        }
    }

}


/**
 * Component for managing all materia slots on an item
 */
class AllSlotMateriaManager extends HTMLElement {
    private gearSet: CharacterGearSet;
    private slotName: string;
    private dataManager: DataManager;

    constructor(dataManager: DataManager, gearSet: CharacterGearSet, slotName: string) {
        super();
        this.dataManager = dataManager;
        this.gearSet = gearSet;
        this.slotName = slotName;
        this.refresh();
        this.classList.add("all-slots-materia-manager")
    }

    refresh() {
        const equipSlot: EquippedItem | null | undefined = this.gearSet.equipment[this.slotName];
        if (equipSlot) {
            if (equipSlot.melds.length === 0) {
                this.classList.remove("materia-slot-no-equip");
                this.classList.add("materia-slot-no-slots");
                this.classList.remove("materia-manager-equipped")
                const textSpan = document.createElement("span");
                textSpan.textContent = "No materia slots on this item";
                this.replaceChildren(textSpan);
            }
            else {
                this.replaceChildren(...equipSlot.melds.map(meld => new SlotMateriaManager(this.dataManager, meld, () => this.gearSet.notifyMateriaChange())));
                this.classList.remove("materia-slot-no-equip");
                this.classList.remove("materia-slot-no-slots");
                this.classList.add("materia-manager-equipped")
            }
        }
        else {
            const textSpan = document.createElement("span");
            textSpan.textContent = "Select an item to meld materia";
            this.replaceChildren(textSpan);
            this.classList.add("materia-slot-no-equip");
            this.classList.remove("materia-slot-no-slots");
            this.classList.remove("materia-manager-equipped")
        }
    }
}

/**
 * Html 'option' element but carries a data element with it
 */
class OptionDataElement<X> extends HTMLOptionElement {
    dataValue: X;

    constructor(dataValue: X) {
        super();
        this.dataValue = dataValue;
    }
}

export class DataSelect<X> extends HTMLSelectElement {
    constructor(items: X[], textGetter: (item: X) => string, callback: ((newValue: X) => void) | undefined, initialSelectedItem: X | undefined = undefined) {
        super();
        for (let item of items) {
            const opt = new OptionDataElement(item);
            opt.textContent = textGetter(item);
            this.options.add(opt);
            if (initialSelectedItem !== undefined && initialSelectedItem === item) {
                this.selectedIndex = this.options.length - 1;
            }
        }
        if (callback !== undefined) {
            this.addEventListener('change', (event) => {
                callback(this.selectedItem);
            })
        }
    }

    get selectedItem(): X {
        return (this.selectedOptions.item(0) as OptionDataElement<X>).dataValue;
    }

}


/**
 * UI for picking a single materia slot
 */
class SlotMateriaManager extends HTMLElement {

    private materiaSlot: MeldableMateriaSlot;
    private dataManager: DataManager;
    private callback: () => void;
    private popup: SlotMateriaManagerPopup | undefined;
    private text: HTMLSpanElement;
    private image: HTMLImageElement;

    constructor(dataManager: DataManager, materiaSlot: MeldableMateriaSlot, callback: () => void) {
        super();
        this.dataManager = dataManager;
        this.classList.add("slot-materia-manager")
        this.materiaSlot = materiaSlot;
        this.callback = callback;
        this.classList.add("slot-materia-manager")
        this.addEventListener('mousedown', (ev) => {
            this.showPopup();
            ev.stopPropagation();
        });
        const imageHolder = document.createElement("div");
        imageHolder.classList.add("materia-image-holder");
        this.image = document.createElement("img");
        this.text = document.createElement("span");
        this.reformat();
        imageHolder.appendChild(this.image);
        this.appendChild(imageHolder);
        this.appendChild(this.text);
    }

    showPopup() {
        if (!this.popup) {
            this.popup = new SlotMateriaManagerPopup(this.dataManager, this.materiaSlot, () => {
                this.callback();
                this.reformat();
            });
            this.appendChild(this.popup);
        }
        this.popup.show();
    }


    reformat() {
        const currentMat = this.materiaSlot.equippedMatiera;
        if (currentMat) {
            this.image.src = currentMat.iconUrl.toString();
            this.image.style.display = 'block';
            this.text.textContent = `+${currentMat.primaryStatValue} ${STAT_ABBREVIATIONS[currentMat.primaryStat]}`;
            this.classList.remove("materia-slot-empty")
            this.classList.add("materia-slot-full");
        }
        else {
            this.image.style.display = 'none';
            this.text.textContent = 'Empty';
            this.classList.remove("materia-slot-full");
            this.classList.add("materia-slot-empty");
        }
    }
}

class SlotMateriaManagerPopup extends HTMLElement {
    private dataManager: DataManager;
    private materiaSlot: MeldableMateriaSlot;
    private callback: () => void;

    constructor(dataManager: DataManager, materiaSlot: MeldableMateriaSlot, callback: () => void) {
        super();
        this.dataManager = dataManager;
        this.materiaSlot = materiaSlot;
        this.callback = callback;
        this.hide();
    }

    show() {
        const allMateria = this.dataManager.materiaTypes;
        const typeMap: { [K in RawStatKey]?: Materia[] } = {};
        const stats: RawStatKey[] = [];
        const grades: number[] = [];
        for (let materia of allMateria) {
            if (materia.materiaGrade > this.materiaSlot.materiaSlot.maxGrade
                || materia.isHighGrade && !this.materiaSlot.materiaSlot.allowsHighGrade) {
                continue;
            }
            (typeMap[materia.primaryStat] = typeMap[materia.primaryStat] ?? []).push(materia);
            if (!stats.includes(materia.primaryStat)) {
                stats.push(materia.primaryStat);
            }
            if (!grades.includes(materia.materiaGrade)) {
                grades.push(materia.materiaGrade);
            }
        }
        grades.sort((grade1, grade2) => grade2 - grade1);
        const table = document.createElement("table");
        const body = table.createTBody();
        const headerRow = body.insertRow();
        // Blank top-left
        headerRow.appendChild(document.createElement("th"));
        for (let stat of stats) {
            const headerCell = document.createElement("th");
            headerCell.textContent = STAT_ABBREVIATIONS[stat];
            headerRow.appendChild(headerCell);
        }
        for (let grade of grades) {
            const row = body.insertRow();
            row.insertCell().textContent = grade.toString();
            for (let stat of stats) {
                const materia = typeMap[stat]?.find(m => m.materiaGrade === grade);
                if (materia) {
                    const cell = row.insertCell();
                    cell.addEventListener('mousedown', (ev) => {
                        this.submit(materia);
                        ev.stopPropagation();
                    });
                    cell.title = `${materia.name}: +${materia.primaryStatValue} ${STAT_FULL_NAMES[materia.primaryStat]}`;
                    const image = document.createElement("img");
                    image.src = materia.iconUrl.toString();
                    if (this.materiaSlot.equippedMatiera === materia) {
                        cell.setAttribute("is-selected", "true");
                    }
                    cell.appendChild(image);
                }
                else {
                    row.insertCell();
                }
            }
        }
        this.replaceChildren(table);
        const self = this;
        setModal({
            element: self,
            close() {
                self.hide();
            }
        });
        this.style.display = 'block';
    }

    submit(materia: Materia) {
        this.materiaSlot.equippedMatiera = materia;
        closeModal();
        this.callback();
    }

    hide() {
        this.style.display = 'none';
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
                }
            },
            {
                shortName: "sheetjob",
                displayName: "Job",
                getter: sheet => sheet.job,
            },
            {
                shortName: "sheetlevel",
                displayName: "Lvl",
                getter: sheet => sheet.level,
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
        for (let localStorageKey in localStorage) {
            if (localStorageKey.startsWith("sheet-save-")) {
                const imported = JSON.parse(localStorage.getItem(localStorageKey)) as SheetExport;
                if (imported.saveKey) {
                    data.push(imported);
                }
            }
        }
        if (data.length === 1) {
            data.push(new TitleRow("You don't have any sheets. Click 'New Sheet' to get started."));
        }
        this.data = data;
    }
}

export function labelFor(label: string, labelFor: HTMLElement) {
    const element = document.createElement("label");
    element.textContent = label;
    if (labelFor.id) {
        element.htmlFor = labelFor.id;
    }
    else {
        console.warn("labelFor requires an element with an ID (for label '" + label + "')");
    }
    return element;
}

// TODO: should this also append some randomness to the end?
function getNextSheetInternalName() {
    const lastRaw = localStorage.getItem("last-sheet-number");
    const lastSheetNum = lastRaw ? parseInt(lastRaw) : 0;
    const next = lastSheetNum + 1;
    localStorage.setItem("last-sheet-number", next.toString());
    const randomStub = Math.floor(Math.random() * 65536);
    return "sheet-save-" + next + '-' + randomStub.toString(16).toLowerCase();
}

export class NewSheetForm extends HTMLFormElement {
    private nameInput: HTMLInputElement;
    private jobDropdown: DataSelect<JobName>;
    private levelDropdown: DataSelect<SupportedLevel>;
    private fieldSet: HTMLFieldSetElement;
    private sheetOpenCallback: (GearPlanSheet) => void;

    constructor(sheetOpenCallback: (GearPlanSheet) => void) {
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
        const gearPlanSheet = new GearPlanSheet(new DataManager(), nextSheetSaveStub, undefined, setEditorAreaContent);
        gearPlanSheet.name = this.nameInput.value;
        gearPlanSheet.job = this.jobDropdown.selectedItem;
        gearPlanSheet.level = this.levelDropdown.selectedItem;
        this.sheetOpenCallback(gearPlanSheet);
    }
}

export interface XivApiJobData {
    Name: string,
    Abbreviation: string,
    ID: number,
    Icon: string
}

let jobData: XivApiJobData[];

const jobIconMap = new Map<JobName, string>();

async function ensureJobDataLoaded() {
    if (jobData !== undefined) {
        return;
    }
    await fetch("https://xivapi.com/ClassJob?columns=Name,Abbreviation,ID,Icon")
        .then(response => response.json())
        .then(response => response['results'] as XivApiJobData[])
        .then(data => jobData = data);
    for (let jobDatum of jobData) {
        jobIconMap.set(jobDatum.Abbreviation as JobName, jobDatum.Icon);
    }
}

export class JobIcon extends HTMLImageElement {
    constructor(job: JobName) {
        super();
        ensureJobDataLoaded().then(() => this.src = "https://xivapi.com/" + jobIconMap.get(job));
    }
}

export interface FbctArgs {
    event?: keyof HTMLElementEventMap;
}

export class FieldBoundCheckBox<ObjType> extends HTMLInputElement {

    reloadValue: () => void;
    listeners: ((value: boolean) => void)[] = [];

    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends boolean ? K : never }[keyof ObjType], extraArgs: {
        id?: string
    } = {}) {
        super();
        this.type = 'checkbox';
        if (extraArgs.id) {
            this.id = extraArgs.id;
        }
        this.reloadValue = () => {
            // @ts-ignore
            this.checked = obj[field];
        };
        this.reloadValue();
        this.addEventListener('change', () => {
            const newValue: boolean = this.checked;
            // @ts-ignore
            obj[field] = newValue;
            for (let listener of this.listeners) {
                try {
                    listener(newValue);
                } catch (e) {
                    console.error("Error in listener", e);
                }
            }
        })
    }
}

export class FieldBoundConvertingTextField<ObjType, DataType> extends HTMLInputElement {

    reloadValue: () => void;
    listeners: ((value: DataType) => void)[] = [];

    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends DataType ? K : never }[keyof ObjType], valueToString: (value: DataType) => string, stringToValue: (string: string) => (DataType), extraArgs: FbctArgs = {}) {
        super();
        this.type = 'text';
        // @ts-ignore
        this.reloadValue = () => this.value = valueToString(obj[field]);
        this.reloadValue();
        this.addEventListener(extraArgs.event ?? 'input', () => {
            const newValue: DataType = stringToValue(this.value);
            // @ts-ignore
            obj[field] = newValue;
            for (let listener of this.listeners) {
                try {
                    listener(newValue);
                } catch (e) {
                    console.error("Error in listener", e);
                }
            }
        });
    }

    addListener(listener: (value: DataType) => void) {
        this.listeners.push(listener);
    }
}

export class FieldBoundConvertingTextField2<ObjType, Field extends keyof ObjType> extends HTMLInputElement {

    reloadValue: () => void;
    listeners: ((value: ObjType[Field]) => void)[] = [];

    constructor(
        obj: ObjType,
        field: Field,
        valueToString: (value: ObjType[Field]) => string,
        stringToValue: (string: string) => (ObjType[Field]),
        extraArgs: FbctArgs = {}
    ) {
        super();
        this.type = 'text';
        // @ts-ignore
        this.reloadValue = () => this.value = valueToString(obj[field]);
        this.reloadValue();
        this.addEventListener(extraArgs.event ?? 'input', () => {
            const newValue: ObjType[Field] = stringToValue(this.value);
            obj[field] = newValue;
            for (let listener of this.listeners) {
                try {
                    listener(newValue);
                } catch (e) {
                    console.error("Error in listener", e);
                }
            }
        });
    }

    addListener(listener: (value: ObjType[Field]) => void) {
        this.listeners.push(listener);
    }
}


// new FieldBoundConvertingTextField(new CharacterGearSet(null), 'food', food => food.toString(), str => new XivApiFoodInfo({}));
export class FieldBoundIntField<ObjType> extends FieldBoundConvertingTextField<ObjType, number> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], extraArgs: FbctArgs = {}) {
        super(obj, field, (s) => s.toString(), (s) => parseInt(s), extraArgs);
    }
}

// export class FieldBoundNumericField<ObjType> extends FieldBoundConvertingTextField2<ObjType, number> {
//     constructor(obj: ObjType, field: Field, extraArgs: FbctArgs = {}) {
//         super(obj, field, (s) => s, (s) => s, extraArgs);
//     }
// }

export class FieldBoundTextField<ObjType> extends FieldBoundConvertingTextField<ObjType, string> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends string ? K : never }[keyof ObjType], extraArgs: FbctArgs = {}) {
        super(obj, field, (s) => s, (s) => s, extraArgs);
    }
}

// export class FieldBoundTextField2<ObjType, Field extends keyof ObjType> extends FieldBoundConvertingTextField2<ObjType, Field> {
//     constructor(obj: ObjType, field: Field, extraArgs: FbctArgs = {}) {
//         super(obj, field, (s) => s, (s) => s, extraArgs);
//     }
// }

// new FieldBoundTextField(new CharacterGearSet(null), 'name');

export function labeledCheckbox(label: string, check: HTMLInputElement): HTMLDivElement {
    const labelElement = labelFor(label, check);
    const div = document.createElement("div");
    div.appendChild(check);
    div.appendChild(labelElement);
    div.classList.add("labeled-checkbox");
    return div;
}


customElements.define("gear-set-editor", GearSetEditor);
customElements.define("gear-plan-table", GearPlanTable, {extends: "table"});
customElements.define("gear-plan", GearPlanSheet);
customElements.define("gear-items-table", GearItemsTable, {extends: "table"});
customElements.define("food-items-table", FoodItemsTable, {extends: "table"});
customElements.define("all-slot-materia-manager", AllSlotMateriaManager);
customElements.define("slot-materia-manager", SlotMateriaManager);
customElements.define("slot-materia-popup", SlotMateriaManagerPopup);
customElements.define("option-data-element", OptionDataElement, {extends: "option"});
customElements.define("gear-sheet-picker", SheetPickerTable, {extends: "table"});
customElements.define("new-sheet-form", NewSheetForm, {extends: "form"});
customElements.define("data-select", DataSelect, {extends: "select"});
customElements.define("ffxiv-job-icon", JobIcon, {extends: "img"});
customElements.define("sim-result-display", SimResultDisplay);
customElements.define("field-bound-converting-text-field", FieldBoundConvertingTextField, {extends: "input"});
customElements.define("field-bound-text-field", FieldBoundTextField, {extends: "input"});
customElements.define("field-bound-checkbox", FieldBoundCheckBox, {extends: "input"});
customElements.define("add-sim-dialog", AddSimDialog, {extends: "dialog"});
