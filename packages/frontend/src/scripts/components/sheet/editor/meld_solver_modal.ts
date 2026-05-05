import {
    el,
    FieldBoundCheckBox,
    FieldBoundDataSelect,
    FieldBoundFloatField,
    FieldBoundIntField,
    labelFor,
    makeActionButton
} from "@xivgear/common-ui/components/util";
import {CharacterGearSet} from "@xivgear/core/gear";
import {GearPlanSheetGui} from "../sheet_gui";
import {SimResult, Simulation} from "@xivgear/core/sims/sim_types";
import {MAX_GCD, STAT_ABBREVIATIONS} from "@xivgear/xivmath/xivconstants";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {EquipSlots, FoodItem, Materia} from "@xivgear/xivmath/geartypes";
import {MeldSolver} from "../../solver/meldsolver";
import {GearsetGenerationSettings} from "@xivgear/core/solving/gearset_generation";
import {SolverSimulationSettings} from "@xivgear/core/solving/sim_runner";
import {recordSheetEvent} from "../../../analytics/analytics";
import {PersistentSettings, SETTINGS} from "@xivgear/common-ui/settings/persistent_settings";
import {GearsetGenerationStatusUpdate, MeldSolvingStatusUpdate} from "@xivgear/core/solving/types";
import {rangeInc} from "@xivgear/util/array_utils";

export class MeldSolverDialog extends BaseModal {
    private _sheet: GearPlanSheetGui;

    private form: HTMLFormElement;
    private descriptionText: HTMLDivElement;
    private setNameText: HTMLDivElement;
    private solveMeldsButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;
    readonly settingsDiv: MeldSolverSettingsMenu;
    private progressDisplay: MeldSolverProgressDisplay;
    private inProgress: boolean = false;

    private solver: MeldSolver;

    constructor(sheet: GearPlanSheetGui, set: CharacterGearSet) {
        super();
        this._sheet = sheet;
        this.id = 'meld-solver-dialog';
        this.headerText = 'Meld and Food Solver';
        this.form = document.createElement("form");
        this.form.method = 'dialog';

        this.classList.add('meld-solver-area');
        this.descriptionText = document.createElement('div');
        this.descriptionText.textContent = "Solve for the highest-dps set of melds/food for this gearset.\r\n"
            + "Computation will be much slower without a target GCD.";

        this.setNameText = el('div', {class: 'meld-solver-set'}, [
            "Solving for ", el('span', {class: 'meld-solver-set-name'}, [set.name]),
        ]);
        // this.setNameText.textContent = `"${set.name}"`;
        // this.setNameText.classList.add('meld-solver-set');

        this.settingsDiv = new MeldSolverSettingsMenu(sheet, set);


        this.solveMeldsButton = makeActionButton("Solve Melds", async () => {
            this.solver = new MeldSolver(sheet);
            const meldSolveStart: number = Date.now();
            this.buttonArea.removeChild(this.solveMeldsButton);
            this.showProgress();
            this.progressDisplay.reset();

            const solverPromise = this.solver.solveMelds(
                this.settingsDiv.gearsetGenSettings,
                this.settingsDiv.simSettings,
                update => {
                    this.progressDisplay.displayUpdate(update);

                }, async (count: number) => {
                    if (!SETTINGS.generatorWarnIfAbove) {
                        return true;
                    }
                    else if (count < SETTINGS.generatorWarnThreshold) {
                        return true;
                    }
                    return await ConfirmLargeSolveDialog.askConfirmation(count);
                });
            solverPromise.then((result) => {
                if (result === 'cancelled') {
                    this.cancel();
                }
                else {
                    const [set, dps] = result;
                    this.solveResultReceived(set, dps);
                }
            });
            const timeTaken = Date.now() - (meldSolveStart);
            console.log("Time taken: " + timeTaken);
            recordSheetEvent("SolveMelds", sheet, {
                "time": timeTaken,
            });
        });

        this.cancelButton = makeActionButton("Cancel", async () => {
            await this.cancel();
        });

        this.showSettings();
        this.contentArea.append(this.form);
    }

    async cancel() {
        await this.solver.cancel();
        this.buttonArea.removeChild(this.cancelButton);
        this.inProgress = false;

        this.showSettings();
    }

