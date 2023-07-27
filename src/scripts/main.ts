// import '@webcomponents/webcomponentsjs/webcomponents-bundle.js'
// import '@webcomponents/webcomponentsjs/custom-elements-es5-adapter.js'

// import {GearSet, XivApiGearInfo} from "./geartypes";

import {
    EquipmentSet,
    EquippedItem,
    EquipSlot,
    EquipSlots,
    GearItem,
    GearSet,
    GearSlot,
    GearStats,
    XivApiGearInfo
} from "./geartypes";


// let primarySelectionElement: SelectableDataElement | undefined;
let primarySelectionValue: Object | undefined;

function setSelection(sel: Object | undefined) {
    console.log("Selection: " + sel)
    primarySelectionValue = sel;
    if (primarySelectionValue instanceof GearSet) {
        var editorArea = document.getElementById("editor-area");
        editorArea.replaceChildren(new GearSetEditor(planner, primarySelectionValue))
    }
}

// function setSelection(sel: SelectableDataElement) {
//     console.log("Selection: " + sel)
//     if (sel === primarySelectionElement) {
//         // Same selection, No-op
//         return;
//     }
//     if (primarySelectionElement !== undefined) {
//         primarySelectionElement.markAsUnselected();
//     }
//     primarySelectionValue = sel.dataElement;
//     console.log("Selected data: " + primarySelectionValue);
//     primarySelectionElement = sel;
//     sel.markAsSelected();
//     if (primarySelectionValue instanceof GearSet) {
//         var editorArea = document.getElementById("editor-area");
//         editorArea.replaceChildren(new GearSetEditor(planner, primarySelectionValue))
//     }
// }

// abstract class SelectableDataElement extends HTMLElement {
//     selected: boolean;
//
//     markAsSelected() {
//         this.selected = true;
//         this.classList.add("data-item-selected")
//     }
//
//     markAsUnselected() {
//         this.selected = false;
//         this.classList.remove("data-item-selected")
//     }
//
//     abstract get dataElement(): Object;
//
//     constructor() {
//         super();
//         this.addEventListener('click', e => setSelection(this));
//     }
// }

class GearItemDisplay extends HTMLElement {
    constructor(item: GearItem, selectionCallback: undefined | ((item: GearItem) => void)) {
        super();
        console.log(item.stats)
        this.textContent += item.ilvl;
        this.textContent += ': ';
        this.textContent += item.name;
        this.appendChild(document.createElement('br'));
        const image = document.createElement('img');
        image.src = item.icon.toString();
        this.appendChild(image);
        this.appendChild(document.createElement('br'));
        for (let statsKey in item.stats) {
            var stat = item.stats[statsKey];
            if (stat) {
                let str = `${statsKey}: ${JSON.stringify(stat)}`
                this.appendChild(document.createTextNode(str));
                this.appendChild(document.createTextNode(";  "));
            }
        }
        this.appendChild(document.createElement('br'));
        if (selectionCallback !== undefined) {
            this.addEventListener('click', e => selectionCallback(item));
        }
    }
}


class GearPlanner extends HTMLElement {
    gearPlanTable: GearPlanTable;

    constructor() {
        super();
        this.gearPlanTable = new GearPlanTable();
        this.appendChild(this.gearPlanTable);
    }

    sets: EquipmentSet[];
    items: XivApiGearInfo[];

    minIlvl = 650;
    maxIlvl = 665;
    classJob = 'WHM'

    loadItems() {
        console.log("loading items (not really)")
        fetch(`https://xivapi.com/search?indexes=Item&filters=LevelItem%3E=${this.minIlvl},LevelItem%3C=${this.maxIlvl},ClassJobCategory.${this.classJob}=1&columns=ID,IconHD,Name,LevelItem,Stats,EquipSlotCategory`)
            .then((response) => {
                return response.json()
            }, (reason) => {
                console.error(reason)
            }).then((data) => {
            console.log(data)
            console.log(`Got ${data['Results'].length} Items`)
            return data['Results'];
        }).then((rawItems) => {
            this.items = rawItems.map(i => new XivApiGearInfo(i));
            // this.items.forEach(item => {
            //     console.log(item.name)
            //     this.appendChild(new GearItemDisplay(item as XivApiGearInfo));
            // })
        })
    }
}


