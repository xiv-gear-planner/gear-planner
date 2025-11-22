import {col, CustomTable, HeaderRow, SpecialRow} from "@xivgear/common-ui/table/tables";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {
    clampValues,
    el,
    FieldBoundCheckBox,
    FieldBoundDataSelect,
    FieldBoundFloatField,
    FieldBoundIntField,
    FieldBoundOrUndefIntField,
    FieldBoundTextField,
    labeledCheckbox,
    makeActionButton,
    nonNegative,
    quickElement,
    randomId
} from "@xivgear/common-ui/components/util";
import {ALL_STATS, ALL_SUB_STATS, STAT_ABBREVIATIONS, STAT_FULL_NAMES} from "@xivgear/xivmath/xivconstants";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {DropdownActionMenu} from "./dropdown_actions_menu";
import {NormalOccGearSlots, RawStats, Substat} from "@xivgear/xivmath/geartypes";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";
import {CustomItem} from "@xivgear/core/customgear/custom_item";
import {CustomFood} from "@xivgear/core/customgear/custom_food";
import {GearPlanSheetGui} from "./sheet";
import {makeTrashIcon} from "@xivgear/common-ui/components/icons";

function ifWeapon(fn: (item: CustomItem) => HTMLElement): (item: CustomItem) => Node {
    return (item: CustomItem) => {
        if (item.displayGearSlotName === 'Weapon') {
            return fn(item);
        }
        else {
            return document.createTextNode('');
        }
    };
}

// Proxy for RawStats that turns zeroes into undefined when reading, and undefined into zero when writing.
// This is needed to allow autocompletion to work correctly - if we actually put '0' in the field, it will only show
// autocompletion possibilities that begin with 0, which isn't very useful.
function customStatsProxy(obj: RawStats): RawStats {
    return new Proxy<RawStats>(obj, {
        get(target: RawStats, prop: string | symbol): unknown {
            // @ts-expect-error we do not know the type beforehand
            const out = target[prop];
            if (out === 0) {
                return undefined;
            }
            return out;
        },
        set(target: RawStats, prop: string | symbol, value: unknown) {
            // @ts-expect-error we do not know the type beforehand
            target[prop] = value ?? 0;
            return true;
        },
    });
}

function setTitle(title: string) {
    return (_: never, cell: HTMLElement) => {
        cell.title = title;
    };
}

/**
 * Table for managing custom items. Creating a new item is handled outside the table.
 */
