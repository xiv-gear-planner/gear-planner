import {
    FieldBoundCheckBox,
    labeledCheckbox,
    labeledRadioButton,
    makeActionButton
} from "@xivgear/common-ui/components/util";
import {closeModal} from "@xivgear/common-ui/modalcontrol";
import {putShortLink} from "@xivgear/core/external/shortlink_server";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {makeUrl, VIEW_SET_HASH} from "@xivgear/core/nav/common_nav";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {writeProxy} from "@xivgear/core/util/proxies";
import {EquipSlots, Materia, XivItem} from "@xivgear/xivmath/geartypes";
import {recordSheetEvent} from "@xivgear/core/analytics/analytics";

type ExportMethod<X> = {
    /**
     * The display name of this export option.
     */
    readonly name: string;
    /**
     * Whether the export is instant (display the value as soon as is it selected) or async (must click the button)
     */
    readonly exportInstantly: boolean;

    /**
     * Perform the export. Should return whatever should display in the text box (typically one or more links)
     *
     * @param item The item to export.
     */
    doExport(item: X): Promise<string>;

    /**
     * Whether the export should offer to open the link rather than copy it.
     */
    readonly openInsteadOfCopy?: boolean;
};

type SheetExportMethod = ExportMethod<GearPlanSheet>;

type SetExportMethod = ExportMethod<CharacterGearSet>;

/**
 * JSON for an entire sheet
 */
const sheetJson = {
    name: "JSON for Whole Sheet",
    exportInstantly: true,
    async doExport(sheet: GearPlanSheet): Promise<string> {
        return JSON.stringify(sheet.exportSheet(true));
    },
} as const as SheetExportMethod;

/**
 * Shortlink for an entire sheet
 */
const sheetShortlink = {
    name: "Link to Whole Sheet",
    exportInstantly: false,
    async doExport(sheet: GearPlanSheet): Promise<string> {
        const exportedSheet = JSON.stringify(sheet.exportSheet(true));
        return await putShortLink(exportedSheet).then(link => link.toString());
    },
} as const as SheetExportMethod;

/**
 * One independent shortlink for each set contained within a sheet
 */
const linkPerSet = {
    name: "One Link for Each Set",
    exportInstantly: false,
    async doExport(sheet: GearPlanSheet): Promise<string> {
        const sets = sheet.sets;
        if (sets.length === 0) {
            return "This sheet does not have any sets!";
        }
        let out = '';
        for (const set of sets) {
            const exportedSet = JSON.stringify(sheet.exportGearSet(set, true));
            const linkToSet = await putShortLink(exportedSet).then(link => link.toString());
            out += linkToSet;
            out += '\n';
        }
        return out;
    },
} as const as SheetExportMethod;

/**
 * One independent embeddable shortlink for each set contained within a sheet
 */
const embedLinkPerSet = {
    name: "Embed URL for Each Set",
    exportInstantly: false,
    async doExport(sheet: GearPlanSheet): Promise<string> {
        const sets = sheet.sets;
        if (sets.length === 0) {
            return "This sheet does not have any sets!";
        }
        let out = '';
        for (const set of sets) {
            const exportedSet = JSON.stringify(sheet.exportGearSet(set, true));
            const linkToSet = await putShortLink(exportedSet, true).then(link => link.toString());
            out += linkToSet;
            out += '\n';
        }
        return out;
    },
} as const as SheetExportMethod;

/**
 * JSON for an individual set
 */
const setJson = {
    name: "JSON for This Set",
    exportInstantly: true,
    async doExport(set: CharacterGearSet): Promise<string> {
        return JSON.stringify(set.sheet.exportGearSet(set, true));
    },
} as const as SetExportMethod;

/**
 * Shortlink for an individual set
 */
const setShortlink = {
    name: "Link to This Set",
    exportInstantly: false,
    async doExport(set: CharacterGearSet): Promise<string> {
        const exportedSheet = JSON.stringify(set.sheet.exportGearSet(set, true));
        return await putShortLink(exportedSheet).then(link => link.toString());
    },
} as const as SetExportMethod;

