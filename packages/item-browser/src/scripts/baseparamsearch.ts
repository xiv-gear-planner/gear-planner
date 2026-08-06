import {BaseModal} from "@xivgear/common-ui/components/modal";
import {makeCloseButton} from "@xivgear/common-ui/components/icons";
import {el, makeActionButton} from "@xivgear/common-ui/components/util";
import {
    CustomRow,
    CustomTable,
    SingleRowSelectionModel,
    SpecialRow,
    TableSelectionModel
} from "@xivgear/common-ui/table/tables";

export interface BaseParamOption {
    id: string;
    name: string;
    description: string;
}

type BaseParamSelection = TableSelectionModel<BaseParamOption, unknown, unknown, CustomRow<BaseParamOption> | null>;

// TOD: the generic stuff shouldn't be in this file
interface SearchOption {
    id: string;
}

/**
 * Item selection table with search
 */
interface SearchSelectionTable<Option extends SearchOption> extends HTMLElement {
    selected: CustomRow<Option> | null;

    addSelectionListener(listener: (selection: CustomRow<Option> | null) => void): void;

    focusSearchBar(): void;
}

/**
 * Item selection modal with search
 */
export class SearchOptionModal<Option extends SearchOption> extends BaseModal {

    private readonly table: SearchSelectionTable<Option>;

    constructor(header: string, table: SearchSelectionTable<Option>, onChoose: (id: string) => void) {
        super();
        this.table = table;
        this.headerText = header;
        this.contentArea.appendChild(table);
        const chooseButton = this.addActionButton('Choose', () => {
            const selection = table.selected;
            if (selection !== null) {
                onChoose(selection.dataItem.id);
                this.close();
            }
        });
        chooseButton.disabled = true;
        table.addSelectionListener(selection => chooseButton.disabled = selection === null);
        this.addCloseButton('Cancel');
    }

    afterShow(): void {
        this.table.focusSearchBar();
    }
}

export class BaseParamSearchTable extends CustomTable<BaseParamOption, BaseParamSelection> implements SearchSelectionTable<BaseParamOption> {
    private readonly singleRowSelection = new SingleRowSelectionModel<BaseParamOption>();
    private searchBox: HTMLInputElement | null = null;

    constructor(options: BaseParamOption[]) {
        super();
        this.classList.add('base-param-search-table', 'gear-items-edit-table', 'hoverable');
        this.selectionModel = this.singleRowSelection as unknown as BaseParamSelection;
        this.columns = [
            {
                shortName: 'name',
                displayName: 'Name',
                getter: option => option.name,
            },
            {
                shortName: 'description',
                displayName: 'Description',
                getter: option => option.description,
            },
        ];

        const searchRow = new SpecialRow(() => {
            const searchBox = el('input', {
                props: {
                    type: 'text',
                    placeholder: 'Search',
                },
            });
            this.searchBox = searchBox;
            const clearButton = makeActionButton([makeCloseButton()], () => {
                searchBox.value = '';
                searchBox.dispatchEvent(new Event('input'));
            });
            clearButton.disabled = true;
            searchBox.addEventListener('input', () => {
                const searchValue = searchBox.value.toLowerCase().trim();
                clearButton.disabled = !searchValue;
                this.dataRowMap.forEach((row, option) => {
                    row.style.display = !searchValue || `${option.name} ${option.description}`.toLowerCase().includes(searchValue)
                        ? ''
                        : 'none';
                });
            });
            return el('div', {classes: ['search-row']}, [clearButton, searchBox]);
        }, row => row.classList.add('search-row-outer'));

        this.data = [searchRow, ...options];
    }

    get selected(): CustomRow<BaseParamOption> | null {
        return this.singleRowSelection.getSelection();
    }

    addSelectionListener(listener: (selection: CustomRow<BaseParamOption> | null) => void): void {
        this.singleRowSelection.addListener({onNewSelection: listener});
    }

    focusSearchBar(): void {
        this.searchBox?.focus();
    }
}

customElements.define('base-param-search-table', BaseParamSearchTable, {extends: 'table'});

export class BaseParamSearchModal extends SearchOptionModal<BaseParamOption> {
    constructor(options: BaseParamOption[], onChoose: (id: string) => void) {
        const table = new BaseParamSearchTable(options);
        super('Select Stat', table, onChoose);
    }
}

customElements.define('base-param-search-modal', BaseParamSearchModal);
