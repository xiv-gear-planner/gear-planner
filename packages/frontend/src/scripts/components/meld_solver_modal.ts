import {
    FieldBoundCheckBox,
    FieldBoundDataSelect,
    FieldBoundFloatField,
    labelFor,
    makeActionButton
} from "@xivgear/common-ui/components/util";
import { CharacterGearSet } from "@xivgear/core/gear";
import { GearPlanSheetGui } from "./sheet";
import { SimResult, Simulation } from "@xivgear/core/sims/sim_types";
import { MAX_GCD, STAT_ABBREVIATIONS } from "@xivgear/xivmath/xivconstants";
import { BaseModal } from "@xivgear/common-ui/components/modal";
import { EquipSlots } from "@xivgear/xivmath/geartypes";
import { MeldSolverSettings, MeldSolver } from "./meldsolver";
import { GearsetGenerationSettings } from "@xivgear/core/solving/gearset_generation";
import { SolverSimulationSettings } from "@xivgear/core/solving/sim_runner";
import { recordEvent } from "@xivgear/core/analytics/analytics";
import { Materia } from "@xivgear/xivmath/geartypes";

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
        // this.inner.style.maxWidth = "25%"; // idk why this doesn't work in common-css but it don't.

        this.classList.add('meld-solver-area');
        this.descriptionText = document.createElement('div');
        this.descriptionText.textContent = "Solve for the highest-dps set of melds for this gearset.\r\n"
            + "Speed up computations by targeting a specific GCD and/or pre-filling some materia slots";

        this.setNameText = document.createElement('div');
        this.setNameText.textContent = `"${set.name}"`;
        this.setNameText.classList.add('meld-solver-set');

        this.settingsDiv = new MeldSolverSettingsMenu(sheet, set);

        let meldSolveStart: number;

        this.solveMeldsButton = makeActionButton("Solve Melds", async () => {
            this.solver = new MeldSolver(sheet);
            meldSolveStart = Date.now();

            this.buttonArea.removeChild(this.solveMeldsButton);
            this.showProgress();

            const solverPromise = this.solver.solveMelds(
                this.settingsDiv.gearsetGenSettings,
                this.settingsDiv.simSettings,
                (num: number) => {
                    this.progressDisplay.loadbar.updateProgress(num);
                    this.progressDisplay.text.textContent = "Simulating...";

                });
            solverPromise.then(([set, dps]) => this.solveResultReceived(set, dps));
            recordEvent("SolveMelds", {
                "Total Time Taken: ": Date.now() - (meldSolveStart ?? Date.now()),
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

    async solveResultReceived(set: CharacterGearSet, dps: number) {
        const oldDps = (await this.settingsDiv.simSettings.sim.simulate(this.settingsDiv.gearsetGenSettings.gearset)).mainDpsResult;
        const confirm = new MeldSolverConfirmationDialog(this._sheet, this.settingsDiv.gearsetGenSettings.gearset, set, [oldDps, dps], this.close);
        document.querySelector('body').appendChild(confirm);
        confirm.show();
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
        };


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
            }],
        });

        this.useTargetGcdCheckBox = new FieldBoundCheckBox(this.gearsetGenSettings, 'useTargetGcd');
        this.useTargetGcdCheckBox.classList.add('meld-solver-settings');
        this.targetGcdInput.pattern = '\\d\\.\\d\\d?';
        this.targetGcdInput.title = 'Solve for the best set with this GCD';
        this.targetGcdInput.classList.add('meld-solver-target-gcd-input');
        this.targetGcdInput.disabled = true;

        const targetGcdText = labelFor("Target GCD: ", this.useTargetGcdCheckBox);
        targetGcdText.textContent = "Target GCD: ";
        targetGcdText.classList.add('meld-solver-settings');

        this.overwriteMateriaCheckbox = new FieldBoundCheckBox(this.gearsetGenSettings, 'overwriteExistingMateria');
        this.overwriteMateriaCheckbox.classList.add('meld-solver-settings');
        this.overwriteMateriaText = labelFor("Overwrite existing materia?", this.overwriteMateriaCheckbox);
        this.overwriteMateriaText.classList.add('meld-solver-settings');

        const simText = document.createElement('span');
        simText.textContent = "Sim: ";
        simText.classList.add('meld-solver-settings');

        this.simDropdown = new FieldBoundDataSelect<typeof this.simSettings, Simulation<SimResult, unknown, unknown>>(
            this.simSettings,
            'sim',
            value => {
                return value ? value.displayName : "None";
            },
            [...sheet.sims]
        );
        this.simDropdown.classList.add('meld-solver-sim-dropdown');

        const span1 = document.createElement('li');
        span1.replaceChildren(this.overwriteMateriaCheckbox, this.overwriteMateriaText);

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
        );

        this.useTargetGcdCheckBox.onclick = (evt) => {
            this.targetGcdInput.disabled = !this.targetGcdInput.disabled;
        };

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

