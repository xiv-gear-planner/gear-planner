/* eslint-disable @typescript-eslint/no-explicit-any */
import {quickElement} from "../components/util";

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
        this.selected = this.table.selectionModel.isColumnHeaderSelected(this._colDef as CustomColumn<unknown, unknown, unknown>);
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
        this._cells.find(cell => cell.colDef === colDef)?.refreshFull();
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

export interface TableSelectionModel<
    RowDataType,
    CellDataType = never,
    ColumnDataType = never,
    SelectionType = SingleCellRowOrHeaderSelection<RowDataType, CellDataType, ColumnDataType>> {
    getSelection(): SelectionType;

    clickCell(cell: CustomCell<RowDataType, CellDataType>): void;

    clickColumnHeader(col: CustomColumn<RowDataType, CellDataType, ColumnDataType>): void;

    clickRow(row: CustomRow<RowDataType>): void;

    isCellSelectedDirectly(cell: CustomCell<RowDataType, CellDataType>): boolean;

    isRowSelected(row: CustomRow<RowDataType>): boolean;

    isColumnHeaderSelected(col: CustomColumn<RowDataType, CellDataType, ColumnDataType>): boolean;

    clearSelection(): void;
}

export const noopSelectionModel: TableSelectionModel<any, any, any, null> = {
    isCellSelectedDirectly(cell: CustomCell<any, any>) {
        return false;
    },
    clickCell(cell: CustomCell<any, any>) {
    },
    clickColumnHeader(col: CustomColumn<any>) {
    },
    clickRow(cell: CustomRow<any>) {
    },
    getSelection(): null {
        return null;
    },
    isColumnHeaderSelected(col: CustomColumn<any, unknown, unknown>) {
        return false;
    },
    isRowSelected(item: any) {
        return false;
    },
    clearSelection() {
    },
};

export interface SelectionListener<SelectionType> {
    onNewSelection(newSelection: SelectionType): void;
}

// deprecated
export type SingleCellRowOrHeaderSelect<X> = CustomColumn<X> | CustomCell<X, any> | CustomRow<X> | null;

export type SingleCellRowOrHeaderSelection<RowDataType, CellDataType = never, ColumnDataType = never>
    = CustomRow<RowDataType>
    | CustomColumn<RowDataType, CellDataType, ColumnDataType>
    | CustomCell<RowDataType, CellDataType>
    | null;

// export type SingleCellRowOrHeaderSelection<RowDataType, CellDataType = never, ColumnDataType = never>
//     = CustomRow<RowDataType>
//     | (RowDataType extends never ? never : CustomColumn<RowDataType, CellDataType, ColumnDataType>)
//     | (CellDataType extends never ? never : CustomCell<RowDataType, CellDataType>)
//     | null;

export class SingleRowSelectionModel<RowDataType> implements TableSelectionModel<RowDataType, never, never, CustomRow<RowDataType> | null> {

    private _selection: CustomRow<RowDataType> | null = null;
    private _listeners: SelectionListener<CustomRow<RowDataType> | null>[] = [];

    private notifyListeners() {
        for (const listener of this._listeners) {
            listener.onNewSelection(this.getSelection());
        }
    }

    addListener(listener: SelectionListener<typeof this._selection>) {
        this._listeners.push(listener);
    }

    getSelection(): typeof this._selection {
        return this._selection;
    }

    clickCell(cell: CustomCell<RowDataType, never>) {
    }

    clickColumnHeader(col: CustomColumn<RowDataType, never, never>) {
    }

    clickRow(row: CustomRow<RowDataType>) {
        this._selection = row;
        this.notifyListeners();
    }

    isCellSelectedDirectly(cell: CustomCell<RowDataType, never>) {
        return false;
    }

    isRowSelected(row: CustomRow<RowDataType>) {
        return row === this._selection;
    }

    isColumnHeaderSelected(col: CustomColumn<RowDataType, never, never>) {
        return false;
    }

