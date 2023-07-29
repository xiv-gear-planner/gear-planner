import {
    CustomCell,
    CustomColumnDef,
    CustomRow,
    CustomTable,
    HeaderRow,
    SingleCellRowOrHeaderSelect,
    SingleSelectionModel,
    SpecialRow,
    TitleRow
} from "./tables";
import {
    CharacterGearSet,
    EquipmentSet,
    EquippedItem,
    EquipSlotKeys,
    EquipSlots,
    GearItem,
    GearSlot,
    GearSlotItem,
    ItemSlotExport,
    Materia,
    MeldableMateriaSlot,
    SetExport,
    SheetExport
} from "./gear";
import {DataManager} from "./datamanager";
import {RawStats} from "./geartypes";

type GearSetSel = SingleCellRowOrHeaderSelect<CharacterGearSet>;

function makeButton(label: string, action: () => void) {
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
    private buttonRow: HTMLDivElement;
    private sheet: GearPlanSheet;

    constructor(sheet: GearPlanSheet, setSelection: (item: CharacterGearSet | undefined) => void) {
        super();
        this.sheet = sheet;
        this.classList.add("gear-plan-table");
        const statColWidth = 40;
        const chanceStatColWidth = 160;
        const multiStatColWidth = 120;
        super.columns = [
            {
                shortName: "actions",
                displayName: "",
                getter: gearSet => gearSet,
                renderer: gearSet => {
                    const div = document.createElement("div");
                    div.appendChild(makeButton('🗑️', () => sheet.delGearSet(gearSet)));
                    div.appendChild(makeButton('📃', () => sheet.addGearSet(gearSet.clone())));
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
                shortName: "mind",
                displayName: "MND",
                getter: gearSet => gearSet.computedStats.mind,
                initialWidth: statColWidth,
            },
            {
                shortName: "crit",
                displayName: "CRT",
                getter: gearSet => ({stat: gearSet.computedStats.crit, chance: gearSet.computedStats.critChance, multiplier: gearSet.computedStats.critDamage}) as ChanceStat,
                renderer: (stats: ChanceStat) => {
                    return chanceStatDisplay(stats);
                },
                initialWidth: chanceStatColWidth,
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: gearSet => ({stat: gearSet.computedStats.dhit, chance: gearSet.computedStats.dhitChance, multiplier: gearSet.computedStats.dhitDamage}) as ChanceStat,
                renderer: (stats: ChanceStat) => {
                    return chanceStatDisplay(stats);
                },
                initialWidth: chanceStatColWidth,
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: gearSet => ({stat: gearSet.computedStats.determination, multiplier: gearSet.computedStats.detDamage}) as MultiplierStat,
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
        const selModel = new SingleSelectionModel<CharacterGearSet, GearSetSel>();
        super.selectionModel = selModel;
        selModel.addListener({
            onNewSelection(newSelection: GearSetSel) {
                if (newSelection instanceof CustomRow) {
                    setSelection(newSelection.dataItem);
                }
                else if (newSelection === undefined) {
                    setSelection(undefined);
                }
            }
        })
        this.buttonRow = document.createElement("div");
        const addRowButton = document.createElement("button");
        addRowButton.textContent = "New Gear Set";
        addRowButton.addEventListener('click', (ev) => {
            const newSet = new CharacterGearSet(this.sheet.dataManager);
            newSet.name = "New Set";
            sheet.addGearSet(newSet);
        });
        this.buttonRow.appendChild(addRowButton)
    }

    addRow(...toAdd: CharacterGearSet[]) {
        // TODO: make this only refresh the specific row
        for (let gearSet of toAdd) {
            gearSet.addListener(() => this.refreshFull());
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
        super.data = [new HeaderRow(), ...this.gearSets, new SpecialRow((table) => this.buttonRow)];
        super.refreshFull();
        // Special case for deleting the currently selected row
        if (curSelection instanceof CustomRow && !(this.gearSets.includes(curSelection.dataItem))) {
            this.selectionModel.clearSelection();
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
function statCallStyler(cell, stat: keyof RawStats, statCssStub: string) {

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


/**
 * Table for displaying gear options for all slots
 */
class GearItemsTable extends CustomTable<GearSlotItem, EquipmentSet> {
    private matMgrs: AllSlotMateriaManager[] = [];

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
                colStyler: (value, cell, node) => statCallStyler(cell, 'crit', 'crit')
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: item => {
                    return item.item.stats.dhit;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCallStyler(cell, 'dhit', 'dhit')
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: item => {
                    return item.item.stats.determination;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCallStyler(cell, 'determination', 'det'),
            },
            {
                shortName: "sps",
                displayName: "SPS",
                getter: item => {
                    return item.item.stats.spellspeed;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCallStyler(cell, 'spellspeed', 'sps')
            },
            {
                shortName: "piety",
                displayName: "PIE",
                getter: item => {
                    return item.item.stats.piety;
                },
                initialWidth: 30,
                colStyler: (value, cell, node) => statCallStyler(cell, 'piety', 'piety')
            },
        ]
        const data: (TitleRow | HeaderRow | GearSlotItem)[] = [];
        const slotMateriaManagers = this.matMgrs;
        for (const [name, slot] of Object.entries(EquipSlots)) {
            data.push(new TitleRow(slot.name));
            data.push(new HeaderRow());
            const itemsInSlot = itemMapping.get(slot.gearSlot);
            for (const gearItem of itemsInSlot) {
                data.push({slot: slot, item: gearItem, slotName: name});
            }
            const matMgr = new AllSlotMateriaManager(dataManager, gearSet, name);
            slotMateriaManagers.push(matMgr);
            data.push(new SpecialRow(tbl => matMgr));
        }
        super.selectionModel = {
            clickCell(cell: CustomCell<GearSlotItem, any>) {

            }, clickColumnHeader(col: CustomColumnDef<GearSlotItem>) {

            }, clickRow(row: CustomRow<GearSlotItem>) {
                gearSet.setEquip(row.dataItem.slotName, row.dataItem.item);
                for (let matMgr of slotMateriaManagers) {
                    matMgr.refresh();
                }
            }, getSelection(): EquipmentSet {
                return gearSet.equipment;
            }, isCellSelectedDirectly(cell: CustomCell<GearSlotItem, any>) {
                return false;
            }, isColumnHeaderSelected(col: CustomColumnDef<GearSlotItem>) {
                return false;
            }, isRowSelected(row: CustomRow<GearSlotItem>) {
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
        const header = document.createElement("h1");
        header.textContent = "Editor Area"
        this.appendChild(header)
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

        const nameEditor = document.createElement("input");
        nameEditor.type = 'text';
        nameEditor.value = gearSet.name;
        nameEditor.addEventListener('input', (e) => {
            gearSet.name = nameEditor.value;
        });
        this.appendChild(nameEditor);

        const table = new GearItemsTable(dataManager, gearSet, itemMapping);
        table.id = "gear-items-table";
        // for (let gearItem of itemsInSlot) {
        //     slotNode.appendChild(new GearItemDisplay(gearItem, selectedItem => gearSet.setEquip(name, {gearItem: selectedItem} as EquippedItem)));
        // }
        this.appendChild(table);
    }
}

/**
 * The top-level gear manager element
 */
export class GearPlanSheet extends HTMLElement {
    gearPlanTable: GearPlanTable;
    private _saveKey: string;
    private _defaultName: string;
    name: string;
    sets: CharacterGearSet[] = [];
    dataManager: DataManager;

    constructor(dataManager: DataManager, editorArea: HTMLElement, sheetKey: string, defaultName: string) {
        super();
        this.dataManager = dataManager;
        this.gearPlanTable = new GearPlanTable(this, item => {
            if (item) {
                editorArea.replaceChildren(new GearSetEditor(this, item, dataManager));
            }
            else {
                editorArea.replaceChildren();
            }
        });
        this.appendChild(this.gearPlanTable);
        this._saveKey = 'sheet-save-' + sheetKey;
        this._defaultName = defaultName;

    }

    loadData() {
        const saved = JSON.parse(localStorage.getItem(this._saveKey)) as SheetExport;
        if (saved) {
            console.log("Found Saved Data")
            this.name = saved.name;
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
                this.addGearSet(set);
            }
        }
        else {
            const set = new CharacterGearSet(this.dataManager);
            set.name = "Default Set";
            this.addGearSet(set);
            this.name = "Default Sheet";
        }
        // needed for empty table
        this.gearPlanTable.dataChanged();
    }

    addGearSet(gearSet: CharacterGearSet) {
        this.sets.push(gearSet);
        this.gearPlanTable.addRow(gearSet);
        gearSet.addListener(() => this.saveData());
        this.saveData();
    }

    delGearSet(gearSet: CharacterGearSet) {
        this.sets = this.sets.filter(gs => gs !== gearSet);
        this.gearPlanTable.delRow(gearSet);
        this.saveData();
    }

    saveData() {
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
                items: items
            };
            sets.push(setExport);
        }
        const fullExport: SheetExport = {
            name: this.name,
            sets: sets
        }
        localStorage.setItem(this._saveKey, JSON.stringify(fullExport));
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
            this.replaceChildren(...equipSlot.melds.map(meld => new SlotMateriaManager(this.dataManager, meld, () => this.gearSet.notifyMateriaChange())));
        }
        else {
            this.textContent = "Select an item to meld materia";
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

/**
 * UI for picking a single materia slot
 */
class SlotMateriaManager extends HTMLElement {
    private materiaSlot: MeldableMateriaSlot;
    private callback: () => void;

    constructor(dataManager: DataManager, materiaSlot: MeldableMateriaSlot, callback: () => void) {
        super();
        this.materiaSlot = materiaSlot;
        this.callback = callback;
        const selector = document.createElement("select");
        const nullOpt = new OptionDataElement(null);
        this.classList.add("slot-materia-manager")
        nullOpt.textContent = "None";
        selector.options.add(nullOpt);
        for (let materiaType of dataManager.materiaTypes) {
            const opt = new OptionDataElement(materiaType);
            const text = materiaType.name + ": " +
                Object.entries(materiaType.stats)
                    .filter(entry => entry[1])
                    .map(entry => `+${entry[1]} ${entry[0]}`);
            const img = document.createElement("img");
            // TODO
            img.src = "https://xivapi.com/" + materiaType.iconUrl;
            opt.appendChild(img);
            opt.appendChild(document.createTextNode(text));
            selector.options.add(opt)
            if (materiaSlot.equippedMatiera === materiaType) {
                selector.selectedIndex = selector.options.length - 1;
            }
        }
        this.replaceChildren(selector);
        selector.addEventListener('change', (event) => {
            const selected = selector.selectedOptions.item(0) as OptionDataElement<Materia>
            materiaSlot.equippedMatiera = selected.dataValue;
            callback();
        })
        this.classList.add("slot-materia-manager")
    }
}

customElements.define("gear-set-editor", GearSetEditor)
customElements.define("gear-plan-table", GearPlanTable, {extends: "table"})
customElements.define("gear-plan", GearPlanSheet)
customElements.define("gear-items-table", GearItemsTable, {extends: "table"})
customElements.define("all-slot-materia-manager", AllSlotMateriaManager)
customElements.define("slot-materia-manager", SlotMateriaManager)
customElements.define("option-data-element", OptionDataElement, {extends: "option"})