export class CustomItemTable extends CustomTable<CustomItem> {
    constructor(private readonly sheet: GearPlanSheet) {
        super();
        this.columns = [
            {
                shortName: 'actions',
                displayName: '',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    const out = document.createElement('div');
                    out.appendChild(makeActionButton([makeTrashIcon()], (ev) => {
                        if (confirmDelete(ev, `Delete custom item '${item.name}'?`)) {
                            const deleted = this.sheet.deleteCustomItem(item, setNames => {
                                return confirmDelete(ev, `Some sets are still using this item:\n${setNames.map(setName => ` - ${setName}`).join('\n')}\nDelete anyway?`);
                            });
                            if (deleted) {
                                this.refresh();
                            }
                        }
                    }, 'Delete this item'));
                    return out;
                },
                initialWidth: 40,
            },
            {
                shortName: 'name',
                displayName: 'Name',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    return new FieldBoundTextField(item.customData, 'name');
                },
                initialWidth: 150,
                colStyler: setTitle('Name of the item'),
                headerStyler: setTitle('Name of the item'),
            }, {
                shortName: 'slot',
                displayName: 'Slot',
                getter: item => item.occGearSlotName,
                initialWidth: 85,
            }, {
                shortName: 'ilvl',
                displayName: 'ilvl (cap?)',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    const ilvlInput = new FieldBoundIntField(item, 'ilvl', {
                        postValidators: [nonNegative],
                    });
                    const capBox = new FieldBoundCheckBox(item, 'respectCaps');
                    const recheck = (ilvl: number) => {
                        if (!sheet.ilvlSyncInfo(ilvl)) {
                            ilvlInput._validationMessage = `Data for item level ${ilvl} does not exist. Caps will not be applied even if enabled.`;
                        }
                        else {
                            ilvlInput._validationMessage = undefined;
                        }
                    };
                    capBox.title = 'Apply caps based on the ilvl of the sheet.';
                    ilvlInput.addListener(recheck);
                    capBox.addListener(() => recheck(item.ilvl));
                    recheck(item.ilvl);
                    ilvlInput.addEventListener('focusout', () => this.refreshRowData(item));
                    const holder = quickElement("div", [], [ilvlInput, capBox]);
                    holder.style.display = 'flex';
                    ilvlInput.style.minWidth = '40px';
                    ilvlInput.title = 'Item level. Checkbox controls whether caps are applied based on the ilvl of the sheet.';
                    return holder;
                },
                initialWidth: 80,
                headerStyler: setTitle('Item level. Checkbox controls whether caps are applied based on the ilvl of the sheet.'),
            },
            {
                shortName: 'mat-large',
                displayName: 'Lg Mat',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    return new FieldBoundIntField(item.customData, 'largeMateriaSlots', {
                        postValidators: [clampValues(0, 5)],
                    });
                },
                initialWidth: 60,
                headerStyler: setTitle('Number of normal materia slots'),
                colStyler: setTitle('Number of normal materia slots'),
            }, {
                shortName: 'mat-small',
                displayName: 'Sm Mat',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    return new FieldBoundIntField(item.customData, 'smallMateriaSlots', {
                        postValidators: [clampValues(0, 5)],
                    });
                },
                initialWidth: 60,
                headerStyler: setTitle('Number of restricted materia slots'),
                colStyler: setTitle('Number of restricted materia slots'),
            },
            ...ALL_STATS.map(stat => {
                return col({
                    shortName: STAT_ABBREVIATIONS[stat],
                    displayName: STAT_ABBREVIATIONS[stat],
                    getter: item => item,
                    renderer: (item: CustomItem) => {
                        const ilvlSyncInfo = sheet.ilvlSyncInfo(item.ilvl);
                        const cap = ilvlSyncInfo.substatCap(item.occGearSlotName, stat);
                        // Small stat is ceil(big stat * 70%)
                        const suggestions = [cap];
                        if (ALL_SUB_STATS.includes(stat as Substat)) {
                            suggestions.push(Math.ceil(cap * 0.7));
                        }
                        suggestions.push(0);
                        const datalist = el('datalist',
                            {id: randomId('custom-item-datalist-')},
                            suggestions.map(sugg => {
                                return el('option', {props: {value: sugg.toString()}});
                            }));

                        const statsProxy = customStatsProxy(item.customData.stats);

                        const field = new FieldBoundOrUndefIntField(statsProxy, stat, {
                            postValidators: [nonNegative],
                        });
                        field.placeholder = '0';
                        field.setAttribute('list', datalist.id);
                        field.appendChild(datalist);
                        return field;
                    },
                    initialWidth: 40,
                    colStyler: (_, cell) => {
                        if (!this.sheet.isStatPossibleOnGear(stat)) {
                            cell.classList.add('irrelevant-stat');
                        }
                        cell.title = STAT_FULL_NAMES[stat];
                    },
                    headerStyler: (_, cell) => {
                        if (!this.sheet.isStatPossibleOnGear(stat)) {
                            cell.classList.add('irrelevant-stat');
                        }
                        cell.title = STAT_FULL_NAMES[stat];
                    },
                });
            }), col({
                shortName: 'haste',
                displayName: 'Haste',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    return new FieldBoundIntField(item.customData.stats, 'gearHaste', {
                        postValidators: [clampValues(0, 99)],
                    });
                },
                initialWidth: 60,
                colStyler: (_, cell) => {
                    cell.classList.add('irrelevant-stat');
                    cell.title = 'Haste (percentage)';
                },
                headerStyler: (_, cell) => {
                    cell.classList.add('irrelevant-stat');
                    cell.title = 'Haste (percentage)';
                },
            }),
            {
                shortName: 'wdPhys',
                displayName: 'WdP',
                getter: item => item,
                renderer: ifWeapon((item: CustomItem) => {
                    return new FieldBoundIntField(item.customData.stats, "wdPhys", {
                        postValidators: [nonNegative],
                    });
                }),
                initialWidth: 40,
                headerStyler: setTitle('Physical Weapon Damage'),
                colStyler: setTitle('Physical Weapon Damage'),
            }, {
                shortName: 'wdMag',
                displayName: 'WdM',
                getter: item => item,
                renderer: ifWeapon((item: CustomItem) => {
                    return new FieldBoundIntField(item.customData.stats, "wdMag", {
                        postValidators: [nonNegative],
                    });
                }),
                initialWidth: 40,
                headerStyler: setTitle('Magical Weapon Damage'),
                colStyler: setTitle('Magical Weapon Damage'),
            }, {
                shortName: 'wDelay',
                displayName: 'Wpn Dly',
                getter: item => item,
                renderer: ifWeapon((item: CustomItem) => {
                    const out = new FieldBoundFloatField(item.customData.stats, "weaponDelay", {
                        postValidators: [nonNegative],
                    });
                    out.title = 'Enter weapon delay in seconds (e.g. 3.125)';

                    const exampleWeapon = this.sheet.highestIlvlItemForSlot(item.occGearSlotName);
                    const suggestions = [exampleWeapon.stats.weaponDelay];

                    const datalist = el('datalist',
                        {id: randomId('custom-item-datalist-')},
                        suggestions.map(sugg => {
                            return el('option', {props: {value: sugg.toString()}});
                        }));

                    out.setAttribute('list', datalist.id);
                    out.appendChild(datalist);

                    return out;
                }),
                initialWidth: 80,
                headerStyler: setTitle('Weapon Delay (Seconds)'),
                colStyler: setTitle('Weapon Delay (Seconds)'),
            }];

        this.refresh();
    }

    /**
     * Refresh the table. Should be called after adding or removing an item.
     */
    refresh() {
        const items = this.sheet.customItems;
        if (items.length === 0) {
            this.data = [new HeaderRow(), new SpecialRow(() => {
                return el('div', {class: 'no-items-message'}, [
                    'You have no custom items. Click "New Item..." below to create one.',
                ]);
            })];
        }
        else {
            this.data = [new HeaderRow(), ...items];
        }
    }
}

