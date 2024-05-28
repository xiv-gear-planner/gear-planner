import {DataSelect, FieldBoundCheckBox, FieldBoundIntField, labelFor, positiveValuesOnly, quickElement} from "./util";
import {JOB_DATA, JobName, LEVEL_ITEMS, MAX_ILVL, SupportedLevel, SupportedLevels} from "@xivgear/xivmath/xivconstants";
import {getNextSheetInternalName} from "@xivgear/core/persistence/saved_sheets";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {GRAPHICAL_SHEET_PROVIDER} from "./sheet";

export class NewSheetForm extends HTMLFormElement {
    private readonly nameInput: HTMLInputElement;
    private readonly jobDropdown: DataSelect<JobName>;
    private readonly levelDropdown: DataSelect<SupportedLevel>;
    private readonly ilvlSyncCheckbox: FieldBoundCheckBox<typeof this.tempSettings>;
    private readonly ilvlSyncValue: FieldBoundIntField<typeof this.tempSettings>;
    private readonly fieldSet: HTMLFieldSetElement;
    private readonly sheetOpenCallback: (sheet: GearPlanSheet) => Promise<unknown>;
    private readonly tempSettings = {
        ilvlSyncEnabled: false,
        ilvlSync: 650
    };

    constructor(sheetOpenCallback: (sheet: GearPlanSheet) => Promise<unknown>) {
        super();
        this.sheetOpenCallback = sheetOpenCallback;
        // Header
        this.id = "new-sheet-form";

        this.fieldSet = document.createElement("fieldset");

        // Sheet Name
        this.nameInput = document.createElement("input");
        this.nameInput.id = "new-sheet-name-input";
        this.nameInput.required = true;
        this.nameInput.type = 'text';
        this.nameInput.width = 400;
        this.fieldSet.appendChild(labelFor("Sheet Name: ", this.nameInput));
        this.fieldSet.appendChild(this.nameInput);
        this.fieldSet.appendChild(spacer());

        // Job selection
        this.jobDropdown = new DataSelect<JobName>(Object.keys(JOB_DATA) as JobName[], item => item, () => this.recheck());
        this.jobDropdown.id = "new-sheet-job-dropdown";
        this.jobDropdown.required = true;
        this.fieldSet.appendChild(labelFor('Job: ', this.jobDropdown));
        this.fieldSet.appendChild(this.jobDropdown);
        this.fieldSet.appendChild(spacer());

        // Level selection
        this.levelDropdown = new DataSelect<SupportedLevel>([...SupportedLevels], item => item.toString(), newValue => {
            const isync = LEVEL_ITEMS[newValue]?.defaultIlvlSync;
            if (isync !== undefined) {
                this.tempSettings.ilvlSyncEnabled = true;
                this.tempSettings.ilvlSync = isync;
                this.ilvlSyncValue.reloadValue();
                this.ilvlSyncCheckbox.reloadValue();
            }
            this.recheck();
        }, Math.max(...SupportedLevels) as SupportedLevel);
        this.levelDropdown.id = "new-sheet-level-dropdown";
        this.levelDropdown.required = true;
        this.fieldSet.appendChild(labelFor('Level: ', this.levelDropdown));
        this.fieldSet.appendChild(this.levelDropdown);
        this.fieldSet.appendChild(spacer());

        this.ilvlSyncCheckbox = new FieldBoundCheckBox(this.tempSettings, 'ilvlSyncEnabled');
        this.ilvlSyncCheckbox.id = 'new-sheet-ilvl-sync-enable';
        this.fieldSet.append(quickElement('div', [], [this.ilvlSyncCheckbox, labelFor("Sync Item Level", this.ilvlSyncCheckbox)]));
        this.ilvlSyncValue = new FieldBoundIntField(this.tempSettings, 'ilvlSync', {
            postValidators: [
                positiveValuesOnly,
                (ctx) => {
                    if (ctx.newValue > MAX_ILVL) {
                        ctx.failValidation("Enter a valid item level (too high)")
                    }
                }
            ]
        });
        this.ilvlSyncValue.style.display = 'none';
        this.ilvlSyncCheckbox.addListener(() => this.recheck());
        this.fieldSet.appendChild(this.ilvlSyncValue);
        this.fieldSet.appendChild(spacer());

        this.appendChild(this.fieldSet);
        this.appendChild(spacer());

        this.submitButton = document.createElement("button");
        this.submitButton.type = 'submit';
        this.submitButton.textContent = "New Sheet";
        this.appendChild(this.submitButton);

        onsubmit = (ev) => {
            this.doSubmit();
        }
    }

    takeFocus() {
        this.nameInput.focus();
    }

    recheck() {
        this.ilvlSyncValue.style.display = this.ilvlSyncCheckbox.currentValue ? '' : 'none';
    }

    private doSubmit() {
        const nextSheetSaveStub = getNextSheetInternalName();
        const gearPlanSheet = GRAPHICAL_SHEET_PROVIDER.fromScratch(nextSheetSaveStub, this.nameInput.value, this.jobDropdown.selectedItem, this.levelDropdown.selectedItem, this.tempSettings.ilvlSyncEnabled ? this.tempSettings.ilvlSync : undefined);
        this.sheetOpenCallback(gearPlanSheet).then(() => gearPlanSheet.requestSave());
    }
}

function spacer() {
    return quickElement('div', ['vertical-spacer'], []);
}

customElements.define("new-sheet-form", NewSheetForm, {extends: "form"});
