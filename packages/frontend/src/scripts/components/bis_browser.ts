import {AnyNode, DirNode, stripFilename} from "@xivgear/core/external/static_bis";
import {
    col,
    CustomCell,
    CustomColumn,
    CustomRow,
    CustomTable,
    HeaderRow,
    SingleCellRowOrHeaderSelection,
    TableSelectionModel
} from "@xivgear/common-ui/table/tables";
import {NamedSection} from "./section";
import {goNav, goPath} from "../nav_hash";
import {BIS_HASH} from "@xivgear/core/nav/common_nav";

export class BisBrowser {
    private namedSection: NamedSection;
    private table: CustomTable<AnyNode, TableSelectionModel<AnyNode>>;
    private currentNode: DirNode;

    constructor() {
        this.namedSection = new NamedSection();
        this.namedSection.classList.add('bis-browser');
        this.table = new CustomTable();
        this.table.columns = [
            col({
                shortName: "type",
                displayName: "Type",
                getter(item: AnyNode): string {
                    return item.type;
                },
            }), col({
                shortName: "name",
                displayName: "Name",
                getter(item: AnyNode): string {
                    if (item.type === 'file') {
                        return item.contentName ?? item.fileName;
                    }
                    return item.fileName;
                },
            }),
        ];
        this.table.classList.add('hoverable');
        this.table.classList.add('bis-browser-table');
        const outer = this;
        this.table.selectionModel = {
            clickCell(cell: CustomCell<AnyNode, never>): void {
            },
            clickColumnHeader(col: CustomColumn<AnyNode, never, never>): void {
            },
            clickRow(row: CustomRow<AnyNode>): void {
                // Open the row TODO implement this
                const di = row.dataItem;
                if (di.type === 'dir') {
                    outer.setData(di);
                }
                else {
                    let path: string[] = [];
                    let currentNode: AnyNode = di;
                    // Don't add the root node as part of the path
                    while (currentNode.parent) {
                        const filename = stripFilename(currentNode.fileName);
                        path = [filename, ...path];
                        currentNode = currentNode.parent;
                    }
                    goPath(BIS_HASH, ...path);
                }
            },
            getSelection(): SingleCellRowOrHeaderSelection<AnyNode, never, never> {
                return undefined;
            },
            isCellSelectedDirectly(cell: CustomCell<AnyNode, never>): boolean {
                return false;
            },
            isColumnHeaderSelected(col: CustomColumn<AnyNode, never, never>): boolean {
                return false;
            },
            isRowSelected(row: CustomRow<AnyNode>): boolean {
                return false;
            },
            clearSelection(): void {
            },
        };
        this.namedSection.contentArea.replaceChildren(this.table);
    }

    setData(data: DirNode) {
        this.currentNode = data;
        this.table.data = [new HeaderRow(), ...data.children];
        this.namedSection.titleText = data.fileName;
    }

    get element(): HTMLElement {
        return this.namedSection;
    }
}
