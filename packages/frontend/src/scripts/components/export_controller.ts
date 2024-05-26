import {FieldBoundCheckBox, labeledCheckbox, labeledRadioButton, makeActionButton} from "./util";
import {closeModal} from "../modalcontrol";
import {putShortLink} from "@xivgear/core/external/shortlink_server";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseModal} from "./modal";
import {makeUrl, VIEW_SET_HASH} from "@xivgear/core/nav/common_nav";
import {GearPlanSheet} from "@xivgear/core/sheet";

const SHEET_EXPORT_OPTIONS = ['Link to Whole Sheet', 'One Link for Each Set', 'Embed URL for Each Set', 'JSON for Whole Sheet'] as const;
type SheetExportType = typeof SHEET_EXPORT_OPTIONS[number];
const SET_EXPORT_OPTIONS = ['Link to This Set', 'Embed URL for This Set', 'JSON for This Set'] as const;
type SetExportType = typeof SET_EXPORT_OPTIONS[number];

// TODO: warning for when you export a single set as a sheet

export function startExport(sheet: GearPlanSheet | CharacterGearSet) {
    let modal: ExportModal<never>;
    if (sheet instanceof GearPlanSheet) {
        modal = new SheetExportModal(sheet);
    }
    else {
        modal = new SetExportModal(sheet);
    }
    document.querySelector('body').appendChild(modal);
    modal.show();
}

const DEFAULT_EXPORT_TEXT = 'Choose an export type from above, then click "Generate" below.\n\nYou can also click "Preview" to get an idea of what your sheet/set will look like after exporting.';

class SimExportChooser extends HTMLElement {
    constructor(sheet: GearPlanSheet) {
        super();
        const header = document.createElement('h3');
        header.textContent = 'Choose Sims to Export';
        this.appendChild(header);
        const inner = document.createElement('div');
        sheet.sims.forEach(sim => {
            const cb = new FieldBoundCheckBox(sim.settings, 'includeInExport');
            const cbFull = labeledCheckbox(sim.displayName, cb);
            inner.appendChild(cbFull);
        });
        inner.classList.add('sim-export-chooser-inner');
        this.appendChild(inner);
    }
}

abstract class ExportModal<X extends string> extends BaseModal {
    private textBox: HTMLTextAreaElement;
    private variableButton: HTMLButtonElement;
    private varButtonAction = (ev: MouseEvent) => {
        console.error("This should not happen!");
    };

    protected constructor(title: string, exportOptions: readonly X[], sheet: GearPlanSheet) {
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
            htmlInputElement.value = opt;
            htmlInputElement.name = 'exporttype';
            const labeled = labeledRadioButton(opt, htmlInputElement);
            fieldset.appendChild(labeled);
            htmlInputElement.addEventListener('change', ev => {
                this.onSelect(ev.target['value']);
            })
        });

        this.contentArea.appendChild(fieldset);

        const closeButton = makeActionButton('Close', () => closeModal());
        const previewButton = makeActionButton('Preview', () => this.doPreview());

        this.textBox = document.createElement('textarea');
        this.textBox.readOnly = true;
        this.variableButton = makeActionButton('PLACEHOLDER', (ev) => this.varButtonAction(ev));
        this.contentArea.appendChild(this.textBox);

        const chooser = new SimExportChooser(sheet);
        this.contentArea.appendChild(chooser);

        this.addButton(this.variableButton);
        this.addButton(previewButton);
        this.addButton(closeButton);

        this.onSelect(exportOptions[0]);

    }

    abstract doExport(selectedType: X): Promise<string>;

    abstract exportInstantly(selectedType: X): boolean;

    abstract get previewUrl(): string;


    private doPreview() {
        window.open(this.previewUrl, '_blank');
    }

    async onSelect(selectedType: X) {
        this.textValue = '';
        if (this.exportInstantly(selectedType)) {
            const content = await this.doExport(selectedType);
            this.setCopyData(content);
        }
        else {
            this.variableButton.textContent = 'Generate';
            this.textValue = DEFAULT_EXPORT_TEXT;
            this.varButtonAction = () => {
                // TODO: loading blocker
                this.variableButton.textContent = 'Wait...';
                this.textValue = 'Wait...';
                this.doExport(selectedType).then(value => {
                    this.setCopyData(value);
                }, err => {
                    console.error(err);
                    this.setCopyData("Error!");
                });
            }
        }

    }

    set textValue(value: string) {
        this.textBox.value = value;
    }

    get textValue() {
        return this.textBox.value;
    }

    // TODO: some kind of concurrency check
    setCopyData(data: string): void {
        this.textValue = data;
        this.variableButton.textContent = 'Copy';
        this.varButtonAction = () => navigator.clipboard.writeText(data);
    }
}

