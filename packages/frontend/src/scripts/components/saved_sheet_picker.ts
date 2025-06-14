import {col, CustomRow, CustomTable, SpecialRow, TableSelectionModel} from "@xivgear/common-ui/table/tables";
import {DEFAULT_SHEET_METADATA, SheetExport, SheetMetadata} from "@xivgear/xivmath/geartypes";
import {faIcon, makeActionButton, makeCloseButton, quickElement} from "@xivgear/common-ui/components/util";
import {deleteSheetByKey} from "@xivgear/core/persistence/saved_sheets";
import {getHashForSaveKey, openSheetByKey, showNewSheetForm} from "../base_ui";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";
import {JobIcon} from "./job_icon";
import {JOB_DATA} from "@xivgear/xivmath/xivconstants";
import {jobAbbrevTranslated} from "./job_name_translator";
import {CharacterGearSet} from "@xivgear/core/gear";
import {installDragHelper} from "./draghelpers";

type SelectableSheet = {
    key: string,
    sheet: SheetExport,
    meta: SheetMetadata,
    get sortOrder(): number,
    set sortOrder(value: number),
    save(): void,
}

export function sheetMetaKey(sheetKey: string): string {
    return sheetKey + '-meta';
}

export function readSheetMeta(sheetKey: string): SheetMetadata {
    const metaKey = sheetMetaKey(sheetKey);
    const metaRaw = localStorage.getItem(metaKey);
    let meta: SheetMetadata;
    if (metaRaw) {
        meta = {
            ...DEFAULT_SHEET_METADATA,
            ...JSON.parse(metaRaw),
        };
    }
    else {
        meta = {
            ...DEFAULT_SHEET_METADATA,
        };
    }
    return meta;
}

class SheetManager {
    private readonly dataMap = new Map<string, SelectableSheet>();
    private lastData: SelectableSheet[] = [];

    constructor(private readonly storage: Storage) {
    }

    /**
     * Debug method which will reset the sort order of all sheets
     */
    resetAll(): void {
        this.lastData.forEach(item => {
            item.sortOrder = null;
        });
        this.readData();
        this.flush();
    }

    readData(): SelectableSheet[] {
        const items: SelectableSheet[] = [];
        const outer = this;
        for (const localStorageKey in localStorage) {
            if (localStorageKey.startsWith("sheet-save-")) {
                const imported = JSON.parse(this.storage.getItem(localStorageKey)) as SheetExport;
                if (imported.saveKey) {
                    if (this.dataMap.has(localStorageKey)) {
                        const existing = this.dataMap.get(localStorageKey);
                        items.push(existing);
                        continue;
                    }
                    const meta = readSheetMeta(localStorageKey);
                    const defaultSort = parseInt(localStorageKey.split('-')[2]);
                    let dirty = false;
                    const item = {
                        key: localStorageKey,
                        sheet: imported,
                        meta: meta,
                        get sortOrder(): number {
                            if (meta.sortOrder !== null) {
                                return meta.sortOrder;
                            }
                            return defaultSort;
                        },
                        set sortOrder(value: number | null) {
                            console.log("new sort", value);
                            meta.sortOrder = value;
                            dirty = true;
                        },
                        save() {
                            if (!dirty) {
                                return;
                            }
                            const metaKey = sheetMetaKey(localStorageKey);
                            outer.storage.setItem(metaKey, JSON.stringify(this.meta));
                            dirty = false;
                        },
                    } satisfies SelectableSheet;
                    this.dataMap.set(localStorageKey, item);
                    items.push(item);
                }
            }
        }
        this.lastData = items;
        // This has the effect of also sorting items
        this.resort();
        return items;
    }

