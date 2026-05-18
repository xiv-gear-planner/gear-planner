import {
    DataSelect,
    FieldBoundCheckBox,
    FieldBoundIntField,
    labeledCheckbox,
    labelFor,
    nonNegative,
    quickElement
} from "@xivgear/common-ui/components/util";
import {
    ALL_COMBAT_JOBS,
    CURRENT_MAX_LEVEL,
    JOB_DATA,
    JobName,
    LEVEL_ITEMS,
    MAX_ILVL,
    SupportedLevel
} from "@xivgear/xivmath/xivconstants";
import {SheetHandle, SheetManager} from "@xivgear/core/persistence/saved_sheets";
import {GearPlanSheet, SheetProvider} from "@xivgear/core/sheet";
import {GearPlanSheetGui} from "../sheet/sheet_gui";
import {fieldBoundLevelSelect} from "@xivgear/common-ui/components/level_picker";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {SHARED_SET_NAME} from "@xivgear/core/imports/imports";
import {JobIcon} from "../job/job_icon";
import {RoleKey, SheetSummary} from "@xivgear/xivmath/geartypes";
import {openSheetByKey} from "../../base_ui";
import {GRAPHICAL_SHEET_PROVIDER} from "../sheet/provider";
import {recordSheetEvent} from "../../analytics/analytics";
import {clampJobLevel, levelsForJob} from "@xivgear/core/util/job_utils";

export type NewSheetTempSettings = {
    ilvlSyncEnabled: boolean,
    ilvlSync: number,
    multiJob: boolean,
    level: SupportedLevel,
}

/**
 * Finalized settings used for creating or updating a sheet.
 */
export type FinalizedSheetSettings = {
    name: string,
    job: JobName,
    level: SupportedLevel,
    ilvlSync: number | undefined,
    multiJob: boolean,
}

/**
 * NewSheetFormFieldSet is used both for the new sheet form, as well as the "Save As" and "Change Sheet Properties"
 * modals where you have the opportunity to change sheet settings.
 *
 * The expected behavior is:
 *
 * 1. You select a job.
 * 2. You optionally enable multi-job mode.
 * 3. When selecting a job, reset the selected level if it falls outside the range of the new job.
 * 4. When selecting a level (including as part of step 3, enable/disable the ilvl sync based on
 * whether or not it is the current global max level.
 *
 */
export class NewSheetFormFieldSet extends HTMLFieldSetElement {
    private readonly nameInput: HTMLInputElement;
    private readonly jobPicker: JobPicker;
    private readonly multiJobCb: FieldBoundCheckBox<NewSheetFormFieldSet>;
    private _levelDropdown: DataSelect<SupportedLevel>;
    private readonly ilvlSyncCheckbox: FieldBoundCheckBox<NewSheetFormFieldSet>;
    private readonly ilvlSyncValue: FieldBoundIntField<NewSheetFormFieldSet>;
    private readonly newSheetSettings: NewSheetTempSettings;

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
            ilvlSyncEnabled: settings.ilvlSyncEnabled ?? false,
            ilvlSync: settings.ilvlSyncLevel ?? 700,
            multiJob: settings.multiJob ?? false,
            level: clampJobLevel(settings.job, settings.level ?? CURRENT_MAX_LEVEL),
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
        this.jobPicker.addEventListener('jobchange', (ev: JobChangeEvent) => {
            this.setSelectedJob(ev.detail.newJob, ev.detail.oldJob);
        });
        this.appendChild(this.jobPicker);
        this.appendChild(spacer());

        this.multiJobCb = new FieldBoundCheckBox<NewSheetFormFieldSet>(this, 'multiJob');
        this.append(labeledCheckbox('Multi Job', this.multiJobCb));
        this.appendChild(spacer());

        // Sheet Name
        this.appendChild(labelFor("Sheet Name: ", this.nameInput));
        this.appendChild(this.nameInput);
        this.appendChild(spacer());

        // Level selection

