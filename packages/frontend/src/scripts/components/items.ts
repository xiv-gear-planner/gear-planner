import {CharacterGearSet, ItemSingleStatDetail, previewItemStatDetail} from "@xivgear/core/gear";
import {
    DisplayGearSlot,
    EquipmentSet,
    EquippedItem,
    EquipSlotInfo,
    EquipSlotKey,
    EquipSlots,
    FoodItem,
    FoodStatBonus,
    GearItem,
    GearSlotItem,
    RawStatKey,
    RawStats,
    Substat,
    XivItem
} from "@xivgear/xivmath/geartypes";
import {
    CellRenderer,
    col,
    CustomCell,
    CustomColumn,
    CustomColumnSpec,
    CustomRow,
    CustomTable,
    HeaderRow,
    SpecialRow,
    TableSelectionModel,
    TitleRow
} from "@xivgear/common-ui/table/tables";
import {
    ALL_SUB_STATS,
    formatAcquisitionSource,
    MateriaSubstat,
    MateriaSubstats,
    STAT_ABBREVIATIONS
} from "@xivgear/xivmath/xivconstants";
import {
    FieldBoundCheckBox,
    FieldBoundIntField,
    labeledCheckbox,
    makeActionButton,
    makeTrashIcon,
    quickElement
} from "@xivgear/common-ui/components/util";
import {AllSlotMateriaManager} from "./materia";
import {shortenItemName} from "@xivgear/util/strutils";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {makeRelicStatEditor} from "./relic_stats";
import {ShowHideButton, ShowHideCallback} from "@xivgear/common-ui/components/show_hide_chevron";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {recordSheetEvent} from "../analytics/analytics";

function removeStatCellStyles(cell: CustomCell<GearSlotItem, unknown>) {
    cell.classList.remove("secondary");
    cell.classList.remove("primary");
    cell.classList.remove("stat-melded-overcapped");
    cell.classList.remove("stat-melded-overcapped-major");
    cell.classList.remove("stat-melded");
    cell.classList.remove("stat-synced-down");
    cell.classList.remove("stat-cell");
    delete cell.title;
}

/**
 * Helper to add classes to cells for stats on a gear item.
 *
 * @param cell The cell
 * @param value Either a raw number (fast path for unmelded stats) or ItemSingleStatDetail which
 * describes meld values and whether it has overcapped or not.
 * @param stat The stat
 */
function applyStatCellStyles(cell: CustomCell<GearSlotItem, unknown>, value: ItemSingleStatDetail, stat: keyof RawStats) {

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
    cell.classList.remove("stat-melded-overcapped", "stat-melded-overcapped-major", "stat-melded", "stat-synced-down");
    if (value.mode === 'melded') {
        cell.classList.add("stat-melded");
    }
    else if (value.mode === 'melded-overcapped') {
        cell.classList.add("stat-melded-overcapped");
    }
    else if (value.mode === 'melded-overcapped-major') {
        cell.classList.add("stat-melded-overcapped-major");
    }
    else if (value.mode === 'synced-down') {
        cell.classList.add("stat-synced-down");
    }
}

function statCellTitle(value: ItemSingleStatDetail): string {
    let modeLabel;
    if (value.mode === 'melded') {
        modeLabel = 'Melded: \n';
    }
    else if (value.mode === 'melded-overcapped') {
        modeLabel = 'Overcapped: \n';
    }
    else if (value.mode === 'melded-overcapped-major') {
        modeLabel = 'Overcapped: \n';
    }
    else if (value.mode === 'synced-down') {
        modeLabel = 'Synced Down: \n';
    }
    else {
        modeLabel = '';
    }
    return `${modeLabel}${value.fullAmount} / ${value.cap}`;
}

/**
 * Like statCellStyle, but for food items.
 *
 * @param cell The cell
 * @param stat The stat
 */
