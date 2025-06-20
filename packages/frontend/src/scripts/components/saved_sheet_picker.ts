import {col, CustomRow, CustomTable, SpecialRow, TableSelectionModel} from "@xivgear/common-ui/table/tables";
import {faIcon, makeActionButton, makeCloseButton, quickElement} from "@xivgear/common-ui/components/util";
import {deleteSheetByKey, SheetHandle, SheetManager} from "@xivgear/core/persistence/saved_sheets";
import {getHashForSaveKey, openSheetByKey, showNewSheetForm} from "../base_ui";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";
import {JobIcon} from "./job_icon";
import {JOB_DATA} from "@xivgear/xivmath/xivconstants";
import {jobAbbrevTranslated} from "./job_name_translator";
import {CharacterGearSet} from "@xivgear/core/gear";
import {installDragHelper} from "./draghelpers";
import {SHEET_MANAGER} from "./saved_sheet_impl";

export class SheetPickerTable extends CustomTable<SheetHandle, TableSelectionModel<SheetHandle, never, never, SheetHandle | null>> {
    private readonly mgr: SheetManager;

    constructor() {
        super();
        this.classList.add("gear-sheets-table");
        this.classList.add("hoverable");
        const outer = this;
        this.mgr = SHEET_MANAGER;
        this.columns = [
            col({
                shortName: "sheetactions",
                displayName: "",
                getter: sheet => sheet,
                renderer: (sel: SheetHandle) => {
                    const sheet = sel.data;
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
                            // TODO: currently, a reorder will not cause a version bump, so it will never get synced.
                            // TODO: shouldn't the flush happen before the readData call?
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
                shortName: "syncstatus",
                displayName: "Sync",
                getter: ss => {
                    return ss.syncStatus;
                },
            }),
            col({
                shortName: "sheetjob",
                displayName: "Job",
                getter: sheet => {
                    if (sheet.data.isMultiJob) {
                        return JOB_DATA[sheet.data.job].role;
                    }
                    return sheet.data.job;
                },
                renderer: job => {
                    return jobAbbrevTranslated(job);
                },
            }),
            col({
                shortName: "sheetjobicon",
                displayName: "Job Icon",
                getter: sheet => {
                    if (sheet.data.isMultiJob) {
                        return JOB_DATA[sheet.data.job].role;
                    }
                    return sheet.data.job;
                },
                renderer: jobOrRole => {
                    return new JobIcon(jobOrRole);
                },
            }),
            {
                shortName: "sheetlevel",
                displayName: "Lvl",
                getter: sheet => sheet.data.level,
                fixedWidth: 40,
            },
            {
                shortName: "sheetname",
                displayName: "Sheet Name",
                getter: sheet => sheet.data.name,
            },
        ];
        this.readData();
        this.selectionModel = {
            clickCell() {
            },
            clickColumnHeader() {
            },
            clickRow(row: CustomRow<SheetHandle>) {
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
        const items: SheetHandle[] = this.mgr.readData();
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
