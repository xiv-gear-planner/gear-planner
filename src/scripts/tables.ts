export class CustomTableHeaderRow<X> extends HTMLTableRowElement {
    constructor(table: CustomTable<any, any>) {
        super();
        for (let column of table.columns) {
            const headerCell = document.createElement("th");
            headerCell.textContent = column.displayName;
            headerCell.setAttribute("col-id", column.shortName);
            this.appendChild(headerCell);
        }
    }

}

export class CustomTableTitleRow extends HTMLTableRowElement {
    constructor(table: CustomTable<any, any>, title: (string | Node)) {
        super();
        let node;
        if (title instanceof Node) {
            node = title;
        }
        else {
            node = document.createTextNode(title);
        }
        const cell = document.createElement("th");
        cell.colSpan = 9999;
        cell.appendChild(node);
        this.appendChild(cell);
    }
}

export interface SelectionModel<X, Y> {
    getSelection(): Y;

    clickCell(cell: CustomCell<X>);

    clickColumnHeader(col: CustomColumnDef<X>);

    clickRow(row: CustomRow<X>);

    isCellSelectedDirectly(cell: CustomCell<X>);

    isRowSelected(row: CustomRow<X>);

    isColumnHeaderSelected(col: CustomColumnDef<X>);
}

export const noopSelectionModel: SelectionModel<any, undefined> = {
    isCellSelectedDirectly(cell: CustomCell<any>) {
        return false;
    },
    clickCell(cell: CustomCell<any>) {
    }, clickColumnHeader(col: CustomColumnDef<any>) {
    }, clickRow(cell: CustomRow<any>) {
    }, getSelection(): undefined {
        return undefined;
    }, isColumnHeaderSelected(col: CustomColumnDef<any>) {
        return false;
    }, isRowSelected(item: any) {
        return false;
    }
}

export interface SelectionListener<Y> {
    onNewSelection(newSelection: Y);
}

export type SingleCellRowOrHeaderSelect<X> = CustomColumnDef<X> | CustomCell<X> | CustomRow<X> | undefined;

export class SingleSelectionModel<X, Y = never> implements SelectionModel<X, SingleCellRowOrHeaderSelect<X> | Y> {

    private _selection: Y | SingleCellRowOrHeaderSelect<X> = undefined;
    private _listeners: SelectionListener<Y | SingleCellRowOrHeaderSelect<X>>[] = [];

    private notifyListeners() {
        for (let listener of this._listeners) {
            listener.onNewSelection(this.getSelection());
        }
    }

    addListener(listener: SelectionListener<Y>) {
        this._listeners.push(listener);
    }

    getSelection(): Y | SingleCellRowOrHeaderSelect<X> {
        return this._selection;
    }

    clickCell(cell: CustomCell<X>) {
        this._selection = cell;
        this.notifyListeners();
    }

    clickColumnHeader(col: CustomColumnDef<X>) {
        this._selection = col;
        this.notifyListeners();
    }

    clickRow(row: CustomRow<X>) {
        this._selection = row;
        this.notifyListeners();
    }

    isCellSelectedDirectly(cell: CustomCell<X>) {
        return cell === this._selection;
    }

    isRowSelected(row: CustomRow<X>) {
        return row === this._selection;
    }

    isColumnHeaderSelected(col: CustomColumnDef<X>) {
        return col === this._selection;
    }

    // TODO
    // removeListener(listener: SimpleSelectionListener<X>) {
    //     this._listeners.
    // }
}

export class HeaderRow {

}

export class TitleRow {
    title: string;
    constructor(title: string) {
        this.title = title;
    }
}

export class CustomTable<X, Y = never> extends HTMLTableElement {
    _data: (X | HeaderRow | TitleRow)[];
    dataRowMap: Map<X, CustomRow<X>> = new Map<X, CustomRow<X>>();
    columns: CustomColumnDef<X>[];
    // TODO
    // selectionEnabled: boolean;
    selectionModel: SelectionModel<X, Y> = noopSelectionModel;
    curSelection: Y = null;

    constructor() {
        super();
        this.appendChild(this.createTHead());
        this.appendChild(this.createTBody());
        this.addEventListener('click', ev => {
            this.handleClick(ev);
        })
    }

    set data(newData: (X | HeaderRow | TitleRow)[]) {
        // TODO
        this._data = newData;
        this.refreshFull();
    }