function foodStatCellStyler(cell: CustomCell<FoodItem, unknown>, stat: keyof RawStats) {

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

class FoodStatBonusDisplay extends HTMLElement {
    constructor(value: FoodStatBonusWithEffective) {
        super();
        const capped = value.effective >= value.max;
        if (capped) {
            this.classList.add('food-capped');
        }
        else {
            this.classList.add('food-undercapped');
        }
        this.appendChild(makeSpan(`+${value.effective}`, ['food-effective']));
        this.appendChild(quickElement('span', ['food-cap'], [capped ? '✔' : `${value.max}`]));
    }
}

function addFoodCellTooltip(value: FoodStatBonusWithEffective, cell: HTMLElement) {
    cell.title = `Effective: ${value.effective}\nBonus: ${value.percentage}%\nMax: ${value.max}`;
}

type FoodStatBonusWithEffective = FoodStatBonus & {
    effective: number;
}

/**
 * Formats a cell to display the % and max like on a food or tincture.
 *
 * @param value The stat bonus value.
 */
function statBonusDisplay(value: FoodStatBonusWithEffective) {
    if ((value.percentage ?? 0 > 0) || (value.max ?? 0 > 0)) {
        return new FoodStatBonusDisplay(value);
    }
    else {
        return document.createTextNode("");
    }
}

function foodTableStatViewColumn(sheet: GearPlanSheet, set: CharacterGearSet, item: FoodItem, stat: RawStatKey, highlightPrimarySecondary: boolean = false): CustomColumnSpec<FoodItem, unknown, unknown> {
    const wrapped = foodTableStatColumn(sheet, set, stat, highlightPrimarySecondary);
    return {
        ...wrapped,
        condition: () => (item.primarySubStat === stat || item.secondarySubStat === stat),
    };
}

function foodTableStatColumn(sheet: GearPlanSheet, set: CharacterGearSet, stat: RawStatKey, highlightPrimarySecondary: boolean = false): CustomColumnSpec<FoodItem, unknown, unknown> {
    return col({
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: item => {
            return {
                ...item.bonuses[stat],
                effective: set.getEffectiveFoodBonuses(item)[stat],
            } satisfies FoodStatBonusWithEffective;
        },
        renderer: statBonusDisplay,
        condition: () => sheet.isStatRelevant(stat),
        colStyler: (value, cell, node) => {
            cell.classList.add('food-stat-col');
            if (highlightPrimarySecondary) {
                foodStatCellStyler(cell, stat);
            }
            addFoodCellTooltip(value, cell);
        },
    });

}


export class FoodItemsTable extends CustomTable<FoodItem, TableSelectionModel<FoodItem, never, never, FoodItem | undefined>> {
    constructor(sheet: GearPlanSheet, private readonly gearSet: CharacterGearSet) {
        super();
        this.classList.add("food-items-table");
        this.classList.add("food-items-edit-table");
        this.classList.add("hoverable");
        this.rowTitleSetter = (rowValue: FoodItem) => {
            const name = rowValue.nameTranslation.asCurrentLang;
            return `${name} (${rowValue.id})`;
        };
        super.columns = [
            {
                shortName: "ilvl",
                displayName: "iLvl",
                getter: item => item.ilvl,
            },
            col({
                shortName: "icon",
                displayName: "",
                getter: item => {
                    return item;
                },
                renderer: itemIconRenderer(),
                fixedData: true,
            }),
            {
                shortName: "itemname",
                displayName: "Name",
                getter: item => {
                    return item.nameTranslation.asCurrentLang;
                },
                renderer: (name: string, rowValue: FoodItem) => {
                    const trashButton = quickElement('button', ['remove-food-button'], [makeTrashIcon()]);
                    trashButton.addEventListener('click', (ev) => {
                        gearSet.food = undefined;
                        this.refreshSelection();
                    });
                    return quickElement('div', ['food-name-holder-editable'], [quickElement('span', [], [name]), trashButton]);
                },
                // renderer: name => {
                //     return quickElement('div', [], [document.createTextNode(name)]);
                // }
                // initialWidth: 200,
            },
            // TODO: VIT always gets filtered out
            foodTableStatColumn(sheet, gearSet, 'vitality'),
            foodTableStatColumn(sheet, gearSet, 'crit', true),
            foodTableStatColumn(sheet, gearSet, 'dhit', true),
            foodTableStatColumn(sheet, gearSet, 'determination', true),
            foodTableStatColumn(sheet, gearSet, 'spellspeed', true),
            foodTableStatColumn(sheet, gearSet, 'skillspeed', true),
            foodTableStatColumn(sheet, gearSet, 'piety', true),
            foodTableStatColumn(sheet, gearSet, 'tenacity', true),
        ];
        // TODO: write a dedicated selection model for this
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

            },
        };
        const osfCb = new FieldBoundCheckBox(gearSet.sheet.itemDisplaySettings, 'showOneStatFood', {
            id: 'show-osf-cb',
        });
        const oneStatFoodWithLabel = labeledCheckbox('Show Food with One Relevant Stat', osfCb);
        // This should not trigger the show/hide control
        oneStatFoodWithLabel.addEventListener('click', e => e.stopPropagation());
        // Chrome has weird behavior, this is a workaround
        osfCb.addEventListener('click', e => e.stopPropagation());

        const showHideRow = makeShowHideRow('Food', gearSet.isSlotCollapsed('food'), (val, count) => {
            gearSet.setSlotCollapsed('food', val);
            recordSheetEvent('hideFood', sheet, {
                hidden: val,
            });
            this.updateShowHide();
        }, [oneStatFoodWithLabel]);
        const displayItems = [...sheet.foodItemsForDisplay];
        displayItems.sort((left, right) => left.ilvl - right.ilvl);
        if (displayItems.length > 0) {
            super.data = [showHideRow.row, new HeaderRow(), ...displayItems];
        }
        else {
            super.data = [showHideRow.row, new HeaderRow(), new TitleRow('No items available - please check your filters')];
        }
        this.updateShowHide();
    }

    private updateShowHide() {
        this.dataRowMap.forEach((row, value) => {
            if (this.gearSet.isSlotCollapsed('food') && !this.selectionModel.isRowSelected(row)) {
                row.style.display = 'none';
            }
            else {
                row.style.display = '';
            }
        });
    }
}

