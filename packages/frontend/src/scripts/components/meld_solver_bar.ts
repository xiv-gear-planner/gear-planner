import { FieldBoundCheckBox, FieldBoundDataSelect, FieldBoundFloatField, makeActionButton } from "@xivgear/common-ui/components/util";
import { CharacterGearSet } from "@xivgear/core/gear";
import { GearPlanSheetGui } from "./sheet";
import { SimResult, SimSettings, Simulation } from "@xivgear/core/sims/sim_types";
import { MAX_GCD } from "@xivgear/xivmath/xivconstants";
import { BaseModal } from "@xivgear/common-ui/components/modal";
import { SetExport, SimExport } from "@xivgear/xivmath/geartypes";


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

    private solveMeldsButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;
    readonly tempSettings: MeldSolverSettings;
    readonly settingsDiv: MeldSolverSettingsMenu;
    private solveWorker: Worker;

    constructor(sheet: GearPlanSheetGui, set: CharacterGearSet) {
        super();
        this._sheet = sheet;
        this.id = 'meld-solver-dialog';
        this.headerText = 'Meld Solver';
        const form = document.createElement("form");
        form.method = 'dialog';
        this.solveWorker = new Worker(new URL(
            './src_scripts_components_meld_solver_worker_ts.js', document.location.toString())
        );

        this.classList.add('meld-solver-area');
        //this._solver = new MeldSolver(sheet);
        this.settingsDiv = new MeldSolverSettingsMenu(sheet, set);
        
        this.solveWorker.onmessage = function (ev: MessageEvent) {
            console.log(ev.data);//ev.data as CharacterGearSet);
            //outer.close();
        };

        this.solveMeldsButton = makeActionButton("Solve Melds", async () => {
            console.log("sending...?");
            this.solveWorker.postMessage([sheet.exportSheet(), this.exportSolverSettings()]);
            this.solveMeldsButton.disabled = true;
            this.addButton(this.cancelButton);
            /*
            const prommie = (async () => {

                //return await this._solver.buttonPress(this.settingsDiv.settings);
            })();
            return prommie;
            */
        });

        this.cancelButton = makeActionButton("Cancel", async () => {
            this.solveWorker.terminate();
            this.solveWorker = new Worker(new URL(
                './src_scripts_components_meld_solver_worker_ts.js', document.location.toString())
            );
            this.buttonArea.removeChild(this.cancelButton);
            this.solveMeldsButton.disabled = false;
        })
        
        this.addButton(this.solveMeldsButton);
        form.replaceChildren( this.settingsDiv);
        this.contentArea.append(form);
    }

    public refresh(set: CharacterGearSet) {
        this.settingsDiv.settings.gearset = set;
    }

    // For sending to worker
    exportSolverSettings(): MeldSolverSettingsExport {
        return {
            ...this.settingsDiv.settings,
            sim: {
                stub: this.settingsDiv.settings.sim.spec.stub,
                settings: this.settingsDiv.settings.sim.settings,
                name: this.settingsDiv.settings.sim.displayName,
            },
            gearset: this._sheet.exportGearSet(this.settingsDiv.settings.gearset),
        };
    }
}

class MeldSolverSettingsMenu extends HTMLDivElement {
    public settings: MeldSolverSettings;
    private overwriteMateriaText: HTMLSpanElement;
    private overwriteMateriaCheckbox: FieldBoundCheckBox<MeldSolverSettings>;
    private useTargetGcdCheckBox: FieldBoundCheckBox<MeldSolverSettings>;
    private targetGcdInput: FieldBoundFloatField<MeldSolverSettings>;
    private checkboxContainer: HTMLDivElement;
    private simDropdown: FieldBoundDataSelect<MeldSolverSettings, Simulation<any, any, any>>

    constructor(sheet: GearPlanSheetGui, set: CharacterGearSet) {
        super();

        this.settings = {
            gearset: set,
            overwriteExistingMateria: true, 
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

        this.simDropdown = new FieldBoundDataSelect<typeof this.settings, Simulation<any, any, any>>(
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
    }
}

customElements.define('meld-solver-area', MeldSolverDialog);
customElements.define('meld-solver-settings-menu', MeldSolverSettingsMenu, {extends: 'div'});