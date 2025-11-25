import {CharacterGearSet} from "@xivgear/core/gear";
import {FoodItemsTable, GearItemsTable} from "./items";
import {ExpandableText} from "@xivgear/common-ui/components/expandy_text";
import {stringToParagraphs} from "../../../util/text_utils";
import {iconForIssues, SetIssuesModal} from "../gear_set_issues";
import {DataSelect, el, makeActionButton, quickElement} from "@xivgear/common-ui/components/util";
import {editIcon, makeExportIcon} from "@xivgear/common-ui/components/icons";
import {startExport} from "../../export/export_controller";
import {startRenameSet} from "../rename_dialog";
import {writeProxy} from "@xivgear/util/proxies";
import {isPopout} from "../../../popout";
import {DisplayGearSlotKey, GearItem} from "@xivgear/xivmath/geartypes";
import {GearPlanSheetGui} from "../sheet_gui";

/**
 * The set editor portion. Includes the tab as well as controls for the set name and such.
 */
export class GearSetEditor extends HTMLElement {
    private readonly sheet: GearPlanSheetGui;
    private readonly gearSet: CharacterGearSet;
    private gearTables: GearItemsTable[] = [];
    private header: HTMLHeadingElement;
    private desc: ExpandableText;
    private issuesButtonContent: HTMLSpanElement;
    private foodTable: FoodItemsTable;

    constructor(sheet: GearPlanSheetGui, gearSet: CharacterGearSet) {
        super();
        this.sheet = sheet;
        this.gearSet = gearSet;
        this.setup();
    }

    formatTitleDesc(): void {
        this.header.textContent = this.gearSet.name;
        const trimmedDesc = this.gearSet.description?.trim();
        if (trimmedDesc) {
            this.desc.style.display = '';
            this.desc.setChildren(stringToParagraphs(trimmedDesc));
        }
        else {
            this.desc.style.display = 'none';
        }
    }

    checkIssues(): void {
        const issues = this.gearSet.issues;
        if (issues.length >= 1) {
            this.issuesButtonContent.replaceChildren(iconForIssues(...issues), `${issues.length} issue${issues.length === 1 ? '' : 's'}`);
        }
        else {
            this.issuesButtonContent.replaceChildren('No issues');
        }
    }

    setup() {
        this.replaceChildren();

        // Name editor

        this.header = document.createElement('h2');
        this.desc = new ExpandableText();
        this.desc.classList.add('set-description-holder');
        this.appendChild(this.header);
        this.appendChild(this.desc);
        this.formatTitleDesc();

        const compatCheckerButton = makeActionButton('Compatibility', () => {
            this.sheet.showCompatOverview(this.gearSet);
        });

        this.issuesButtonContent = el('span');

        const issuesButton = makeActionButton([this.issuesButtonContent], () => {
            this.showIssuesModal();
        });
        issuesButton.classList.add('issues-button');

        const buttonArea = quickElement('div', ['gear-set-editor-button-area', 'button-row'], [
            makeActionButton([makeExportIcon(), 'Export Set'], () => {
                startExport(this.gearSet);
            }),
            makeActionButton([editIcon(), 'Edit Name/Description'], () => {
                startRenameSet(writeProxy(this.gearSet, () => this.formatTitleDesc()));
            }),
            isPopout() ? null : makeActionButton([makeExportIcon(), 'Popout Editor'], () => {
                const sheetAny = this.sheet;
                sheetAny.openPopoutForSet(this.gearSet);
            }),
            compatCheckerButton,
            issuesButton,
        ].filter(x => x !== null));
        if (this.sheet.isMultiJob) {
            buttonArea.prepend(new DataSelect(
                this.sheet.allJobs,
                job => job,
                job => this.gearSet.jobOverride = job,
                this.gearSet.job
            ));
        }

        this.appendChild(buttonArea);

        // Put items in categories by slot
        // Not enough to just use the items, because rings can be in either ring slot, so we
        // need options to reflect that.
        const itemMapping: Map<DisplayGearSlotKey, GearItem[]> = new Map();
        this.sheet.itemsForDisplay
            .filter(item => item.usableByJob(this.gearSet.job))
            .forEach((item) => {
                const slot = item.displayGearSlotName;
                if (itemMapping.has(slot)) {
                    itemMapping.get(slot).push(item);
                }
                else {
                    itemMapping.set(slot, [item]);
                }
            });

        const leftSideSlots = ['Head', 'Body', 'Hand', 'Legs', 'Feet'] as const;
        const rightSideSlots = ['Ears', 'Neck', 'Wrist', 'RingRight', 'RingLeft'] as const;

        const showHideAllCallback = () => {
            this.gearTables.forEach(tbl => tbl.recheckHiddenSlots());
        };

        const weaponTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, this.gearSet.classJobStats.offhand ? ['Weapon', 'OffHand'] : ['Weapon'], showHideAllCallback);
        const leftSideDiv = document.createElement('div');
        const rightSideDiv = document.createElement('div');

        this.gearTables = [weaponTable];

        for (const slot of leftSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot], showHideAllCallback);
            leftSideDiv.appendChild(table);
            this.gearTables.push(table);
        }
        for (const slot of rightSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot], showHideAllCallback);
            rightSideDiv.appendChild(table);
            this.gearTables.push(table);
        }
        // const leftSideTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, ['Head', 'Body', 'Hand', 'Legs', 'Feet']);
        // const rightSideTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, ['Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight']);

        const gearTableSet = document.createElement('div');
        weaponTable.classList.add('weapon-table');
        gearTableSet.classList.add('gear-table-sides-holder');
        leftSideDiv.classList.add('left-side-gear-table');
        rightSideDiv.classList.add('right-side-gear-table');

        gearTableSet.appendChild(leftSideDiv);
        gearTableSet.appendChild(rightSideDiv);
        this.appendChild(weaponTable);
        this.appendChild(gearTableSet);
        // this.appendChild(rightSideDiv);

        // // Gear table
        // const gearTable = new GearItemsTable(sheet, gearSet, itemMapping);
        // // gearTable.id = "gear-items-table";
        // this.appendChild(gearTable);

        // Food table
        this.foodTable = new FoodItemsTable(this.sheet, this.gearSet);
        this.foodTable.classList.add('food-table');
        // foodTable.id = "food-items-table";
        this.appendChild(this.foodTable);
        this.checkIssues();
    }

    refreshMateria() {
        this.gearTables.forEach(tbl => tbl.refreshMateria());
        this.checkIssues();
    }

    showIssuesModal(): void {
        new SetIssuesModal(this.gearSet).attachAndShowExclusively();
    }

    refresh() {
        this.checkIssues();
        this.foodTable.refreshFull();
    }

    private undoRedoHotkeyHandler = (ev: KeyboardEvent) => {
        // Ctrl-Z = undo
        // Ctrl-Shift-Z = redo
        if (ev.ctrlKey && ev.key.toLowerCase() === 'z') {
            // ignore anything that would naturally handle an undo
            if (ev.target instanceof Element) {
                const tag = ev.target.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'select' || tag === 'textarea') {
                    return;
                }
            }
            if (ev.shiftKey) {
                this.gearSet.redo();
            }
            else {
                this.gearSet.undo();
            }
        }
    };

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
        window.addEventListener('keydown', this.undoRedoHotkeyHandler);
    }

    // noinspection JSUnusedGlobalSymbols
    disconnectedCallback() {
        window.removeEventListener('keydown', this.undoRedoHotkeyHandler);
    }
}

customElements.define("gear-set-editor", GearSetEditor);