export class FoodItemViewTable extends CustomTable<FoodItem> {
    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet, item: FoodItem) {
        super();
        this.classList.add("food-items-table");
        super.columns = [
            {
                shortName: "ilvl",
                displayName: "",
                getter: item => item.ilvl,
            },
            col({
                shortName: "icon",
                displayName: "",
                getter: item => {
                    return item;
                },
                renderer: itemIconRenderer(),
                fixedData: true,
            }),
            {
                shortName: "itemname",
                displayName: "Food",
                getter: item => {
                    return item.nameTranslation.asCurrentLang;
                },
                // renderer: name => {
                //     return quickElement('div', [], [document.createTextNode(name)]);
                // }
                // initialWidth: 200,
            },
            foodTableStatViewColumn(sheet, gearSet, item, 'vitality'),
            foodTableStatViewColumn(sheet, gearSet, item, 'crit', true),
            foodTableStatViewColumn(sheet, gearSet, item, 'dhit', true),
            foodTableStatViewColumn(sheet, gearSet, item, 'determination', true),
            foodTableStatViewColumn(sheet, gearSet, item, 'spellspeed', true),
            foodTableStatViewColumn(sheet, gearSet, item, 'skillspeed', true),
            foodTableStatViewColumn(sheet, gearSet, item, 'piety', true),
            foodTableStatViewColumn(sheet, gearSet, item, 'tenacity', true),
        ];
        super.data = [new HeaderRow(), item];
    }
}

class RelicCellInfo {
    constructor(public readonly set: CharacterGearSet,
                public readonly item: GearItem,
                public readonly slotId: EquipSlotKey,
                public readonly stat: Substat,
                public readonly statDetail: ItemSingleStatDetail,
                public readonly supportedStat: boolean) {
    }
}