    async solveResultReceived(set: CharacterGearSet, dps: number) {
        const oldDps = (await this.settingsDiv.simSettings.sim.simulate(this.settingsDiv.gearsetGenSettings.gearset)).mainDpsResult;
        const confirm = new MeldSolverConfirmationDialog(this._sheet, this.settingsDiv.gearsetGenSettings.gearset, set, [oldDps, dps], () => this.close());
        confirm.attachAndShowExclusively();
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

        this.inProgress = true;

        this.closeButton.disabled = true;
        this.settingsDiv.setEnabled(false);

        this.progressDisplay = new MeldSolverProgressDisplay();
        this.form.replaceChildren(this.progressDisplay);
        this.addButton(this.cancelButton);
    }

    // Block accidental closing once in progress
    get explicitCloseOnly() {
        return this.inProgress;
    }
}

class ConfirmLargeSolveDialog extends BaseModal {
    constructor(count: number, onAnswer: (answer: boolean) => void) {
        super();
        this.headerText = 'Confirm Large Solve';
        const p = el('p', {}, [
            'A total of ',
            el('span', {class: 'large-solve-confirmation-count'}, [count.toString()]),
            ' unique combinations have been identified. Are you sure you wish to proceed?',
        ]);
        this.addActionButton('Yes, Continue', () => {
            onAnswer(true);
            this.close();
        });
        this.addActionButton('No, Cancel', () => {
            onAnswer(false);
            this.close();
        });
        this.contentArea.replaceChildren(p);
    }

    get explicitCloseOnly(): boolean {
        return true;
    }

    static askConfirmation(count: number): Promise<boolean> {
        return new Promise(resolve => {
            const dialog = new ConfirmLargeSolveDialog(count, resolve);
            dialog.attachAndShowTop();
        });
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
        this.innerBar.style.width = "0%";

        this.outerBar.replaceChildren(this.innerBar);
        this.replaceChildren(this.outerBar);
    }

    updateProgress(progressPercentage: number) {
        this.innerBar.style.width = `${progressPercentage}%`;
    }
}

type ExtendedPhase = 0 | 1 | 2 | 3 | 4 | 5;

class MeldSolverProgressDisplay extends HTMLDivElement {

    private readonly inPhaseLoadBar: LoadBar;
    private displayedSimText: boolean = false;
    text: HTMLHeadingElement;
    private phaseIndicators: LoadBar[] = [];
    private lastSeenPhase: ExtendedPhase = 0;

    constructor() {
        super();

        this.inPhaseLoadBar = new LoadBar();
        this.inPhaseLoadBar.classList.add('in-phase-progress');
        this.text = document.createElement('h4');
        this.text.textContent = "Generating meld combinations...";
        this.classList.add('meld-solver-progress-display');

        for (let i: ExtendedPhase = 0; i <= 5; i++) {
            this.phaseIndicators.push(new LoadBar());
        }
        const phaseHolder = el('div', {class: 'phases-holder'}, this.phaseIndicators);

        this.replaceChildren(phaseHolder, this.inPhaseLoadBar, this.text);
    }

    reset() {
        this.inPhaseLoadBar.updateProgress(0);
    }

    updatePhase(phase: ExtendedPhase, phaseProgress: number, phaseMax: number) {
        const percentage = phaseMax > 0 ? 100.0 * phaseProgress / phaseMax : 0;
        this.inPhaseLoadBar.updateProgress(percentage);
        this.phaseIndicators[phase].updateProgress(percentage);
        // If transitioning to a new phase, reset the state of these
        if (phase !== this.lastSeenPhase) {
            this.phaseIndicators.forEach((l, i) => {
                if (i < phase) {
                    l.updateProgress(100);
                }
                else if (i > phase) {
                    l.updateProgress(0);
                }
            });
            this.lastSeenPhase = phase;
        }
    }

