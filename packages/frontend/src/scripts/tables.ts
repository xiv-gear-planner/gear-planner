/* eslint-disable @typescript-eslint/no-explicit-any */
function setCellProps(cell: HTMLTableCellElement, colDef: CustomColumn<any, any>) {
    cell.setAttribute("col-id", colDef.shortName);
    const extraClasses = colDef.extraClasses;
    if (extraClasses) {
        cell.classList.add(...extraClasses);
    }
    cell.classList.add();
    if (colDef.initialWidth !== undefined) {
        cell.style.width = cell.style.minWidth = cell.style.maxWidth = colDef.initialWidth + "px";
    }
    if (colDef.fixedWidth !== undefined) {
        // Do the same thing but consider it non-resizable
        cell.style.width = cell.style.minWidth = cell.style.maxWidth = colDef.fixedWidth + "px";
    }
}

export class CustomTableHeaderCell<RowDataType, CellDataType, ColumnDataType> extends HTMLTableCellElement implements SelectionRefresh {
    private readonly _colDef: CustomColumn<RowDataType, CellDataType, ColumnDataType>;
    private _selected: boolean = false;
    private table: CustomTable<RowDataType, any>;
    private readonly span: HTMLSpanElement;

    constructor(table: CustomTable<RowDataType, any>, columnDef: CustomColumn<RowDataType, CellDataType, ColumnDataType>) {
        super();
        this.table = table;
        this._colDef = columnDef;
        this.span = document.createElement('div');
        this.appendChild(this.span);
        this.refreshFull();
        setCellProps(this, columnDef);
        if (columnDef.headerStyler) {
            columnDef.headerStyler(columnDef.dataValue, this);
        }
        this.refreshSelection();
    }

    get colDef() {
        return this._colDef;
    }

    setName() {
        this.span.textContent = this.colDef.displayName;
    }

    refreshFull() {
        this.setName();
    }