    reorderTo(draggedSheet: SelectableSheet, draggedTo: SelectableSheet): 'up' | 'down' | null {
        // Index where we want the dragged sheet to go to
        const fromIndex = this.lastData.indexOf(draggedSheet);
        const toIndex = this.lastData.indexOf(draggedTo);
        const lastIndex = this.lastData.length - 1;
        // Four scenarios:
        // 1. Sheet is dragged to a position between two other sheets
        //  In this case, we can just set the sheet's sort order to be between the two other sheets
        // 2. Sheet is dragged to the end of the list
        //  In this case, we can set the sheet's sort order to the last item's index minus one
        // 3. Sheet is dragged to the beginning of the list
        //  In this case, we need to be careful - we want a *new* sheet to still be at the top of the list,
        //  so we set the sort order to be the index of the first sheet plus a very small amount.
        // 4. Sheet is dragged to itself
        //  No-op
        let out: 'down' | 'up';
        if (toIndex === 0) {
            // Scenario 3
            draggedSheet.sortOrder = draggedTo.sortOrder + 0.0001;
            out = 'up';
        }
        else if (toIndex === lastIndex) {
            draggedSheet.sortOrder = draggedTo.sortOrder - 1;
            out = 'down';
        }
        else if (draggedSheet === draggedTo) {
            // No-op
            return null;
        }
        else {
            // In-between
            // e.g. if index 4 is dragged to index 1, then it should push the existing index 1 down by taking on a
            // sort order value between the current index 0 and 1.
            // If index 4 is dragged to index 6, then it should push the existing index 6 up by taking on a sort
            // order value between the current index 6 and 7.
            const isDown: boolean = toIndex > fromIndex;
            const secondBasisIndex = toIndex + (isDown ? 1 : -1);
            const secondBasis = this.lastData[secondBasisIndex].sortOrder;
            const primaryBasis = draggedTo.sortOrder;
            const newSort = (primaryBasis + secondBasis) / 2;
            draggedSheet.sortOrder = newSort;
            out = isDown ? 'down' : 'up';
        }
        this.resort();
        return out;
    }

    private resort() {
        this.lastData.sort((left, right) => {
            return right.sortOrder - left.sortOrder;
        });

    }

    flush(): void {
        this.lastData.forEach(item => item.save());
    }
}


export class SheetPickerTable extends CustomTable<SelectableSheet, TableSelectionModel<SelectableSheet, never, never, SelectableSheet | null>> {
    private readonly mgr: SheetManager;

    constructor() {
        super();
        this.classList.add("gear-sheets-table");
        this.classList.add("hoverable");
        const outer = this;
        this.mgr = new SheetManager(localStorage);
        this.columns = [
            col({
                shortName: "sheetactions",
                displayName: "",
                getter: sheet => sheet,
                renderer: (sel: SelectableSheet) => {
                    const sheet = sel.sheet;
                    const div = document.createElement("div");
                    div.appendChild(makeActionButton([faIcon('fa-trash-can')], (ev) => {
                        if (confirmDelete(ev, `Delete sheet '${sheet.name}'?`)) {
                            deleteSheetByKey(sheet.saveKey);
                            this.readData();
                        }
                    }, `Delete sheet '${sheet.name}'`));
                    const hash = getHashForSaveKey(sheet.saveKey);
                    const linkUrl = new URL(`#/${hash.join('/')}`, document.location.toString());
                    const newTabLink = document.createElement('a');
                    newTabLink.href = linkUrl.toString();
                    newTabLink.target = '_blank';
                    newTabLink.appendChild(faIcon('fa-arrow-up-right-from-square', 'fa'));
                    newTabLink.addEventListener('mousedown', ev => {
                        ev.stopPropagation();
                    }, true);
                    newTabLink.classList.add('borderless-button');
                    newTabLink.title = `Open sheet '${sheet.name}' in a new tab/window`;
                    div.appendChild(newTabLink);
                    // Reorder dragger
                    const dragger = document.createElement('button');
                    dragger.title = 'Drag to re-order this set';
                    dragger.textContent = '≡';
                    dragger.classList.add('drag-handle');
                    let rowBeingDragged: null | CustomRow<CharacterGearSet> = null;
                    let lastDelta: number = 0;
                    installDragHelper({
                        dragHandle: dragger,
                        dragOuter: outer,
                        downHandler: (ev) => {
                            let target = ev.target;
                            while (target) {
                                if (target instanceof CustomRow) {
                                    console.log('Drag start: ' + target);
                                    rowBeingDragged = target;
                                    rowBeingDragged.classList.add('dragging');
                                    return;
                                }
                                else if (target instanceof Node) {
                                    target = target.parentElement as EventTarget;
                                }
                                else {
                                    break;
                                }
                            }
                            rowBeingDragged = null;
                        },
                        moveHandler: (ev) => {
                            if (!rowBeingDragged) {
                                return;
                            }
                            // let target = ev.target;
                            const dragY = ev.clientY;
                            const target = this._rows.find(row => {
                                const el = row.element;
                                if (!el || el === rowBeingDragged) {
                                    return false;
                                }
                                const br = el.getBoundingClientRect();
                                // Since rows are not necessarily the same height, instead of just checking bounds
                                // normally, we need to account for the height of whichever is larger.
                                const effectiveHeight = Math.min(br.height, rowBeingDragged.getBoundingClientRect().height);
                                return br.y < dragY && dragY < (br.y + effectiveHeight);
                            });
                            if (target instanceof CustomRow) {
                                const movement = this.mgr.reorderTo(sel, target.dataItem);
                                if (movement === 'up') {
                                    target.element.before(rowBeingDragged);
                                }
                                else if (movement === 'down') {
                                    target.element.after(rowBeingDragged);
                                }
                            }
                            const rect = rowBeingDragged.getBoundingClientRect();
                            const delta = ev.pageY - (rect.y - lastDelta) - (rect.height / 2);
                            lastDelta = delta;
                            rowBeingDragged.style.top = `${delta}px`;
                        },
                        upHandler: () => {
                            // this.sheet.requestSave();
                            lastDelta = 0;
                            rowBeingDragged.style.top = '';
                            rowBeingDragged.classList.remove('dragging');
                            console.log('Drag end');
                            rowBeingDragged = null;
                            outer.readData();
                            outer.mgr.flush();
                        },
                    });
                    div.appendChild(dragger);
                    return div;
                },
            }),
            // col({
            //     shortName: "sort",
            //     displayName: "Sort",
            //     getter: sheet => {
            //         return sheet.sortOrder;
            //     },
            //     // renderer: job => {
            //     //     return jobAbbrevTranslated(job);
            //     // },
            // }),
            col({
                shortName: "sheetjob",
                displayName: "Job",
                getter: sheet => {
                    if (sheet.sheet.isMultiJob) {
                        return JOB_DATA[sheet.sheet.job].role;
                    }
                    return sheet.sheet.job;
                },
                renderer: job => {
                    return jobAbbrevTranslated(job);
                },
            }),
            col({
                shortName: "sheetjobicon",
                displayName: "Job Icon",
                getter: sheet => {
                    if (sheet.sheet.isMultiJob) {
                        return JOB_DATA[sheet.sheet.job].role;
                    }
                    return sheet.sheet.job;
                },
                renderer: jobOrRole => {
                    return new JobIcon(jobOrRole);
                },
            }),
            {
                shortName: "sheetlevel",
                displayName: "Lvl",
                getter: sheet => sheet.sheet.level,
                fixedWidth: 40,
            },
            {
                shortName: "sheetname",
                displayName: "Sheet Name",
                getter: sheet => sheet.sheet.name,
            },
        ];
        this.readData();
        this.selectionModel = {
            clickCell() {
            },
            clickColumnHeader() {
            },
            clickRow(row: CustomRow<SelectableSheet>) {
                openSheetByKey(row.dataItem.key);
            },
            getSelection(): null {
                return null;
            },
            isCellSelectedDirectly() {
                return false;
            },
            isColumnHeaderSelected() {
                return false;
            },
            isRowSelected() {
                return false;
            },
            clearSelection(): void {

            },
        };
    }

