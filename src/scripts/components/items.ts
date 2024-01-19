import {CharacterGearSet, EquippedItem, ItemSingleStatDetail, nonEmptyRelicStats} from "../gear";
import {
    DisplayGearSlot,
    EquipmentSet,
    EquipSlotInfo,
    EquipSlotKey,
    EquipSlots,
    FoodItem,
    GearItem,
    GearSlotItem,
    RawStatKey,
    RawStats,
    StatBonus,
    Substat
} from "../geartypes";
import {
    CustomCell,
    CustomColumn,
    CustomColumnSpec,
    CustomRow,
    CustomTable,
    HeaderRow,
    noopSelectionModel,
    SpecialRow,
    TitleRow
} from "../tables";
import {MateriaSubstat, MateriaSubstats, STAT_ABBREVIATIONS} from "../xivconstants";
import {FieldBoundCheckBox, FieldBoundIntField, labeledCheckbox} from "./util";
import {AllSlotMateriaManager} from "./materia";
import {GearPlanSheet} from "../components";

function statCellStylerRemover(cell: CustomCell<GearSlotItem, any>) {
    cell.classList.remove("secondary");
    cell.classList.remove("primary");
    cell.classList.remove("stat-melded-overcapped");
    cell.classList.remove("stat-melded-overcapped-major");
    cell.classList.remove("stat-melded");
    cell.classList.remove("stat-synced-down")
}

/**
 * Helper to add classes to cells for stats on a gear item.
 *
 * @param cell The cell
 * @param value Either a raw number (fast path for unmelded stats) or ItemSingleStatDetail which
 * describes meld values and whether it has overcapped or not.
 * @param stat The stat
 */
