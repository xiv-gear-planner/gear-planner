import {CharacterGearSet, ItemSingleStatDetail} from "../gear";
import {
    EquipmentSet,
    EquipSlots,
    EquipSlotInfo,
    FoodItem,
    GearItem,
    GearSlot,
    GearSlotItem,
    RawStatKey,
    RawStats,
    StatBonus, EquipSlotKey, GearSlots
} from "../geartypes";
import {
    CustomCell,
    CustomColumn,
    CustomColumnSpec,
    CustomRow,
    CustomTable,
    HeaderRow,
    SpecialRow,
    TitleRow
} from "../tables";
import {STAT_ABBREVIATIONS} from "../xivconstants";
import {FieldBoundIntField} from "./util";
import {AllSlotMateriaManager} from "./materia";
import {GearPlanSheet} from "../components";

/**
 * Helper to add classes to cells for stats on a gear item.
 *
 * @param cell The cell
 * @param value Either a raw number (fast path for unmelded stats) or ItemSingleStatDetail which
 * describes meld values and whether it has overcapped or not.
 * @param stat The stat
 */
function statCellStyler(cell: CustomCell<GearSlotItem, any>, value: number | ItemSingleStatDetail, stat: keyof RawStats) {

    cell.classList.add("stat-" + stat);
    if (cell.dataItem.item.primarySubstat === stat) {
        cell.classList.add("primary");
    }
    else if (cell.dataItem.item.secondarySubstat === stat) {
        cell.classList.add("secondary");
    }
    if (cell._value === 0) {
        cell.classList.add("stat-zero");
    }
    else {
        cell.classList.remove("stat-zero");
    }
    cell.classList.remove("stat-melded-overcapped");
    cell.classList.remove("stat-melded-overcapped-major");
    cell.classList.remove("stat-melded");
    if (value instanceof Object) {
        cell.title = `${value.fullAmount} / ${value.cap}`;
        if (value.mode === 'melded') {
            cell.classList.add("stat-melded");
        }
        else if (value.mode === 'melded-overcapped') {
            cell.classList.add("stat-melded-overcapped");
        }
        else if (value.mode === 'melded-overcapped-major') {
            cell.classList.add("stat-melded-overcapped-major")
        }
    }
    else {
        delete cell.title;
    }
}

/**
 * Like statCellStyle, but for food items.
 *
 * @param cell The cell
 * @param stat The stat
 */
function foodStatCellStyler(cell: CustomCell<FoodItem, any>, stat: keyof RawStats) {

    cell.classList.add("stat-" + stat);
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

/**
 * Formats a cell to display the % and max like on a food or tincture.
 *
 * @param value The stat bonus value.
 */
function statBonusDisplay(value: StatBonus) {
    if (value) {
        return document.createTextNode(`+${value.percentage}% (max ${value.max})`);
    }
    else {
        return document.createTextNode("");
    }
}

function foodTableStatColumn(sheet: GearPlanSheet, stat: RawStatKey, highlightPrimarySecondary: boolean = false): CustomColumnSpec<FoodItem, any, any> {
    return {
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: item => {
            return item.bonuses[stat];
        },
        renderer: statBonusDisplay,
        initialWidth: 120,
        condition: () => sheet.isStatRelevant(stat),
        colStyler: (value, cell, node) => highlightPrimarySecondary ? foodStatCellStyler(cell, stat) : undefined,
    }

}

export class FoodItemsTable extends CustomTable<FoodItem, FoodItem> {
    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet) {
        super();
        this.classList.add("food-items-table");
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
            foodTableStatColumn(sheet, 'vitality'),
            foodTableStatColumn(sheet, 'crit', true),
            foodTableStatColumn(sheet, 'dhit', true),
            foodTableStatColumn(sheet, 'determination', true),
            foodTableStatColumn(sheet, 'spellspeed', true),
            foodTableStatColumn(sheet, 'skillspeed', true),
            foodTableStatColumn(sheet, 'piety', true),
            foodTableStatColumn(sheet, 'tenacity', true),
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
        super.data = [new HeaderRow(), ...sheet.foodItemsForDisplay];
    }
}

