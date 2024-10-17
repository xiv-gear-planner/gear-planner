import { FieldBoundCheckBox, FieldBoundDataSelect, FieldBoundFloatField, makeActionButton } from "@xivgear/common-ui/components/util";
import { CharacterGearSet } from "@xivgear/core/gear";
import { GearPlanSheetGui } from "./sheet";
import { SimResult, Simulation } from "@xivgear/core/sims/sim_types";
import { MAX_GCD } from "@xivgear/xivmath/xivconstants";
import { BaseModal } from "@xivgear/common-ui/components/modal";
import { EquipSlots } from "@xivgear/xivmath/geartypes";
import { MeldSolverSettings, MeldSolver } from "./meldsolver";
import { GearsetGenerationSettings } from "@xivgear/core/solving/gearset_generation";
import { SolverSimulationSettings } from "@xivgear/core/solving/sim_runner";
import { recordEvent } from "@xivgear/core/analytics/analytics";

export class MeldSolverDialog extends BaseModal {
    private _sheet: GearPlanSheetGui;

    private form: HTMLFormElement;
    private descriptionText: HTMLDivElement;
    private setNameText: HTMLDivElement;
    readonly tempSettings: MeldSolverSettings;
    private solveMeldsButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;
    readonly settingsDiv: MeldSolverSettingsMenu;
    private progressDisplay: MeldSolverProgressDisplay;

    private solver: MeldSolver;

    constructor(sheet: GearPlanSheetGui, set: CharacterGearSet) {
        super();
        this._sheet = sheet;
        this.id = 'meld-solver-dialog';
        this.headerText = 'Meld Solver';
        this.form = document.createElement("form");
        this.form.method = 'dialog';
        this.inner.style.maxWidth = "25%"; // idk why this doesn't work in common-css but it don't.

        this.classList.add('meld-solver-area');
        this.descriptionText = document.createElement('div');
        this.descriptionText.textContent = "Solve for the highest-dps set of melds for this gearset.\r\n"
            + "Speed up computations by targeting a specific GCD and/or pre-filling some materia slots";

        this.setNameText = document.createElement('div');
        this.setNameText.textContent = `"${set.name}"`;
        this.setNameText.classList.add('meld-solver-set');

        this.settingsDiv = new MeldSolverSettingsMenu(sheet, set);

        let meld_solve_start: number;

        this.solveMeldsButton = makeActionButton("Solve Melds", async () => {
            this.solver = new MeldSolver(sheet);
            meld_solve_start = Date.now();

            this.buttonArea.removeChild(this.solveMeldsButton);
            this.showProgress();

            const solverPromise = this.solver.solveMelds(
                this.settingsDiv.gearsetGenSettings,
                this.settingsDiv.simSettings,
                (num: number) => {
                    this.progressDisplay.loadbar.updateProgress(num);
                    this.progressDisplay.text.textContent = "Simulating...";

                });
            solverPromise.then((set) => this.solveResultReceived(set));
            recordEvent("SolveMelds", {
                "Total Time Taken: ": Date.now() - (meld_solve_start ?? Date.now()),
            });
            solverPromise.catch((err) => console.log(err));
        });

        this.cancelButton = makeActionButton("Cancel", async () => {
            await this.solver.cancel();
            this.buttonArea.removeChild(this.cancelButton);

            this.showSettings();
        });

        this.showSettings();
        this.contentArea.append(this.form);
    }

    public refresh(set: CharacterGearSet) {
        this.settingsDiv.gearsetGenSettings.gearset = set;
    }

    solveResultReceived(set: CharacterGearSet) {
        if (set) {
            this.applyResult(set);
            this.settingsDiv.gearsetGenSettings.gearset.forceRecalc();
            this._sheet.refreshMateria();
            this.close();
            return;
        }
        this.showSettings();
    }