function statCellStyler(cell: CustomCell<GearSlotItem, any>, value: number | ItemSingleStatDetail, stat: keyof RawStats) {

    let isPrimary: boolean = false;
    let isSecondary: boolean = false;
    cell.classList.add("stat-cell", "stat-" + stat);
    if (cell.dataItem.item.isCustomRelic) {
        const current = (value instanceof Object) ? value.fullAmount : value;
        const cap = cell.dataItem.item.statCaps[stat];
        if (cap) {
            if (current >= cap) {
                isPrimary = true;
            }
            else if (current > 0) {
                isSecondary = true;
            }
        }
    }
    else {
        if (cell.dataItem.item.primarySubstat === stat) {
            isPrimary = true;
        }
        else if (cell.dataItem.item.secondarySubstat === stat) {
            isSecondary = true;
        }
    }
    if (isPrimary) {
        cell.classList.add("primary");
        cell.classList.remove("secondary");
    }
    else if (isSecondary) {
        cell.classList.add("secondary");
        cell.classList.remove("primary");
    }
    else {
        cell.classList.remove("secondary");
        cell.classList.remove("primary");
    }

    if (cell._cellValue === 0) {
        cell.classList.add("stat-zero");
    }
    else {
        cell.classList.remove("stat-zero");
    }
    cell.classList.remove("stat-melded-overcapped");
    cell.classList.remove("stat-melded-overcapped-major");
    cell.classList.remove("stat-melded");
    if (value instanceof Object) {
        let modeLabel;
        if (value.mode === 'melded') {
            modeLabel = 'Melded: \n';
            cell.classList.add("stat-melded");
        }
        else if (value.mode === 'melded-overcapped') {
            modeLabel = 'Overcapped: \n';
            cell.classList.add("stat-melded-overcapped");
        }
        else if (value.mode === 'melded-overcapped-major') {
            modeLabel = 'Overcapped: \n';
            cell.classList.add("stat-melded-overcapped-major")
        }
        else if (value.mode === 'synced-down') {
            modeLabel = 'Synced Down: \n';
            cell.classList.add("stat-synced-down")
        }
        else {
            modeLabel = '';
        }
        cell.title = `${modeLabel}${value.fullAmount} / ${value.cap}`;
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

    cell.classList.add("food-stat-cell");
    cell.classList.add("stat-" + stat);
    if (cell.dataItem.primarySubStat === stat) {
        cell.classList.add("primary");
    }
    else if (cell.dataItem.secondarySubStat === stat) {
        cell.classList.add("secondary");
    }
    if (cell._cellValue === 0) {
        cell.classList.add("stat-zero");
    }
}

function makeSpan(text: string, classes: string[] = []) {
    const span = document.createElement('span');
    span.textContent = text;
    span.classList.add(...classes);
    return span;
}

class FoodStatBonus extends HTMLElement {
    constructor(value: StatBonus) {
        super();
        this.appendChild(makeSpan(`+${value.percentage}%`))
        this.appendChild(document.createTextNode(' '));
        this.appendChild(makeSpan(`<${value.max}`, ['food-stat-narrow']));
        this.appendChild(makeSpan(`(max ${value.max})`, ['food-stat-wide']));
    }
}

/**
 * Formats a cell to display the % and max like on a food or tincture.
 *
 * @param value The stat bonus value.
 */
function statBonusDisplay(value: StatBonus) {
    if (value) {
        return new FoodStatBonus(value);
    }
    else {
        return document.createTextNode("");
    }
}

function foodTableStatViewColumn(sheet: GearPlanSheet, item: FoodItem, stat: RawStatKey, highlightPrimarySecondary: boolean = false): CustomColumnSpec<FoodItem, any, any> {
    const wrapped = foodTableStatColumn(sheet, stat, highlightPrimarySecondary);
    return {
        ...wrapped,
        condition: () => (item.primarySubStat === stat || item.secondarySubStat === stat),
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
        condition: () => sheet.isStatRelevant(stat),
        colStyler: (value, cell, node) => {
            cell.classList.add('food-stat-col');
            highlightPrimarySecondary ? foodStatCellStyler(cell, stat) : undefined;
        },
    }

}


export class FoodItemsTable extends CustomTable<FoodItem, FoodItem> {
    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet) {
        super();
        this.classList.add("food-items-table");
        this.classList.add("hoverable")
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
                    image.setAttribute('intrinsicsize', '64x64');
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
                // renderer: name => {
                //     return quickElement('div', [], [document.createTextNode(name)]);
                // }
                // initialWidth: 200,
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
        this.selectionModel = {
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
        const displayItems = [...sheet.foodItemsForDisplay];
        displayItems.sort((left, right) => left.ilvl - right.ilvl);
        if (displayItems.length > 0) {
            super.data = [new HeaderRow(), ...displayItems];
        }
        else {
            super.data = [new HeaderRow(), new TitleRow('No items available - please check your filters')];
        }
    }
}

export class FoodItemViewTable extends CustomTable<FoodItem, FoodItem> {
    constructor(sheet: GearPlanSheet, item: FoodItem) {
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
                    image.setAttribute('intrinsicsize', '64x64');
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
                // renderer: name => {
                //     return quickElement('div', [], [document.createTextNode(name)]);
                // }
                // initialWidth: 200,
            },
            foodTableStatViewColumn(sheet, item, 'vitality'),
            foodTableStatViewColumn(sheet, item, 'crit', true),
            foodTableStatViewColumn(sheet, item, 'dhit', true),
            foodTableStatViewColumn(sheet, item, 'determination', true),
            foodTableStatViewColumn(sheet, item, 'spellspeed', true),
            foodTableStatViewColumn(sheet, item, 'skillspeed', true),
            foodTableStatViewColumn(sheet, item, 'piety', true),
            foodTableStatViewColumn(sheet, item, 'tenacity', true),
        ]
        this.selectionModel = noopSelectionModel;
        super.data = [new HeaderRow(), item];
    }
}

class RelicCellInfo {
    constructor(public set: CharacterGearSet, public item: GearItem, public slotId: EquipSlotKey, public stat: Substat) {
    }
}

