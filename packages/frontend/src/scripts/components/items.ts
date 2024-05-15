import {CharacterGearSet, ItemSingleStatDetail, nonEmptyRelicStats} from "../gear";
import {
    DisplayGearSlot,
    EquipmentSet,
    EquippedItem,
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
} from "@xivgear/xivmath/geartypes";
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
import {
    formatAcquisitionSource,
    MateriaSubstat,
    MateriaSubstats,
    STAT_ABBREVIATIONS
} from "@xivgear/xivmath/xivconstants";
import {FieldBoundCheckBox, FieldBoundIntField, labeledCheckbox, makeChevronDown} from "./util";
import {AllSlotMateriaManager} from "./materia";
import {GearPlanSheet} from "../components";
import {shortenItemName} from "../util/strutils";
import {makeRelicStatEditor} from "../relicstats/relicstats";

function statCellStylerRemover(cell: CustomCell<GearSlotItem, any>) {
    cell.classList.remove("secondary");
    cell.classList.remove("primary");
    cell.classList.remove("stat-melded-overcapped");
    cell.classList.remove("stat-melded-overcapped-major");
    cell.classList.remove("stat-melded");
    cell.classList.remove("stat-synced-down");
    cell.classList.remove("stat-cell");
}

/**
 * Helper to add classes to cells for stats on a gear item.
 *
 * @param cell The cell
 * @param value Either a raw number (fast path for unmelded stats) or ItemSingleStatDetail which
 * describes meld values and whether it has overcapped or not.
 * @param stat The stat
 */