// class GearPlanRow extends SelectableDataElement {
//     private gearSet: GearSet;
//     private label: HTMLSpanElement;
//
//     constructor(gearSet: GearSet) {
//         super();
//         this.gearSet = gearSet;
//         var header = document.createElement("span");
//         header.textContent = gearSet.name;
//         this.appendChild(header)
//         gearSet.listeners.push(() => this.recheck());
//         this.label = document.createElement("span");
//         this.recheck();
//         this.append(document.createElement("br"));
//         this.appendChild(this.label);
//     }
//
//     get dataElement() {
//         return this.gearSet;
//     }
//
//     private recheck() {
//         this.label.textContent = Object.entries(this.gearSet.equipment).map((entry) => `${entry[0]}: ${entry[1].gearItem.name}`).join(", ");
//     }
// }

class CustomTableHeaderRow<X> extends HTMLTableRowElement {

}

interface Selection<X> {
    // If no row is selected, but a column is, then it is the header row's column that is selected
    row: X | undefined;
    column: CustomColumnDef<X> | undefined;
}

const noSelection: Selection<any> = {
    row: undefined,
    column: undefined
}

interface SelectionModel<X> {
    selection: Selection<X> | undefined;
}

const noopSelectionModel: SelectionModel<any> = {
    get selection() {
        return noSelection;
    },
    set selection(selection) {
        // do nothing
    },
}

interface SimpleSelectionListener<X> {
    onNewSelection(newSelection: Selection<X> | undefined);
}

class SimpleSelectionModel<X> implements SelectionModel<X> {

    private _selection: Selection<X> = undefined;
    private _listeners: SimpleSelectionListener<X>[] = [];

    set selection(newSelection: Selection<X> | undefined) {
        if (newSelection === this._selection) {
            return;
        }
        console.log("New Selection: ");
        console.log(newSelection);
        this._selection = newSelection;
        for (let listener of this._listeners) {
            listener.onNewSelection(newSelection);
        }
    }

    get selection(): Selection<X> | undefined {
        return this._selection;
    }

    addListener(listener: SimpleSelectionListener<X>) {
        this._listeners.push(listener);
    }

    // TODO
    // removeListener(listener: SimpleSelectionListener<X>) {
    //     this._listeners.
    // }

}

class CustomTable<X> extends HTMLTableElement {
    _data: X[];
    dataRowMap: Map<X, CustomRow<X>> = new Map<X, CustomRow<X>>();
    columns: CustomColumnDef<X>[];
    headerRow: CustomTableHeaderRow<X>;
    // TODO
    // selectionEnabled: boolean;
    selectionModel: SelectionModel<X> = noopSelectionModel;
    curSelection: Selection<X> | undefined;

    constructor() {
        super();
        this.headerRow = new CustomTableHeaderRow();
        this.appendChild(this.createTHead());
        this.appendChild(this.createTBody());
        this.tHead.appendChild(this.headerRow);
        this.addEventListener('click', ev => {
            console.info(ev);
            this.handleClick(ev);
        })
    }

    set data(newData: X[]) {
        // TODO
        this._data = newData;
        this.refreshFull();
    }

    refreshFull() {
        const newRowElements: CustomRow<X>[] = [];
        for (let item of this._data) {
            if (this.dataRowMap.has(item)) {
                newRowElements.push(this.dataRowMap.get(item));
            }
            else {
                const newRow = new CustomRow<X>(item, this);
                this.dataRowMap.set(item, newRow);
                newRowElements.push(newRow);
            }
        }
        this.tBodies[0].replaceChildren(...newRowElements);
        for (let value of newRowElements.values()) {
            value.refresh();
        }
        this.refreshSelection();
    }

    refreshSelection() {
        this.curSelection = this.selectionModel.selection;
        for (let value of this.dataRowMap.values()) {
            value.refreshSelection();
        }
    }

    handleClick(ev) {
        console.log(ev);
        if (ev.target instanceof CustomRow) {
            this.selectionModel.selection = {
                row: (ev.target as CustomRow<X>).dataItem,
                column: undefined,
            }
        }
        else if (ev.target instanceof CustomCell) {
            const cell = ev.target as CustomCell<X>;
            if (cell.colDef.allowCellSelection) {
                this.selectionModel.selection = {
                    row: (ev.target as CustomRow<X>).dataItem,
                    column: cell.colDef,
                }
            }
            else {
                this.selectionModel.selection = {
                    row: (ev.target as CustomRow<X>).dataItem,
                    column: undefined,
                }
            }
        }
        this.refreshSelection();
    }
}

class CustomColumnDef<X> {
    shortName: string;
    displayName: string;
    getter: (item: X) => Node;
    allowHeaderSelection: boolean = false;
    allowCellSelection: boolean = false;
}

class CustomRow<X> extends HTMLTableRowElement {
    dataItem: X;
    table: CustomTable<X>;
    dataColMap: Map<CustomColumnDef<X>, CustomCell<X>> = new Map<CustomColumnDef<X>, CustomCell<X>>();
    private _selected: boolean = false;