function itemTableStatColumn(sheet: GearPlanSheet, set: CharacterGearSet, stat: RawStatKey, highlightPrimarySecondary: boolean = false): CustomColumnSpec<GearSlotItem, number | ItemSingleStatDetail | RelicCellInfo, any> {
    return {
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: slotItem => {
            const item = slotItem.item;
            if (item.isCustomRelic
                && item.stats[stat] === 0
                && MateriaSubstats.includes(stat as MateriaSubstat)) {
                const currentEquipment: EquippedItem = set.equipment[slotItem.slotId];
                if (currentEquipment && currentEquipment.gearItem !== item) {
                    const preview = set.toEquippedItem(item);
                    if (nonEmptyRelicStats(preview.relicStats)) {
                        return set.getEquipStatDetail(preview, stat);
                    }
                }
                return new RelicCellInfo(set, item, slotItem.slotId, stat as Substat);
            }
            else {
                const selected = set.getItemInSlot(slotItem.slotId) === item;
                if (selected) {
                    return set.getStatDetail(slotItem.slotId, stat);
                }
                else {
                    if (item.isSyncedDown) {
                        const unsynced = item.unsyncedVersion.stats[stat];
                        const synced = item.stats[stat];
                        if (synced < unsynced) {
                            return {
                                effectiveAmount: synced,
                                fullAmount: unsynced,
                                overcapAmount: unsynced - synced,
                                cap: synced,
                                mode: "synced-down"
                            }
                        }
                        else {
                            return synced;
                        }
                    }
                    else {
                        return item.stats[stat];
                    }
                }
            }
        },
        renderer: (value: number | ItemSingleStatDetail | RelicCellInfo) => {
            if (value instanceof RelicCellInfo) {
                const equipment: EquippedItem = value.set.equipment[value.slotId];
                if (equipment && equipment.gearItem === value.item) {
                    if (equipment.relicStats[value.stat] === undefined) {
                        equipment.relicStats[value.stat] = 0;
                    }
                    if (sheet.isViewOnly) {
                        const cap = equipment.gearItem.statCaps[stat];
                        if (cap) {
                            return document.createTextNode(Math.min(equipment.relicStats[stat], cap).toString());
                        }
                        else {
                            return document.createTextNode(equipment.relicStats[stat].toString());
                        }
                    }
                    else {
                        const inputSubstatCap = equipment.gearItem.unsyncedVersion.statCaps[value.stat] ?? 1000;
                        const input = new FieldBoundIntField(equipment.relicStats, value.stat, {
                            postValidators: [ctx => {
                                if (ctx.newValue < 0) {
                                    ctx.failValidation('Must be greater than zero');
                                }
                                else if (ctx.newValue > inputSubstatCap) {
                                    ctx.failValidation(`Must be less than ${inputSubstatCap}`);
                                }
                            }]
                        });
                        const cap = equipment.gearItem.statCaps[stat] ?? 9999;
                        const titleListener = () => {
                            const newValue = equipment.relicStats[stat];
                            if (newValue > cap) {
                                input.title = `Synced down:\n${newValue}/${cap}`;
                            }
                            else {
                                delete input.title;
                            }
                        }
                        input.addListener(titleListener);
                        titleListener();
                        input.type = 'number';
                        input.pattern = '[0-9]*';
                        input.inputMode = 'number';
                        input.classList.add('gear-items-table-relic-stat-input');
                        input.addListener(() => value.set.forceRecalc());
                        return input;
                    }
                }
                else {
                    return null;
                }
            }
            else if (value instanceof Object) {
                return document.createTextNode(value.effectiveAmount.toString());
            }
            else {
                return document.createTextNode(value.toString());
            }
        },
        initialWidth: 33,
        condition:
            () => sheet.isStatRelevant(stat),
        colStyler:
            (value, cell, node) => {
                if (highlightPrimarySecondary) {
                    if (value instanceof RelicCellInfo) {
                        statCellStylerRemover(cell);
                    }
                    else {
                        statCellStyler(cell, value, stat)
                    }
                }
            },
    }
}

/**
 * Table for displaying gear options for all slots
 aa*/
