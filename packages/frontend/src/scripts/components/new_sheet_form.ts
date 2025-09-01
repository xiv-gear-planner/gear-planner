import {
    DataSelect,
    FieldBoundCheckBox,
    FieldBoundIntField,
    labeledCheckbox,
    labelFor,
    nonNegative,
    quickElement
} from "@xivgear/common-ui/components/util";
import {JOB_DATA, JobName, LEVEL_ITEMS, MAX_ILVL, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {SheetHandle, SheetManager} from "@xivgear/core/persistence/saved_sheets";
import {GearPlanSheet, SheetProvider} from "@xivgear/core/sheet";
import {GearPlanSheetGui, GRAPHICAL_SHEET_PROVIDER} from "./sheet";
import {levelSelect} from "@xivgear/common-ui/components/level_picker";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {SHARED_SET_NAME} from "@xivgear/core/imports/imports";
import {recordSheetEvent} from "@xivgear/gearplan-frontend/analytics/analytics";
import {JobIcon} from "./job_icon";
import {RoleKey, SheetSummary} from "@xivgear/xivmath/geartypes";
import {openSheetByKey} from "../base_ui";

export type NewSheetTempSettings = {
    ilvlSyncEnabled: boolean,
    ilvlSync: number,
    multiJob: boolean,
}

export class NewSheetFormFieldSet extends HTMLFieldSetElement {
    readonly nameInput: HTMLInputElement;
    // readonly jobDropdown: DataSelect<JobName>;
    readonly jobPicker: JobPicker;
    readonly multiJobCb: FieldBoundCheckBox<NewSheetTempSettings>;
    readonly levelDropdown: DataSelect<SupportedLevel>;
    readonly ilvlSyncCheckbox: FieldBoundCheckBox<typeof this.newSheetSettings>;
    readonly ilvlSyncValue: FieldBoundIntField<typeof this.newSheetSettings>;
    readonly newSheetSettings: NewSheetTempSettings;

    constructor(settings: {
        name?: string,
        job?: JobName,
        level?: SupportedLevel,
        ilvlSyncEnabled?: boolean,
        ilvlSyncLevel?: number,
        allowedRoles?: RoleKey[],
        multiJob?: boolean,
    }) {
        super();

        this.newSheetSettings = {
            ilvlSyncEnabled: settings?.ilvlSyncEnabled ?? false,
            ilvlSync: settings?.ilvlSyncLevel ?? 700,
            multiJob: settings?.multiJob ?? false,
        };

        // Sheet Name
        this.nameInput = document.createElement("input");
        this.nameInput.id = "new-sheet-name-input";
        this.nameInput.required = true;
        this.nameInput.type = 'text';
        this.nameInput.width = 400;
        if (settings?.name) {
            this.nameInput.value = settings.name;
        }

        // Job selection
        this.jobPicker = new JobPicker(settings.job ?? null, settings.allowedRoles);
        this.appendChild(this.jobPicker);
        this.appendChild(spacer());

        this.multiJobCb = new FieldBoundCheckBox(this.newSheetSettings, 'multiJob');
        this.append(labeledCheckbox('Multi Job', this.multiJobCb));
        this.appendChild(spacer());

        // Sheet Name
        this.appendChild(labelFor("Sheet Name: ", this.nameInput));
        this.appendChild(this.nameInput);
        this.appendChild(spacer());

        // Level selection
        this.levelDropdown = levelSelect(newValue => {
            const isync = LEVEL_ITEMS[newValue]?.defaultIlvlSync;
            if (isync !== undefined) {
                this.newSheetSettings.ilvlSyncEnabled = true;
                this.newSheetSettings.ilvlSync = isync;
                this.ilvlSyncValue.reloadValue();
                this.ilvlSyncCheckbox.reloadValue();
            }
            this.recheck();
        }, settings?.level);
        this.levelDropdown.id = "new-sheet-level-dropdown";
        this.levelDropdown.required = true;
        this.appendChild(labelFor('Level: ', this.levelDropdown));
        this.appendChild(this.levelDropdown);
        this.appendChild(spacer());
        this.ilvlSyncCheckbox = new FieldBoundCheckBox(this.newSheetSettings, 'ilvlSyncEnabled');
        this.ilvlSyncCheckbox.id = 'new-sheet-ilvl-sync-enable';
        this.append(quickElement('div', [], [this.ilvlSyncCheckbox, labelFor("Sync Item Level", this.ilvlSyncCheckbox)]));
        this.ilvlSyncValue = new FieldBoundIntField(this.newSheetSettings, 'ilvlSync', {
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

    validateIsync(): boolean {
        const ilvlSyncEnabled = this.newSheetSettings.ilvlSyncEnabled;
        const ilvlSync = this.newSheetSettings.ilvlSync;
        const level: SupportedLevel = this.levelDropdown.selectedItem;
        if (ilvlSyncEnabled) {
            const expectedMaxIlvl = LEVEL_ITEMS[level]?.defaultIlvlSync ?? MAX_ILVL;
            if (ilvlSync > expectedMaxIlvl) {
                return confirm(`Are you sure you want to create a sheet with an ilvl sync of ${ilvlSync} but a level of ${level}?`);
            }
        }
        return true;
    }

}

type SheetOpenCallback = (sheet: GearPlanSheet) => Promise<unknown>

export class NewSheetForm extends HTMLFormElement {
    private readonly fieldSet: NewSheetFormFieldSet;
    private readonly sheetOpenCallback: SheetOpenCallback;

    constructor(sheetOpenCallback: SheetOpenCallback, private readonly sheetManager: SheetManager, private readonly sheetProvider: SheetProvider<GearPlanSheet>) {
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

        this.addEventListener('submit', (ev) => {
            this.doSubmit(ev);
        });
        // this.onsubmit = (ev) => {
        //     this.doSubmit(ev);
        // };
    }

    takeFocus() {
        this.fieldSet.takeFocus();
    }

    recheck() {
        this.fieldSet.recheck();
    }

    private doSubmit(ev: SubmitEvent) {
        const result = this.fieldSet.validateIsync();
        if (!result) {
            ev.preventDefault();
            return;
        }
        const job = this.fieldSet.jobPicker.selectedJob;
        if (job === null) {
            alert("Please select a job");
            ev.preventDefault();
            return;
        }
        const settings = this.fieldSet.newSheetSettings;
        const sheetName = this.fieldSet.nameInput.value;

        const multiJob = settings.multiJob;
        const isync = settings.ilvlSyncEnabled ? settings.ilvlSync : undefined;
        const level = this.fieldSet.levelDropdown.selectedItem;
        const summary: SheetSummary = {
            isync,
            job,
            level,
            multiJob,
            name: sheetName,
        };
        const handle: SheetHandle = this.sheetManager.newSheetFromScratch(summary);
        const gearPlanSheet = this.sheetProvider.fromScratch(handle.key, sheetName, job, level, isync, multiJob);
        recordSheetEvent("newSheet", gearPlanSheet);
        this.sheetOpenCallback(gearPlanSheet).then(() => gearPlanSheet.requestSave());
    }
}

export abstract class BaseSheetSettingsModal extends BaseModal {
    protected readonly fieldSet: NewSheetFormFieldSet;
    protected readonly form: HTMLFormElement;

    protected constructor(fieldSetInit: {
        name?: string,
        job?: JobName,
        level?: SupportedLevel,
        ilvlSyncEnabled?: boolean,
        ilvlSyncLevel?: number,
        allowedRoles?: RoleKey[],
        multiJob?: boolean,
    }, submitLabel: string) {
        super();
        const form = document.createElement('form');
        this.form = form;
        this.fieldSet = new NewSheetFormFieldSet(fieldSetInit);
        form.appendChild(this.fieldSet);
        this.contentArea.replaceChildren(form);

        const submitButton = quickElement("button", [], [submitLabel]);
        submitButton.type = 'submit';
        this.addButton(submitButton);
        this.addCloseButton();
        submitButton.addEventListener('click', () => {
            form.requestSubmit();
        });
        const hiddenSubmit = quickElement("button", [], [submitLabel]) as HTMLButtonElement;
        hiddenSubmit.style.display = 'none';
        hiddenSubmit.type = 'submit';
        form.appendChild(hiddenSubmit);

        form.addEventListener('submit', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (!this.fieldSet.validateIsync()) {
                return;
            }
            this.onSubmit();
        });
        this.fieldSet.recheck();
    }

    protected get ilvlSyncEnabled(): boolean {
        return this.fieldSet.newSheetSettings.ilvlSyncEnabled;
    }
    protected get ilvlSync(): number {
        return this.fieldSet.newSheetSettings.ilvlSync;
    }
    protected get level(): SupportedLevel {
        return this.fieldSet.levelDropdown.selectedItem;
    }
    protected get selectedJob(): JobName | null {
        return this.fieldSet.jobPicker.selectedJob;
    }
    protected get multiJob(): boolean {
        return this.fieldSet.newSheetSettings.multiJob;
    }
    protected get nameValue(): string {
        return this.fieldSet.nameInput.value;
    }

    protected confirmJobMultiChange(currentJob: JobName, currentIsMultiJob: boolean, newJob: JobName, newIsMultiJob: boolean): boolean {
        if (newJob !== currentJob && !newIsMultiJob) {
            const result = confirm(`You are attempting to change a sheet from ${currentJob} to ${newJob}. Weapons and other class-specific items will be de-selected if they are not equippable as ${newJob}.`);
            if (!result) {
                return false;
            }
        }
        else if (currentIsMultiJob && !newIsMultiJob) {
            const result = confirm(`You are attempting to change a sheet from multi-job to single-job. Items may need to be re-selected if they are not equippable as ${newJob}.`);
            if (!result) {
                return false;
            }
        }
        return true;
    }

    protected abstract onSubmit(): void;
}

export class SaveAsModal extends BaseSheetSettingsModal {
    constructor(private readonly existingSheet: GearPlanSheet, private readonly callback: SheetOpenCallback) {
        const defaultNameBase = existingSheet.sheetName;
        // Add 'copy' to the name if we're copying a sheet that has been saved, or one that's in view only mode.
        const defaultName = (existingSheet.saveKey !== undefined || existingSheet.isViewOnly)
            ? (existingSheet.sheetName === SHARED_SET_NAME ? SHARED_SET_NAME : defaultNameBase + ' copy')
            : defaultNameBase;
        super({
            job: existingSheet.classJobName,
            level: existingSheet.level,
            name: defaultName,
            ilvlSyncEnabled: existingSheet.ilvlSync !== undefined,
            ilvlSyncLevel: existingSheet.ilvlSync,
            allowedRoles: [JOB_DATA[existingSheet.classJobName].role],
            multiJob: existingSheet.isMultiJob,
        }, 'New Sheet');
        this.headerText = 'Save As';
    }

    protected onSubmit(): void {
        const ilvlSyncEnabled = this.ilvlSyncEnabled;
        const ilvlSync = this.ilvlSync;
        const level: SupportedLevel = this.level;
        const newJob = this.selectedJob ?? this.existingSheet.classJobName;
        const multiJob = this.multiJob;
        if (!this.confirmJobMultiChange(this.existingSheet.classJobName, this.existingSheet.isMultiJob, newJob, multiJob)) {
            return;
        }
        const newSheetSaveKey: string = this.existingSheet.saveAs(
            this.nameValue,
            newJob,
            level,
            ilvlSyncEnabled ? ilvlSync : undefined,
            multiJob
        );
        const newSheet = GRAPHICAL_SHEET_PROVIDER.fromSaved(newSheetSaveKey);
        console.log("new sheet key", newSheet.saveKey);
        this.callback(newSheet).then(() => newSheet.requestSave());
        recordSheetEvent("saveAs", newSheet);
        this.close();
    }
}

function spacer() {
    return quickElement('div', ['vertical-spacer'], []);
}

/**
 * JobPicker provides a graphical job selection UI
 */
class JobPicker extends HTMLElement {

    private _selectedJob: JobName | null = null;
    private _selectedSelector: HTMLButtonElement | null = null;

    /**
     * @param defaultJob The job to default to, or null if nothing should be selected by default.
     * @param allowedRoles If specified, restrict which roles may be chosen.
     */
    constructor(defaultJob: JobName | null, allowedRoles?: RoleKey[]) {
        super();
        const tankDiv = quickElement('div', ['job-picker-section', 'job-picker-section-tank'], []);
        const healerDiv = quickElement('div', ['job-picker-section', 'job-picker-section-healer'], []);
        const meleeDiv = quickElement('div', ['job-picker-section', 'job-picker-section-melee'], []);
        const rangeDiv = quickElement('div', ['job-picker-section', 'job-picker-section-range'], []);
        const casterDiv = quickElement('div', ['job-picker-section', 'job-picker-section-caster'], []);

        const jobs = Object.keys(JOB_DATA) as JobName[];

        jobs.forEach((jobName) => {
            const job = JOB_DATA[jobName];
            const jobSelector = quickElement('button', ['job-picker-job-icon'], [new JobIcon(jobName)]);
            jobSelector.value = jobName;
            jobSelector.type = 'button';
            if (defaultJob === jobName) {
                jobSelector.classList.add('selected');
                this._selectedJob = jobName;
                this._selectedSelector = jobSelector;
            }
            let parent: HTMLDivElement;
            switch (job.role) {
                case "Healer":
                    parent = healerDiv;
                    break;
                case "Melee":
                    parent = meleeDiv;
                    break;
                case "Ranged":
                    parent = rangeDiv;
                    break;
                case "Caster":
                    parent = casterDiv;
                    break;
                case "Tank":
                    parent = tankDiv;
                    break;
            }
            parent.appendChild(jobSelector);
            jobSelector.addEventListener('click', (ev) => {
                this._selectedJob = jobName;
                this._selectedSelector?.classList.remove('selected');
                jobSelector.classList.add('selected');
                this._selectedSelector = jobSelector;
            });
        });
        if (allowedRoles) {
            const children = [];
            if (allowedRoles.includes('Tank')) {
                children.push(tankDiv);
            }
            if (allowedRoles.includes('Healer')) {
                children.push(healerDiv);
            }
            if (allowedRoles.includes('Melee')) {
                children.push(meleeDiv);
            }
            if (allowedRoles.includes('Ranged')) {
                children.push(rangeDiv);
            }
            if (allowedRoles.includes('Caster')) {
                children.push(casterDiv);
            }
            this.replaceChildren(...children);
        }
        else {
            this.replaceChildren(tankDiv, healerDiv, meleeDiv, rangeDiv, casterDiv);
        }
    }

    get selectedJob(): JobName | null {
        return this._selectedJob;
    }
}

export class ChangePropsModal extends BaseSheetSettingsModal {
    constructor(private readonly sheet: GearPlanSheetGui) {
        super({
            name: sheet.sheetName,
            job: sheet.classJobName,
            level: sheet.level,
            ilvlSyncEnabled: sheet.ilvlSync !== undefined,
            ilvlSyncLevel: sheet.ilvlSync,
            allowedRoles: [JOB_DATA[sheet.classJobName].role],
            multiJob: sheet.isMultiJob,
        }, 'Apply');
        this.headerText = 'Change Sheet Properties';
    }

    protected onSubmit(): void {
        const desiredJob = this.selectedJob ?? this.sheet.classJobName;
        const desiredMultiJob = this.multiJob;

        const newName = this.nameValue;
        const newLevel = this.level;
        const newIlvl = this.ilvlSyncEnabled ? this.ilvlSync : undefined;

        if (!this.confirmJobMultiChange(this.sheet.classJobName, this.sheet.isMultiJob, desiredJob, desiredMultiJob)) {
            return;
        }

        const changed = (this.sheet.sheetName !== newName)
            || (this.sheet.classJobName !== desiredJob)
            || (this.sheet.isMultiJob !== desiredMultiJob)
            || (this.sheet.level !== newLevel)
            || (this.sheet.ilvlSync !== newIlvl);
        if (!changed) {
            this.close();
            return;
        }

        // Apply in-place updates for all fields, then save and reload this sheet
        this.sheet.sheetName = newName;
        this.sheet.classJobName = desiredJob;
        this.sheet.isMultiJob = desiredMultiJob;
        this.sheet.level = newLevel as SupportedLevel;
        this.sheet.ilvlSync = newIlvl;
        this.sheet.saveData();
        if (this.sheet.saveKey) {
            openSheetByKey(this.sheet.saveKey);
        }
        this.close();
    }
}

customElements.define("save-as-modal", SaveAsModal);
customElements.define("new-sheet-form-fieldset", NewSheetFormFieldSet, {extends: "fieldset"});
customElements.define("new-sheet-form", NewSheetForm, {extends: "form"});
customElements.define('job-picker', JobPicker);
customElements.define('change-props-modal', ChangePropsModal);