    constructor(dataItem: X, table: CustomTable<X>) {
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
        this.selected = (this.table.curSelection !== undefined && this.table.curSelection.row === this.dataItem && this.table.curSelection.column === undefined);
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

class CustomCell<X> extends HTMLTableCellElement {

    private dataItem: X;
    colDef: CustomColumnDef<X>;
    private row: CustomRow<X>;
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
        this.replaceChildren(this.colDef.getter(this.dataItem));
        console.log(this.row.table.curSelection);
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = (this.row.table.curSelection !== undefined && this.dataItem === this.row.table.curSelection.row && this.row.table.curSelection.column === undefined);
    }

    set selected(selected) {
        if (this._selected === selected) {
            return;
        }
        this._selected = selected;
        this.setAttribute("is-selected", selected);
    }

}

class GearPlanTable extends CustomTable<GearSet> {

    private gearSets: GearSet[] = [];

    constructor() {
        super();
        super.columns = [
            {
                shortName: "name",
                displayName: "Set Name",
                getter: gearSet => document.createTextNode(gearSet.name),
                allowHeaderSelection: false,
                allowCellSelection: false
            },
            {
                shortName: "bar",
                displayName: "Foo bar Baz",
                getter: stuff => document.createTextNode("Stuff"),
                allowHeaderSelection: false,
                allowCellSelection: false
            }
        ]
        const selModel = new SimpleSelectionModel<GearSet>();
        super.selectionModel = selModel;
        selModel.addListener({
            onNewSelection(newSelection: Selection<GearSet> | undefined) {
                const sel = newSelection.row;
                setSelection(sel)
            }
        })
        // var header = document.createElement("h1")
        // header.textContent = "Gear Sets"
        // this.appendChild(header)
        //
        // this.buildsDiv = document.createElement("div");
        // this.buildsDiv.className = "gear-set-list";
        // this.appendChild(this.buildsDiv);
        //
        // let newButton = document.createElement("button");
        // newButton.addEventListener("click", e => {
        //     this.addRow(new GearSet())
        // })
        // newButton.textContent = "New Gear Set";
        // this.appendChild(newButton);
    }

    addRow(gearSet: GearSet) {
        this.gearSets.push(gearSet);
        super.data = this.gearSets;
        super.refreshFull();
    }
}

class GearSetEditor extends HTMLElement {
    constructor(gearPlanner: GearPlanner, gearSet: GearSet) {
        super();
        var header = document.createElement("h1");
        header.textContent = "Editor Area"
        this.appendChild(header)
        let itemMapping: Map<GearSlot, GearItem[]> = new Map();
        gearPlanner.items.forEach((item) => {
            console.log(item.name);
            let slot = item.slot;
            if (itemMapping.has(slot)) {
                itemMapping.get(slot).push(item);
            }
            else {
                itemMapping.set(slot, [item]);
            }
        })
        console.log(itemMapping);
        for (const [name, slot] of Object.entries(EquipSlots)) {
            const slotNode = document.createElement("div");
            const header = document.createElement("h4");
            header.textContent = slot.name;
            slotNode.appendChild(header);
            const itemsInSlot = itemMapping.get(slot.gearSlot);
            for (let gearItem of itemsInSlot) {
                slotNode.appendChild(new GearItemDisplay(gearItem, selectedItem => gearSet.setEquip(name, {gearItem: selectedItem} as EquippedItem)));
            }
            this.appendChild(slotNode);
        }
    }
}

// customElements.define("gear-plan-row", GearPlanRow)
customElements.define("gear-set-editor", GearSetEditor)
customElements.define("gear-plan-table", GearPlanTable, {extends: "table"})
customElements.define("gear-item-display", GearItemDisplay)
customElements.define("gear-plan", GearPlanner)
customElements.define("custom-table-row", CustomRow, {extends: "tr"})
customElements.define("custom-table", CustomTable, {extends: "table"})
customElements.define("custom-table-cell", CustomCell, {extends: "td"})
customElements.define("custom-table-header-row", CustomTableHeaderRow, {extends: "tr"})


const planner = new GearPlanner()
document['planner'] = planner

document.addEventListener("DOMContentLoaded", () => {
    console.log("Loaded")
    planner.loadItems();
    document.getElementById("content-area").appendChild(planner)
    var gs1 = new GearSet();
    gs1.name = "Other name";
    planner.gearPlanTable.addRow(gs1)
    planner.gearPlanTable.addRow(new GearSet())
    planner.gearPlanTable.addRow(new GearSet())
    planner.gearPlanTable.addRow(new GearSet())
})

