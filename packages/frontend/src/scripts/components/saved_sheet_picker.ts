import {CustomCell, CustomColumn, CustomRow, CustomTable, SpecialRow, TitleRow} from "../tables";
import {SheetExport} from "@xivgear/xivmath/geartypes";
import {faIcon, makeActionButton} from "@xivgear/common-ui/components/util";
import {deleteSheetByKey} from "@xivgear/core/persistence/saved_sheets";
import {getHashForSaveKey, openSheetByKey, showNewSheetForm} from "../base_ui";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";

export class SheetPickerTable extends CustomTable<SheetExport, SheetExport> {
    constructor() {
        super();
        this.classList.add("gear-sheets-table");
        this.classList.add("hoverable");
        this.columns = [
            {
                shortName: "sheetactions",
                displayName: "",
                getter: sheet => sheet,
                renderer: (sheet: SheetExport) => {
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
                    return div;
                },
            },
            {
                shortName: "sheetlevel",
                displayName: "Lvl",
                getter: sheet => sheet.level,
                fixedWidth: 40,
            },
            {
                shortName: "sheetjob",
                displayName: "Job",
                getter: sheet => sheet.job,
                // renderer: job => {
                //     const out = document.createElement('div');
                //     out.replaceChildren(new JobIcon(job), job);
                //     return out;
                // },
                fixedWidth: 60,
            },
            {
                shortName: "sheetname",
                displayName: "Sheet Name",
                getter: sheet => sheet.name,
            }
        ];
        this.readData();
        this.selectionModel = {
            clickCell(cell: CustomCell<SheetExport, SheetExport>) {

            },
            clickColumnHeader(col: CustomColumn<SheetExport>) {

            },
            clickRow(row: CustomRow<SheetExport>) {
                openSheetByKey(row.dataItem.saveKey);
            },
            getSelection(): SheetExport {
                return null;
            },
            isCellSelectedDirectly(cell: CustomCell<SheetExport, SheetExport>) {
                return false;
            },
            isColumnHeaderSelected(col: CustomColumn<SheetExport>) {
                return false;
            },
            isRowSelected(row: CustomRow<SheetExport>) {
                return false;
            },
            clearSelection(): void {

            },
        };
    }

    readData() {
        const data: typeof this.data = [];
        data.push(new SpecialRow((table) => {
            const div = document.createElement("div");
            div.replaceChildren(faIcon('fa-plus', 'fa-solid'), 'New Sheet');
            return div;
        }, (row) => {
            row.classList.add('special-row-hoverable', 'new-sheet-row');
            row.addEventListener('click', () => startNewSheet());
        }));
        const items: SheetExport[] = [];
        for (const localStorageKey in localStorage) {
            if (localStorageKey.startsWith("sheet-save-")) {
                const imported = JSON.parse(localStorage.getItem(localStorageKey)) as SheetExport;
                if (imported.saveKey) {
                    items.push(imported);
                }
            }
        }
        if (items.length === 0) {
            data.push(new TitleRow("You don't have any sheets. Click 'New Sheet' to get started."));
        }
        else {
            items.sort((left, right) => {
                return parseInt(right.saveKey.split('-')[2]) - parseInt(left.saveKey.split('-')[2]);
            });
            data.push(...items);
        }
        this.data = data;
    }
}

function startNewSheet() {
    showNewSheetForm();
}

customElements.define("gear-sheet-picker", SheetPickerTable, {extends: "table",});
