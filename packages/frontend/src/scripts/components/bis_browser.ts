import {AnyNode, DirNode} from "@xivgear/core/external/static_bis";
import {
    col,
    CustomCell,
    CustomColumn,
    CustomRow,
    CustomTable,
    SingleCellRowOrHeaderSelection,
    TableSelectionModel
} from "@xivgear/common-ui/table/tables";
import {NamedSection} from "./section";
import {BIS_BROWSER_HASH, BIS_HASH} from "@xivgear/core/nav/common_nav";
import {JOB_DATA} from "@xivgear/xivmath/xivconstants";
import {makeActionButton, mySheetsIcon, quickElement} from "@xivgear/common-ui/components/util";
import {capitalizeFirstLetter} from "@xivgear/util/strutils";

type NodeInfo = {
    name: string,
    description: string | null,
}

export class BisBrowser {

    private readonly namedSection: NamedSection;
    private readonly table: CustomTable<AnyNode, TableSelectionModel<AnyNode>>;
    private readonly buttonRow: HTMLElement;
    private readonly upButton: HTMLButtonElement;

    private currentNode: DirNode;

    constructor(private readonly navCallback: (path: string[], navigate: boolean) => void) {
        const outer = this;
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
                renderer(itemType: AnyNode['type']) {
                    if (itemType === 'file') {
                        return quickElement('b', [], ['🗋']);
                    }
                    else {
                        return mySheetsIcon();
                    }
                },
                fixedWidth: 30,
            }), col({
                shortName: "name",
                displayName: "Name",
                getter(item: AnyNode): NodeInfo {
                    return formatInfo(item);
                },
                renderer(info: NodeInfo) {
                    const out: Element[] = [];
                    out.push(quickElement('div', ['bis-sheet-name'], [info.name]));
                    if (info.description) {
                        out.push(quickElement('div', ['bis-sheet-description'], [info.description]));
                    }
                    return quickElement('div', ['bis-sheet-info'], out);
                },
            }),
        ];
        this.table.classList.add('hoverable');
        this.table.classList.add('bis-browser-table');
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
                    const path = di.path;
                    navCallback([BIS_HASH, ...path], true);
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
        this.upButton = makeActionButton('Up', () => {
            this.setData(this.currentNode.parent);
        });
        this.upButton.classList.add('up-button');
        this.buttonRow = quickElement('div', ['button-row'], [this.upButton]);
        this.namedSection.contentArea.replaceChildren(this.buttonRow, this.table);
    }

    setData(node: DirNode) {
        this.currentNode = node;
        this.table.data = [
            ...([...node.children].sort((a, b) => {
                if (a.type === "dir" && b.type === "file") {
                    return -1;
                }
                else if (a.type === "file" && b.type === "dir") {
                    return 1;
                }
                else {
                    return formatInfo(a).name.localeCompare(formatInfo(b).name);
                }
            })),
        ];
        this.namedSection.titleText = formattedPath(node).join(" - ");
        if (node.parent) {
            this.upButton.disabled = false;
            this.upButton.textContent = `↰ Back to ${formatInfo(node.parent).name}`;
        }
        else {
            this.upButton.textContent = '';
            this.upButton.disabled = node.parent === undefined;
        }
        this.navCallback([BIS_BROWSER_HASH, ...node.path], false);
    }

    get element(): HTMLElement {
        return this.namedSection;
    }
}

function formattedPath(node: DirNode): string[] {
    if (!node.parent) {
        return ["Best-in-Slot Gear"];
    }
    let out: string[] = [];
    let current = node;
    while (current.parent) {
        out = [formatInfo(current).name, ...out];
        current = current.parent;
    }
    return out;
}

function formatInfo(node: AnyNode): NodeInfo {
    if (!node.parent) {
        return {
            name: "Best-in-Slot Gear",
            description: null,
        };
    }
    else if (node.type === 'file') {
        let desc = node.contentDescription;
        if (desc && desc.length > 200) {
            desc = desc.substring(0, 200) + '…';
        }
        return {
            name: node.contentName ?? node.fileName,
            description: desc,
        };
    }
    else if (node.fileName.toUpperCase() in JOB_DATA) {
        return {
            name: node.fileName.toUpperCase(),
            description: null,
        };
    }
    return {
        name: capitalizeFirstLetter(node.fileName),
        description: null,
    };
}