class MateriaEntry extends HTMLDivElement {
    materiaImgHolder: HTMLDivElement;
    textContainer: HTMLSpanElement;
    statText: HTMLSpanElement;
    countText: HTMLSpanElement;

    constructor(materia: Materia, count: number) {
        super();
        this.classList.add("meld-solver-result-materia-entry");

        this.materiaImgHolder = document.createElement('div');
        this.materiaImgHolder.classList.add('meld-solver-result-image');
        const img = document.createElement('img');
        img.src = materia.iconUrl.toString();
        this.materiaImgHolder.appendChild(img);

        this.statText = document.createElement('span');
        this.statText.textContent = `+${materia.primaryStatValue} ${STAT_ABBREVIATIONS[materia.primaryStat]}`;
        this.statText.classList.add('meld-solver-result-materia-entry-stat');

        this.countText = document.createElement('span');
        this.countText.textContent = `× ${count}`;
        this.countText.classList.add('meld-solver-result-materia-entry-count');

        this.textContainer = document.createElement('div');
        this.textContainer.replaceChildren(this.statText, this.countText);
        this.textContainer.classList.add('meld-solver-result-materia-entry-text');

        this.replaceChildren(this.materiaImgHolder, this.textContainer);
    }
}

class MeldSolverConfirmationDialog extends BaseModal {

    newMateriaTotalsList: HTMLDivElement;
    oldMateriaTotalsList: HTMLDivElement;
    newSet: CharacterGearSet;
    oldSet: CharacterGearSet;
    sheet: GearPlanSheetGui;

    applyButton: HTMLButtonElement;
    discardButton: HTMLButtonElement;

    constructor(sheet: GearPlanSheetGui, oldSet: CharacterGearSet, newSet: CharacterGearSet, [oldSimResult, newsimResult]: [number, number], closeParent: () => void) {
        super();
        this.sheet = sheet;
        this.oldSet = oldSet;
        this.newSet = newSet;

        this.headerText = "Solver Results";
        const form = document.createElement("form");
        form.method = 'dialog';
        form.classList.add('meld-solver-result');
        // this.inner.style.maxWidth = "35%";
        // this.inner.style.width = "35%"
        //this.inner.style.maxWidth = "4%"; // idk why this doesn't work in common-css but it don't.

        if (!newSet) {
            this.headerText = "No Results Found";

            const textElement = document.createElement('span');
            textElement.textContent = "The solver didn't find any results. Try relaxing some of the settings.";
            this.contentArea.replaceChildren(textElement);
            this.addButton(makeActionButton("Ok", (_ev) => this.close()));
            return;
        }

        const materiaTotals = MeldSolverConfirmationDialog.getMateriaTotals(oldSet, newSet);

        [this.oldMateriaTotalsList, this.newMateriaTotalsList] = this.buildMateriaLists([`"${oldSet.name}"`, "Solved Set"], materiaTotals, [oldSimResult, newsimResult]);

        const arrow = document.createElement('span');
        arrow.textContent = "→";
        arrow.classList.add("arrow");

        this.applyButton = makeActionButton("Apply", (ev) => {

            if (this.newSet) {
                this.applyResult(newSet);
                this.oldSet.forceRecalc();
                this.sheet.refreshMateria();
                this.close();
            }
            closeParent();
            this.close();
        });

        this.discardButton = makeActionButton("Discard", (_ev) => {
            this.close();
        });

        this.addButton(this.applyButton);
        this.addButton(this.discardButton);

        form.replaceChildren(this.oldMateriaTotalsList, arrow, this.newMateriaTotalsList);
        this.contentArea.append(form);
    }

