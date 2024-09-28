import { FieldBoundCheckBox, FieldBoundDataSelect, FieldBoundFloatField, makeActionButton, quickElement } from "@xivgear/common-ui/components/util";
import { CharacterGearSet } from "@xivgear/core/gear";
import { GearPlanSheetGui } from "./sheet";
import { SimResult, SimSettings, Simulation } from "@xivgear/core/sims/sim_types";
import { MAX_GCD } from "@xivgear/xivmath/xivconstants";
import { BaseModal } from "@xivgear/common-ui/components/modal";
import { EquipSlots, SetExport, SimExport } from "@xivgear/xivmath/geartypes";

export class MeldSolverSettings {
    sim: Simulation<SimResult, SimSettings, unknown>;
    gearset: CharacterGearSet;
    overwriteExistingMateria: boolean;
    useTargetGcd: boolean;
    targetGcd?: number;
}

/**
 * Different from MeldsolverSettings because webworkers needs a serializable object
 * There's probably a better way than
 */
export class MeldSolverSettingsExport {
    sim: SimExport;
    gearset: SetExport;
    overwriteExistingMateria: boolean;
    useTargetGcd: boolean;
    targetGcd?: number;
}

export class MeldSolverDialog extends BaseModal {
    private _sheet: GearPlanSheetGui;

    private descriptionText: HTMLSpanElement;
    private setNameText: HTMLSpanElement;
    readonly tempSettings: MeldSolverSettings;
    private solveMeldsButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;
    readonly settingsDiv: MeldSolverSettingsMenu;
    private progressDisplay: MeldSolverProgressDisplay;
    
    private solveWorker: Worker;

    constructor(sheet: GearPlanSheetGui, set: CharacterGearSet) {
        super();
        this._sheet = sheet;
        this.id = 'meld-solver-dialog';
        this.headerText = 'Meld Solver';
        const form = document.createElement("form");
        form.method = 'dialog';

        this.solveWorker = this.makeActualWorker();

        this.classList.add('meld-solver-area');
        this.descriptionText = document.createElement('span');
        this.descriptionText.textContent = "Solve for the highest-dps set of melds for this gearset.\nSpeed up computations by targeting a specific GCD and/or pre-filling some materia slots";
        
        this.setNameText = document.createElement('span');
        this.setNameText.textContent = set.name;
        this.setNameText.classList.add('meld-solver-set');

        this.settingsDiv = new MeldSolverSettingsMenu(sheet, set);

        let outer = this; 
        this.solveWorker.onmessage = function (ev: MessageEvent) {
            outer.messageReceived(ev);
        };

        this.solveMeldsButton = makeActionButton("Solve Melds", async () => {
            console.log("sending...?");
            this.solveWorker.postMessage([sheet.exportSheet(), this.exportSolverSettings()]);

            this.closeButton.disabled = true;
            this.settingsDiv.setEnabled(false);

            this.buttonArea.removeChild(this.solveMeldsButton);
            this.addButton(this.cancelButton);
            this.progressDisplay = new MeldSolverProgressDisplay;
            form.replaceChildren(this.progressDisplay);

        });

        this.cancelButton = makeActionButton("Cancel", async () => {
            this.solveWorker.terminate();

            this.closeButton.disabled = false;
            this.settingsDiv.setEnabled(true);

            this.buttonArea.removeChild(this.cancelButton);
            form.replaceChildren(this.settingsDiv);
            this.addButton(this.solveMeldsButton);
        });
        
        this.addButton(this.solveMeldsButton);

        form.replaceChildren(this.descriptionText, this.setNameText, this.settingsDiv);
        this.contentArea.append(form);
    }

    // Webpack sees this and it causes it to generate a separate js file for the worker.
    // import.meta.url doesn't actually work for this - we need to use document.location as shown in the ctor.
    // TODO: make sure the worker JS is not also ending up in the main JS
    makeUselessWorker() {
        this.solveWorker = new Worker(new URL(
            // @ts-expect-error idk
            '../workers/meld_solver_worker.ts', import.meta.url)
        );
    }

    makeActualWorker(): Worker {
        return new Worker(new URL(
            './src_scripts_workers_meld_solver_worker_ts.js', document.location.toString())
        );
    }

    public refresh(set: CharacterGearSet) {
        this.settingsDiv.settings.gearset = set;
    }

    // For sending to worker
    exportSolverSettings(): MeldSolverSettingsExport {
        const setting = this.settingsDiv.settings.sim.exportSettings();
        return {
            ...this.settingsDiv.settings,
            sim: {
                stub: this.settingsDiv.settings.sim.spec.stub,
                settings: setting as SimSettings,
                name: this.settingsDiv.settings.sim.displayName,
            },
            gearset: this._sheet.exportGearSet(this.settingsDiv.settings.gearset),
        };
    }

    messageReceived(ev: MessageEvent) {
        
        if (typeof ev.data === 'number') {
            this.progressDisplay.loadbar.updateProgress(ev.data as number);
            if ((ev.data as number) === 0) {
                this.progressDisplay.text.textContent = "Simulating...";
            }  
        }
        else {
            let set = this._sheet.importGearSet(ev.data as SetExport);
            if (set) {
                this.applyResult(set);
                this.settingsDiv.settings.gearset.forceRecalc();
                this._sheet.refreshMateria();
                this.close();
            }
        }
    }

    applyResult(newSet: CharacterGearSet) {

        for (const slotKey of EquipSlots) {
            if (!this.settingsDiv.settings.gearset.equipment[slotKey]) {
                continue;
            }

            this.settingsDiv.settings.gearset.equipment[slotKey].melds = newSet.equipment[slotKey].melds;
        }
    }
}