class SheetExportModal extends ExportModal<SheetExportType> {
    constructor(private sheet: GearPlanSheet) {
        super('Export Full Sheet', SHEET_EXPORT_OPTIONS, sheet);
    }

    async doExport(selectedType: SheetExportType): Promise<string> {
        switch (selectedType) {
            case "Link to Whole Sheet": {
                const exportedSheet = JSON.stringify(this.sheet.exportSheet(true));
                return await putShortLink(exportedSheet).then(link => link.toString());
            }
            case "One Link for Each Set": {
                const sets = this.sheet.sets;
                if (sets.length === 0) {
                    return "This sheet does not have any sets!";
                }
                let out = '';
                for (const set of sets) {
                    const exportedSet = JSON.stringify(this.sheet.exportGearSet(set, true));
                    const linkToSet = await putShortLink(exportedSet).then(link => link.toString());
                    out += linkToSet;
                    out += '\n';
                }
                return out;
            }
            case "Embed URL for Each Set": {
                const sets = this.sheet.sets;
                if (sets.length === 0) {
                    return "This sheet does not have any sets!";
                }
                let out = '';
                for (const set of sets) {
                    const exportedSet = JSON.stringify(this.sheet.exportGearSet(set));
                    const linkToSet = await putShortLink(exportedSet, true).then(link => link.toString());
                    out += linkToSet;
                    out += '\n';
                }
                return out;
            }
            case "JSON for Whole Sheet":
                return JSON.stringify(this.sheet.exportSheet(true));
        }
    }

    exportInstantly(selectedType: SheetExportType): boolean {
        return selectedType === "JSON for Whole Sheet";
    }

    get previewUrl(): string {
        const exported = this.sheet.exportSheet(true);
        const url = makeUrl(VIEW_SET_HASH, JSON.stringify(exported));
        return url.toString();
    }
}

class SetExportModal extends ExportModal<SetExportType> {
    private sheet: GearPlanSheet;

    constructor(private set: CharacterGearSet) {
        super('Export Individual Set', SET_EXPORT_OPTIONS, set.sheet);
        this.sheet = set.sheet;
    }

    async doExport(selectedType: SetExportType): Promise<string> {
        switch (selectedType) {
            case "Link to This Set": {
                const exportedSheet = JSON.stringify(this.sheet.exportGearSet(this.set, true));
                return await putShortLink(exportedSheet).then(link => link.toString());
            }
            case "Embed URL for This Set": {
                const exportedSheet = JSON.stringify(this.sheet.exportGearSet(this.set, true));
                return await putShortLink(exportedSheet, true).then(link => link.toString());
            }
            case "JSON for This Set":
                return JSON.stringify(this.sheet.exportGearSet(this.set, true));
        }
    }

    exportInstantly(selectedType: SetExportType): boolean {
        return selectedType === "JSON for This Set";
    }

    get previewUrl(): string {
        const exported = this.sheet.exportGearSet(this.set, true);
        const url = makeUrl(VIEW_SET_HASH, JSON.stringify(exported));
        return url.toString();
    }
}

customElements.define('sheet-export-modal', SheetExportModal);
customElements.define('set-export-modal', SetExportModal);
customElements.define('sim-export-chooser', SimExportChooser);