    clearSelection() {
        this._selection = null;
        this.notifyListeners();
    }
}

export class SingleRowConvertingSelectionModel<RowType, OutDataType = RowType> implements TableSelectionModel<RowType, never, never, OutDataType | null> {

    private readonly delegate: SingleRowSelectionModel<RowType>;
    private readonly _listeners: SelectionListener<OutDataType | null>[] = [];

    constructor(private readonly converter: (row: CustomRow<RowType>) => OutDataType) {
        this.delegate = new SingleRowSelectionModel<RowType>();
        const outer = this;
        this.delegate.addListener({
            onNewSelection(newSelection: CustomRow<RowType> | null): void {
                const converted = outer.convert(newSelection);
                outer._listeners.forEach(listener => listener.onNewSelection(converted));
            },
        });
    }

    private convert(value: CustomRow<RowType> | null): OutDataType | null {
        if (value === null) {
            return null;
        }
        return this.converter(value);
    }

    getSelection(): OutDataType | null {
        return this.convert(this.delegate.getSelection());
    }

    addListener(listener: SelectionListener<OutDataType | null>) {
        this._listeners.push(listener);
    }

    clickCell(cell: CustomCell<RowType, never>) {
        this.delegate.clickCell(cell);
    }

    clickColumnHeader(col: CustomColumn<RowType, never, never>) {
        this.delegate.clickColumnHeader(col);
    }

    clickRow(row: CustomRow<RowType>) {
        this.delegate.clickRow(row);
    }

    isCellSelectedDirectly(cell: CustomCell<RowType, never>): boolean {
        return this.delegate.isCellSelectedDirectly(cell);
    }

    isRowSelected(row: CustomRow<RowType>): boolean {
        return this.delegate.isRowSelected(row);
    }

    isColumnHeaderSelected(col: CustomColumn<RowType, never, never>): boolean {
        return this.delegate.isColumnHeaderSelected(col);
    }

    clearSelection() {
        this.delegate.clearSelection();
    }

}

export class SingleCellRowOrHeaderSelectionModel<RowDataType, CellDataType, ColumnDataType> implements TableSelectionModel<RowDataType, CellDataType, ColumnDataType, SingleCellRowOrHeaderSelection<RowDataType, CellDataType, ColumnDataType>> {

    private _selection: SingleCellRowOrHeaderSelection<RowDataType, CellDataType, ColumnDataType> = null;
    private _listeners: SelectionListener<CustomRow<RowDataType> | CustomColumn<RowDataType, CellDataType, ColumnDataType> | CustomCell<RowDataType, CellDataType> | null>[] = [];

    private notifyListeners() {
        for (const listener of this._listeners) {
            listener.onNewSelection(this.getSelection());
        }
    }

    addListener(listener: SelectionListener<typeof this._selection>) {
        this._listeners.push(listener);
    }

    getSelection(): typeof this._selection {
        return this._selection;
    }

    clickCell(cell: CustomCell<RowDataType, CellDataType>) {
        this._selection = cell;
        this.notifyListeners();
    }

    clickColumnHeader(col: CustomColumn<RowDataType, CellDataType, ColumnDataType>) {
        this._selection = col;
        this.notifyListeners();
    }

    clickRow(row: CustomRow<RowDataType>) {
        this._selection = row;
        this.notifyListeners();
    }

    isCellSelectedDirectly(cell: CustomCell<RowDataType, CellDataType>) {
        return cell === this._selection;
    }

    isRowSelected(row: CustomRow<RowDataType>) {
        return row === this._selection;
    }

    isColumnHeaderSelected(col: CustomColumn<RowDataType, CellDataType, ColumnDataType>) {
        return col === this._selection;
    }

    clearSelection() {
        this._selection = null;
        this.notifyListeners();
    }
}

export class HeaderRow {

}

export class TitleRow {
    title: string;

    constructor(title: string) {
        this.title = title;
    }
}