function statCellStyler(cell: CustomCell<GearSlotItem, any>, value: ItemSingleStatDetail, stat: keyof RawStats) {

    let isPrimary: boolean = false;
    let isSecondary: boolean = false;
    cell.classList.add("stat-cell", "stat-" + stat);
    if (cell.dataItem.item.isCustomRelic) {
        const current = value.fullAmount;
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

    if (value.effectiveAmount === 0) {
        cell.classList.add("stat-zero");
    }
    else {
        cell.classList.remove("stat-zero");
    }
    cell.classList.remove("stat-melded-overcapped");
    cell.classList.remove("stat-melded-overcapped-major");
    cell.classList.remove("stat-melded");
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
        cell.classList.add("stat-melded-overcapped-major");
    }
    else if (value.mode === 'synced-down') {
        modeLabel = 'Synced Down: \n';
        cell.classList.add("stat-synced-down");
    }
    else {
        modeLabel = '';
    }
    cell.title = `${modeLabel}${value.fullAmount} / ${value.cap}`;
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
        this.appendChild(makeSpan(`+${value.percentage}%`));
        this.appendChild(document.createTextNode(' '));
        this.appendChild(makeSpan(`≤${value.max}`, ['food-stat-narrow']));
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
        this.classList.add("hoverable");
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
                displayName: "",
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
                displayName: "Food",
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

function itemTableStatColumn(sheet: GearPlanSheet, set: CharacterGearSet, stat: RawStatKey, highlightPrimarySecondary: boolean = false): CustomColumnSpec<GearSlotItem, ItemSingleStatDetail | RelicCellInfo, any> {
    return {
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: slotItem => {
            const item = slotItem.item;
            // If custom relic, and the value is editable, then
            if (item.isCustomRelic
                && item.stats[stat] === 0
                && MateriaSubstats.includes(stat as MateriaSubstat)) {
                const currentEquipment: EquippedItem = set.equipment[slotItem.slotId];
                // If not equipped, and there is a saved set of stats for that relic, display them
                // after syncing down and such
                if (currentEquipment && currentEquipment.gearItem !== item) {
                    const preview = set.toEquippedItem(item);
                    if (nonEmptyRelicStats(preview.relicStats)) {
                        return set.getEquipStatDetail(preview, stat);
                    }
                }
                // If it is equipped, then display the relic cell editor
                return new RelicCellInfo(set, item, slotItem.slotId, stat as Substat);
            }
            else {
                // Not a relic, or not an editable stat. Display normally
                const selected = set.getItemInSlot(slotItem.slotId) === item;
                if (selected) {
                    return set.getStatDetail(slotItem.slotId, stat);
                }
                else {
                    return set.previewItemStatDetail(item, stat);
                }
            }
        },
        renderer: (value: ItemSingleStatDetail | RelicCellInfo) => {
            // First, check if the cell is an editable relic stat
            if (value instanceof RelicCellInfo) {
                const equipment: EquippedItem = value.set.equipment[value.slotId];
                // Then, check if equipped.
                if (equipment && equipment.gearItem === value.item) {
                    if (equipment.relicStats[value.stat] === undefined) {
                        equipment.relicStats[value.stat] = 0;
                    }
                    // If read-only, display stat normally
                    if (sheet.isViewOnly) {
                        const cap = equipment.gearItem.statCaps[stat];
                        if (cap) {
                            return document.createTextNode(Math.min(equipment.relicStats[stat], cap).toString());
                        }
                        else {
                            return document.createTextNode(equipment.relicStats[stat].toString());
                        }
                    }
                    // If not, display the editor
                    else {
                        return makeRelicStatEditor(equipment, value.stat, set);
                    }
                }
                else {
                    return null;
                }
            }
            return document.createTextNode(value.effectiveAmount.toString());
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
                else {
                    cell.classList.add('stat-cell');
                }
            },
    }
}

// TODO: this is generic, so move it out
class ShowHideButton extends HTMLElement {
    private _hidden: boolean;

    constructor(initiallyHidden: boolean = false, private setter: (newValue: boolean) => void) {
        super();
        this._hidden = initiallyHidden;
        this.appendChild(makeChevronDown());
        this.setStyles();
    }

    get isHidden(): boolean {
        return this._hidden;
    }

    set isHidden(hide: boolean) {
        this._hidden = hide;
        this.setStyles();
        this.setter(hide);
    }

    toggle(): void {
        this.isHidden = !this.isHidden;
    }

    private setStyles() {
        if (this.isHidden) {
            this.classList.add('hidden');
        }
        else {
            this.classList.remove('hidden');
        }
    }
}

function makeShowHideRow(label: string, initiallyHidden: boolean = false, setter: (newValue: boolean) => void, extraElements: HTMLElement[] = []): SpecialRow<GearSlotItem, EquipmentSet> {

    const showHide = new ShowHideButton(initiallyHidden, setter);

    return new SpecialRow<GearSlotItem, EquipmentSet>(
        tbl => {
            const div = document.createElement('div');
            div.classList.add('special-row-holder');
            const text = document.createElement('span');
            text.textContent = label;
            div.appendChild(text);
            // div.classList.add('weapon-ilvl-bypass-setting');
            div.appendChild(showHide);
            extraElements.forEach(el => {
                div.appendChild(el);
            });
            return div;
        }, row => {
            row.addEventListener('click', () => showHide.toggle());
            if (row.cells.length) {
                row.cells.item(0).classList.add('hoverable');
            }
        }
    )
}

/**
 * Table for displaying gear options for all slots
 aa*/
export class GearItemsTable extends CustomTable<GearSlotItem, EquipmentSet> {
    private readonly materiaManagers: AllSlotMateriaManager[];
    private selectionTracker: Map<keyof EquipmentSet, CustomRow<GearSlotItem> | GearSlotItem>;

    constructor(sheet: GearPlanSheet, private readonly gearSet: CharacterGearSet, itemMapping: Map<DisplayGearSlot, GearItem[]>, handledSlots?: EquipSlotKey[]) {
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
                renderer: (name: string) => {
                    return document.createTextNode(shortenItemName(name));
                },
                colStyler: (value, colElement, internalElement, rowValue) => {
                    colElement.title = `${value} (${rowValue.item.id})`;
                    const formattedAcqSrc = formatAcquisitionSource(rowValue.item.acquisitionType);
                    if (formattedAcqSrc) {
                        colElement.title += `\nAcquired from: ${formattedAcqSrc}`;
                    }
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
                initialWidth: 33,
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
            const extras = [];
            if (slotId === 'Weapon') {
                const cb = new FieldBoundCheckBox(sheet.itemDisplaySettings, 'higherRelics');
                const lcb = labeledCheckbox('Display relics above max ilvl setting', cb);
                extras.push(lcb);
            }
            // TODO: initial value needs to apply to this
            // TODO: just make the getters/setters on this class instead
            data.push(makeShowHideRow(slot.name, gearSet.isSlotCollapsed(slotId), (val) => {
                gearSet.setSlotCollapsed(slotId, val);
                this.updateShowHide();
            }, extras));
            let itemsInSlot = itemMapping.get(slot.gearSlot);
            if (itemsInSlot === undefined) {
                itemsInSlot = [];
            }
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
        this.updateShowHide();
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

    private updateShowHide() {
        this.dataRowMap.forEach((row, value) => {
            if (this.gearSet.isSlotCollapsed(value.slotId) && !this.selectionModel.isRowSelected(row)) {
                row.style.display = 'none';
            }
            else {
                row.style.display = '';
            }
        })
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
        let headingText = handledSlots && handledSlots.length > 0 ? EquipSlotInfo[handledSlots[0]].name : "Name";
        const data: (TitleRow | HeaderRow | GearSlotItem)[] = [];
        // Track the selected item in every category so that it can be more quickly refreshed
        data.push(new HeaderRow());
        let slotItem: GearItem = null;
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
                slotItem = equippedItem;
                data.push(item);
                if (!equippedItem.isCustomRelic) {
                    // TODO: make this readonly properly
                    const matMgr = new AllSlotMateriaManager(sheet, gearSet, slotId);
                    data.push(new SpecialRow(tbl => matMgr));
                }
            }
        }
        if (slotItem) {
            const acqSource = formatAcquisitionSource(slotItem.acquisitionType);
            if (acqSource) {
                headingText = `${headingText}: ${acqSource}`;
            }
        }
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
                displayName: headingText,
                getter: item => {
                    return item.item.name;
                },
                renderer: (name: string) => {
                    return document.createTextNode(shortenItemName(name));
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
customElements.define("show-hide-button", ShowHideButton);
