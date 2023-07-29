
function setCellProps(cell: HTMLTableCellElement, colDef: CustomColumnDef<any, any>) {
    cell.setAttribute("col-id", colDef.shortName);
    if (colDef.initialWidth !== undefined) {
        cell.style.width = cell.style.minWidth = cell.style.maxWidth = colDef.initialWidth + "px";
    }
    if (colDef.fixedWidth !== undefined) {
        // Do the same thing but consider it non-resizable
        cell.style.width = cell.style.minWidth = cell.style.maxWidth = colDef.fixedWidth + "px";
    }
}

export class CustomTableHeaderRow<X> extends HTMLTableRowElement {
    constructor(table: CustomTable<any, any>) {
        super();
        for (let column of table.columns) {
            const headerCell = document.createElement("th");
            headerCell.textContent = column.displayName;
            setCellProps(headerCell, column);
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

    clickCell(cell: CustomCell<X, Y>);

    clickColumnHeader(col: CustomColumnDef<X>);

    clickRow(row: CustomRow<X>);

    isCellSelectedDirectly(cell: CustomCell<X, Y>);

    isRowSelected(row: CustomRow<X>);

    isColumnHeaderSelected(col: CustomColumnDef<X>);

    clearSelection(): void;
}

export const noopSelectionModel: SelectionModel<any, undefined> = {
    isCellSelectedDirectly(cell: CustomCell<any, any>) {
        return false;
    },
    clickCell(cell: CustomCell<any, any>) {
    }, clickColumnHeader(col: CustomColumnDef<any>) {
    }, clickRow(cell: CustomRow<any>) {
    }, getSelection(): undefined {
        return undefined;
    }, isColumnHeaderSelected(col: CustomColumnDef<any>) {
        return false;
    }, isRowSelected(item: any) {
        return false;
    }, clearSelection() {
    }
}

export interface SelectionListener<Y> {
    onNewSelection(newSelection: Y);
}

export type SingleCellRowOrHeaderSelect<X> = CustomColumnDef<X> | CustomCell<X, any> | CustomRow<X> | undefined;

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

    clickCell(cell: CustomCell<X, Y>) {
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

    isCellSelectedDirectly(cell: CustomCell<X, Y>) {
        return cell === this._selection;
    }

    isRowSelected(row: CustomRow<X>) {
        return row === this._selection;
    }

    isColumnHeaderSelected(col: CustomColumnDef<X>) {
        return col === this._selection;
    }

    clearSelection() {
        this._selection = undefined;
        this.notifyListeners();
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

export class SpecialRow<X, Y> {

    creator: (table: CustomTable<X, Y>) => Node

    constructor(creator) {
        this.creator = creator;
    }
}

export class CustomTable<X, Y = never> extends HTMLTableElement {
    _data: (X | HeaderRow | TitleRow)[] = [];
    dataRowMap: Map<X, CustomRow<X>> = new Map<X, CustomRow<X>>();
    _columns: CustomColumnDef<X, any>[];
    // TODO
    // selectionEnabled: boolean;
    selectionModel: SelectionModel<X, Y> = noopSelectionModel;
    curSelection: Y = null;

    constructor() {
        super();
        this.appendChild(this.createTHead());
        this.appendChild(this.createTBody());
        this.addEventListener('mousedown', ev => {
            this.handleClick(ev);
        })
    }

    get columns() {
        return this._columns;
    }

    set columns(cols) {
        this._columns = cols.map(colDefPartial => {
            const out = new CustomColumnDef();
            Object.assign(out, colDefPartial);
            return out;
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
            }
            else if (item instanceof SpecialRow) {
                newRowElements.push(new CustomTableTitleRow(this, item.creator(this)));
            }
            else {
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
        this._handleClick(ev.target);
    }

    _handleClick(target) {
        if (target instanceof CustomRow) {
            this.selectionModel.clickRow(target);
            this.refreshSelection();
        }
        else if (target instanceof CustomCell) {
            if (target.colDef.allowCellSelection) {
                this.selectionModel.clickCell(target);
            }
            else {
                this.selectionModel.clickRow(target.row);
            }
            this.refreshSelection();
        }
        else if (target instanceof HTMLButtonElement) {
            // Assume buttons will handle themselves
        }
        else if (target === undefined || target === null) {
            return;
        }
        else {
            this._handleClick(target.parentElement);
        }
    }
}

export class CustomColumnDef<X, Y = string> {
    shortName: string;
    displayName: string;
    allowHeaderSelection?: boolean = false;
    allowCellSelection?: boolean = false;
    getter: (item: X) => Y;
    renderer?: (value: Y) => Node = (value) => document.createTextNode(value.toString());
    colStyler?: (value: Y, colElement: CustomCell<X, Y>, internalElement: Node) => void = (value, colElement, internalElement) => {
        if (value) {
            colElement.classList.add("value-truthy")
        }
        else {
            colElement.classList.add("value-falsey")
        }
    };
    initialWidth?: number | undefined = undefined;
    fixedWidth?: number | undefined = undefined;
}

export class CustomRow<X> extends HTMLTableRowElement {
    dataItem: X;
    table: CustomTable<X, any>;
    dataColMap: Map<CustomColumnDef<X>, CustomCell<X, any>> = new Map<CustomColumnDef<X>, CustomCell<X, any>>();
    private _selected: boolean = false;

    constructor(dataItem: X, table: CustomTable<X, any>) {
        super();
        this.dataItem = dataItem;
        this.table = table;
        this.refresh();
    }

    refresh() {
        const newColElements: CustomCell<X, any>[] = [];
        for (let col of this.table.columns) {
            if (this.dataColMap.has(col)) {
                newColElements.push(this.dataColMap.get(col));
            }
            else {
                const newCell = new CustomCell<X, any>(this.dataItem, col, this);
                this.dataColMap.set(col, newCell);
                newColElements.push(newCell);
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

export class CustomCell<X, Y> extends HTMLTableCellElement {

    dataItem: X;
    colDef: CustomColumnDef<X, Y>;
    row: CustomRow<X>;
    _value: Y;
    private _selected: boolean = false;

    constructor(dataItem: X, colDef: CustomColumnDef<X, Y>, row: CustomRow<X>) {
        super();
        this.dataItem = dataItem;
        this.colDef = colDef;
        this.row = row;
        this.setAttribute("col-id", colDef.shortName);
        this.refresh();
        setCellProps(this, colDef);
    }

    refresh() {
        let node: Node;
        try {
            this._value = this.colDef.getter(this.dataItem);
            node = this.colDef.renderer(this._value);
            this.colDef.colStyler(this._value, this, node);
        } catch (e) {
            console.error(e);
            node = document.createTextNode("Error");
        }
        this.replaceChildren(node);
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = (this.row.table.selectionModel.isCellSelectedDirectly(this));
    }

    get value() {
        return this._value;
    }

    set selected(selected) {
        if (this._selected === selected) {
            return;
        }
        this._selected = selected;
        this.setAttribute("is-selected", String(selected));
    }

    get selected() {
        return this._selected;
    }

}

customElements.define("custom-table-row", CustomRow, {extends: "tr"})
customElements.define("custom-table", CustomTable, {extends: "table"})
customElements.define("custom-table-cell", CustomCell, {extends: "td"})
customElements.define("custom-table-header-row", CustomTableHeaderRow, {extends: "tr"})
customElements.define("custom-table-title-row", CustomTableTitleRow, {extends: "tr"})