function itemTableStatColumn(sheet: GearPlanSheet, set: CharacterGearSet, stat: RawStatKey, highlightPrimarySecondary: boolean = false): CustomColumnSpec<GearSlotItem, ItemSingleStatDetail | RelicCellInfo | 'relic-zero', unknown> {
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
                const preview = set.toEquippedItem(item);
                // If not equipped, and there is a saved set of stats for that relic, display them
                // after syncing down and such
                if (!currentEquipment || currentEquipment.gearItem !== item) {
                    // If the relic has no stats configured, return a special marker value that causes all of the cells
                    // to display blank values rather than 0.
                    if (!(ALL_SUB_STATS.find(stat => {
                        const statValue = preview.relicStats[stat];
                        return statValue !== undefined && statValue !== 0;
                    }))) {
                        return 'relic-zero';
                    }
                    return set.getEquipStatDetail(preview, stat);
                }
                // If it is equipped, then display the relic cell editor.
                // Use currentEquipment so that recent changes to the relic stats will be reflecjted.
                return new RelicCellInfo(set, currentEquipment.gearItem, slotItem.slotId, stat as Substat, set.getStatDetail(slotItem.slotId, stat), !item.relicStatModel.excludedStats.includes(stat as Substat));
            }
            else {
                // Not a relic, or not an editable stat. Display normally
                const selected = set.getItemInSlot(slotItem.slotId) === item;
                if (selected) {
                    return set.getStatDetail(slotItem.slotId, stat);
                }
                else {
                    return previewItemStatDetail(item, stat);
                }
            }
        },
        renderer: (value, rowValue: GearSlotItem) => {
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
                            return document.createTextNode(Math.min(equipment.relicStats[value.stat] ?? 0, cap).toString());
                        }
                        else {
                            return document.createTextNode(equipment.relicStats[value.stat].toString());
                        }
                    }
                    else { // If not, display the editor
                        return makeRelicStatEditor(equipment, value.stat, set);
                    }
                }
                else {
                    // This should never happen - we only get passed in a RelicCellInfo if the relic in question is equipped.
                    return null;
                }
            }
            else if (value === 'relic-zero') {
                return null;
            }
            else {
                if (rowValue.item.isCustomRelic) {
                    if (rowValue.item.relicStatModel.excludedStats.includes(stat as Substat)) {
                        return document.createTextNode('-');
                    }
                }
                return document.createTextNode(value.effectiveAmount.toString());
            }
        },
        initialWidth: 33,
        condition: () => sheet.isStatRelevant(stat),
        colStyler: (value, cell, node) => {
            if (highlightPrimarySecondary) {
                if (value instanceof RelicCellInfo) {
                    if (sheet.isViewOnly) {
                        applyStatCellStyles(cell, value.statDetail, stat);
                    }
                    else {
                        removeStatCellStyles(cell);
                    }
                }
                else if (value !== 'relic-zero') {
                    applyStatCellStyles(cell, value, stat);
                }
            }
            else {
                cell.classList.add('stat-cell');
            }
        },
        titleSetter: (value, rowValue: GearSlotItem) => {
            if (value instanceof RelicCellInfo) {
                const currentEquipment: EquippedItem = set.equipment[value.slotId];
                // If not equipped, and there is a saved set of stats for that relic, display them
                // after syncing down and such
                if (!currentEquipment || currentEquipment.gearItem !== value.item) {
                    const preview = set.toEquippedItem(value.item);
                    const statDetail = set.getEquipStatDetail(preview, stat);
                    return statCellTitle(statDetail);
                }
                return statCellTitle(set.getStatDetail(value.slotId, stat));
            }
            else if (value !== 'relic-zero') {
                return statCellTitle(value);
            }
            else {
                return null;
            }
        },
        finisher: (value, rowValue, cell) => {
            if (value instanceof RelicCellInfo) {
                if (!value.supportedStat) {
                    cell.classList.add('stat-cell', 'stat-zero');
                }
            }
        },
    };
}

function makeShowHideRow(label: string, initiallyHidden: boolean = false, setter: ShowHideCallback, extraElements: HTMLElement[] = []): {
    row: SpecialRow<CustomTable<GearSlotItem>>,
    setState: (hidden: boolean) => void,
} {

    const showHide = new ShowHideButton(initiallyHidden, setter);

    return {
        row: new SpecialRow<CustomTable<GearSlotItem>>(
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
                row.addEventListener('click', (e) => {
                    showHide.toggle(e.detail);
                });
                if (row.cells.length) {
                    row.cells.item(0).classList.add('hoverable');
                }
            }),
        setState: hidden => showHide.isHidden = hidden,
    };
}

/**
 * Table for displaying gear options for all slots
 aa*/
export class GearItemsTable extends CustomTable<GearSlotItem, TableSelectionModel<GearSlotItem, never, never, EquipmentSet>> {
    private readonly materiaManagers: AllSlotMateriaManager[];
    private selectionTracker: Map<keyof EquipmentSet, CustomRow<GearSlotItem> | GearSlotItem>;
    private showHideCallbacks: Map<keyof EquipmentSet, (value: boolean) => void> = new Map();