function itemTableStatColumn(sheet: GearPlanSheet, set: CharacterGearSet, stat: RawStatKey, highlightPrimarySecondary: boolean = false): CustomColumnSpec<GearSlotItem, number | ItemSingleStatDetail, any> {
    return {
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: slotItem => {
            const selected = set.getItemInSlot(slotItem.slotId) === slotItem.item;
            if (selected) {
                return set.getStatDetail(slotItem.slotId, stat);
            }
            else {
                return slotItem.item.stats[stat];
            }
        },
        renderer: (item: number | ItemSingleStatDetail) => {
            if (item instanceof Object) {
                return document.createTextNode(item.effectiveAmount.toString());
            }
            else {
                return document.createTextNode(item.toString());
            }
        },
        initialWidth: 30,
        condition: () => sheet.isStatRelevant(stat),
        colStyler: (value, cell, node) => highlightPrimarySecondary ? statCellStyler(cell, value, stat) : undefined,
    }
}

/**
 * Table for displaying gear options for all slots
 */
export class GearItemsTable extends CustomTable<GearSlotItem, EquipmentSet> {
    private readonly materiaManagers: AllSlotMateriaManager[];
    private selectionTracker: Map<keyof EquipmentSet, CustomRow<GearSlotItem> | GearSlotItem>;

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet, itemMapping: Map<GearSlot, GearItem[]>, handledSlots?: EquipSlotKey[]) {
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
                condition: () => handledSlots === undefined || handledSlots.includes('Weapon'),
            },
            itemTableStatColumn(sheet, gearSet, 'vitality'),
            itemTableStatColumn(sheet, gearSet, 'strength'),
            itemTableStatColumn(sheet, gearSet, 'dexterity'),
            itemTableStatColumn(sheet, gearSet, 'intelligence'),
            itemTableStatColumn(sheet, gearSet, 'mind'),
            itemTableStatColumn(sheet, gearSet, 'crit', true),
            itemTableStatColumn(sheet, gearSet, 'dhit', true),
            itemTableStatColumn(sheet, gearSet, 'determination', true),
            itemTableStatColumn(sheet, gearSet, 'spellspeed', true),
            itemTableStatColumn(sheet, gearSet, 'skillspeed', true),
            itemTableStatColumn(sheet, gearSet, 'piety', true),
            itemTableStatColumn(sheet, gearSet, 'tenacity', true),
        ]
        const data: (TitleRow | HeaderRow | GearSlotItem)[] = [];
        const slotMateriaManagers = new Map<keyof EquipmentSet, AllSlotMateriaManager>();
        this.materiaManagers = [];
        // Track the selected item in every category so that it can be more quickly refreshed
        const selectionTracker = new Map<keyof EquipmentSet, CustomRow<GearSlotItem> | GearSlotItem>();
        this.selectionTracker = selectionTracker;
        const refreshSingleItem = (item: CustomRow<GearSlotItem> | GearSlotItem) => this.refreshRowData(item);
        for (const [name, slot] of Object.entries(EquipSlotInfo)) {
            if (handledSlots && !handledSlots.includes(name as EquipSlotKey)) {
                continue;
            }
            const slotId = name as keyof EquipmentSet;
            data.push(new TitleRow(slot.name));
            data.push(new HeaderRow());
            const itemsInSlot = itemMapping.get(slot.gearSlot);
            for (const gearItem of itemsInSlot) {
                const item = {
                    slot: slot,
                    item: gearItem,
                    slotId: slotId
                };
                data.push(item);
                if (gearSet.getItemInSlot(slotId) === gearItem) {
                    selectionTracker.set(slotId, item);
                }
            }
            const matMgr = new AllSlotMateriaManager(sheet, gearSet, slotId, () => {
                // Update whatever was selected
                const prevSelection = selectionTracker.get(slotId);
                if (prevSelection) {
                    refreshSingleItem(prevSelection);
                }

            });
            this.materiaManagers.push(matMgr);
            slotMateriaManagers.set(slotId, matMgr);
            data.push(new SpecialRow(tbl => matMgr));
        }
        super.selectionModel = {
            clickCell(cell: CustomCell<GearSlotItem, any>) {

            },
            clickColumnHeader(col: CustomColumn<GearSlotItem>) {

            },
            clickRow(newSelection: CustomRow<GearSlotItem>) {
                // refreshSingleItem old and new items
                gearSet.setEquip(newSelection.dataItem.slotId, newSelection.dataItem.item, sheet.materiaAutoFillController);
                const matMgr = slotMateriaManagers.get(newSelection.dataItem.slotId);
                if (matMgr) {
                    matMgr.refresh();
                }
                const oldSelection = selectionTracker.get(newSelection.dataItem.slotId);
                if (oldSelection) {
                    refreshSingleItem(oldSelection);
                }
                if (newSelection) {
                    refreshSingleItem(newSelection);
                }
                selectionTracker.set(newSelection.dataItem.slotId, newSelection);
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
                return gearSet.getItemInSlot(row.dataItem.slotId) === row.dataItem.item;
            },
            clearSelection() {
                // no-op
            }
        };
        this.data = data;
    }

    refreshMateria() {
        this.materiaManagers.forEach(mgr => mgr.refresh());
        for (let equipSlot of EquipSlots) {
            const selection = this.selectionTracker.get(equipSlot);
            if (selection) {
                this.refreshRowData(selection);
            }
        }

    }
}