    displayUpdate(update: GearsetGenerationStatusUpdate | MeldSolvingStatusUpdate) {

        if ('done' in update) {
            this.updatePhase(5, update.done, update.total);
            // Don't re-render this unnecessarily
            if (!this.displayedSimText) {
                this.text.textContent = `Simulating ${update.total} sets...`;
                this.displayedSimText = true;
            }
        }
        else {
            let out: string;
            this.updatePhase(update.phase, update.subPhase?.phase ?? 0, update.subPhase?.phaseMax ?? 0);
            switch (update.phase) {
                case 0:
                    out = "Initializing...";
                    break;
                case 1:
                    out = "Generating Piece Combinations...";
                    break;
                case 2:
                    if ("subPhase" in update) {
                        out = `Generating Sets - Slot ${update.subPhase.phase} / ${update.subPhase.phaseMax}... ${update.count} so far`;
                    }
                    else {
                        out = `Generating Sets... ${update.count} so far`;
                    }
                    break;
                case 3:
                    if ("subPhase" in update) {
                        out = `Sorting ${update.subPhase.phase} / ${update.subPhase.phaseMax} Sets...`;
                    }
                    else {
                        out = `Sorting ${update.count} Sets...`;
                    }
                    break;
                case 4:
                    out = `Finalizing ${update.count} Sets (${update.subPhase.phase} / ${update.subPhase.phaseMax})...`;
                    break;
                default:
                    return;
            }
            this.text.textContent = out;
        }
    }
}

class MeldSolverSettingsMenu extends HTMLDivElement {
    public gearsetGenSettings: GearsetGenerationSettings;
    public simSettings: SolverSimulationSettings;
    private readonly overwriteMateriaText: HTMLSpanElement;
    private readonly overwriteMateriaCheckbox: FieldBoundCheckBox<GearsetGenerationSettings>;
    private readonly useTargetGcdCheckBox: FieldBoundCheckBox<GearsetGenerationSettings>;
    private readonly overwriteFoodCheckbox: FieldBoundCheckBox<GearsetGenerationSettings>;
    private readonly overwriteFoodText: HTMLSpanElement;
    private readonly targetGcdInput: FieldBoundFloatField<GearsetGenerationSettings>;
    private readonly warnIfAboveCheckBox: FieldBoundCheckBox<PersistentSettings>;
    private readonly warnIfAboveNumberField: FieldBoundIntField<PersistentSettings>;
    private readonly checkboxContainer: HTMLDivElement;
    private readonly simDropdown: FieldBoundDataSelect<SolverSimulationSettings, Simulation<SimResult, unknown, unknown>>;

    private readonly disableables: {
        disabled?: boolean
    }[] = [];