    readData() {
        const data: typeof this.data = [];
        // "New sheet" button/row
        data.push(new SpecialRow(() => {
            const div = document.createElement("div");
            div.replaceChildren(faIcon('fa-plus', 'fa-solid'), 'New Sheet');
            return div;
        }, (row) => {
            row.classList.add('special-row-hoverable', 'new-sheet-row');
            row.addEventListener('click', () => startNewSheet());
        }));
        // Search row
        data.push(new SpecialRow(() => {
            const searchBox = document.createElement("input");
            searchBox.type = 'text';
            searchBox.placeholder = "Search";
            const clearBtn = makeActionButton([makeCloseButton()], () => {
                searchBox.value = '';
                searchBox.dispatchEvent(new Event('input'));
            });
            clearBtn.disabled = true;
            searchBox.addEventListener('input', () => {
                const searchValue = (searchBox.value ?? '').toLowerCase().trim();
                clearBtn.disabled = !searchValue;
                this.search(searchValue);
            });
            return quickElement('div', ['search-row'], [clearBtn, searchBox]);
        }, row => {
            row.classList.add('search-row-outer');
        }));
        const items: SelectableSheet[] = this.mgr.readData();
        data.push(...items);
        this.data = data;
    }

    search(searchValue: string | null) {
        this.dataRowMap.forEach(row => {
            if (!searchValue) {
                row.classList.remove('searched');
                // Display everything if no search value
                row.style.display = '';
            }
            else {
                row.classList.add('searched');
                if (row.textContent.toLowerCase().includes(searchValue)) {
                    row.style.display = '';
                }
                else {
                    row.style.display = 'none';
                }
            }
        });
    }
}

function startNewSheet() {
    showNewSheetForm();
}

customElements.define("gear-sheet-picker", SheetPickerTable, {extends: "table"});
