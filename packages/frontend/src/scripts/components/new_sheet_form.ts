import {
    DataSelect,
    FieldBoundCheckBox,
    FieldBoundIntField,
    labelFor,
    nonNegative,
    quickElement
} from "@xivgear/common-ui/components/util";
import {JOB_DATA, JobName, LEVEL_ITEMS, MAX_ILVL, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {getNextSheetInternalName} from "@xivgear/core/persistence/saved_sheets";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {GRAPHICAL_SHEET_PROVIDER} from "./sheet";
import {levelSelect} from "@xivgear/common-ui/components/level_picker";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {SHARED_SET_NAME} from "@xivgear/core/imports/imports";
import {recordSheetEvent} from "@xivgear/core/analytics/analytics";

export class NewSheetFormFieldSet extends HTMLFieldSetElement {
    readonly nameInput: HTMLInputElement;
    readonly jobDropdown: DataSelect<JobName>;
    readonly levelDropdown: DataSelect<SupportedLevel>;
    readonly ilvlSyncCheckbox: FieldBoundCheckBox<typeof this.tempSettings>;
    readonly ilvlSyncValue: FieldBoundIntField<typeof this.tempSettings>;
    readonly tempSettings;

    constructor(defaults: {
        name?: string,
        job?: JobName,
        level?: SupportedLevel,
        ilvlSyncEnabled?: boolean,
        ilvlSyncLevel?: number
    }) {
        super();
        // Sheet Name
        this.nameInput = document.createElement("input");
        this.nameInput.id = "new-sheet-name-input";
        this.nameInput.required = true;
        this.nameInput.type = 'text';
        this.nameInput.width = 400;
        if (defaults?.name) {
            this.nameInput.value = defaults.name;
        }
        this.appendChild(labelFor("Sheet Name: ", this.nameInput));
        this.appendChild(this.nameInput);
        this.appendChild(spacer());

        // Job selection
        this.jobDropdown = new DataSelect<JobName>(Object.keys(JOB_DATA) as JobName[], item => item, () => this.recheck(), defaults?.job);
        this.jobDropdown.id = "new-sheet-job-dropdown";
        this.jobDropdown.required = true;
        this.appendChild(labelFor('Job: ', this.jobDropdown));
        this.appendChild(this.jobDropdown);
        this.appendChild(spacer());

        // Level selection
        this.levelDropdown = levelSelect(newValue => {
            const isync = LEVEL_ITEMS[newValue]?.defaultIlvlSync;
            if (isync !== undefined) {
                this.tempSettings.ilvlSyncEnabled = true;
                this.tempSettings.ilvlSync = isync;
                this.ilvlSyncValue.reloadValue();
                this.ilvlSyncCheckbox.reloadValue();
            }
            this.recheck();
        }, defaults?.level);
        this.levelDropdown.id = "new-sheet-level-dropdown";
        this.levelDropdown.required = true;
        this.appendChild(labelFor('Level: ', this.levelDropdown));
        this.appendChild(this.levelDropdown);
        this.appendChild(spacer());
        this.tempSettings = {
            ilvlSyncEnabled: defaults?.ilvlSyncEnabled ?? false,
            ilvlSync: defaults?.ilvlSyncLevel ?? 650,
        };
        this.ilvlSyncCheckbox = new FieldBoundCheckBox(this.tempSettings, 'ilvlSyncEnabled');
        this.ilvlSyncCheckbox.id = 'new-sheet-ilvl-sync-enable';
        this.append(quickElement('div', [], [this.ilvlSyncCheckbox, labelFor("Sync Item Level", this.ilvlSyncCheckbox),]));
        this.ilvlSyncValue = new FieldBoundIntField(this.tempSettings, 'ilvlSync', {
            postValidators: [
                nonNegative,
                (ctx) => {
                    if (ctx.newValue > MAX_ILVL) {
                        ctx.failValidation("Enter a valid item level (too high)");
                    }
                },
            ],
        });
        this.ilvlSyncValue.style.display = 'none';
        this.ilvlSyncCheckbox.addListener(() => this.recheck());
        this.appendChild(this.ilvlSyncValue);
        this.appendChild(spacer());
    }

    takeFocus() {
        this.nameInput.focus();
    }

    recheck() {
        this.ilvlSyncValue.style.display = this.ilvlSyncCheckbox.currentValue ? '' : 'none';
    }

}

type SheetOpenCallback = (sheet: GearPlanSheet) => Promise<unknown>

export class NewSheetForm extends HTMLFormElement {
    private readonly fieldSet: NewSheetFormFieldSet;
    private readonly sheetOpenCallback: SheetOpenCallback;

    constructor(sheetOpenCallback: SheetOpenCallback) {
        super();
        this.sheetOpenCallback = sheetOpenCallback;
        // Header
        this.id = "new-sheet-form";

        this.fieldSet = new NewSheetFormFieldSet({});


        this.appendChild(this.fieldSet);
        this.appendChild(spacer());

        this.submitButton = document.createElement("button");
        this.submitButton.type = 'submit';
        this.submitButton.textContent = "New Sheet";
        this.appendChild(this.submitButton);

        onsubmit = (ev) => {
            this.doSubmit();
        };
    }

    takeFocus() {
        this.fieldSet.takeFocus();
    }

    recheck() {
        this.fieldSet.recheck();
    }

    private doSubmit() {
        const nextSheetSaveStub = getNextSheetInternalName();
        const gearPlanSheet = GRAPHICAL_SHEET_PROVIDER.fromScratch(nextSheetSaveStub, this.fieldSet.nameInput.value, this.fieldSet.jobDropdown.selectedItem, this.fieldSet.levelDropdown.selectedItem, this.fieldSet.tempSettings.ilvlSyncEnabled ? this.fieldSet.tempSettings.ilvlSync : undefined);
        recordSheetEvent("newSheet", gearPlanSheet);
        this.sheetOpenCallback(gearPlanSheet).then(() => gearPlanSheet.requestSave());
    }
}

export class SaveAsModal extends BaseModal {
    private fieldSet: NewSheetFormFieldSet;

    constructor(existingSheet: GearPlanSheet, callback: SheetOpenCallback) {
        super();
        this.headerText = 'Save As';
        const form = document.createElement('form');
        const defaultName = existingSheet.sheetName === SHARED_SET_NAME ? 'Imported Set' : existingSheet.sheetName + ' copy';
        this.fieldSet = new NewSheetFormFieldSet({
            job: existingSheet.classJobName,
            level: existingSheet.level,
            name: defaultName,
            ilvlSyncEnabled: existingSheet.ilvlSync !== undefined,
            ilvlSyncLevel: existingSheet.ilvlSync,
        });
        form.appendChild(this.fieldSet);
        this.contentArea.replaceChildren(form);
        const submitButton = document.createElement("button");
        submitButton.type = 'submit';
        submitButton.textContent = "New Sheet";
        this.addButton(submitButton);
        submitButton.addEventListener('click', () => {
            form.requestSubmit();
        });
        form.addEventListener('submit', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const newJob = this.fieldSet.jobDropdown.selectedItem;
            if (newJob !== undefined && newJob !== existingSheet.classJobName) {
                const result = confirm(`You are attempting to change a sheet from ${existingSheet.classJobName} to ${newJob}. Items may need to be re-selected.`);
                if (!result) {
                    this.close();
                    return;
                }
            }
            const newSheetSaveKey: string = existingSheet.saveAs(
                this.fieldSet.nameInput.value,
                newJob,
                this.fieldSet.levelDropdown.selectedItem,
                this.fieldSet.tempSettings.ilvlSyncEnabled ? this.fieldSet.tempSettings.ilvlSync : undefined
            );
            const newSheet = GRAPHICAL_SHEET_PROVIDER.fromSaved(newSheetSaveKey);
            console.log("new sheet key", newSheet.saveKey);
            callback(newSheet).then(() => newSheet.requestSave());
            recordSheetEvent("saveAs", newSheet);
            this.close();
        });
        this.fieldSet.recheck();
    }
}

function spacer() {
    return quickElement('div', ['vertical-spacer',], []);
}

customElements.define("save-as-modal", SaveAsModal);
customElements.define("new-sheet-form-fieldset", NewSheetFormFieldSet, {extends: "fieldset",});
customElements.define("new-sheet-form", NewSheetForm, {extends: "form",});