    constructor(sheet: GearPlanSheet, private readonly gearSet: CharacterGearSet, itemMapping: Map<DisplayGearSlot, GearItem[]>, handledSlots: EquipSlotKey[], afterShowHideAll: () => void) {
        super();
        this.classList.add("gear-items-table");
        this.classList.add("gear-items-edit-table");
        this.classList.add("hoverable");
        this.rowTitleSetter = (rowValue: GearSlotItem) => {
            const name = rowValue.item.nameTranslation.asCurrentLang;
            let title: string;
            if (rowValue.item.acquisitionType === 'custom') {
                title = `${name} (Custom Item)`;
            }
            else {
                title = `${name} (${rowValue.item.id})`;
                const formattedAcqSrc = formatAcquisitionSource(rowValue.item.acquisitionType);
                if (formattedAcqSrc) {
                    title += `\nAcquired from: ${formattedAcqSrc}`;
                }
            }
            if (rowValue.item.isSyncedDown) {
                title += `\nSynced to ${rowValue.item.syncedDownTo}`;
            }
            return title;
        };
        super.columns = [
            {
                shortName: "ilvl",
                displayName: "iLvl",
                getter: item => {
                    return item.item.ilvl.toString();
                },
                fixedWidth: 32,
            },
            col({
                shortName: "icon",
                displayName: "",
                getter: item => {
                    return item.item;
                },
                renderer: itemIconRenderer(),
                fixedData: true,
            }),
            col({
                shortName: "itemname",
                displayName: "Name",
                getter: item => {
                    return item.item.nameTranslation.asCurrentLang;
                },
                renderer: (name: string, rowValue: GearSlotItem) => {
                    const trashButton = quickElement('button', ['remove-item-button'], [makeTrashIcon()]);
                    trashButton.title = 'Click to un-equip item';
                    trashButton.addEventListener('click', (ev) => {
                        gearSet.setEquip(rowValue.slotId, null);
                        selectionTracker.set(rowValue.slotId, null);
                        this.refreshSelection();
                        this.refreshMateria();
                        this.refreshRowData(rowValue);
                    });
                    return quickElement('div', ['item-name-holder-editable'], [quickElement('span', [], [shortenItemName(name)]), trashButton]);
                },
                colStyler: (value, colElement, internalElement, rowValue) => {
                },
            }),
            col({
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
                    }
                    else {
                        span.textContent = value.materiaSlots.length.toString();
                    }
                    return span;
                },
                titleSetter: (value, rowValue, cell) => {
                    if (value.isSyncedDown) {
                        return "Melds unavailable due to ilvl sync";
                    }
                    else {
                        const lgCount = value.materiaSlots.filter(slot => slot.allowsHighGrade).length;
                        const smCount = value.materiaSlots.filter(slot => !slot.allowsHighGrade).length;
                        return `${lgCount} full + ${smCount} restricted`;
                    }
                },
            }),
            col({
                shortName: "wd",
                displayName: "WD",
                getter: item => {
                    // return Math.max(item.item.stats.wdMag, item.item.stats.wdPhys);
                    return Math.max(item.item.stats.wdMag, item.item.stats.wdPhys);
                },
                renderer: value => {
                    if (value) {
                        return document.createTextNode(String(value));
                    }
                    else {
                        return document.createTextNode("");
                    }
                },
                initialWidth: 33,
                condition: () => handledSlots === undefined || handledSlots.includes('Weapon'),
                titleSetter: (_, rowValue: GearSlotItem) => {
                    const statDetail = gearSet.getEquipStatDetail(gearSet.toEquippedItem(rowValue.item), rowValue.item.stats.wdPhys > rowValue.item.stats.wdMag ? 'wdPhys' : 'wdMag');
                    return statCellTitle(statDetail);
                },
            }),
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
        ];
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
                cb.addListener(() => {
                    sheet.gearDisplaySettingsUpdateNow();
                });
                const lcb = labeledCheckbox('Display relics above max ilvl setting', cb);
                lcb.addEventListener('click', e => e.stopPropagation());
                extras.push(lcb);
            }
            // TODO: initial value needs to apply to this
            // TODO: just make the getters/setters on this class instead
            const showHideRow = makeShowHideRow(slot.name, gearSet.isSlotCollapsed(slotId), (val, count) => {
                if (count === 1) {
                    gearSet.setSlotCollapsed(slotId, val);
                    recordSheetEvent('hideSlot', sheet, {
                        hidden: val,
                    });
                    this.updateShowHide();
                }
                else if (count === 2) {
                    gearSet.setAllSlotsCollapsed(val);
                    recordSheetEvent('hideAllSlots', sheet, {
                        hidden: val,
                    });
                    afterShowHideAll();
                }
            }, extras);
            data.push(showHideRow.row);
            this.showHideCallbacks.set(slotId, showHideRow.setState);
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
                        slotId: slotId,
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
            const matMgr = new AllSlotMateriaManager(sheet, gearSet, slotId, true, () => {
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
            clickCell(cell: CustomCell<GearSlotItem, unknown>) {

            },
            clickColumnHeader(col: CustomColumn<GearSlotItem>) {

            },
            clickRow(newSelection: CustomRow<GearSlotItem>) {
                // refreshSingleItem old and new items
                gearSet.setEquip(newSelection.dataItem.slotId, newSelection.dataItem.item, sheet.materiaAutoFillController);
                const matMgr = slotMateriaManagers.get(newSelection.dataItem.slotId);
                if (matMgr) {
                    matMgr.refreshFull();
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
            isCellSelectedDirectly(cell: CustomCell<GearSlotItem, unknown>) {
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
            },
        };
        this.data = data;
        this.updateShowHide();
    }

    refreshMateria() {
        this.materiaManagers.forEach(mgr => {
            mgr.refresh();
        });
        for (const equipSlot of EquipSlots) {
            const selection = this.selectionTracker.get(equipSlot);
            if (selection) {
                this.refreshRowData(selection);
            }
        }
        // setTimeout(() => mgr.updateColors());
        this.materiaManagers.forEach(mgr => {
            mgr.updateDisplay();
        });
    }

    recheckHiddenSlots() {
        this.showHideCallbacks.forEach((fn, slot) => {
            fn(this.gearSet.isSlotCollapsed(slot));
        });
    }

    private updateShowHide() {
        this.dataRowMap.forEach((row, value) => {
            if (this.gearSet.isSlotCollapsed(value.slotId) && !this.selectionModel.isRowSelected(row)) {
                row.style.display = 'none';
            }
            else {
                row.style.display = '';
            }
        });
    }
}

/**
 * Table for displaying only equipped items, read-only
 */
export class GearItemsViewTable extends CustomTable<GearSlotItem> {

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet, itemMapping: Map<EquipSlotKey, GearItem>, handledSlots?: EquipSlotKey[]) {
        super();
        this.classList.add("gear-items-table");
        this.classList.add("gear-items-view-table");
        let headingText = handledSlots && handledSlots.length > 0 ? EquipSlotInfo[handledSlots[0]].name : "Name";
        const data: (TitleRow | HeaderRow | GearSlotItem)[] = [];
        // Track the selected item in every category so that it can be more quickly refreshed
        data.push(new HeaderRow());
        let slotItem: GearItem = null;
        let alts: ReturnType<typeof sheet.getAltItemsFor> = [];
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
                    slotId: slotId,
                    // alts: sheet.getAltItemsFor(equippedItem)
                };
                if (slotItem === null) {
                    slotItem = equippedItem;
                    alts = sheet.getAltItemsFor(equippedItem);
                }
                data.push(item);
                if (!equippedItem.isCustomRelic) {
                    const matMgr = new AllSlotMateriaManager(sheet, gearSet, slotId, false);
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
            col({
                shortName: "icon",
                displayName: "",
                getter: item => {
                    return item.item;
                },
                renderer: itemIconRenderer(),
                fixedData: true,
            }),
            col({
                shortName: "itemname",
                displayName: headingText,
                getter: item => {
                    return item.item.nameTranslation.asCurrentLang;
                },
                renderer: (item) => {
                    const name = item;
                    const itemNameSpan = quickElement('span', ['item-name'], [shortenItemName(name)]);
                    const out = quickElement('div', ['item-name-holder-view'], [itemNameSpan]);
                    return out;
                },
                headerStyler: (_, colHeader) => {
                    // console.log("Item", item);
                    colHeader.classList.add('gear-items-view-item-header');
                    if (alts.length > 0) {
                        const altButton = makeActionButton(`+${alts.length} alt items`, () => {
                            const modal = new AltItemsModal(slotItem, alts);
                            modal.attachAndShowExclusively();
                        });
                        altButton.classList.add('gear-items-view-alts-button');
                        colHeader.appendChild(altButton);
                    }

                },
                // initialWidth: 300,
            }),
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
        ];
        this.data = data;
    }

}

