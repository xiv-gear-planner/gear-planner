import {CustomTable, HeaderRow} from "../tables";
import {CustomItem} from "@xivgear/core/gear";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {
    clampValues,
    faIcon,
    FieldBoundFloatField,
    FieldBoundIntField,
    FieldBoundTextField,
    makeActionButton,
    nonNegative
} from "@xivgear/common-ui/components/util";
import {ALL_STATS, STAT_ABBREVIATIONS} from "@xivgear/xivmath/xivconstants";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {DropdownActionMenu} from "./dropdown_actions_menu";
import {OccGearSlots} from "@xivgear/xivmath/geartypes";

function ifWeapon(fn: (item: CustomItem) => HTMLElement): (item: CustomItem) => Node {
    return (item: CustomItem) => {
        if (item.displayGearSlotName === 'Weapon') {
            return fn(item);
        }
        else {
            return document.createTextNode('');
        }
    }
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
                    out.appendChild(makeActionButton([faIcon('fa-trash-can')], () => {
                        this.sheet.deleteCustomItem(item);
                        this.refresh();
                    }, 'Delete this item'));
                    return out;
                },
                initialWidth: 40
            },
            {
                shortName: 'name',
                displayName: 'Name',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    return new FieldBoundTextField(item.customData, 'name');
                },
                initialWidth: 150
            }, {
                shortName: 'slot',
                displayName: 'Slot',
                getter: item => item.occGearSlotName,
                initialWidth: 85
            }, {
                shortName: 'ilvl',
                displayName: 'ilvl',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    return new FieldBoundIntField(item.customData, 'ilvl', {
                        postValidators: [nonNegative],
                        inputMode: 'number'
                    })
                },
                initialWidth: 60
            },{
                shortName: 'mat-large',
                displayName: 'Lg Mat',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    return new FieldBoundIntField(item.customData, 'largeMateriaSlots', {
                        postValidators: [clampValues(0, 5)],
                        inputMode: 'number'
                    })
                },
                initialWidth: 60
            }, {
                shortName: 'mat-small',
                displayName: 'Sm Mat',
                getter: item => item,
                renderer: (item: CustomItem) => {
                    return new FieldBoundIntField(item.customData, 'smallMateriaSlots', {
                        postValidators: [clampValues(0, 5)],
                        inputMode: 'number'
                    })
                },
                initialWidth: 60
            },
            ...ALL_STATS.map(stat => {
                return {
                    shortName: STAT_ABBREVIATIONS[stat],
                    displayName: STAT_ABBREVIATIONS[stat],
                    getter: item => item,
                    renderer: (item: CustomItem) => {
                        return new FieldBoundIntField(item.customData.stats, stat, {
                            postValidators: [nonNegative],
                            inputMode: 'number'
                        });
                    },
                    initialWidth: 40
                }
            }),
            {
                shortName: 'wdPhys',
                displayName: 'WdP',
                getter: item => item,
                renderer: ifWeapon((item: CustomItem) => {
                    return new FieldBoundIntField(item.customData.stats, "wdPhys", {
                        postValidators: [nonNegative],
                        inputMode: 'number'
                    });
                }),
                initialWidth: 40,
            }, {
                shortName: 'wdMag',
                displayName: 'WdM',
                getter: item => item,
                renderer: ifWeapon((item: CustomItem) => {
                    return new FieldBoundIntField(item.customData.stats, "wdMag", {
                        postValidators: [nonNegative],
                        inputMode: 'number'
                    });
                }),
                initialWidth: 40

            }, {
                shortName: 'wDelay',
                displayName: 'Wpn Dly',
                getter: item => item,
                renderer: ifWeapon((item: CustomItem) => {
                    const out = new FieldBoundFloatField(item.customData.stats, "weaponDelay", {
                        postValidators: [nonNegative],
                        inputMode: 'number'
                    });
                    out.title = 'Enter weapon delay in seconds (e.g. 3.125)';
                    return out;
                }),
                initialWidth: 80
            }];
        // TODO: weapon damage, weapon delay, any other relevant things, haste

        this.refresh();
    }

    /**
     * Refresh the table. Should be called after adding or removing an item.
     */
    refresh() {
        this.data = [new HeaderRow(), ...this.sheet.customItems];
    }
}

/**
 * Modal dialog for custom item management.
 */
export class CustomItemPopup extends BaseModal {
    constructor(private readonly sheet: GearPlanSheet) {
        super();
        this.headerText = 'Custom Items';
        const table = new CustomItemTable(sheet);
        this.contentArea.appendChild(table);

        const notesArea = document.createElement('p');
        notesArea.innerHTML = 'Limitations:<br />Do not delete items that are currently equipped.<br />If you change the number of materia slots on an item, you will need to re-select the item.<br />Currently, items will not downsync - they will always get their full stat value.';
        notesArea.classList.add('notes-area');
        this.contentArea.appendChild(notesArea);

        const newCustomItemDropdown = new DropdownActionMenu('New Item...');
        OccGearSlots.forEach(slot => {
            // Don't show 2H weapons for 1H/offhand classes
            if (slot === 'Weapon2H' && this.sheet.classJobStats.offhand) {
                return;
            }
            // Don't show 1H/Shield for 2H classes
            else if ((slot === 'Weapon1H' || slot === 'OffHand') && !this.sheet.classJobStats.offhand) {
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

    close() {
        super.close();
        this.sheet.requestSave();
        this.sheet.onGearDisplaySettingsUpdate();
        this.sheet.recalcAll();
    }
}

customElements.define('custom-item-popup', CustomItemPopup);
customElements.define('custom-item-table', CustomItemTable, {extends: 'table'});