export class SpecialRow<T extends CustomTable<any>> {
    constructor(public readonly creator: (table: T) => Node,
                public readonly finisher: (row: CustomTableTitleRow, table: T) => void = () => {
                }) {
    }
}

export interface SelectionRefresh {
    refreshSelection(): void;
}

export interface RefreshableRow<X> {
    refreshFull(): void;

    refreshColumn(colDef: CustomColumn<X, any>): void;

    get element(): HTMLElement;
}

/**
 * Describes a strategy for breaking a table load into smaller units of work by rendering only the first chunk of cells
 * immediately, and then deferring the rest.
 */
export type LazyTableStrategy = {
    /**
     * If there are not at least minRows rows total, do not attempt to lazy render.
     */
    minRows: number,
    /**
     * Max number of rows to render immediately.
     */
    immediateRows: number,
    /**
     * Specify a scroll root to use for the IntersectionObserver
     */
    altRoot?: HTMLElement,
    /**
     * Specify the extra "buffer" around the scroll root (pixels). Defaults to 2000px if not specified.
     */
    rootMargin?: number,
}

export const NoLazyRender: LazyTableStrategy = {
    minRows: Number.MAX_SAFE_INTEGER,
    immediateRows: Number.MAX_SAFE_INTEGER,
} as const;

export class CustomTable<RowDataType, SelectionType extends TableSelectionModel<RowDataType, unknown, unknown, unknown> = TableSelectionModel<RowDataType, unknown, unknown, never>> extends HTMLTableElement {
    _data: (RowDataType | HeaderRow | TitleRow)[] = [];
    dataRowMap: Map<RowDataType, CustomRow<RowDataType>> = new Map<RowDataType, CustomRow<RowDataType>>();
    selectionRefreshables: SelectionRefresh[] = [];
    _rows: RefreshableRow<RowDataType>[] = [];
    _columns!: CustomColumn<RowDataType, unknown, unknown>[];
    // TODO: should changing selection model also refresh the current selection?
    selectionModel: SelectionType = noopSelectionModel as SelectionType;
    rowTitleSetter: ((row: RowDataType) => string | null) | null = null;
    lazyRenderStrategy: LazyTableStrategy = NoLazyRender;

    constructor() {
        super();
        this.appendChild(this.createTHead());
        this.appendChild(this.createTBody());
        this.addEventListener('mousedown', ev => {
            this.handleClick(ev);
        });
    }

    get columns(): CustomColumn<RowDataType, unknown, unknown>[] {
        return this._columns;
    }

    set columns(cols: (CustomColumn<RowDataType, unknown, unknown> | CustomColumnSpec<RowDataType, any>)[]) {
        this._columns = cols.flatMap(cdef => {
            if (cdef instanceof CustomColumn) {
                if (cdef.condition()) {
                    return [cdef];
                }
                else {
                    return [];
                }
            }
            const out = new CustomColumn(cdef);
            Object.assign(out, cdef);
            if (out.condition()) {
                return [out];
            }
            else {
                return [];
            }
        });
        // TODO: see if successive refreshFull calls can be coalesced
        this._onRowColChange();
        this.refreshFull();
    }

    set data(newData: (RowDataType | HeaderRow | TitleRow)[]) {
        this._data = newData;
        this._onRowColChange();
    }

    get data(): (RowDataType | HeaderRow | TitleRow)[] {
        return [...this._data];
    }

    protected makeDataRow(item: RowDataType): CustomRow<RowDataType> {
        return new CustomRow<RowDataType>(item, this, {noInitialRefresh: true});
    }

