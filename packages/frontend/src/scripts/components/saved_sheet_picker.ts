import {col, CustomRow, CustomTable, SpecialRow, TableSelectionModel} from "@xivgear/common-ui/table/tables";
import {makeActionButton, makeAsyncActionButton, quickElement} from "@xivgear/common-ui/components/util";
import {SheetHandle, SheetManager, SyncStatus} from "@xivgear/core/persistence/saved_sheets";
import {getHashForSaveKey, openSheetByKey, showNewSheetForm} from "../base_ui";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";
import {JobIcon} from "./job_icon";
import {JOB_DATA} from "@xivgear/xivmath/xivconstants";
import {jobAbbrevTranslated} from "./job_name_translator";
import {CharacterGearSet} from "@xivgear/core/gear";
import {installDragHelper} from "./draghelpers";
import {ACCOUNT_STATE_TRACKER} from "../account/account_state";
import {UserDataSyncer} from "../account/user_data";
import {showAccountModal} from "../account/components/account_components";
import {Inactivitytimer} from "@xivgear/util/inactivitytimer";
import {ConflictResolutionDialog} from "./conflict_resolution_dialog";
import {
    errorIcon,
    makeCloseButton,
    makeNewTabIcon,
    makePlusIcon,
    makeTrashIcon
} from "@xivgear/common-ui/components/icons";

export class SheetPickerTable extends CustomTable<SheetHandle, TableSelectionModel<SheetHandle, never, never, SheetHandle | null>> {

    private readonly buttonRefresh: Inactivitytimer;
    private readonly conflictUpBtn: HTMLButtonElement;
    private readonly conflictDnBtn: HTMLButtonElement;