export class GearItemsTable extends CustomTable<GearSlotItem, EquipmentSet> {
    private readonly materiaManagers: AllSlotMateriaManager[];
    private selectionTracker: Map<keyof EquipmentSet, CustomRow<GearSlotItem> | GearSlotItem>;

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet, itemMapping: Map<DisplayGearSlot, GearItem[]>, handledSlots?: EquipSlotKey[]) {
        super();
        this.classList.add("gear-items-table");
        this.classList.add("gear-items-edit-table");
        this.classList.add("hoverable");
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
                    image.setAttribute('intrinsicsize', '64x64');
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
                colStyler: (value, colElement, internalElement, rowValue) => {
                    colElement.title = `${value} (${rowValue.item.id})`;
                }
            },
            {
                shortName: "mats",
                displayName: "Mat",
                getter: item => {
                    return item.item;
                },
                initialWidth: 30,
                renderer: (value: GearItem) => {
                    const span = document.createElement('span');
                    if (value.isSyncedDown) {
                        span.textContent = value.unsyncedVersion.materiaSlots.length.toString();
                        span.style.textDecoration = "line-through";
                        span.style.opacity = "50%";
                        span.title = "Melds unavailable due to ilvl sync";
                    }
                    else {
                        span.textContent = value.materiaSlots.length.toString();
                    }
                    return span;
                }
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
            if (slotId === 'Weapon') {
                data.push(new SpecialRow(table => {
                    // Weapons have the option to display relics that violate the ilvl range
                    const div = document.createElement('div');
                    div.classList.add('weapon-ilvl-bypass-setting');
                    const text = document.createElement('span');
                    text.textContent = slot.name;
                    div.appendChild(text);

                    const cb = new FieldBoundCheckBox(sheet.itemDisplaySettings, 'higherRelics');
                    div.appendChild(labeledCheckbox('Display relics above max ilvl setting', cb));
                    return div;
                }));
            }
            else {
                data.push(new TitleRow(slot.name));
            }
            const itemsInSlot = itemMapping.get(slot.gearSlot);
            // Also display selected item
            const selection = gearSet.getItemInSlot(slotId);
            if (selection) {
                if (!itemsInSlot.includes(selection)) {
                    itemsInSlot.push(selection);
                }
            }
            if (itemsInSlot && itemsInSlot.length > 0) {
                const sortedItems = [...itemsInSlot];
                sortedItems.sort((left, right) => left.ilvl - right.ilvl);
                data.push(new HeaderRow());
                for (const gearItem of sortedItems) {
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
            }
            else {
                data.push(new TitleRow('No items available - please check your filters'));
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
        this.selectionModel = {
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

/**
 * Table for displaying only equipped items, read-only
 */
export class GearItemsViewTable extends CustomTable<GearSlotItem, EquipmentSet> {

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet, itemMapping: Map<EquipSlotKey, GearItem>, handledSlots?: EquipSlotKey[]) {
        super();
        this.classList.add("gear-items-table");
        this.classList.add("gear-items-view-table");
        super.columns = [
            {
                shortName: "ilvl",
                displayName: "",
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
                    image.setAttribute('intrinsicsize', '64x64');
                    image.src = img.toString();
                    return image;
                },
            },
            {
                shortName: "itemname",
                displayName: handledSlots && handledSlots.length > 0 ? EquipSlotInfo[handledSlots[0]].name : "Name",
                getter: item => {
                    return item.item.name;
                },
                // initialWidth: 300,
            },
            // {
            //     shortName: "mats",
            //     displayName: "Mat",
            //     getter: item => {
            //         return item.item.materiaSlots.length;
            //     },
            //     initialWidth: 30,
            // },
            // {
            //     shortName: "wd",
            //     displayName: "WD",
            //     getter: item => {
            //         // return Math.max(item.item.stats.wdMag, item.item.stats.wdPhys);
            //         return Math.max(item.item.stats.wdMag, item.item.stats.wdPhys);
            //     },
            //     renderer: value => {
            //         if (value) {
            //             return document.createTextNode(value);
            //         }
            //         else {
            //             return document.createTextNode("");
            //         }
            //     },
            //     initialWidth: 30,
            //     condition: () => handledSlots === undefined || handledSlots.includes('Weapon'),
            // },
            // itemTableStatColumn(sheet, gearSet, 'vitality'),
            // itemTableStatColumn(sheet, gearSet, 'strength'),
            // itemTableStatColumn(sheet, gearSet, 'dexterity'),
            // itemTableStatColumn(sheet, gearSet, 'intelligence'),
            // itemTableStatColumn(sheet, gearSet, 'mind'),
            itemTableStatColumn(sheet, gearSet, 'crit', true),
            itemTableStatColumn(sheet, gearSet, 'dhit', true),
            itemTableStatColumn(sheet, gearSet, 'determination', true),
            itemTableStatColumn(sheet, gearSet, 'spellspeed', true),
            itemTableStatColumn(sheet, gearSet, 'skillspeed', true),
            itemTableStatColumn(sheet, gearSet, 'piety', true),
            itemTableStatColumn(sheet, gearSet, 'tenacity', true),
        ]
        const data: (TitleRow | HeaderRow | GearSlotItem)[] = [];
        // Track the selected item in every category so that it can be more quickly refreshed
        data.push(new HeaderRow());
        for (const [name, slot] of Object.entries(EquipSlotInfo)) {
            if (handledSlots && !handledSlots.includes(name as EquipSlotKey)) {
                continue;
            }
            const slotId = name as keyof EquipmentSet;
            const equippedItem = itemMapping.get(slot.slot);
            if (equippedItem) {
                const item = {
                    slot: slot,
                    item: equippedItem,
                    slotId: slotId
                };
                data.push(item);
                if (!equippedItem.isCustomRelic) {
                    // TODO: make this readonly properly
                    const matMgr = new AllSlotMateriaManager(sheet, gearSet, slotId);
                    data.push(new SpecialRow(tbl => matMgr));
                }
            }
        }
        this.selectionModel = noopSelectionModel;
        this.data = data;
    }

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
customElements.define("gear-items-view-table", GearItemsViewTable, {extends: "table"});
customElements.define("food-items-table", FoodItemsTable, {extends: "table"});
customElements.define("food-items-view-table", FoodItemViewTable, {extends: "table"});
customElements.define("ilvl-range-picker", ILvlRangePicker);
customElements.define("food-stat-bonus", FoodStatBonus);