    constructor(sheet: GearPlanSheetGui, set: CharacterGearSet) {
        super();

        const override = sheet.classJobStats.gcdDisplayOverrides?.(sheet.level);
        let buffHaste = 0;
        let gaugeHaste = 0;
        if (override && override.length >= 1) {
            buffHaste += (override[0].buffHaste ?? 0);
            gaugeHaste += (override[0].gaugeHaste ?? 0);
        }
        const haste = Math.max(set.computedStats.haste("Weaponskill", buffHaste, gaugeHaste), set.computedStats.haste("Spell", buffHaste, gaugeHaste));
        const gcd = Math.min(set.computedStats.gcdPhys(2.5, haste), set.computedStats.gcdMag(2.5, haste));

        this.gearsetGenSettings = new GearsetGenerationSettings(set, false, true, gcd);
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
            fixDecimals: 2,
        });

        this.useTargetGcdCheckBox = new FieldBoundCheckBox(this.gearsetGenSettings, 'useTargetGcd');
        // this.useTargetGcdCheckBox.classList.add('meld-solver-settings');
        this.targetGcdInput.title = 'Solve for the best set with this GCD';
        this.targetGcdInput.classList.add('meld-solver-target-gcd-input');

        const targetGcdText = labelFor("Target GCD: ", this.useTargetGcdCheckBox);
        targetGcdText.textContent = "Target GCD: ";
        // targetGcdText.classList.add('meld-solver-settings');

        this.overwriteFoodCheckbox = new FieldBoundCheckBox(this.gearsetGenSettings, 'overwriteFood');
        // this.overwriteFoodCheckbox.classList.add('meld-solver-settings');
        this.overwriteFoodText = labelFor("Overwrite food? ", this.overwriteFoodCheckbox);
        // this.overwriteFoodText.classList.add('meld-solver-settings');

        this.overwriteMateriaCheckbox = new FieldBoundCheckBox(this.gearsetGenSettings, 'overwriteExistingMateria');
        // this.overwriteMateriaCheckbox.classList.add('meld-solver-settings');
        this.overwriteMateriaText = labelFor("Overwrite existing materia?", this.overwriteMateriaCheckbox);
        // this.overwriteMateriaText.classList.add('meld-solver-settings');

        this.warnIfAboveCheckBox = new FieldBoundCheckBox(SETTINGS, 'generatorWarnIfAbove');
        // this.warnIfAboveCheckBox.classList.add('meld-solver-settings');
        this.warnIfAboveNumberField = new FieldBoundIntField(SETTINGS, 'generatorWarnThreshold');
        // this.warnIfAboveNumberField.classList.add('meld-solver-settings');
        this.warnIfAboveCheckBox.addAndRunListener(warnEnabled => {
            this.warnIfAboveNumberField.disabled = !warnEnabled;
        });
        this.warnIfAboveNumberField.classList.add('meld-solver-warn-threshold-input');

        const simText = document.createElement('span');
        simText.textContent = "Sim: ";
        // simText.classList.add('meld-solver-settings');

        this.simDropdown = new FieldBoundDataSelect<typeof this.simSettings, Simulation<SimResult, unknown, unknown>>(
            this.simSettings,
            'sim',
            value => {
                return value ? value.displayName : "None";
            },
            [...sheet.sims]
        );
        this.simDropdown.classList.add('meld-solver-sim-dropdown');

        this.checkboxContainer = el('div', {class: 'meld-solver-settings'},
            [
                el('li', {}, [this.overwriteMateriaCheckbox, this.overwriteMateriaText]),
                el('li', {}, [this.overwriteFoodCheckbox, this.overwriteFoodText]),
                el('li', {}, [this.useTargetGcdCheckBox, targetGcdText, this.targetGcdInput]),
                el('li', {}, [this.warnIfAboveCheckBox, labelFor('Confirm before simming more than ', this.warnIfAboveCheckBox), this.warnIfAboveNumberField, labelFor(' sets', this.warnIfAboveNumberField)]),
                el('li', {}, [simText, this.simDropdown]),
            ]
        );

        const pentameldWarning = el('li', {
            style: {
                overflow: 'hidden',
                display: 'block',
                maxWidth: "90%",
                width: "90%",
            },
        }, [
            el('span', {
                style: {
                    fontSize: '90%',
                    display: 'inline',
                },
            }, [
                "⚠️ Solving pentameld sets can take a long time. To speed it up, try filling some materia and solving without Overwrite existing materia, or not solving food.",
            ]),
        ]);

        const gearsetGenSettings = this.gearsetGenSettings;
        const calculateNumberOfMateriaToSolve = function () {
            return EquipSlots.reduce((acc, slotKey) => {
                const item = gearsetGenSettings.gearset.equipment[slotKey];
                if (item) {
                    return acc + item.melds.reduce((acc, meldSlot) => (gearsetGenSettings.overwriteExistingMateria || !meldSlot.equippedMateria) ? 1 + acc : acc, 0);
                }
                return acc;
            }, 0);
        };

        // 23 accounts for 2 melds on each left/right side and 3 slots for the weapon (e.g. ultimate weapon).
        const maxNumberOfMateriaWithoutPentamelding = 23;

        const gearsetContainsPentamelds = calculateNumberOfMateriaToSolve() > maxNumberOfMateriaWithoutPentamelding;
        pentameldWarning.style.visibility = gearsetContainsPentamelds ? "visible" : "hidden";

        // Setting overwrite materia will increase the materia to solve for if some are set.
        this.overwriteMateriaCheckbox.onchange = () => {
            const gearsetContainsPentamelds = calculateNumberOfMateriaToSolve() > maxNumberOfMateriaWithoutPentamelding;
            pentameldWarning.style.visibility = gearsetContainsPentamelds ? "visible" : "hidden";
        };

        this.useTargetGcdCheckBox.onclick = (evt) => {
            this.targetGcdInput.disabled = !this.targetGcdInput.disabled;
        };

        this.replaceChildren(this.checkboxContainer);

        this.style.columnCount = "2";
        this.style.columnRule = "4px";
        this.appendChild(pentameldWarning);

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
    private readonly materiaImgHolder: HTMLDivElement;
    private readonly statText: HTMLSpanElement;
    private readonly countText: HTMLSpanElement;

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

        this.replaceChildren(this.materiaImgHolder, this.statText, this.countText);
    }
}

