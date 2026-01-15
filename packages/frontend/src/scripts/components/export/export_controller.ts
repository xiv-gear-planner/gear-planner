import {
    FieldBoundCheckBox,
    labeledCheckbox,
    labeledRadioButton,
    makeActionButton
} from "@xivgear/common-ui/components/util";
import {putShortLink} from "@xivgear/core/external/shortlink_server";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {
    EMBED_HASH, HASH_QUERY_PARAM,
    makeUrl, makeUrlSimple, NavState, ONLY_SET_QUERY_PARAM, PATH_SEPARATOR, SELECTION_INDEX_QUERY_PARAM, VIEW_SET_HASH,
    VIEW_SHEET_HASH
} from "@xivgear/core/nav/common_nav";
import {ExportTypes, GearPlanSheet} from "@xivgear/core/sheet";
import {writeProxy} from "@xivgear/util/proxies";
import {EquipSlots, Materia, XivItem} from "@xivgear/xivmath/geartypes";
import {recordSheetEvent} from "../../analytics/analytics";
import {GearPlanSheetGui} from "../sheet/sheet_gui";

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
    doExport(item: X, isViewonly?: boolean): Promise<string>;
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
        return JSON.stringify(sheet.exportSheet(ExportTypes.ExternalExport));
    },
} as const as SheetExportMethod;

/**
 * Shortlink for an entire sheet
 */
const sheetShortlink = {
    name: "Link to Whole Sheet",
    exportInstantly: false,
    async doExport(sheet: GearPlanSheet, viewOnly: boolean): Promise<string> {
        // If we're viewOnly, we can use the URL we have. Otherwise,
        // we need to make a new one.
        let linkToSheet: URL;
        if (viewOnly) {
            linkToSheet = new URL(document.location.toString());
            linkToSheet.searchParams.delete(SELECTION_INDEX_QUERY_PARAM);
        }
        else {
            const exportedSheet = JSON.stringify(sheet.exportSheet(ExportTypes.ExternalExport));
            linkToSheet = await putShortLink(exportedSheet);
        }

        return urlToString(linkToSheet);
    },
} as const as SheetExportMethod;

function urlToString(url: URL): string {
    return url.toString().replaceAll('%7C', '|');
}

/**
 * One independent shortlink for each set contained within a sheet
 */