class LoadBar extends HTMLDivElement {

    outerBar: HTMLDivElement;
    innerBar: HTMLDivElement;

    constructor() {
        super();

        this.outerBar = document.createElement('div');
        this.outerBar.classList.add('load-bar-outer');

        this.innerBar = document.createElement('div');
        this.innerBar.classList.add('load-bar-inner');
        this.innerBar.style.height = "30px";
        this.innerBar.style.width = "0%";

        this.outerBar.replaceChildren(this.innerBar);
        this.replaceChildren(this.outerBar);
    }

    updateProgress(progress: number) {
        this.innerBar.style.width = `${progress}%`;
    }
}

class MeldSolverProgressDisplay extends HTMLDivElement {

    public readonly loadbar: LoadBar;
    text: HTMLHeadingElement;

    constructor() {
        super();

        this.loadbar = new LoadBar;
        this.text = document.createElement('h4');
        this.text.textContent = "Generating meld combinations...";

        this.replaceChildren(this.text, this.loadbar);
    }
}

class MeldSolverSettingsMenu extends HTMLDivElement {
    public settings: MeldSolverSettings;
    private overwriteMateriaText: HTMLSpanElement;
    private overwriteMateriaCheckbox: FieldBoundCheckBox<MeldSolverSettings>;
    private useTargetGcdCheckBox: FieldBoundCheckBox<MeldSolverSettings>;
    private targetGcdInput: FieldBoundFloatField<MeldSolverSettings>;
    private checkboxContainer: HTMLDivElement;
    private simDropdown: FieldBoundDataSelect<MeldSolverSettings, Simulation<SimResult, unknown, unknown>>;

    private readonly disableables = [];
    constructor(sheet: GearPlanSheetGui, set: CharacterGearSet) {
        super();
        this.settings = {
            gearset: set,
            overwriteExistingMateria: false, 
            useTargetGcd: false,
            targetGcd: 2.50,
            sim: sheet.sims.at(0),
        }

        const targetGcdText = document.createElement('span');
        targetGcdText.textContent = "Target GCD: ";
        targetGcdText.classList.add('meld-solver-settings');

        this.targetGcdInput = new FieldBoundFloatField(this.settings, 'targetGcd', {
            postValidators: [ctx => {
                const val = ctx.newValue;
                // Check if user typed more than 2 digits, weird math because floating point fun
                if (Math.round(val * 1000) % 10) {
                    ctx.failValidation("Enter at most two decimal points");
                }
                else if (val < 0) {
                    ctx.failValidation("Enter a positive number");
                }
                else if (val > MAX_GCD) {
                    ctx.failValidation("Cannot be greater than " + MAX_GCD);
                }
            }]
        });

        this.targetGcdInput.pattern = '\\d\\.\\d\\d?';
        this.targetGcdInput.title = 'Solve for the best set with this GCD'
        this.targetGcdInput.classList.add('meld-solver-target-gcd-input');
        this.targetGcdInput.disabled = true;

        this.useTargetGcdCheckBox = new FieldBoundCheckBox(this.settings, 'useTargetGcd');
        this.useTargetGcdCheckBox.classList.add('meld-solver-settings');

        this.overwriteMateriaText = document.createElement('span');
        this.overwriteMateriaText.textContent = "Overwrite existing materia?";
        this.overwriteMateriaText.classList.add('meld-solver-settings');

        this.overwriteMateriaCheckbox = new FieldBoundCheckBox(this.settings, 'overwriteExistingMateria');
        this.overwriteMateriaCheckbox.classList.add('meld-solver-settings');

        const simText = document.createElement('span');
        simText.textContent = "Sim: ";
        simText.classList.add('meld-solver-settings');

        this.simDropdown = new FieldBoundDataSelect<typeof this.settings, Simulation<SimResult, unknown, unknown>>(
            this.settings,
            'sim',
            value => {
                return value ? value.displayName : "None";
            },
            [...sheet.sims],
        );
        this.simDropdown.classList.add('meld-solver-sim-dropdown');

        const span1 = document.createElement('li');
        span1.replaceChildren(this.overwriteMateriaCheckbox, this.overwriteMateriaText)

        const span2 = document.createElement('li');
        span2.replaceChildren(this.useTargetGcdCheckBox, targetGcdText, this.targetGcdInput);

        const span3 = document.createElement('li');
        span3.replaceChildren(simText, this.simDropdown);

        this.checkboxContainer = document.createElement('div');
        this.checkboxContainer.classList.add('meld-solver-settings');
        this.checkboxContainer.replaceChildren(
            span1,
            span2,
            span3
        )

        this.useTargetGcdCheckBox.onclick = (evt) => {
            this.targetGcdInput.disabled = !this.targetGcdInput.disabled;
        }

        this.replaceChildren(this.checkboxContainer);
        this.disableables = [this.overwriteMateriaCheckbox, this.useTargetGcdCheckBox, this.targetGcdInput, this.simDropdown];
    }

    setEnabled(enabled: boolean) {
        for (const item of this.disableables) {
            if (item && 'disabled' in item) {
                item.disabled = !enabled;
            }
        }
    }
}

customElements.define('meld-solver-area', MeldSolverDialog);
customElements.define('load-bar', LoadBar, {extends: 'div'});
customElements.define('meld-solver-progress-display', MeldSolverProgressDisplay, {extends: 'div'});
customElements.define('meld-solver-settings-menu', MeldSolverSettingsMenu, {extends: 'div'});