/**
 * Embeddable shortlink for an individual set
 */
const setEmbedShortLink = {
    name: "Embed URL for This Set",
    exportInstantly: false,
    async doExport(set: CharacterGearSet): Promise<string> {
        const exportedSheet = JSON.stringify(set.sheet.exportGearSet(set, true));
        return await putShortLink(exportedSheet, true).then(link => link.toString());
    },
} as const as SetExportMethod;

type TeamcraftItem = {
    readonly itemId: number,
    quantity: number
}

const exportSetToTeamcraft = {
    name: 'Export to Teamcraft',
    exportInstantly: true,
    openInsteadOfCopy: true,
    async doExport(set: CharacterGearSet): Promise<string> {
        const items: TeamcraftItem[] = [];
        const allItems: XivItem[] = [];
        const allMateria: Materia[] = [];
        const equipment = set.equipment;
        EquipSlots.forEach(slot => {
            const item = equipment[slot];
            if (item) {
                allItems.push(item.gearItem);
                item.melds.forEach(mat => {
                    const materia = mat.equippedMateria;
                    if (materia) {
                        allMateria.push(materia);
                    }
                });
            }
        });
        // TODO: should food be included in this? What quantity of food?
        // if (set.food) {
        //     allItems.push(set.food);
        // }
        allItems.push(...allMateria);
        allItems.forEach(equippedItem => {
            const existing = items.find(item => item.itemId === equippedItem.id);
            if (existing) {
                existing.quantity++;
            }
            else {
                items.push({
                    itemId: equippedItem.id,
                    quantity: 1,
                });
            }
        });
        const joinedItems = items
            .map(item => `${item.itemId},null,${item.quantity}`)
            .join(';');
        return `https://ffxivteamcraft.com/import/${btoa(joinedItems)}`;
    },
} as const as SetExportMethod;

const SHEET_EXPORT_OPTIONS = [sheetShortlink, linkPerSet, embedLinkPerSet, sheetJson] as const;

const SET_EXPORT_OPTIONS = [setShortlink, setEmbedShortLink, setJson, exportSetToTeamcraft] as const;

// TODO: warning for when you export a single set as a sheet
export function startExport(sheet: GearPlanSheet | CharacterGearSet) {
    let modal: ExportModal<unknown>;
    if (sheet instanceof GearPlanSheet) {
        modal = new SheetExportModal(sheet);
    }
    else {
        modal = new SetExportModal(sheet);
    }
    modal.attachAndShow();
}

window["startExport"] = startExport;

const DEFAULT_EXPORT_TEXT = 'Choose an export type from above, then click "Generate" below.\n\nYou can also click "Preview" to get an idea of what your sheet/set will look like after exporting.';

class SimExportChooser extends HTMLElement {
    constructor(sheet: GearPlanSheet, callback: () => void) {
        super();
        const header = document.createElement('h3');
        header.textContent = 'Choose Sims to Export';
        this.appendChild(header);
        const inner = document.createElement('div');
        sheet.sims.forEach(sim => {
            const cb = new FieldBoundCheckBox(writeProxy(sim.settings, callback), 'includeInExport');
            const cbFull = labeledCheckbox(sim.displayName, cb);
            inner.appendChild(cbFull);
        });
        inner.classList.add('sim-export-chooser-inner');
        this.appendChild(inner);
    }
}

abstract class ExportModal<X> extends BaseModal {
    private textBox: HTMLTextAreaElement;
    private variableButton: HTMLButtonElement;
    private varButtonAction = (ev: MouseEvent) => {
        console.error("This should not happen!");
    };
    private _selectedOption: ExportMethod<X>;