    applyResult(newSet: CharacterGearSet) {

        for (const slotKey of EquipSlots) {
            if (!this.settingsDiv.gearsetGenSettings.gearset.equipment[slotKey]) {
                continue;
            }

            this.settingsDiv.gearsetGenSettings.gearset.equipment[slotKey].melds = newSet.equipment[slotKey].melds;
        }
    }

    showSettings() {

        this.closeButton.disabled = false;
        this.settingsDiv.setEnabled(true);

        this.form.replaceChildren(
            this.descriptionText, document.createElement('br'),
            this.setNameText, document.createElement('br'),
            this.settingsDiv
        );
        this.addButton(this.solveMeldsButton);
    }

    showProgress() {

        this.closeButton.disabled = true;
        this.settingsDiv.setEnabled(false);

        this.progressDisplay = new MeldSolverProgressDisplay;
        this.form.replaceChildren(this.progressDisplay);
        this.addButton(this.cancelButton);
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
    public gearsetGenSettings: GearsetGenerationSettings;
    public simSettings: SolverSimulationSettings;
    private overwriteMateriaText: HTMLSpanElement;
    private overwriteMateriaCheckbox: FieldBoundCheckBox<GearsetGenerationSettings>;
    private useTargetGcdCheckBox: FieldBoundCheckBox<GearsetGenerationSettings>;
    private targetGcdInput: FieldBoundFloatField<GearsetGenerationSettings>;
    private checkboxContainer: HTMLDivElement;
    private simDropdown: FieldBoundDataSelect<SolverSimulationSettings, Simulation<SimResult, unknown, unknown>>;

    private readonly disableables = [];
    constructor(sheet: GearPlanSheetGui, set: CharacterGearSet) {
        super();

        let gcd = 2.5;
        const override = sheet.classJobStats.gcdDisplayOverrides?.(sheet.level);
        if (override && override.length >= 1) {
            const haste = set.computedStats.haste(override[0].attackType) + (override[0].haste ?? 0);
            switch (override[0].basis) {
                case "sks":
                    gcd = set.computedStats.gcdPhys(2.5, haste);
                    break;
                case "sps":
                    gcd = set.computedStats.gcdMag(2.5, haste);
                    break;
            }
        }
        this.gearsetGenSettings = new GearsetGenerationSettings(set, false, false, gcd);
        this.simSettings = {
            sim: sheet.sims.at(0),
            sets: undefined, // Not referenced in UI
        }

        const targetGcdText = document.createElement('span');
        targetGcdText.textContent = "Target GCD: ";
        targetGcdText.classList.add('meld-solver-settings');

        this.targetGcdInput = new FieldBoundFloatField(this.gearsetGenSettings, 'targetGcd', {
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

        this.useTargetGcdCheckBox = new FieldBoundCheckBox(this.gearsetGenSettings, 'useTargetGcd');
        this.useTargetGcdCheckBox.classList.add('meld-solver-settings');

        this.overwriteMateriaText = document.createElement('span');
        this.overwriteMateriaText.textContent = "Overwrite existing materia?";
        this.overwriteMateriaText.classList.add('meld-solver-settings');

        this.overwriteMateriaCheckbox = new FieldBoundCheckBox(this.gearsetGenSettings, 'overwriteExistingMateria');
        this.overwriteMateriaCheckbox.classList.add('meld-solver-settings');

        const simText = document.createElement('span');
        simText.textContent = "Sim: ";
        simText.classList.add('meld-solver-settings');

        this.simDropdown = new FieldBoundDataSelect<typeof this.simSettings, Simulation<SimResult, unknown, unknown>>(
            this.simSettings,
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
        this.targetGcdInput.disabled = !this.gearsetGenSettings.useTargetGcd;
    }
}

customElements.define('meld-solver-area', MeldSolverDialog);
customElements.define('load-bar', LoadBar, { extends: 'div' });
customElements.define('meld-solver-progress-display', MeldSolverProgressDisplay, { extends: 'div' });
customElements.define('meld-solver-settings-menu', MeldSolverSettingsMenu, { extends: 'div' });