        this.ilvlSyncCheckbox = new FieldBoundCheckBox<NewSheetFormFieldSet>(this, 'ilvlSyncEnabled');
        this.ilvlSyncCheckbox.id = 'new-sheet-ilvl-sync-enable';
        this.ilvlSyncValue = new FieldBoundIntField<NewSheetFormFieldSet>(this, 'ilvlSync', {
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

        // This requires us to have the elements initialized
        this.revalidateLevelSelect();
        this.appendChild(labelFor('Level: ', this._levelDropdown));
        this.appendChild(this._levelDropdown);

        this.appendChild(spacer());
        this.append(quickElement('div', [], [this.ilvlSyncCheckbox, labelFor("Sync Item Level", this.ilvlSyncCheckbox)]));

        this.appendChild(this.ilvlSyncValue);
        this.appendChild(spacer());

        this.recheck();
    }

    private get selectedJob(): JobName | null {
        return this.jobPicker.selectedJob;
    }

    private setSelectedJob(job: JobName | null, oldJob: JobName | null) {
        // JobPicker handles its own internal state and UI when clicked,
        // but we might be calling this from code too.
        // If it's the same, do nothing.
        const newLevel = clampJobLevel(job, this.level);
        if (newLevel !== this.level) {
            this.level = newLevel;
            // The level setter will handle ilvl sync and updating the dropdown.
            // However, we also need to revalidate the level select because the list of valid levels might have changed.
            this.revalidateLevelSelect();
        }
        else if (job !== oldJob) {
            // Even if level didn't change, we might need to refresh the level dropdown
            // because valid levels might have changed.
            this.revalidateLevelSelect();
        }
    }

    get level(): SupportedLevel {
        return this.newSheetSettings.level;
    }

    set level(newLevel: SupportedLevel) {
        this.newSheetSettings.level = newLevel;
        const isync = LEVEL_ITEMS[newLevel]?.defaultIlvlSync;
        if (isync !== undefined) {
            this.ilvlSyncEnabled = true;
            this.ilvlSync = isync;
        }
        else {
            this.ilvlSyncEnabled = false;
        }
        if (this._levelDropdown && this._levelDropdown.selectedItem !== newLevel) {
            this._levelDropdown.selectedItem = newLevel;
        }
    }

    get ilvlSyncEnabled(): boolean {
        return this.newSheetSettings.ilvlSyncEnabled;
    }

    set ilvlSyncEnabled(enabled: boolean) {
        this.newSheetSettings.ilvlSyncEnabled = enabled;
        this.recheck();
    }

    get ilvlSync(): number {
        return this.newSheetSettings.ilvlSync;
    }

    set ilvlSync(isync: number) {
        this.newSheetSettings.ilvlSync = isync;
        this.recheck();
    }

    get multiJob(): boolean {
        return this.newSheetSettings.multiJob;
    }

    set multiJob(multiJob: boolean) {
        this.newSheetSettings.multiJob = multiJob;
        this.recheck();
    }

    private get nameValue(): string {
        return this.nameInput.value;
    }

    private set nameValue(name: string) {
        this.nameInput.value = name;
    }

    get finalizedSettings(): FinalizedSheetSettings | 'no-job' {
        const job = this.selectedJob;
        if (job === null) {
            return 'no-job';
        }
        return {
            name: this.nameValue,
            job: job,
            level: this.level,
            ilvlSync: this.ilvlSyncEnabled ? this.ilvlSync : undefined,
            multiJob: this.multiJob,
        };
    }

    takeFocus() {
        this.nameInput.focus();
    }

    recheck() {
        this.ilvlSyncCheckbox.reloadValue();
        this.ilvlSyncValue.reloadValue();
        // this.multiJobCb.reloadValue();
        this.ilvlSyncValue.style.display = this.ilvlSyncEnabled ? '' : 'none';
    }

    private get levelDropdown(): DataSelect<SupportedLevel> {
        return this._levelDropdown;
    }

    private set levelDropdown(value: DataSelect<SupportedLevel>) {
        const oldDropdown = this._levelDropdown;
        if (oldDropdown) {
            oldDropdown.replaceWith(value);
        }
        this._levelDropdown = value;
    }

    private revalidateLevelSelect() {
        const job = this.selectedJob ?? 'SGE';
        const select = fieldBoundLevelSelect<NewSheetFormFieldSet>(this, 'level');
        const levels = levelsForJob(job);
        select.updateItems([...levels], this.level);
        select.id = "new-sheet-level-dropdown";
        select.required = true;
        this.levelDropdown = select;
    }

    validateIsync(): boolean {
        const ilvlSyncEnabled = this.newSheetSettings.ilvlSyncEnabled;
        const ilvlSync = this.newSheetSettings.ilvlSync;
        const level: SupportedLevel = this.newSheetSettings.level;
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

    private doSubmit(ev: SubmitEvent) {
        if (!this.fieldSet.validateIsync()) {
            ev.preventDefault();
            return;
        }
        const settings = this.fieldSet.finalizedSettings;
        if (settings === 'no-job') {
            alert("Please select a job");
            ev.preventDefault();
            return;
        }

        const summary: SheetSummary = {
            isync: settings.ilvlSync,
            job: settings.job,
            level: settings.level,
            multiJob: settings.multiJob,
            name: settings.name,
        };
        const handle: SheetHandle = this.sheetManager.newSheetFromScratch(summary);
        const gearPlanSheet = this.sheetProvider.fromScratch(handle.key, settings.name, settings.job, settings.level, settings.ilvlSync, settings.multiJob);
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
        const settings = this.fieldSet.finalizedSettings;
        if (settings === 'no-job') {
            return;
        }
        if (!this.confirmJobMultiChange(this.existingSheet.classJobName, this.existingSheet.isMultiJob, settings.job, settings.multiJob)) {
            return;
        }
        const newSheetSaveKey: string = this.existingSheet.saveAs(
            settings.name,
            settings.job,
            settings.level,
            settings.ilvlSync,
            settings.multiJob
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
export class JobChangeEvent extends CustomEvent<JobChangeEventDetail> {
    constructor(detail: JobChangeEventDetail) {
        super('jobchange', {detail});
    }
}

export interface JobChangeEventDetail {
    oldJob: JobName | null;
    newJob: JobName | null;
}

class JobPicker extends HTMLElement {

    private _selectedJob: JobName | null = null;
    private _selectedSelector: HTMLButtonElement | null = null;

    /**
     * @param defaultJob The job to default to, or null if nothing should be selected by default.
     * @param allowedRoles If specified, restrict which roles may be chosen.
     */
    constructor(defaultJob: JobName | null = null, allowedRoles?: RoleKey[]) {
        super();
        const tankDiv = quickElement('div', ['job-picker-section', 'job-picker-section-tank'], []);
        const healerDiv = quickElement('div', ['job-picker-section', 'job-picker-section-healer'], []);
        const meleeDiv = quickElement('div', ['job-picker-section', 'job-picker-section-melee'], []);
        const rangeDiv = quickElement('div', ['job-picker-section', 'job-picker-section-range'], []);
        const casterDiv = quickElement('div', ['job-picker-section', 'job-picker-section-caster'], []);

        ALL_COMBAT_JOBS.forEach((jobName) => {
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
                const oldJob = this._selectedJob;
                this._selectedJob = jobName;
                this._selectedSelector?.classList.remove('selected');
                jobSelector.classList.add('selected');
                this._selectedSelector = jobSelector;
                this.dispatchEvent(new JobChangeEvent({
                    oldJob,
                    newJob: jobName,
                }));
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
        const settings = this.fieldSet.finalizedSettings;
        if (settings === 'no-job') {
            return;
        }

        if (!this.confirmJobMultiChange(this.sheet.classJobName, this.sheet.isMultiJob, settings.job, settings.multiJob)) {
            return;
        }

        const changed = (this.sheet.sheetName !== settings.name)
            || (this.sheet.classJobName !== settings.job)
            || (this.sheet.isMultiJob !== settings.multiJob)
            || (this.sheet.level !== settings.level)
            || (this.sheet.ilvlSync !== settings.ilvlSync);
        if (!changed) {
            this.close();
            return;
        }

        // Apply in-place updates for all fields, then save and reload this sheet
        this.sheet.sheetName = settings.name;
        this.sheet.classJobName = settings.job;
        this.sheet.isMultiJob = settings.multiJob;
        this.sheet.level = settings.level as SupportedLevel;
        this.sheet.ilvlSync = settings.ilvlSync;
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