    protected constructor(title: string, exportOptions: readonly ExportMethod<X>[], protected sheet: GearPlanSheet, protected item: X) {
        super();
        this.classList.add('export-modal-dialog');
        this.headerText = title;

        const fieldset = document.createElement('fieldset');

        exportOptions.forEach((opt, index) => {
            const htmlInputElement = document.createElement('input');
            htmlInputElement.type = 'radio';
            if (index === 0) {
                htmlInputElement.checked = true;
            }
            htmlInputElement.value = opt.name;
            htmlInputElement.name = 'exporttype';
            const labeled = labeledRadioButton(opt.name, htmlInputElement);
            fieldset.appendChild(labeled);
            htmlInputElement.addEventListener('change', ev => {
                this.selectedOption = opt;
            });
        });

        this.contentArea.appendChild(fieldset);

        const closeButton = makeActionButton('Close', () => closeModal());
        const previewButton = makeActionButton('Preview', () => this.doPreview());

        this.textBox = document.createElement('textarea');
        this.textBox.readOnly = true;
        this.variableButton = makeActionButton('PLACEHOLDER', (ev) => this.varButtonAction(ev));
        this.contentArea.appendChild(this.textBox);

        const chooser = new SimExportChooser(sheet, () => this.refreshSelection());
        this.contentArea.appendChild(chooser);

        this.addButton(this.variableButton);
        this.addButton(previewButton);
        this.addButton(closeButton);

        this.selectedOption = exportOptions[0];
    }

    private get selectedOption(): ExportMethod<X> {
        return this._selectedOption;
    }

    private set selectedOption(value: ExportMethod<X>) {
        this._selectedOption = value;
        this.refreshSelection();
    }

    doExport(selectedType: ExportMethod<X>): Promise<string> {
        recordSheetEvent("doExport", this.sheet, {
            'exportType': selectedType.name,
        });
        return selectedType.doExport(this.item);
    };

    abstract get previewUrl(): string;

    private doPreview() {
        window.open(this.previewUrl, '_blank');
    }

    async refreshSelection() {
        const selectedType = this.selectedOption;
        this.textValue = '';
        if (selectedType.exportInstantly) {
            const content = await this.doExport(selectedType);
            this.setResultData(selectedType, content);
        }
        else {
            this.variableButton.textContent = 'Generate';
            this.textValue = DEFAULT_EXPORT_TEXT;
            this.varButtonAction = () => {
                // TODO: loading blocker
                this.variableButton.textContent = 'Wait...';
                this.textValue = 'Wait...';
                this.doExport(selectedType).then(value => {
                    this.setResultData(selectedType, value);
                }, err => {
                    console.error(err);
                    this.setResultData(selectedType, "Error!");
                });
            };
        }

    }

    set textValue(value: string) {
        this.textBox.value = value;
    }

    get textValue() {
        return this.textBox.value;
    }

    // TODO: some kind of concurrency check
    setResultData(exportType: ExportMethod<X>, data: string): void {
        this.textValue = data;
        if (exportType.openInsteadOfCopy) {
            this.variableButton.textContent = 'Go';
            this.varButtonAction = () => window.open(data, '_blank');
        }
        else {
            this.variableButton.textContent = 'Copy';
            this.varButtonAction = () => navigator.clipboard.writeText(data);
        }
    }
}

class SheetExportModal extends ExportModal<GearPlanSheet> {
    constructor(sheet: GearPlanSheet) {
        super('Export Full Sheet', SHEET_EXPORT_OPTIONS, sheet, sheet);
    }

    get previewUrl(): string {
        const exported = this.sheet.exportSheet(true);
        const url = makeUrl(VIEW_SET_HASH, JSON.stringify(exported));
        return url.toString();
    }
}

class SetExportModal extends ExportModal<CharacterGearSet> {

    constructor(set: CharacterGearSet) {
        super('Export Individual Set', SET_EXPORT_OPTIONS, set.sheet, set);
    }

    get previewUrl(): string {
        const exported = this.sheet.exportGearSet(this.item, true);
        const url = makeUrl(VIEW_SET_HASH, JSON.stringify(exported));
        return url.toString();
    }
}

customElements.define('sheet-export-modal', SheetExportModal);
customElements.define('set-export-modal', SetExportModal);
customElements.define('sim-export-chooser', SimExportChooser);
