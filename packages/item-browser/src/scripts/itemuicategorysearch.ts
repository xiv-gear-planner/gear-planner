import {makeCloseButton} from "@xivgear/common-ui/components/icons";
import {el, makeActionButton} from "@xivgear/common-ui/components/util";
import {CustomRow, CustomTable, SingleRowSelectionModel, SpecialRow, TableSelectionModel} from "@xivgear/common-ui/table/tables";
import {SearchOptionModal} from "./baseparamsearch";

export interface ItemUICategoryOption {
    id: string;
    name: string;
    icon?: string;
    orderMajor: number;
    orderMinor: number;
}
type CategorySelection = TableSelectionModel<ItemUICategoryOption, unknown, unknown, CustomRow<ItemUICategoryOption> | null>;

export class ItemUICategorySearchTable extends CustomTable<ItemUICategoryOption, CategorySelection> {
    private readonly singleRowSelection = new SingleRowSelectionModel<ItemUICategoryOption>();

    constructor(options: ItemUICategoryOption[]) {
        super();
        options = [...options].sort((a, b) => a.orderMajor - b.orderMajor || a.orderMinor - b.orderMinor || Number(a.id) - Number(b.id));
        this.classList.add('item-ui-category-search-table', 'gear-items-edit-table', 'hoverable');
        this.selectionModel = this.singleRowSelection as unknown as CategorySelection;
        this.columns = [
            {shortName: 'icon', displayName: 'Icon', getter: option => option.icon, renderer: (url: string | undefined, option: ItemUICategoryOption) =>
                url ? el('img', {props: {src: url, alt: option.name, width: 32, height: 32}}) : null},
            {shortName: 'name', displayName: 'Name', getter: option => option.name},
        ];
        const searchRow = new SpecialRow(() => {
            const searchBox = document.createElement('input');
            searchBox.type = 'text'; searchBox.placeholder = 'Search';
            const clearButton = makeActionButton([makeCloseButton()], () => {
                searchBox.value = ''; searchBox.dispatchEvent(new Event('input'));
            });
            clearButton.disabled = true;
            searchBox.addEventListener('input', () => {
                const value = searchBox.value.toLowerCase().trim();
                clearButton.disabled = !value;
                this.dataRowMap.forEach((row, option) => row.style.display = !value || option.name.toLowerCase().includes(value) ? '' : 'none');
            });
            return el('div', {classes: ['search-row']}, [clearButton, searchBox]);
        }, row => row.classList.add('search-row-outer'));
        this.data = [searchRow, ...options];
    }

    get selected(): CustomRow<ItemUICategoryOption> | null { return this.singleRowSelection.getSelection(); }
    addSelectionListener(listener: (selection: CustomRow<ItemUICategoryOption> | null) => void): void {
        this.singleRowSelection.addListener({onNewSelection: listener});
    }
}

customElements.define('item-ui-category-search-table', ItemUICategorySearchTable, {extends: 'table'});

export class ItemUICategorySearchModal extends SearchOptionModal<ItemUICategoryOption> {
    constructor(options: ItemUICategoryOption[], onChoose: (id: string) => void) {
        super('Select Category', new ItemUICategorySearchTable(options), onChoose);
    }
}

customElements.define('item-ui-category-search-modal', ItemUICategorySearchModal);