export class AltItemsModal extends BaseModal {
    constructor(baseItem: GearItem, altItems: GearItem[]) {
        super();
        this.headerText = 'Alternative Items';
        console.log(altItems);

        const text = document.createElement('p');
        text.textContent = `The item ${baseItem.nameTranslation} can be replaced by all of the following items, which have equivalent or better effective stats:`;
        this.contentArea.appendChild(quickElement('div', ['alt-items-text-holder'], [text]));

        const table: CustomTable<GearItem> = new CustomTable<GearItem>();
        table.columns = [
            {
                shortName: "ilvl",
                displayName: "iLv",
                getter: item => {
                    return item.ilvl.toString();
                },
            },
            col({
                shortName: "icon",
                displayName: "",
                getter: item => {
                    return item;
                },
                renderer: itemIconRenderer(),
            }),
            {
                shortName: "itemname",
                displayName: "Name",
                getter: item => {
                    return item.nameTranslation.asCurrentLang;
                },
            },
            col({
                shortName: 'acqsrc',
                displayName: 'Source',
                getter: item => item.acquisitionType,
                renderer: value => {
                    return document.createTextNode(value ? (formatAcquisitionSource(value) ?? 'Unknown') : 'Unknown');
                },
            }),
        ];
        table.data = [new HeaderRow(), baseItem, ...altItems];
        this.contentArea.appendChild(table);

        this.addCloseButton();
    }
}