    constructor(private readonly mgr: SheetManager, private readonly uds: UserDataSyncer) {
        super();
        this.classList.add("gear-sheets-table");
        this.classList.add("hoverable");
        const outer = this;
        this.mgr.setUpdateHook('sheet-picker', {
            onSheetListChange(): void {
                // TODO: this causes flashing when the job icon elements get re-rendered
                outer.readData();
                outer.buttonRefresh.ping();
            },
            onSheetUpdate(handle: SheetHandle): void {
                outer.refreshCells(handle);
                outer.buttonRefresh.ping();
            },
        });
        this.columns = [
            col({
                shortName: "sheetactions",
                displayName: "",
                getter: sheet => sheet,
                renderer: (sel: SheetHandle) => {
                    const div = document.createElement("div");
                    div.appendChild(makeActionButton([makeTrashIcon()], (ev) => {
                        if (confirmDelete(ev, `Delete sheet '${sel.name}'?`)) {
                            sel.deleteLocal();
                            sel.flush();
                            this.readData();
                        }
                    }, `Delete sheet '${sel.name}'`));
                    const hash = getHashForSaveKey(sel.key);
                    const linkUrl = new URL(`#/${hash.join('/')}`, document.location.toString());
                    const newTabLink = document.createElement('a');
                    newTabLink.href = linkUrl.toString();
                    newTabLink.target = '_blank';
                    newTabLink.appendChild(makeNewTabIcon());
                    newTabLink.addEventListener('mousedown', ev => {
                        ev.stopPropagation();
                    }, true);
                    newTabLink.classList.add('borderless-button');
                    newTabLink.title = `Open sheet '${sel.name}' in a new tab/window`;
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
            col({
                shortName: "syncstatus",
                displayName: "Sync",
                getter: ss => {
                    if (ACCOUNT_STATE_TRACKER.loggedIn && ACCOUNT_STATE_TRACKER.accountState?.verified) {
                        return [ss.syncStatus, ss.busy];
                    }
                    return null;
                },
                renderer: (status: [SyncStatus, boolean] | null, handle) => {
                    if (status === null) {
                        return document.createTextNode('');
                    }
                    const out = [];
                    const statusType = status[0];
                    let action: 'none' | 'sync' | 'conflict' = 'none';
                    let tooltip = '';
                    switch (statusType) {
                        case "in-sync":
                            out.push('✓');
                            tooltip = 'This sheet is in sync';
                            break;
                        case "never-uploaded":
                        case "client-newer-than-server":
                            out.push('↑');
                            action = 'sync';
                            break;
                        case "never-downloaded":
                        case "server-newer-than-client":
                            out.push('↓');
                            action = 'sync';
                            break;
                        case "conflict":
                            out.push(errorIcon());
                            action = 'conflict';
                            tooltip = 'This sheet has been modified locally and on another device. Click to resolve conflict.';
                            break;
                        case "unknown":
                            out.push('?');
                            tooltip = 'Unknown - possible bug';
                            break;
                        case 'trash':
                            // This *shouldn't* happen
                            out.push(makeTrashIcon());
                            break;
                    }
                    const active = status[1];
                    if (active) {
                        out.push('...');
                    }
                    const statusHolder = quickElement('div', ['sync-status'], out);
                    if (action === 'conflict') {
                        statusHolder.addEventListener('mousedown', (e) => {
                            e.stopPropagation();
                            outer.showConflictResolution(handle);
                        });
                        statusHolder.classList.add('has-sync-action');
                    }
                    else if (action === 'sync') {
                        statusHolder.addEventListener('mousedown', (e) => {
                            e.stopPropagation();
                            uds.syncOne(handle);
                        });
                        statusHolder.classList.add('has-sync-action');
                    }
                    if (tooltip) {
                        statusHolder.title = tooltip;
                    }
                    return statusHolder;
                },
            }),
            col({
                shortName: "sheetjob",
                displayName: "Job",
                getter: sheet => {
                    if (sheet.multiJob) {
                        return JOB_DATA[sheet.job].role;
                    }
                    return sheet.job;
                },
                renderer: job => {
                    return jobAbbrevTranslated(job);
                },
                fixedData: true,
            }),
            col({
                shortName: "sheetjobicon",
                displayName: "Job Icon",
                getter: sheet => {
                    if (sheet.multiJob) {
                        return JOB_DATA[sheet.job].role;
                    }
                    return sheet.job;
                },
                renderer: jobOrRole => {
                    return new JobIcon(jobOrRole);
                },
                fixedData: true,
            }),
            {
                shortName: "sheetlevel",
                displayName: "Lvl",
                getter: sheet => sheet.level,
                fixedWidth: 40,
                fixedData: true,
            },
            {
                shortName: "sheetname",
                displayName: "Sheet Name",
                getter: sheet => sheet.name,
            },
        ];
        this.selectionModel = {
            clickCell() {
            },
            clickColumnHeader() {
            },
            clickRow(row: CustomRow<SheetHandle>) {
                if (row.dataItem.meta.localDeleted) {
                    // Cannot open a locally-deleted sheet. This can happen if the sheet is in
                    // a state of deletion conflict.
                    // Instead, open the conflict resolution UI.
                    setTimeout(() => {
                        outer.showConflictResolution(row.dataItem);
                    }, 20);
                }
                else {
                    openSheetByKey(row.dataItem.key);
                }
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
        this.conflictUpBtn = makeActionButton('Conflicts: Upload', async () => {
            this.mgr.allSheets.forEach(ss => {
                ss.conflictResolutionStrategy = 'keep-local';
                this.refreshCells(ss);
            });
            this.refreshButtons();
            this.uds.syncSheets();
        });
        this.conflictDnBtn = makeActionButton('Conflicts: Download', async () => {
            this.mgr.allSheets.forEach(ss => {
                ss.conflictResolutionStrategy = 'keep-remote';
                this.refreshCells(ss);
            });
            this.refreshButtons();
            this.uds.syncSheets();
        });
        this.buttonRefresh = new Inactivitytimer(2_000, () => {
            this.refreshButtons();
        });
        this.refreshButtons();
        this.readData();
    }

    private refreshButtons() {
        if (this.mgr.allSheets.find(ss => ss.syncStatus === 'conflict')) {
            this.conflictUpBtn.style.display = '';
            this.conflictDnBtn.style.display = '';
        }
        else {
            this.conflictUpBtn.style.display = 'none';
            this.conflictDnBtn.style.display = 'none';
        }

    }

    refreshCells(handle: SheetHandle): void {
        for (const cell of (this.dataRowMap.get(handle)?.dataColMap.values() ?? [])) {
            if (cell.colDef.shortName === 'syncstatus' || cell.colDef.shortName === 'sheetname') {
                cell.refreshFull();
            }
            this.buttonRefresh.ping();
        }
    }

    readData() {
        const data: typeof this.data = [];
        data.push(new SpecialRow(() => {

            // Items that only appear for logged-in and verified users
            const refreshButton = makeAsyncActionButton('Refresh', async () => {
                await this.uds.prepSheetSync();
            });
            // Sync also refreshes, so hide this from non-power-users
            refreshButton.style.display = 'none';
            const syncButton = makeAsyncActionButton('Sync Now', async () => {
                await this.uds.syncSheets();
            });
            const loggedInItems = [refreshButton, syncButton, this.conflictDnBtn, this.conflictUpBtn];
            loggedInItems.forEach(item => item.classList.add('require-account-state-verified'));

            // Items that only appear for non-logged-in-users
            const loginButton = makeActionButton('Login/Register', () => showAccountModal());
            const loggedOutText = quickElement('span', [], ['Not logged in - sheets are only stored on this browser!']);
            const loggedOutItems = [loginButton, loggedOutText];
            loggedOutItems.forEach(item => item.classList.add('require-account-state-logged-out'));

            // Items that only appear for logged-in but not verified users
            const verifyButton = makeActionButton('Verify', () => showAccountModal());
            const verifyText = quickElement('span', [], ['Not verified - sheets are only stored on this browser!']);
            const verifyItems = [verifyButton, verifyText];
            verifyItems.forEach(item => item.classList.add('require-account-state-unverified'));

            // Items displayed when account (actually token) state has not loaded yet.
            const accountLoadingText = quickElement('span', [], ['Checking account...']);
            const loadingItems = [accountLoadingText];
            loadingItems.forEach(item => item.classList.add('require-account-state-not-loaded'));

            return quickElement('div', ['sync-tools'], [...loggedInItems, ...loggedOutItems, ...verifyItems, ...loadingItems]);
        }));
        // "New sheet" button/row
        data.push(new SpecialRow(() => {
            const div = document.createElement("div");
            div.replaceChildren(makePlusIcon(), 'New Sheet');
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
        const items: SheetHandle[] = this.mgr.allDisplayableSheets;
        data.push(...items);
        this.data = data;
        this.buttonRefresh.ping();
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

    showConflictResolution(handle: SheetHandle) {
        new ConflictResolutionDialog(handle, this.uds).attachAndShowExclusively();
    }
}

function startNewSheet() {
    showNewSheetForm();
}

customElements.define("gear-sheet-picker", SheetPickerTable, {extends: "table"});