/**
 * Modal dialog for custom item management.
 */
export class CustomItemPopup extends BaseModal {

    constructor(private readonly sheet: GearPlanSheetGui) {
        super();
        this.headerText = 'Custom Items';
        const table = new CustomItemTable(sheet);
        this.contentArea.appendChild(table);

        const showAllStatsCb = new FieldBoundCheckBox<CustomItemPopup>(this, 'showAllStats');
        const lcb = labeledCheckbox('Show all stats', showAllStatsCb);

        const notesArea = el('p', {class: 'notes-area'}, [
            lcb,
            el('br'),
            'Limitations:',
            el('br'),
            'If you change the number of materia slots on an item, you will need to re-select the item.',
        ]);
        this.contentArea.appendChild(notesArea);

        const newCustomItemDropdown = new DropdownActionMenu('New Item...');
        // Use normal slots to not clog the UI up with unusual options
        NormalOccGearSlots.forEach(slot => {
            // Don't show 2H weapons for 1H/offhand classes
            if (slot === 'Weapon2H' && this.sheet.classJobStats.offhand) {
                return;
            }
            else if ((slot === 'Weapon1H' || slot === 'OffHand') && !this.sheet.classJobStats.offhand) {
                // Don't show 1H/Shield for 2H classes
                return;
            }
            newCustomItemDropdown.addAction({
                label: slot,
                action: () => {
                    sheet.newCustomItem(slot);
                    table.refresh();
                },
            });
        });
        this.addButton(newCustomItemDropdown);

        this.addCloseButton();
    }

    onClose() {
        this.sheet.requestSave();
        this.sheet.recheckCustomItems();
        this.sheet.recalcAll();
        this.sheet.gearDisplaySettingsUpdateNow();
    }

    get showAllStats(): boolean {
        return this.classList.contains('show-all-stats');
    }

    set showAllStats(value: boolean) {
        if (value) {
            this.classList.add('show-all-stats');
        }
        else {
            this.classList.remove('show-all-stats');
        }
    }
}

/**
 * Table for managing custom food items. Creating a new food is handled outside the table.
 */