export class ILvlRangePicker<ObjType> extends HTMLElement {
    private _listeners: ((min: number, max: number) => void)[] = [];
    private readonly obj: ObjType;
    private readonly minField: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType];
    private readonly maxField: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType];

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
                if (ctx.newValue > (obj[maxField] as number)) {
                    ctx.failValidation('Minimum level must be less than the maximum level');
                }
            }],
        });
        const upperBoundControl = new FieldBoundIntField(obj, maxField, {
            postValidators: [(ctx) => {
                if (ctx.newValue < (obj[minField] as number)) {
                    ctx.failValidation('Maximum level must be greater than the minimum level');
                }
            }],
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
        for (const listener of this._listeners) {
            listener(this.obj[this.minField] as number, this.obj[this.maxField] as number);
        }
    }
}

export function itemIconRenderer<RowType>(): CellRenderer<RowType, XivItem> {
    return item => {
        const img = item.iconUrl;
        const image = document.createElement('img');
        image.setAttribute('intrinsicsize', '80x80');
        image.src = img.toString();
        image.classList.add('item-icon');
        // TODO: should this behavior be part of ItemIcon + use that?
        if ('rarity' in item) {
            const rarity = item.rarity as number;
            switch (rarity) {
                case 1:
                    image.classList.add('item-rarity-normal');
                    break;
                case 2:
                    image.classList.add('item-rarity-green');
                    break;
                case 3:
                    image.classList.add('item-rarity-blue');
                    break;
                case 4:
                    image.classList.add('item-rarity-relic');
                    break;
            }
        }
        else {
            image.classList.add('item-rarity-unknown');
        }
        image.addEventListener('load', () => {
            image.classList.add('loaded');
        });
        return image;
    };
}

customElements.define("gear-items-table", GearItemsTable, {extends: "table"});
customElements.define("gear-items-view-table", GearItemsViewTable, {extends: "table"});
customElements.define("food-items-table", FoodItemsTable, {extends: "table"});
customElements.define("food-items-view-table", FoodItemViewTable, {extends: "table"});
customElements.define("ilvl-range-picker", ILvlRangePicker);
customElements.define("food-stat-bonus", FoodStatBonusDisplay);
customElements.define("alt-items-modal", AltItemsModal);