class FoodEntry extends HTMLDivElement {
    private readonly foodImgHolder: HTMLDivElement;
    private readonly nameText: HTMLSpanElement;

    constructor(food: FoodItem, count: number) {
        super();
        this.classList.add("meld-solver-result-materia-entry");

        this.foodImgHolder = document.createElement('div');
        this.foodImgHolder.classList.add('meld-solver-result-image');
        this.nameText = document.createElement('span');
        this.nameText.classList.add('meld-solver-result-materia-entry-stat');
        if (food) {
            const img = document.createElement('img');
            img.width = 32;
            img.height = 32;
            img.src = food?.iconUrl.toString();
            this.foodImgHolder.appendChild(img);

            this.nameText.textContent = food.name;
        }
        else {
            this.nameText.textContent = "No food selected.";
        }

        this.replaceChildren(this.foodImgHolder, this.nameText);
    }
}

// TODO: delete this leftover debugging code
// @ts-expect-error asdfsadfdsafdsafa
window['srt'] = () => {
    new MeldSolverConfirmationDialog(window.currentSheet, window.currentGearSet, window.currentGearSet, [12345, 13579], () => {
    }).attachAndShowExclusively();
};

type RowElements = {
    newEle: HTMLElement;
    oldEle: HTMLElement;
    deltaEle: HTMLElement | null;
}

class MeldSolverConfirmationDialog extends BaseModal {
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

        if (!newSet) {
            this.headerText = "No Results Found";

            const textElement = document.createElement('span');
            textElement.textContent = "The solver didn't find any results. Try relaxing some of the settings.";
            this.contentArea.replaceChildren(textElement);
            this.addButton(makeActionButton("Ok", (_ev) => this.close()));
            return;
        }

        this.headerText = "Solver Results";
        // This holds the results
        const form = document.createElement("form");
        form.method = 'dialog';
        form.classList.add('meld-solver-result');

        const materiaTotals = MeldSolverConfirmationDialog.getMateriaTotals(oldSet, newSet);

        const elements = this.buildMateriaLists([`"${oldSet.name}"`, "Solved Set"], materiaTotals, [oldSimResult, newsimResult]);

        const [oldFood, newFood] = [document.createElement('div'), document.createElement('div')];
        oldFood.classList.add('solve-result-mat-entry-holder', 'cols-left');
        newFood.classList.add('solve-result-mat-entry-holder', 'cols-right');
        elements.push({
            oldEle: new FoodEntry(this.oldSet.food, 1),
            newEle: new FoodEntry(this.newSet.food, 1),
            deltaEle: null,
        });

        const arrow = document.createElement('span');
        arrow.textContent = "→";
        arrow.classList.add("arrow", 'meld-results-arrow');
        arrow.style.gridRow = '1';
        arrow.style.gridColumn = '4';
        arrow.style.gridRowEnd = '-1';