    buildMateriaLists([oldName, newName]: [string, string], matTotals: Map<Materia, [number, number]>, [oldSimResult, newSimResult]: [number, number]): [HTMLDivElement, HTMLDivElement] {
        const [oldSet, newSet] = [document.createElement('div'), document.createElement('div')];
        oldSet.classList.add("meld-solver-result-set");
        newSet.classList.add("meld-solver-result-set");
        const [oldHead, newHead] = [document.createElement('h3'), document.createElement('h3')];
        oldHead.textContent = oldName;
        newHead.textContent = newName;
        oldSet.appendChild(oldHead);
        newSet.appendChild(newHead);

        const [oldResultElem, newResultElem] = [document.createElement('span'), document.createElement('span')];
        oldResultElem.textContent = oldSimResult.toFixed(2);
        newResultElem.textContent = newSimResult.toFixed(2);

        let delta = newSimResult - oldSimResult;
        if (delta / newSimResult < 0.001) {
            delta = newSimResult * 0.001;
        }

        oldResultElem.classList.add(`meld-solver-result-set-sim`);
        newResultElem.classList.add(`meld-solver-result-set-sim`);
        oldResultElem.style.setProperty("--sim-result-relative", 0 + '%');
        newResultElem.style.setProperty("--sim-result-relative", ((newSimResult - oldSimResult) / delta * 100).toFixed(1) + '%');
        if (newSimResult > oldSimResult) {
            newResultElem.style.fontWeight = "bold";
        }
        //newResultElem.classList.add(`meld-solver-result-set-sim-${newBetter ? "better" : "worse"}`);

        oldSet.appendChild(oldResultElem);
        newSet.appendChild(newResultElem);

        const oldList = document.createElement('ul');
        const newList = document.createElement('ul');
        for (const [mat, [oldTotal, newTotal]] of matTotals) {
            const [oldItem, newItem] = [document.createElement('li'), document.createElement('li')];

            const [oldEntry, newEntry] = [new MateriaEntry(mat, oldTotal), new MateriaEntry(mat, newTotal)];

            if (oldTotal === 0) {
                oldEntry.classList.add('meld-solver-result-materia-entry-zero');
            }
            if (newTotal === 0) {
                newEntry.classList.add('meld-solver-result-materia-entry-zero');
            }

            const delta = newTotal - oldTotal;
            const deltaElem = document.createElement('div');
            deltaElem.classList.add('meld-solver-result-materia-entry-delta');
            deltaElem.textContent = delta === 0 ? "" : `(${delta > 0 ? "+" : ""}${delta})`;

            oldItem.appendChild(oldEntry);
            newItem.appendChild(newEntry);
            newItem.appendChild(deltaElem);
            oldList.appendChild(oldItem);
            newList.appendChild(newItem);
        }

        oldSet.appendChild(oldList);
        newSet.appendChild(newList);
        return [oldSet, newSet];
    }

    static getMateriaTotals(oldSet: CharacterGearSet, newSet: CharacterGearSet): Map<Materia, [number, number]> {
        const result: Map<Materia, [number, number]> = new Map;
        for (const slotKey of EquipSlots) {
            if (oldSet.equipment[slotKey]) {
                for (const meldSlot of oldSet.equipment[slotKey].melds) {
                    if (!meldSlot.equippedMateria) continue;

                    const prevCount = result.get(meldSlot.equippedMateria);
                    if (!prevCount) {
                        result.set(meldSlot.equippedMateria, [1, 0]);
                    }
                    else {
                        prevCount[0]++;
                    }
                }
            }

            if (newSet.equipment[slotKey]) {
                for (const meldSlot of newSet.equipment[slotKey].melds) {
                    if (!meldSlot.equippedMateria) continue;

                    const prevCount = result.get(meldSlot.equippedMateria);
                    if (!prevCount) {
                        result.set(meldSlot.equippedMateria, [0, 1]);
                    }
                    else {
                        prevCount[1]++;
                    }
                }
            }
        }

        return result;
    }

    applyResult(newSet: CharacterGearSet) {

        for (const slotKey of EquipSlots) {
            if (!this.oldSet.equipment[slotKey] || !this.newSet.equipment[slotKey]) {
                continue;
            }

            this.oldSet.equipment[slotKey].melds = newSet.equipment[slotKey].melds;
        }
    }
}
customElements.define('meld-solver-area', MeldSolverDialog);
customElements.define('load-bar', LoadBar, { extends: 'div' });
customElements.define('meld-solver-progress-display', MeldSolverProgressDisplay, { extends: 'div' });
customElements.define('meld-solver-settings-menu', MeldSolverSettingsMenu, { extends: 'div' });
customElements.define('meld-solver-result-materia-entry', MateriaEntry, { extends: 'div' });
customElements.define('meld-solver-result-dialog', MeldSolverConfirmationDialog);