    /**
     * To be called when rows or columns are added, removed, or rearranged, but not
     * when only the data within cells is changed.
     *
     * @private
     */
    private _onRowColChange() {
        const newRowElements: Node[] = [];
        const len = this._data.length;
        const lazy = this.lazyRenderStrategy;
        // If we have a lazy render strategy, but we haven't hit the threshold, don't lazy render
        const enableLazy = len >= lazy.minRows;
        let observer: IntersectionObserver | null;
        if (enableLazy) {
            // This tells us when a row is scrolled into view or at least within a buffer (rootMargin)
            observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.intersectionRatio > 0 && entry.target instanceof CustomRow) {
                        entry.target.refreshFull(true);
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                root: lazy.altRoot ?? null,
                rootMargin: lazy.rootMargin ? `${lazy.rootMargin}px` : '2000px',
            });
        }
        else {
            observer = null;
        }
        for (let i = 0; i < len; i++) {
            const item = this._data[i];
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
                // Try to find existing row first
                const row = this.dataRowMap.get(item);
                if (row !== undefined) {
                    newRowElements.push(row);
                }
                else {
                    // Otherwise, create new row
                    const newRow = this.makeDataRow(item);
                    this.dataRowMap.set(item, newRow);
                    // Lazy-load outside of the threshold
                    if (i < lazy.immediateRows) {
                        newRow.refreshFull();
                    }
                    else {
                        newRow.refreshFull(false);
                        // setTimeout(async () => {
                        //     // newRow.refreshFull(true);
                        // }, lazy.delay(i));
                        observer?.observe(newRow);
                    }
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

    _handleClick(target: EventTarget | null) {
        if (target instanceof CustomRow) {
            this.selectionModel.clickRow(target);
            this.refreshSelection();
        }
        else if (target instanceof CustomCell) {
            if (target.colDef.allowCellSelection && target.rowConditionSatisfied) {
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
        else if (target instanceof Node) {
            this._handleClick(target.parentElement);
        }
    }
}

export type CellRenderer<RowDataType, CellDataType> = (value: CellDataType, rowValue: RowDataType) => (Node | null);
export type ColStyler<RowDataType, CellDataType> = (value: CellDataType, colElement: CustomCell<RowDataType, CellDataType>, internalElement: Node, rowValue: RowDataType) => void;

export interface CustomColumnSpec<RowDataType, CellDataType, ColumnDataType = any> {
    // Required
    shortName: string;
    displayName: string;
    getter: (item: RowDataType) => CellDataType;
    // Optional
    allowHeaderSelection?: boolean;
    allowCellSelection?: boolean;
    renderer?: CellRenderer<RowDataType, CellDataType>;
    colStyler?: ColStyler<RowDataType, CellDataType>;
    condition?: () => boolean;
    rowCondition?: (item: RowDataType) => boolean;
    initialWidth?: number | undefined;
    fixedWidth?: number | undefined;
    dataValue?: ColumnDataType;
    headerStyler?: (value: ColumnDataType, colHeader: CustomTableHeaderCell<RowDataType, CellDataType, ColumnDataType>) => void;
    extraClasses?: string[];
    titleSetter?: (value: CellDataType, rowValue: RowDataType, cell: CustomCell<RowDataType, CellDataType>) => string | null;
    finisher?: (value: CellDataType, rowValue: RowDataType, cell: CustomCell<RowDataType, CellDataType>) => void;
    /**
     * Only allow a single refresh - after that, the item is considered "fixed" and subsequent refreshes will be ignored
     */
    fixedData?: boolean;
}

/**
 * Wrapper function for a coldef. Doesn't do anything that CustomTable wouldn't do naturally when receiving a
 * CustomColumnSpec, but helps with typing. Typescript doesn't allow an array type of generics to narrow the type
 * parameters internally. In other words, we won't get proper validation of CellDataType nor ColDataType - i.e. won't
 * validate that your getter's return type matches your renderer's input type (nor any of the other fields that
 * involve the cell data type).
 *
 * @param cdef The column spec.
 */
export function col<RowDataType, CellDataType = string, ColumnDataType = any>(cdef: CustomColumnSpec<RowDataType, CellDataType, ColumnDataType>): CustomColumn<RowDataType, CellDataType, ColumnDataType> {
    return new CustomColumn<RowDataType, CellDataType, ColumnDataType>(cdef);
}

export class CustomColumn<RowDataType, CellDataType = string, ColumnDataType = any> {
    private _original: CustomColumnSpec<RowDataType, CellDataType, ColumnDataType>;

    constructor(colDefPartial: CustomColumnSpec<RowDataType, CellDataType, ColumnDataType>) {
        Object.assign(this, colDefPartial);
        this._original = colDefPartial;
    }

    shortName!: string;

    get displayName() {
        // Name can change after the fact, so query the original spec
        return this._original.displayName;
    };

    // noinspection JSUnusedGlobalSymbols
    set displayName(ignored) {
    };

    allowHeaderSelection?: boolean = false;
    allowCellSelection?: boolean = false;
    getter!: (item: RowDataType) => CellDataType;
    renderer: CellRenderer<RowDataType, CellDataType> = (value) => document.createTextNode(String(value));
    colStyler: ColStyler<RowDataType, CellDataType> = (value, colElement, internalElement) => {
        if (value) {
            colElement.classList.add("value-truthy");
        }
        else {
            colElement.classList.add("value-falsey");
        }
    };
    condition: () => boolean = () => true;
    rowCondition: (item: RowDataType) => boolean = () => true;
    initialWidth: number | undefined = undefined;
    extraClasses: string[] = [];
    fixedWidth: number | undefined = undefined;
    dataValue?: ColumnDataType;
    headerStyler?: (value: typeof this.dataValue, colHeader: CustomTableHeaderCell<RowDataType, CellDataType, ColumnDataType>) => void;
    titleSetter?: (value: CellDataType, rowValue: RowDataType, cell: CustomCell<RowDataType, CellDataType>) => string | null;
    finisher?: (value: CellDataType, rowValue: RowDataType, cell: CustomCell<RowDataType, CellDataType>) => void;
    fixedData?: boolean;
}

export type RefreshableOpts = {
    // Do not perform a refresh in the constructor - must refresh manually before any data will be displayed.
    noInitialRefresh?: boolean;
}

export class CustomRow<RowDataType> extends HTMLTableRowElement implements RefreshableRow<RowDataType> {
    dataItem: RowDataType;
    table: CustomTable<RowDataType, any>;
    dataColMap: Map<CustomColumn<RowDataType, unknown, unknown>, CustomCell<RowDataType, unknown>> = new Map<CustomColumn<RowDataType, unknown, unknown>, CustomCell<RowDataType, unknown>>();
    private _selected: boolean = false;
    beforeElements: Node[] = [];
    afterElements: Node[] = [];

    constructor(dataItem: RowDataType, table: CustomTable<RowDataType, any>, opts?: RefreshableOpts) {
        super();
        this.dataItem = dataItem;
        this.table = table;
        if (!(opts?.noInitialRefresh)) {
            this.refreshFull();
        }
    }


    refreshColumn(colDef: CustomColumn<RowDataType, unknown, unknown>) {
        this.dataColMap.get(colDef)?.refreshFull();
    }

    refreshFull(refreshCells: boolean = true) {
        const newColElements: CustomCell<RowDataType, unknown>[] = [];
        for (const col of this.table.columns) {
            const c = this.dataColMap.get(col);
            if (c !== undefined) {
                newColElements.push(c);
            }
            else {
                if (col.rowCondition(this.dataItem)) {
                    const newCell = new CustomCell<RowDataType, any>(this.dataItem, col, this, {noInitialRefresh: true});
                    this.dataColMap.set(col, newCell);
                    newColElements.push(newCell);
                }
                else {
                    const dummyCol: CustomColumn<RowDataType, unknown> = new CustomColumn<RowDataType, unknown>({
                        ...col,
                        displayName: col.displayName,
                        getter: () => null,
                        renderer: () => quickElement('span', [], []),
                        colStyler: () => null,
                    });
                    const newCell = new CustomCell<RowDataType, any>(this.dataItem, dummyCol, this, {noInitialRefresh: true});
                    this.dataColMap.set(col, newCell);
                    newColElements.push(newCell);
                }
            }
        }
        this.replaceChildren(...this.beforeElements, ...newColElements, ...this.afterElements);
        if (refreshCells) {
            for (const value of this.dataColMap.values()) {
                value.refreshFull();
            }
        }
        this.refreshTitle();
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = this.table.selectionModel.isRowSelected(this);
        for (const value of this.dataColMap.values()) {
            value.refreshSelection();
        }
    }

    refreshTitle() {
        const titleSetter = this.table.rowTitleSetter;
        if (titleSetter) {
            const newTitle = titleSetter(this.dataItem);
            if (newTitle) {
                this.title = newTitle;
            }
            else {
                this.removeAttribute('title');
            }
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
    _cellValue!: CellDataType;
    private _selected: boolean = false;
    // null indicates that we do not want "one refresh only" behavior
    // true/false indicates whether that one refresh has already happened.
    private _oneRefreshDone: boolean | null;

    constructor(dataItem: RowDataType, colDef: CustomColumn<RowDataType, CellDataType>, row: CustomRow<RowDataType>, opts?: RefreshableOpts) {
        super();
        this.dataItem = dataItem;
        this.colDef = colDef;
        this.row = row;
        this.setAttribute("col-id", colDef.shortName);
        if (!(opts?.noInitialRefresh)) {
            this.refreshFull();
        }
        if (colDef?.fixedData) {
            this._oneRefreshDone = false;
        }
        else {
            this._oneRefreshDone = null;
        }
        setCellProps(this, colDef);
    }

    refreshFull() {
        if (this._oneRefreshDone === true) {
            return;
        }
        const rowValue = this.dataItem;
        let node: Node | null;
        try {
            this._cellValue = this.colDef.getter(rowValue);
            node = this.colDef.renderer(this._cellValue, this.row.dataItem);
            if (node) {
                this.colDef.colStyler(this._cellValue, this, node, this.row.dataItem);
            }
        }
        catch (e) {
            console.error(e);
            node = document.createTextNode("Error");
        }
        const span = document.createElement('span');
        if (node === null || node === undefined) {
            this.replaceChildren(span);
        }
        else {
            // Due to some of the styling, the child must be a real HTML element and not a raw text node
            if (node.nodeType === this.TEXT_NODE) {
                // TODO: this logic should take place above, so that colStyler can always take an HTMLElement instead
                // of potentially being fed a raw text node and being unable to style it.
                span.textContent = node.textContent ?? '';
                this.replaceChildren(span);
            }
            else {
                // Some elements don't support ::before (which is required for things like selection highlighting),
                // so insert a dummy span to work around this.
                this.replaceChildren(span, node);
            }
        }
        this.refreshSelection();
        this.refreshTitle();
        this.colDef.finisher?.(this._cellValue, this.row.dataItem, this);
        if (this._oneRefreshDone === false) {
            this._oneRefreshDone = true;
        }
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

    get rowConditionSatisfied() {
        return this.colDef.rowCondition(this.row.dataItem);
    }

    refreshTitle() {
        if (this.colDef.titleSetter) {
            const newTitle = this.colDef.titleSetter(this._cellValue, this.row.dataItem, this);
            if (newTitle) {
                this.title = newTitle;
            }
            else {
                this.removeAttribute('title');
            }
        }
    }
}

export type ColDefs<RowDataType> = (CustomColumn<RowDataType> | CustomColumnSpec<RowDataType, any>)[];

customElements.define("custom-table-row", CustomRow, {extends: "tr"});
customElements.define("custom-table", CustomTable, {extends: "table"});
customElements.define("custom-table-cell", CustomCell, {extends: "td"});
customElements.define("custom-table-header-row", CustomTableHeaderRow, {extends: "tr"});
customElements.define("custom-table-title-row", CustomTableTitleRow, {extends: "tr"});
customElements.define("custom-table-header-cell", CustomTableHeaderCell, {extends: "th"});