const linkPerSet = {
    name: "One Link for Each Set",
    exportInstantly: false,
    async doExport(sheet: GearPlanSheet, viewOnly:boolean ): Promise<string> {
        const sets = sheet.sets;
        if (sets.filter(set => !set.isSeparator).length === 0) {
            return "This sheet does not have any sets!";
        }
        let out = '';

        // If we're viewOnly, we can use the URL we have. Otherwise,
        // we need to make a new one.
        let linkToSheet: URL;
        if (viewOnly) {
            linkToSheet = new URL(document.location.toString());
        }
        else {
            const exportedSheet = JSON.stringify(sheet.exportSheet(ExportTypes.ExternalExport));
            linkToSheet = await putShortLink(exportedSheet);
        }

        for (const i in sets) {
            const set = sets[i];
            if (set.isSeparator) {
                continue;
            }
            const linkToSet = new URL(linkToSheet);

            // If ONLY_SET_QUERY_PARAM is already set, we're only looking at one set
            // so we shouldn't overwrite it.
            if (!linkToSet.searchParams.get(ONLY_SET_QUERY_PARAM)) {
                linkToSet.searchParams.set(ONLY_SET_QUERY_PARAM, i);
            }
            linkToSet.searchParams.delete(SELECTION_INDEX_QUERY_PARAM);
            out += urlToString(linkToSet);
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
    async doExport(sheet: GearPlanSheet, viewOnly: boolean): Promise<string> {
        const sets = sheet.sets;
        if (sets.filter(set => !set.isSeparator).length === 0) {
            return "This sheet does not have any sets!";
        }
        let out = '';

        // If we're viewOnly, we can use the URL we have. Otherwise,
        // we need to make a new one.
        let linkToSheet: URL;
        if (viewOnly) {
            linkToSheet = new URL(document.location.toString());
        }
        else {
            const exportedSheet = JSON.stringify(sheet.exportSheet(ExportTypes.ExternalExport));
            linkToSheet = await putShortLink(exportedSheet);
        }

        for (const i in sets) {
            const set = sets[i];
            if (set.isSeparator) {
                continue;
            }

            const linkToSet = new URL(linkToSheet);

            // If ONLY_SET_QUERY_PARAM is already set, we're only looking at one set
            // so we shouldn't overwrite it.
            if (!linkToSet.searchParams.get(ONLY_SET_QUERY_PARAM)) {
                linkToSet.searchParams.set(ONLY_SET_QUERY_PARAM, i);
            }
            linkToSet.searchParams.delete(SELECTION_INDEX_QUERY_PARAM);

            const pageLink = linkToSet.searchParams.get(HASH_QUERY_PARAM);
            if (pageLink !== null && !pageLink.startsWith(EMBED_HASH)) {
                const embed = EMBED_HASH + PATH_SEPARATOR;
                linkToSet.searchParams.set(HASH_QUERY_PARAM, embed + pageLink);
            }
            out += urlToString(linkToSet);
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
    async doExport(set: CharacterGearSet, viewOnly: boolean): Promise<string> {
        const exportedSheet = JSON.stringify(set.sheet.exportGearSet(set, true));
        const linkToSheet = await putShortLink(exportedSheet);
        return urlToString(linkToSheet);
    },
} as const as SetExportMethod;

/**
 * Embeddable shortlink for an individual set
 */
const setEmbedShortLink = {
    name: "Embed URL for This Set",
    exportInstantly: false,
    async doExport(set: CharacterGearSet, viewOnly: boolean): Promise<string> {
        const exportedSheet = JSON.stringify(set.sheet.exportGearSet(set, true));
        const linkToSheet = await putShortLink(exportedSheet, true);
        return urlToString(linkToSheet);
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
    modal.attachAndShowExclusively();
}

declare global {
    interface Window {
        startExport: typeof startExport;
    }
}

window.startExport = startExport;

const DEFAULT_EXPORT_TEXT = 'Choose an export type from above, then click "Generate" below.\n\nYou can also click "Preview" to get an idea of what your sheet/set will look like after exporting.';

class SimExportChooser extends HTMLElement {
    constructor(sheet: GearPlanSheet, callback: () => void) {
        super();
        const header = document.createElement('h3');
        if (!sheet.isViewOnly && sheet.sims.length > 0) {
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

        const previewButton = makeActionButton('Preview', () => this.doPreview());

        this.textBox = document.createElement('textarea');
        this.textBox.readOnly = true;
        this.variableButton = makeActionButton('PLACEHOLDER', (ev) => this.varButtonAction(ev));
        this.contentArea.appendChild(this.textBox);

        const chooser = new SimExportChooser(sheet, () => this.refreshSelection());
        this.contentArea.appendChild(chooser);

        this.addButton(this.variableButton);
        this.addButton(previewButton);
        this.addCloseButton();

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

        return selectedType.doExport(this.item, this.sheet.isViewOnly);
    };

    abstract get previewUrl(): string;

    private doPreview() {
        window.open(this.previewUrl, '_blank');
    }

    async refreshSelection() {
        const selectedType = this.selectedOption;
        this.textValue = '';
        let isSingleSetExport = false;
        SET_EXPORT_OPTIONS.forEach(x => {
            if (selectedType === x) {
                isSingleSetExport = true;
            }
        });
        // View-only sets don't get re-exported, except in the case that it's a single-set export,
        // since those intentionally reduce the size of the sheet.
        const isExportNotRequired = this.sheet.isViewOnly && !isSingleSetExport;
        if (selectedType.exportInstantly || isExportNotRequired) {
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
        if (this.sheet.isViewOnly) {
            const baseUrl = document.location.toString();
            return baseUrl;
        }

        const exported = this.sheet.exportSheet(ExportTypes.ExternalExport);
        let selectedIndex = undefined;
        if (this.sheet instanceof GearPlanSheetGui) {
            selectedIndex = this.sheet.gearPlanTable.selectedIndex ?? undefined;
        }
        const url = makeUrl(new NavState([VIEW_SHEET_HASH, JSON.stringify(exported)], undefined, selectedIndex));
        // const url = makeUrlSimple(VIEW_SET_HASH, JSON.stringify(exported));
        console.log("Preview url", url);
        return url.toString();
    }
}

class SetExportModal extends ExportModal<CharacterGearSet> {
    constructor(set: CharacterGearSet) {
        super('Export Individual Set', SET_EXPORT_OPTIONS, set.sheet, set);
    }

    get previewUrl(): string {
        const exported = this.sheet.exportGearSet(this.item, true);
        const url = makeUrlSimple(VIEW_SET_HASH, JSON.stringify(exported));
        console.log("Preview url", url);
        return url.toString();
    }
}

customElements.define('sheet-export-modal', SheetExportModal);
customElements.define('set-export-modal', SetExportModal);
customElements.define('sim-export-chooser', SimExportChooser);
