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
    XivApiGearInfo
} from "./geartypes";
import {
    CustomCell,
    CustomColumnDef,
    CustomRow,
    CustomTable, HeaderRow,
    SelectionModel,
    SingleCellRowOrHeaderSelect,
    SingleSelectionModel, TitleRow
} from "./tables";

// let primarySelectionElement: SelectableDataElement | undefined;
let primarySelectionValue: Object | undefined;

function setSelection(sel: Object | undefined) {
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
        console.log("loading items");
        fetch(`https://xivapi.com/search?indexes=Item&filters=LevelItem%3E=${this.minIlvl},LevelItem%3C=${this.maxIlvl},ClassJobCategory.${this.classJob}=1&columns=ID,IconHD,Name,LevelItem,Stats,EquipSlotCategory`)
            .then((response) => {
                return response.json()
            }, (reason) => {
                console.error(reason)
            }).then((data) => {
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

type GearSetSel = SingleCellRowOrHeaderSelect<GearSet>;

class GearPlanTable extends CustomTable<GearSet, GearSetSel> {

    private gearSets: GearSet[] = [];

    constructor() {
        super();
        super.columns = [
            {
                shortName: "name",
                displayName: "Set Name",
                getter: gearSet => document.createTextNode(gearSet.name),
            },
            {
                shortName: "bar",
                displayName: "Foo bar Baz",
                getter: stuff => document.createTextNode("Stuff"),
            },
        ]
        const selModel = new SingleSelectionModel<GearSet, GearSetSel>();
        super.selectionModel = selModel;
        selModel.addListener({
            onNewSelection(newSelection: GearSetSel) {
                if (newSelection instanceof CustomRow) {
                    setSelection(newSelection.dataItem);
                }
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

class GearSlotItem {
    slot: EquipSlot;
    item: GearItem;
    slotName: string;
}

class GearItemsTable extends CustomTable<GearSlotItem, EquipmentSet> {
    constructor(gearSet: GearSet, itemMapping: Map<GearSlot, GearItem[]>) {
        super();
        super.columns = [
            {
                shortName: "ilvl",
                displayName: "Item Level",
                getter: item => {
                    return item.item.ilvl.toString();
                },
            },
            {
                shortName: "name",
                displayName: "Name",
                getter: item => {
                    return item.item.name.toString();
                },
            },
            {
                shortName: "icon",
                displayName: "Icon",
                getter: item => {
                    const image = document.createElement('img');
                    image.src = item.item.icon.toString();
                    return image;
                }
            },
            {
                shortName: "mind",
                displayName: "MND",
                getter: item => {
                    return item.item.stats.mind.toString();
                }
            },
            {
                shortName: "crit",
                displayName: "CRT",
                getter: item => {
                    return item.item.stats.crit.toString();
                }
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: item => {
                    return item.item.stats.dhit.toString();
                }
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: item => {
                    return item.item.stats.det.toString();
                }
            },
            {
                shortName: "sps",
                displayName: "SPS",
                getter: item => {
                    return item.item.stats.spellspeed.toString();
                }
            },
            {
                shortName: "piety",
                displayName: "PIE",
                getter: item => {
                    return item.item.stats.crit.toString();
                }
            },
        ]
        const selModel: SelectionModel<GearSlotItem, EquipmentSet> = {
            clickCell(cell: CustomCell<GearSlotItem>) {

            }, clickColumnHeader(col: CustomColumnDef<GearSlotItem>) {

            }, clickRow(row: CustomRow<GearSlotItem>) {
                gearSet.setEquip(row.dataItem.slotName, {gearItem: row.dataItem.item} as EquippedItem);
            }, getSelection(): EquipmentSet {
                return gearSet.equipment;
            }, isCellSelectedDirectly(cell: CustomCell<GearSlotItem>) {
                return false;
            }, isColumnHeaderSelected(col: CustomColumnDef<GearSlotItem>) {
                return false;
            }, isRowSelected(row: CustomRow<GearSlotItem>) {
                return gearSet.getItemInSlot(row.dataItem.slotName) === row.dataItem.item;
            }
        }
        super.selectionModel = selModel;
        const data : (TitleRow | HeaderRow | GearSlotItem)[] = [];
        for (const [name, slot] of Object.entries(EquipSlots)) {
            // @ts-ignore
            console.log(name)
            data.push(new TitleRow(slot.name));
            data.push(new HeaderRow());
            const itemsInSlot = itemMapping.get(slot.gearSlot);
            for (const gearItem of itemsInSlot) {
                data.push({slot: slot, item: gearItem, slotName: name});
            }
        }
        this.data = data;
        // selModel.addListener({
        //     onNewSelection(newSelection: Selection<GearSet> | undefined) {
        //         const sel = newSelection.row;
        //         setSelection(sel)
        //     }
        // })
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
            let slot = item.slot;
            if (itemMapping.has(slot)) {
                itemMapping.get(slot).push(item);
            }
            else {
                itemMapping.set(slot, [item]);
            }
        })

        const table = new GearItemsTable(gearSet, itemMapping);
        table.id = "gear-items-table";
        // for (let gearItem of itemsInSlot) {
        //     slotNode.appendChild(new GearItemDisplay(gearItem, selectedItem => gearSet.setEquip(name, {gearItem: selectedItem} as EquippedItem)));
        // }
        this.appendChild(table);
    }
}

// customElements.define("gear-plan-row", GearPlanRow)
customElements.define("gear-set-editor", GearSetEditor)
customElements.define("gear-plan-table", GearPlanTable, {extends: "table"})
customElements.define("gear-plan", GearPlanner)
customElements.define("gear-items-table", GearItemsTable, {extends: "table"})


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