    refreshSelection() {
        this.selected = this.table.selectionModel.isColumnHeaderSelected(this._colDef as CustomColumn<RowDataType>);
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

export class CustomTableHeaderRow<RowDataType> extends HTMLTableRowElement implements SelectionRefresh, RefreshableRow<RowDataType> {
    _cells: CustomTableHeaderCell<RowDataType, any, any>[] = [];

    constructor(table: CustomTable<RowDataType, any>) {
        super();
        for (const column of table.columns) {
            const headerCell = new CustomTableHeaderCell(table, column);
            this.appendChild(headerCell);
            this._cells.push(headerCell);
        }
    }

    refreshFull() {
        this._cells.forEach(cell => cell.refreshFull());
    }

    refreshColumn(colDef: CustomColumn<RowDataType>) {
        this._cells.find(cell => cell.colDef == colDef)?.refreshFull();
    }

    refreshSelection() {
        this._cells.forEach(cell => cell.refreshSelection());
    }

    get element(): HTMLElement {
        return this;
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

export interface SelectionModel<RowDataType, SelectionType> {
    getSelection(): SelectionType;

    clickCell(cell: CustomCell<RowDataType, SelectionType>);

    clickColumnHeader(col: CustomColumn<RowDataType>);

    clickRow(row: CustomRow<RowDataType>);

    isCellSelectedDirectly(cell: CustomCell<RowDataType, SelectionType>);

    isRowSelected(row: CustomRow<RowDataType>);

    isColumnHeaderSelected(col: CustomColumn<RowDataType>);

    clearSelection(): void;
}

export const noopSelectionModel: SelectionModel<any, undefined> = {
    isCellSelectedDirectly(cell: CustomCell<any, any>) {
        return false;
    },
    clickCell(cell: CustomCell<any, any>) {
    },
    clickColumnHeader(col: CustomColumn<any>) {
    },
    clickRow(cell: CustomRow<any>) {
    },
    getSelection(): undefined {
        return undefined;
    },
    isColumnHeaderSelected(col: CustomColumn<any>) {
        return false;
    },
    isRowSelected(item: any) {
        return false;
    },
    clearSelection() {
    }
};

export interface SelectionListener<SelectionType> {
    onNewSelection(newSelection: SelectionType);
}

export type SingleCellRowOrHeaderSelect<X> = CustomColumn<X> | CustomCell<X, any> | CustomRow<X> | undefined;

export class SingleSelectionModel<TableDataType, ExtraType = never> implements SelectionModel<TableDataType, SingleCellRowOrHeaderSelect<TableDataType> | ExtraType> {

    private _selection: ExtraType | SingleCellRowOrHeaderSelect<TableDataType> = undefined;
    private _listeners: SelectionListener<ExtraType | SingleCellRowOrHeaderSelect<TableDataType>>[] = [];

    private notifyListeners() {
        for (const listener of this._listeners) {
            listener.onNewSelection(this.getSelection());
        }
    }

    addListener(listener: SelectionListener<SingleCellRowOrHeaderSelect<TableDataType> | ExtraType>) {
        this._listeners.push(listener);
    }

    getSelection(): ExtraType | SingleCellRowOrHeaderSelect<TableDataType> {
        return this._selection;
    }

    clickCell(cell: CustomCell<TableDataType, ExtraType>) {
        this._selection = cell;
        this.notifyListeners();
    }

    clickColumnHeader(col: CustomColumn<TableDataType>) {
        this._selection = col;
        this.notifyListeners();
    }

    clickRow(row: CustomRow<TableDataType>) {
        this._selection = row;
        this.notifyListeners();
    }

    isCellSelectedDirectly(cell: CustomCell<TableDataType, ExtraType>) {
        return cell === this._selection;
    }

    isRowSelected(row: CustomRow<TableDataType>) {
        return row === this._selection;
    }

    isColumnHeaderSelected(col: CustomColumn<TableDataType>) {
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

export class SpecialRow<RowDataType, SelectionType> {
    constructor(public readonly creator: (table: CustomTable<RowDataType, SelectionType>) => Node,
                public readonly finisher: (row: CustomTableTitleRow, table: CustomTable<RowDataType, SelectionType>) => void = () => null) {
    }
}

export interface SelectionRefresh {
    refreshSelection(): void;
}

export interface RefreshableRow<X> {
    refreshFull(),

    refreshColumn(colDef: CustomColumn<X>),

    get element(): HTMLElement
}

export class CustomTable<RowDataType, SelectionType = never> extends HTMLTableElement {
    _data: (RowDataType | HeaderRow | TitleRow)[] = [];
    dataRowMap: Map<RowDataType, CustomRow<RowDataType>> = new Map<RowDataType, CustomRow<RowDataType>>();
    selectionRefreshables: SelectionRefresh[] = [];
    _rows: RefreshableRow<RowDataType>[] = [];
    _columns: CustomColumn<RowDataType, any>[];
    // TODO
    // selectionEnabled: boolean;
    selectionModel: SelectionModel<RowDataType, SelectionType> = noopSelectionModel;
    curSelection: SelectionType = null;

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

    set columns(cols: CustomColumnSpec<RowDataType, any, any>[]) {
        this._columns = cols.flatMap(colDefPartial => {
            const out = new CustomColumn(colDefPartial);
            Object.assign(out, colDefPartial);
            if (out.condition()) {
                return [out];
            }
            else {
                return []
            }
        });
        // TODO: see if successive refreshFull calls can be coalesced
        this._onDataChanged();
        this.refreshFull();
    }

    set data(newData: (RowDataType | HeaderRow | TitleRow)[]) {
        // TODO
        this._data = newData;
        this._onDataChanged();
    }

    get data(): (RowDataType | HeaderRow | TitleRow)[] {
        return [...this._data];
    }

    /**
     * To be called when rows or columns are added, removed, or rearranged, but not
     * when only the data within cells is changed.
     *
     * @private
     */
    private _onDataChanged() {
        const newRowElements: Node[] = [];
        for (const item of this._data) {
            if (item instanceof HeaderRow) {
                const header = new CustomTableHeaderRow(this);
                newRowElements.push(header);
            }
            else if (item instanceof TitleRow) {
                newRowElements.push(new CustomTableTitleRow(this, item.title));
            }
            else if (item instanceof SpecialRow) {
                const out = new CustomTableTitleRow(this, item.creator(this));
                item.finisher(out, this);
                newRowElements.push(out);
            }
            else {
                if (this.dataRowMap.has(item)) {
                    newRowElements.push(this.dataRowMap.get(item));
                }
                else {
                    const newRow = new CustomRow<RowDataType>(item, this, {noInitialRefresh: true});
                    this.dataRowMap.set(item, newRow);
                    newRow.refreshFull();
                    newRowElements.push(newRow);
                }
            }
        }
        this.tBodies[0].replaceChildren(...newRowElements);
        this.selectionRefreshables = [];
        this._rows = [];
        for (const value of newRowElements.values()) {
            if (value instanceof CustomRow) {
                this.selectionRefreshables.push(value);
                this._rows.push(value);
            }
            else if (value instanceof CustomTableHeaderRow) {
                this.selectionRefreshables.push(value);
                this._rows.push(value);
            }
        }
        this.refreshSelection();
    }

    refreshFull() {
        for (const row of this._rows) {
            row.refreshFull();
        }
    }

    refreshSelection() {
        for (const value of this.selectionRefreshables) {
            value.refreshSelection();
        }
    }

    refreshRowData(item: CustomRow<RowDataType> | RowDataType) {
        if (item === undefined) {
            return;
        }
        if (item instanceof CustomRow) {
            item.refreshFull();
        }
        else {
            const row = this.dataRowMap.get(item);
            if (row) {
                row.refreshFull();
            }
        }
    }

    refreshColumn(item: CustomColumn<RowDataType> | any) {
        if (item instanceof CustomColumn) {
            for (const row of this._rows) {
                row.refreshColumn(item);
            }
        }
        else {
            const col = this._columns.find(col => col.dataValue === item);
            if (col) {
                for (const row of this._rows) {
                    row.refreshColumn(col);
                }
            }
        }
    }

    refreshColHeaders() {
        for (const row of this._rows) {
            if (row instanceof CustomTableHeaderRow) {
                row.refreshFull();
            }
        }
    }

    handleClick(ev: MouseEvent) {
        if (ev.button === 0) {
            this._handleClick(ev.target);
        }
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
        else if (target instanceof CustomTableHeaderCell) {
            if (target.colDef.allowHeaderSelection) {
                this.selectionModel.clickColumnHeader(target.colDef);
                this.refreshSelection();
            }
        }
        else if (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) {
            // Assume buttons/inputs will handle themselves
        }
        else if (target === undefined || target === null) {
            return;
        }
        else {
            this._handleClick(target.parentElement);
        }
    }
}

export type CellRenderer<RowDataType, CellDataType> = (value: CellDataType, rowValue: RowDataType) => Node | null;
export type ColStyler<RowDataType, CellDataType> = (value: CellDataType, colElement: CustomCell<RowDataType, CellDataType>, internalElement: Node, rowValue: RowDataType) => void;

export interface CustomColumnSpec<RowDataType, CellDataType = string, ColumnDataType = any> {
    shortName: string;
    displayName: string;
    allowHeaderSelection?: boolean;
    allowCellSelection?: boolean;
    getter: (item: RowDataType) => CellDataType;
    renderer?: CellRenderer<RowDataType, CellDataType>;
    colStyler?: ColStyler<RowDataType, CellDataType>;
    condition?: () => boolean;
    initialWidth?: number | undefined;
    fixedWidth?: number | undefined;
    dataValue?: ColumnDataType;
    headerStyler?: (value: ColumnDataType, colHeader: CustomTableHeaderCell<RowDataType, CellDataType, ColumnDataType>) => void;
    extraClasses?: string[]
}

export class CustomColumn<RowDataType, CellDataType = string, ColumnDataType = any> {
    private _original?: CustomColumnSpec<RowDataType, CellDataType, ColumnDataType>;

    constructor(colDefPartial: CustomColumnSpec<RowDataType, CellDataType, ColumnDataType>) {
        Object.assign(this, colDefPartial);
        this._original = colDefPartial;
    }

    shortName: string;

    get displayName() {
        // Name can change after the fact, so query the original spec
        return this._original.displayName;
    };

    // noinspection JSUnusedGlobalSymbols
    set displayName(ignored) {
    };

    allowHeaderSelection?: boolean = false;
    allowCellSelection?: boolean = false;
    getter: (item: RowDataType) => CellDataType;
    renderer?: CellRenderer<RowDataType, CellDataType> = (value) => document.createTextNode(value.toString());
    colStyler?: ColStyler<RowDataType, CellDataType> = (value, colElement, internalElement) => {
        if (value) {
            colElement.classList.add("value-truthy")
        }
        else {
            colElement.classList.add("value-falsey")
        }
    };
    condition?: () => boolean = () => true;
    initialWidth?: number | undefined = undefined;
    extraClasses?: string[] = undefined;
    fixedWidth?: number | undefined = undefined;
    dataValue?: ColumnDataType;
    headerStyler?: (value: ColumnDataType, colHeader: CustomTableHeaderCell<RowDataType, CellDataType, ColumnDataType>) => void;
}

export type RefreshableOpts = {
    noInitialRefresh?: boolean;
}

export class CustomRow<RowDataType> extends HTMLTableRowElement implements RefreshableRow<RowDataType> {
    dataItem: RowDataType;
    table: CustomTable<RowDataType, any>;
    dataColMap: Map<CustomColumn<RowDataType>, CustomCell<RowDataType, any>> = new Map<CustomColumn<RowDataType>, CustomCell<RowDataType, any>>();
    private _selected: boolean = false;

    constructor(dataItem: RowDataType, table: CustomTable<RowDataType, any>, opts?: RefreshableOpts) {
        super();
        this.dataItem = dataItem;
        this.table = table;
        if (!(opts?.noInitialRefresh)) {
            this.refreshFull();
        }
    }

    refreshColumn(colDef: CustomColumn<RowDataType, string, any>) {
        this.dataColMap.get(colDef)?.refreshFull();
    }

    refreshFull() {
        const newColElements: CustomCell<RowDataType, any>[] = [];
        for (const col of this.table.columns) {
            if (this.dataColMap.has(col)) {
                newColElements.push(this.dataColMap.get(col));
            }
            else {
                const newCell = new CustomCell<RowDataType, any>(this.dataItem, col, this, {noInitialRefresh: true});
                this.dataColMap.set(col, newCell);
                newColElements.push(newCell);
            }
        }
        this.replaceChildren(...newColElements);
        for (const value of this.dataColMap.values()) {
            value.refreshFull();
        }
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = this.table.selectionModel.isRowSelected(this);
        for (const value of this.dataColMap.values()) {
            value.refreshSelection();
        }
    }

    get selected() {
        return this._selected;
    }

    set selected(selected: boolean) {
        if (this._selected === selected) {
            return;
        }
        this._selected = selected;
        this.setAttribute("is-selected", String(selected));
    }

    get element(): HTMLElement {
        return this;
    }
}



export class CustomCell<RowDataType, CellDataType> extends HTMLTableCellElement {

    dataItem: RowDataType;
    colDef: CustomColumn<RowDataType, CellDataType>;
    row: CustomRow<RowDataType>;
    _cellValue: CellDataType;
    private _selected: boolean = false;

    constructor(dataItem: RowDataType, colDef: CustomColumn<RowDataType, CellDataType>, row: CustomRow<RowDataType>, opts?: RefreshableOpts) {
        super();
        this.dataItem = dataItem;
        this.colDef = colDef;
        this.row = row;
        this.setAttribute("col-id", colDef.shortName);
        if (!(opts?.noInitialRefresh)) {
            this.refreshFull();
        }
        setCellProps(this, colDef);
    }

    refreshFull() {
        let node: Node;
        try {
            this._cellValue = this.colDef.getter(this.dataItem);
            node = this.colDef.renderer(this._cellValue, this.row.dataItem);
            if (node) {
                this.colDef.colStyler(this._cellValue, this, node, this.row.dataItem);
            }
        } catch (e) {
            console.error(e);
            node = document.createTextNode("Error");
        }
        const span = document.createElement('span');
        if (node === null || node === undefined) {
            this.replaceChildren(span);
        }
        else {
            // Due to some of the styling, the child must be a real HTML element and not a raw text node
            // Also, some elements don't support ::before, so insert a dummy span
            if (node.nodeType === this.TEXT_NODE) {
                const text = node.textContent;
                span.textContent = text;
                this.replaceChildren(span);
            }
            else {
                this.replaceChildren(span, node);
            }
        }
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = (this.row.table.selectionModel.isCellSelectedDirectly(this));
    }

    get cellValue() {
        return this._cellValue;
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

customElements.define("custom-table-row", CustomRow, {extends: "tr"});
customElements.define("custom-table", CustomTable, {extends: "table"});
customElements.define("custom-table-cell", CustomCell, {extends: "td"});
customElements.define("custom-table-header-row", CustomTableHeaderRow, {extends: "tr"});
customElements.define("custom-table-title-row", CustomTableTitleRow, {extends: "tr"});
customElements.define("custom-table-header-cell", CustomTableHeaderCell, {extends: "th"});