export interface ItemDisplaySettings {
    minILvl: number,
    maxILvl: number,
    minILvlFood: number,
    maxILvlFood: number,
}

export class ILvlRangePicker<ObjType> extends HTMLElement {
    private _listeners: ((min: number, max: number) => void)[] = [];
    private obj: ObjType;
    private minField: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType];
    private maxField: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType];

    constructor(obj: ObjType, minField: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], maxField: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], label: string | undefined) {
        super();
        this.obj = obj;
        this.minField = minField;
        this.maxField = maxField;
        this.classList.add('ilvl-range-picker');

        if (label) {
            const labelElement = document.createElement('span');
            labelElement.textContent = label;
            this.appendChild(labelElement);
        }

        const lowerBoundControl = new FieldBoundIntField(obj, minField, {
            postValidators: [(ctx) => {
                if (ctx.newValue >= (obj[maxField] as number)) {
                    ctx.failValidation('Minimum level must be less than the maximum level');
                }
            }]
        });
        const upperBoundControl = new FieldBoundIntField(obj, maxField, {
            postValidators: [(ctx) => {
                if (ctx.newValue <= (obj[minField] as number)) {
                    ctx.failValidation('Maximum level must be greater than the minimum level');
                }
            }]
        });
        lowerBoundControl.addListener(() => this.runListeners());
        upperBoundControl.addListener(() => this.runListeners());
        const hyphen = document.createElement('span');
        hyphen.textContent = '-';
        this.appendChild(lowerBoundControl);
        this.appendChild(hyphen);
        this.appendChild(upperBoundControl);
    }

    addListener(listener: (min: number, max: number) => void) {
        this._listeners.push(listener);
    }

    private runListeners() {
        for (let listener of this._listeners) {
            listener(this.obj[this.minField] as number, this.obj[this.maxField] as number);
        }
    }
}

customElements.define("gear-items-table", GearItemsTable, {extends: "table"});
customElements.define("food-items-table", FoodItemsTable, {extends: "table"});
customElements.define("ilvl-range-picker", ILvlRangePicker);
