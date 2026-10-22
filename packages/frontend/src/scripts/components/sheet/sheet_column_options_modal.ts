import {BaseModal} from "@xivgear/common-ui/components/modal";
import {el, FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {
    SHEET_OPTIONAL_COLUMNS,
    SheetOptionalColumnKey,
    SheetOptionalColumnSelection,
} from "./sheet_columns";
import {elt} from "@xivgear/common-ui/components/templates";

/**
 * Modal for showing additional columns (e.g. def/mdef) on the sheet
 */
export class SheetColumnOptionsModal extends BaseModal {
    private readonly columnSelections: Record<SheetOptionalColumnKey, boolean>;
    private readonly initialColumns: Set<SheetOptionalColumnKey>;

    constructor(
        columns: SheetOptionalColumnSelection[],
        private readonly onApply: (columns: SheetOptionalColumnKey[]) => void,
    ) {
        super();
        this.headerText = 'Customize Columns';
        this.columnSelections = Object.fromEntries(columns.map(column => [column.key, column.show])) as Record<SheetOptionalColumnKey, boolean>;
        this.initialColumns = new Set(this.selectedColumns);

        const checkboxControls = Object.values(SHEET_OPTIONAL_COLUMNS).map(column => {
            const checkbox = new FieldBoundCheckBox(this.columnSelections, column.key);
            return labeledCheckbox(column.label, checkbox);
        });
        this.contentArea.appendChild(el('fieldset', {}, [
            elt('legend')`Additional columns to display:`,
            ...checkboxControls,
        ]));
        this.addActionButton('OK', () => this.finish());
        this.addCloseButton('Cancel');
    }

    get explicitCloseOnly(): boolean {
        // Only allow closing by clicking off if nothing is dirty
        return !this.sameColumns(this.initialColumns, new Set(this.selectedColumns));
    }

    private get selectedColumns(): SheetOptionalColumnKey[] {
        return Object.values(SHEET_OPTIONAL_COLUMNS)
            .filter(column => this.columnSelections[column.key])
            .map(column => column.key);
    }

    private sameColumns(first: ReadonlySet<SheetOptionalColumnKey>, second: ReadonlySet<SheetOptionalColumnKey>): boolean {
        return first.size === second.size && [...first].every(column => second.has(column));
    }

    private finish() {
        this.onApply(this.selectedColumns);
        this.close();
    }
}

customElements.define('sheet-column-options-modal', SheetColumnOptionsModal);