    refreshFull() {
        const newRowElements: Node[] = [];
        for (let item of this._data) {
            if (item instanceof HeaderRow) {
                const header = new CustomTableHeaderRow(this);
                newRowElements.push(header);
            }
            else if (item instanceof TitleRow) {
                newRowElements.push(new CustomTableTitleRow(this, item.title));
            } else {
                if (this.dataRowMap.has(item)) {
                    newRowElements.push(this.dataRowMap.get(item));
                }
                else {
                    const newRow = new CustomRow<X>(item, this);
                    this.dataRowMap.set(item, newRow);
                    newRowElements.push(newRow);
                }
            }
        }
        this.tBodies[0].replaceChildren(...newRowElements);
        for (let value of newRowElements.values()) {
            if (value instanceof CustomRow) {
                value.refresh();
            }
        }
        this.refreshSelection();
    }

    refreshSelection() {
        this.curSelection = this.selectionModel.getSelection();
        for (let value of this.dataRowMap.values()) {
            value.refreshSelection();
        }
    }

    handleClick(ev) {
        if (ev.target instanceof CustomRow) {
            this.selectionModel.clickRow(ev.target);
        }
        else if (ev.target instanceof CustomCell) {
            if (ev.target.colDef.allowCellSelection) {
                this.selectionModel.clickCell(ev.target);
            }
            else {
                this.selectionModel.clickRow(ev.target.row);
            }
        }
        this.refreshSelection();
    }
}

export class CustomColumnDef<X> {
    shortName: string;
    displayName: string;
    getter: (item: X) => Node | string;
    allowHeaderSelection?: boolean = false;
    allowCellSelection?: boolean = false;
}

export class CustomRow<X> extends HTMLTableRowElement {
    dataItem: X;
    table: CustomTable<X, any>;
    dataColMap: Map<CustomColumnDef<X>, CustomCell<X>> = new Map<CustomColumnDef<X>, CustomCell<X>>();
    private _selected: boolean = false;

    constructor(dataItem: X, table: CustomTable<X, any>) {
        super();
        this.dataItem = dataItem;
        this.table = table;
        this.refresh();
    }

    refresh() {
        const newColElements: CustomCell<X>[] = [];
        for (let col of this.table.columns) {
            if (this.dataColMap.has(col)) {
                newColElements.push(this.dataColMap.get(col));
            }
            else {
                const newRow = new CustomCell<X>(this.dataItem, col, this);
                this.dataColMap.set(col, newRow);
                newColElements.push(newRow);
            }
        }
        // @ts-ignore
        this.replaceChildren(...newColElements);
        for (let value of this.dataColMap.values()) {
            value.refresh();
        }
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = this.table.selectionModel.isRowSelected(this);
        for (let value of this.dataColMap.values()) {
            value.refreshSelection();
        }
    }

    set selected(selected) {
        if (this._selected === selected) {
            return;
        }
        this._selected = selected;
        this.setAttribute("is-selected", selected);
    }
}

export class CustomCell<X> extends HTMLTableCellElement {

    private dataItem: X;
    colDef: CustomColumnDef<X>;
    row: CustomRow<X>;
    private _selected: boolean = false;

    constructor(dataItem: X, colDef: CustomColumnDef<X>, row: CustomRow<X>) {
        super();
        this.dataItem = dataItem;
        this.colDef = colDef;
        this.row = row;
        this.setAttribute("col-id", colDef.shortName);
        this.refresh();
    }

    refresh() {

        let result: Node | string;
        try {
            result = this.colDef.getter(this.dataItem);
        } catch (e) {
            console.error(e);
            result = "Error";
        }
        if (result instanceof String) {
            result = document.createTextNode(result as string);
        }
        this.replaceChildren(result);
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = (this.row.table.selectionModel.isCellSelectedDirectly(this));
    }

    set selected(selected) {
        if (this._selected === selected) {
            return;
        }
        this._selected = selected;
        this.setAttribute("is-selected", selected);
    }

}

customElements.define("custom-table-row", CustomRow, {extends: "tr"})
customElements.define("custom-table", CustomTable, {extends: "table"})
customElements.define("custom-table-cell", CustomCell, {extends: "td"})
customElements.define("custom-table-header-row", CustomTableHeaderRow, {extends: "tr"})
customElements.define("custom-table-title-row", CustomTableTitleRow, {extends: "tr"})