export class CustomFoodTable extends CustomTable<CustomFood> {
    constructor(private readonly sheet: GearPlanSheet) {
        super();
        this.columns = [
            {
                shortName: 'actions',
                displayName: '',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    const out = document.createElement('div');
                    out.appendChild(makeActionButton([makeTrashIcon()], (ev) => {
                        if (confirmDelete(ev, `Delete custom food '${item.name}'?`)) {
                            const deleted = this.sheet.deleteCustomFood(item, setNames => {
                                return confirmDelete(ev, `Some sets are still using this item:\n${setNames.map(setName => ` - ${setName}`).join('\n')}\nDelete anyway?`);
                            });
                            if (deleted) {
                                this.refresh();
                            }
                        }
                    }, 'Delete this item'));
                    return out;
                },
                initialWidth: 40,
            },
            {
                shortName: 'name',
                displayName: 'Name',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundTextField(item.customData, 'name');
                },
                initialWidth: 150,
                headerStyler: setTitle('Name of the item'),
                colStyler: setTitle('Name of the item'),
            }, {
                shortName: 'ilvl',
                displayName: 'ilvl',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundIntField(item.customData, 'ilvl', {
                        postValidators: [nonNegative],
                    });
                },
                initialWidth: 60,
                headerStyler: setTitle('Item level'),
                colStyler: setTitle('Item level'),
            }, {
                shortName: 'vitality-percent',
                displayName: 'Vit %',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundIntField(item.customData.vitalityBonus, 'percentage', {postValidators: [nonNegative]});
                },
                initialWidth: 60,
                headerStyler: setTitle('Vitality bonus percentage'),
                colStyler: setTitle('Vitality bonus percentage'),
            }, {
                shortName: 'vitality-cap',
                displayName: 'Vit Max',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundIntField(item.customData.vitalityBonus, 'max', {postValidators: [nonNegative]});
                },
                initialWidth: 60,
                headerStyler: setTitle('Vitality bonus cap'),
                colStyler: setTitle('Vitality bonus cap'),
            }, {
                shortName: 'primary-stat',
                displayName: '1st Stat',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundDataSelect(item.customData, 'primaryStat', value => value ? STAT_FULL_NAMES[value] : 'None', [null, ...ALL_SUB_STATS]);
                },
                initialWidth: 120,
                headerStyler: setTitle('The primary sub-stat'),
                colStyler: setTitle('The primary sub-stat'),
            }, {
                shortName: 'primary-stat-percent',
                displayName: '%',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundIntField(item.customData.primaryStatBonus, 'percentage', {postValidators: [nonNegative]});
                },
                initialWidth: 60,
                headerStyler: setTitle('The primary sub-stat bonus percentage'),
                colStyler: setTitle('The primary sub-stat bonus percentage'),
            }, {
                shortName: 'primary-stat-cap',
                displayName: 'Max',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundIntField(item.customData.primaryStatBonus, 'max', {postValidators: [nonNegative]});
                },
                initialWidth: 60,
                headerStyler: setTitle('The primary sub-stat bonus cap'),
                colStyler: setTitle('The primary sub-stat bonus cap'),
            }, {
                shortName: 'secondary-stat',
                displayName: '2nd Stat',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundDataSelect(item.customData, 'secondaryStat', value => value ? STAT_FULL_NAMES[value] : 'None', [null, ...ALL_SUB_STATS]);
                },
                initialWidth: 120,
                headerStyler: setTitle('The secondary sub-stat'),
                colStyler: setTitle('The secondary sub-stat'),
            }, {
                shortName: 'secondary-stat-percent',
                displayName: '%',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundIntField(item.customData.secondaryStatBonus, 'percentage', {postValidators: [nonNegative]});
                },
                initialWidth: 60,
                headerStyler: setTitle('The secondary sub-stat bonus percentage'),
                colStyler: setTitle('The secondary sub-stat bonus percentage'),
            }, {
                shortName: 'secondary-stat-cap',
                displayName: 'Max',
                getter: item => item,
                renderer: (item: CustomFood) => {
                    return new FieldBoundIntField(item.customData.secondaryStatBonus, 'max', {postValidators: [nonNegative]});
                },
                initialWidth: 60,
                headerStyler: setTitle('The secondary sub-stat bonus cap'),
                colStyler: setTitle('The secondary sub-stat bonus cap'),
            },
        ];

        this.refresh();
    }

    /**
     * Refresh the table. Should be called after adding or removing an item.
     */
    refresh() {
        const items = this.sheet.customFood;
        if (items.length === 0) {
            this.data = [new HeaderRow(), new SpecialRow(() => {
                return el('div', {class: 'no-items-message'}, [
                    'You have no custom foods. Click "New Food" below to create one.',
                ]);
            })];
        }
        else {
            this.data = [new HeaderRow(), ...items];
        }
    }
}

/**
 * Modal dialog for custom item management.
 */
export class CustomFoodPopup extends BaseModal {
    constructor(private readonly sheet: GearPlanSheetGui) {
        super();
        this.headerText = 'Custom Food';
        const table = new CustomFoodTable(sheet);
        this.contentArea.appendChild(table);

        // const notesArea = document.createElement('p');
        // notesArea.innerHTML = 'Limitations:<br />Do not delete items that are currently equipped.';
        // notesArea.classList.add('notes-area');
        // this.contentArea.appendChild(notesArea);

        this.addActionButton('New Food', () => {
            sheet.newCustomFood();
            table.refresh();
        });

        this.addCloseButton();
    }

    onClose() {
        this.sheet.requestSave();
        this.sheet.gearDisplaySettingsUpdateLater();
        this.sheet.recalcAll();
        this.sheet.refreshGearEditor();
    }
}

customElements.define('custom-item-popup', CustomItemPopup);
customElements.define('custom-item-table', CustomItemTable, {extends: 'table'});
customElements.define('custom-food-popup', CustomFoodPopup);
customElements.define('custom-food-table', CustomFoodTable, {extends: 'table'});

