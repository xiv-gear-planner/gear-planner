import { FieldBoundCheckBox, FieldBoundDataSelect, FieldBoundFloatField, makeActionButton } from "@xivgear/common-ui/components/util";
import { CharacterGearSet } from "@xivgear/core/gear";
import { MeldSolver } from "./meldsolver";
import { GearPlanSheetGui } from "./sheet";
import { SimResult, SimSettings, Simulation } from "@xivgear/core/sims/sim_types";
import { MAX_GCD } from "@xivgear/xivmath/xivconstants";
import { BaseModal } from "@xivgear/common-ui/components/modal";

export class MeldSolverSettings {
    sim: Simulation<SimResult, SimSettings, unknown>;
    overwriteExistingMateria: boolean;
    useTargetGcd: boolean;
    targetGcd?: number;
}
export class MeldSolverDialog extends BaseModal {
    private _solver: MeldSolver;

    private button: HTMLButtonElement;
    readonly tempSettings: MeldSolverSettings;
    readonly settingsDiv: MeldSolverSettingsMenu;

    constructor(sheet: GearPlanSheetGui) {
        super();
        this.id = 'meld-solver-dialog';
        this.headerText = 'Meld Solver';
        const form = document.createElement("form");
        form.method = 'dialog';

        this.classList.add('meld-solver-area');
        this._solver = new MeldSolver(sheet);
        this.settingsDiv = new MeldSolverSettingsMenu(sheet);

        this.button = makeActionButton("Solve Melds", async () => {
            const prommie = (async () => {

                return await this._solver.buttonPress(this.settingsDiv.settings);
            })();
            return prommie;
        });
        
        this.addButton(this.button);
        form.replaceChildren( this.settingsDiv);
        this.contentArea.append(form);
    }

    public refresh(set: CharacterGearSet) {
        this._solver.refresh(set);
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

    constructor(sheet: GearPlanSheetGui) {
        super();

        this.settings = {
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

        let span1 = document.createElement('li');
        span1.replaceChildren(this.overwriteMateriaCheckbox, this.overwriteMateriaText)

        let span2 = document.createElement('li');
        span2.replaceChildren(this.useTargetGcdCheckBox, targetGcdText, this.targetGcdInput);

        let span3 = document.createElement('li');
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