        this.applyButton = makeActionButton("Apply", (ev) => {
            if (this.newSet) {
                this.applyResult();
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

        const all = [arrow];
        elements.forEach((elems, idx) => {
            const oldEle = elems.oldEle;
            oldEle.classList.add('cols-left');
            oldEle.style.gridRow = `${idx + 1}`;
            all.push(oldEle);
            const newEle = elems.newEle;
            newEle.classList.add('cols-right');
            newEle.style.gridRow = `${idx + 1}`;
            all.push(newEle);
            const deltaEle = elems.deltaEle;
            if (deltaEle) {
                deltaEle.classList.add('cols-middle');
                deltaEle.style.gridRow = `${idx + 1}`;
                all.push(deltaEle);
            }
        });
        form.replaceChildren(...all);
        this.contentArea.append(form);
    }

    buildMateriaLists([oldName, newName]: [string, string], matTotals: Map<Materia, [number, number]>, [oldSimResult, newSimResult]: [number, number]): RowElements[] {
        const out: RowElements[] = [];
        const [oldHead, newHead] = [document.createElement('h3'), document.createElement('h3')];
        oldHead.textContent = oldName;
        newHead.textContent = newName;
        oldHead.classList.add('cols-left');
        newHead.classList.add('cols-right');
        out.push({
            oldEle: oldHead,
            newEle: newHead,
            deltaEle: null,
        });

        const [oldResultElem, newResultElem] = [document.createElement('span'), document.createElement('span')];
        oldResultElem.textContent = oldSimResult.toFixed(2);
        newResultElem.textContent = newSimResult.toFixed(2);

        let delta = newSimResult - oldSimResult;
        if (delta / newSimResult < 0.001) {
            delta = newSimResult * 0.001;
        }

        oldResultElem.classList.add(`meld-solver-result-set-sim`, 'cols-left');
        newResultElem.classList.add(`meld-solver-result-set-sim`, 'cols-right');
        oldResultElem.style.setProperty("--sim-result-relative", 0 + '%');
        newResultElem.style.setProperty("--sim-result-relative", ((newSimResult - oldSimResult) / delta * 100).toFixed(1) + '%');
        if (newSimResult > oldSimResult) {
            newResultElem.classList.add('sim-best');
            oldResultElem.style.setProperty("--sim-result-relative", 0 + '%');
            newResultElem.style.setProperty("--sim-result-relative", ((newSimResult - oldSimResult) / delta * 100).toFixed(1) + '%');
        }
        else if (newSimResult < oldSimResult) {
            oldResultElem.classList.add('sim-best');
            newResultElem.style.setProperty("--sim-result-relative", 0 + '%');
            oldResultElem.style.setProperty("--sim-result-relative", ((oldSimResult - newSimResult) / delta * 100).toFixed(1) + '%');
        }
        //newResultElem.classList.add(`meld-solver-result-set-sim-${newBetter ? "better" : "worse"}`);

        out.push({
            oldEle: oldResultElem,
            newEle: newResultElem,
            deltaEle: null,
        });

        for (const [mat, [oldTotal, newTotal]] of matTotals) {
            const [oldItem, newItem] = [document.createElement('div'), document.createElement('div')];
            oldItem.classList.add('solve-result-mat-entry-holder', 'cols-left');
            newItem.classList.add('solve-result-mat-entry-holder', 'cols-right');

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
            out.push({
                oldEle: oldItem,
                newEle: newItem,
                deltaEle: deltaElem,
            });
        }

        return out;
    }

    static getMateriaTotals(oldSet: CharacterGearSet, newSet: CharacterGearSet): Map<Materia, [number, number]> {
        const result: Map<Materia, [number, number]> = new Map;
        for (const slotKey of EquipSlots) {
            if (oldSet.equipment[slotKey]) {
                for (const meldSlot of oldSet.equipment[slotKey].melds) {
                    if (!meldSlot.equippedMateria) {
                        continue;
                    }

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
                    if (!meldSlot.equippedMateria) {
                        continue;
                    }

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

    applyResult() {
        for (const slotKey of EquipSlots) {
            const oldEq = this.oldSet.equipment[slotKey];
            const newEq = this.newSet.equipment[slotKey];
            if (!oldEq || !newEq) {
                continue;
            }

            for (let i = 0; i < oldEq.melds.length; i++) {
                const oldSlot = oldEq.melds[i];
                const newSlot = newEq.melds[i];
                oldSlot.equippedMateria = newSlot.equippedMateria;
            }
        }

        // Unless 'Solve food' is ticked, this will always be the same anyway
        this.oldSet.food = this.newSet.food;
    }

    get explicitCloseOnly(): boolean {
        return true;
    }
}

customElements.define('meld-solver-area', MeldSolverDialog);
customElements.define('load-bar', LoadBar, {extends: 'div'});
customElements.define('meld-solver-progress-display', MeldSolverProgressDisplay, {extends: 'div'});
customElements.define('meld-solver-settings-menu', MeldSolverSettingsMenu, {extends: 'div'});
customElements.define('meld-solver-result-materia-entry', MateriaEntry, {extends: 'div'});
customElements.define('meld-solver-result-food-entry', FoodEntry, {extends: 'div'});
customElements.define('meld-solver-result-dialog', MeldSolverConfirmationDialog);
customElements.define('meld-solver-confirm-large-solve-dialog', ConfirmLargeSolveDialog);
