import {
    clampValues,
    FbctPostValidator,
    FieldBoundDataSelect,
    FieldBoundFloatField,
    FieldBoundIntField,
    labelFor,
    makeActionButton,
    quickElement
} from "@xivgear/common-ui/components/util";
import {
    CURRENT_MAX_LEVEL,
    getLevelStats,
    JOB_DATA,
    JobName,
    LEVEL_STATS,
    SupportedLevel,
    SupportedLevels
} from "@xivgear/xivmath/xivconstants";
import {setHash} from "../nav_hash";
import {CALC_HASH} from "@xivgear/core/nav/common_nav";
import {writeProxy} from "@xivgear/util/proxies";
import {ShowHideButton} from "@xivgear/common-ui/components/show_hide_chevron";
import {scrollIntoView} from "@xivgear/common-ui/util/scrollutil";
import hljs from "highlight.js/lib/core";
import {
    FormulaSetInput,
    GeneralSettings,
    MathFormulaSet,
    registered,
    regMap,
    Result,
    ResultSet,
    Variable
} from "./math_main";
import {setMainContent, welcomeArea} from "../base_ui";
import javascript from "highlight.js/lib/languages/javascript";
import {fieldBoundLevelSelect} from "@xivgear/common-ui/components/level_picker";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {col, ColDefs, CustomRow, CustomTable, HeaderRow, TableSelectionModel} from "@xivgear/common-ui/table/tables";

hljs.registerLanguage('javascript', javascript);

export const tableDisplayOptions = ['Show By Tier', 'Show Full'] as const;
export type DisplayType = typeof tableDisplayOptions[number];


function labeledInput(labelText: string, element: HTMLElement): HTMLDivElement {
    const label = labelFor(labelText, element);
    return quickElement('div', ['vertical-labeled-input'], [label, element]);
}

/**
 * Gets the source of a function.
 *
 * Will also clean up the function's source code by removing TODO, ts-ignore, ts-expect-error, etc comments.
 *
 * @param func
 */
function functionText(func: object): string {
    return func.toString()
        .split("\n")
        .map(line => {
            const idx = line.indexOf('//');
            if (idx >= 0) {
                const comment = line.substring(idx);
                if (comment.includes('TODO') || comment.includes('@ts-')) {
                    return line.substring(0, idx);
                }
            }
            return line;
        }).filter(line => line.trim().length > 0)
        .join('\n');
}

// Assuming key sets are identical
function resultsEquals(left: ResultSet, right: ResultSet): boolean {
    const entries = Object.entries(left);
    for (const entry of entries) {
        if (entry[1].value !== right[entry[0]].value) {
            return false;
        }
    }
    return true;
}

function getPrimaryVarSpec<X extends object>(formulaSet: MathFormulaSet<X>): Variable<X> {
    const pvKey = formulaSet.primaryVariable;
    if (pvKey === 'level') {
        return {
            label: "Level",
            type: "level",
        };
    }
    else if (pvKey === 'job') {
        return {
            label: "Job",
            type: 'job',
        };
    }
    else {
        const found = formulaSet.variables.find(v => v['property'] === formulaSet.primaryVariable);
        if (!found) {
            throw new Error(`Could not find primary variable '${formulaSet.primaryVariable}' for formulaSet ${formulaSet.name}`);
        }
        return found;
    }
}

function isHideable(fn: {
    hideableColumn?: boolean
}): boolean {
    return fn.hideableColumn ?? false;
}

/**
 * Top level math component.
 */
export class MathArea extends HTMLElement {
    private readonly heading: HTMLHeadingElement;
    private readonly specificSettingsArea: HTMLDivElement;
    private readonly subFormulaeArea: HTMLDivElement;

    private readonly generalSettings: GeneralSettings;
    private _level!: SupportedLevel;
    private menu: HTMLDivElement;
    private updateHook: () => void = () => undefined;
    private readonly tableArea: HTMLDivElement;
    private readonly subFormulaeOuter: HTMLDivElement;
    private landingInner: HTMLElement | undefined = undefined;
    private landingOuter: HTMLElement;
    private displayEntries: number = 100;
    private _loading: boolean = false;
    private readonly loader = new LoadingBlocker();
    private readonly formulaSettingsStickyHolder: Map<MathFormulaSet<object>, object> = new Map();
    private readonly formulaVisibilityStickyHolder: Map<MathFormulaSet<object>, Map<string, boolean>> = new Map();

    constructor() {
        super();
        this.generalSettings = {
            classJob: 'WHM',
            // @ts-expect-error - set below in this.level
            levelStats: undefined,
            displayType: 'Show By Tier',
        };
        this.level = CURRENT_MAX_LEVEL;

        // Top heading
        this.heading = document.createElement('h1');
        this.appendChild(this.heading);

        // Formula picker menu
        this.menu = quickElement('div', ['formula-selector-area'], []);
        registered.forEach(reg => {
            const menuItem = makeActionButton(reg.name, () => {
                this.setFormulaSet(reg);
                setHash(CALC_HASH, reg.stub);
            });
            menuItem.value = reg.stub;
            this.menu.appendChild(menuItem);
        });
        this.appendChild(this.menu);

        // Settings area which is not specific to any formula
        const displayType = new FieldBoundDataSelect(writeProxy(this.generalSettings, () => this.update()), 'displayType', item => item.toString(), [...tableDisplayOptions]);
        const jobDropdown = new FieldBoundDataSelect(writeProxy(this.generalSettings, () => this.update()), 'classJob', item => item, Object.keys(JOB_DATA) as JobName[]);
        const levelDropdown = fieldBoundLevelSelect(writeProxy(this as {
            'level': SupportedLevel
        }, () => this.update()), 'level');
        const genericSettingsArea = quickElement('div', ['generic-settings-area'], [labeledInput('Table Style', displayType), labeledInput('Job', jobDropdown), labeledInput('Level', levelDropdown)]);

        // Settings area for specific formula. To be filled in when a formula is selected.
        this.specificSettingsArea = quickElement('div', ['specific-settings-area'], []);
        const settingsArea = quickElement('div', ['settings-area'], [genericSettingsArea, this.specificSettingsArea]);
        this.appendChild(settingsArea);

        // Landing text area. To be filled externally by the page loading scripts.
        this.landingOuter = document.createElement('div');
        this.appendChild(this.landingOuter);

        // Results table. Table itself is added on demand.
        this.tableArea = quickElement('div', ['math-result-table-holder'], []);
        this.appendChild(this.tableArea);

        // Formula text holder
        this.subFormulaeOuter = document.createElement('div');

        // subFormulaeArea is where the actual formulae go, but this is hidden/shown by the chevron
        this.subFormulaeArea = document.createElement('div');
        this.subFormulaeArea.style.display = 'none';
        const showHide = new ShowHideButton(true, hidden => {
            if (hidden) {
                this.subFormulaeArea.style.display = 'none';
            }
            else {
                this.subFormulaeArea.style.display = '';
            }
        });

        const formulaHeader = quickElement('h3', ['show-hide-formula-header'], ['Show/Hide Formulae', showHide]);
        formulaHeader.addEventListener('click', ev => {
            showHide.toggle();
        });
        this.subFormulaeOuter.appendChild(formulaHeader);

        this.subFormulaeOuter.appendChild(this.subFormulaeArea);
        this.appendChild(this.subFormulaeOuter);

    }

    /**
     * This initializes or retrieves the settings for a particular formula set.
     *
     * @param formulaSet The formula set
     */
    private getSettingsFor<AllInputType extends object>(formulaSet: MathFormulaSet<AllInputType>): AllInputType {
        const saved = this.formulaSettingsStickyHolder.get(formulaSet as unknown as MathFormulaSet<object>);
        if (saved) {
            return saved as AllInputType;
        }
        else {
            const out = formulaSet.makeDefaultInputs(this.generalSettings);
            this.formulaSettingsStickyHolder.set(formulaSet as unknown as MathFormulaSet<object>, out);
            return out;
        }
    }

    private getVisibleColumns<AllInputType extends object, FsType extends MathFormulaSet<AllInputType>>(formulaSet: FsType): Map<typeof formulaSet['functions'][number]['name'], boolean> {
        const saved = this.formulaVisibilityStickyHolder.get(formulaSet as unknown as MathFormulaSet<object>) as Map<FsType['functions'][number]['name'], boolean> | undefined;
        if (saved) {
            return saved;
        }
        else {
            const vis = new Map<FsType['functions'][number]['name'], boolean>();
            formulaSet.functions.forEach(fn => {
                if (isHideable(fn)) {
                    vis.set(fn.name as FsType['functions'][number]['name'], true);
                }
            });
            this.formulaVisibilityStickyHolder.set(formulaSet as unknown as MathFormulaSet<object>, vis as unknown as Map<string, boolean>);
            return vis;
        }
    }

    private isColumnVisible<AllInputType extends object, FsType extends MathFormulaSet<AllInputType>>(formulaSet: FsType, formula: (FsType['functions'][number])): boolean {
        if (!isHideable(formula)) {
            return true;
        }
        return this.getVisibleColumns<AllInputType, FsType>(formulaSet).get(formula.name) ?? true;
    }


    /**
     * Set a new formula set
     *
     * @param formulaSet The set, or null to clear
     */
    setFormulaSet<AllInputType extends object>(formulaSet: MathFormulaSet<AllInputType> | null) {
        if (formulaSet !== null) {

            const table = new CustomTable<FormulaSetInput<AllInputType>, TableSelectionModel<FormulaSetInput<AllInputType>, unknown, unknown, FormulaSetInput<AllInputType> | undefined>>;
            this.landingOuter.style.display = 'none';
            this.heading.textContent = formulaSet.name;
            const settings: AllInputType = this.getSettingsFor(formulaSet);
            const outer = this;
            // TODO: this is way too big, can it be moved somewhere
            // Callback to update UI state when any settings are changed.
            const update = async () => {
                const rows: FormulaSetInput<AllInputType>[] = [];
                const funcs = formulaSet.functions.filter(fn => {
                    if (!isHideable(fn)) {
                        return true;
                    }
                    const visMap = outer.getVisibleColumns<AllInputType, typeof formulaSet>(formulaSet);
                    return visMap.get(fn.name) ?? true;
                });

                /**
                 * Make a row given a primary value - the rest of the values are assumed to be according to use
                 * inputs.
                 *
                 * @param primary The value for the primary variable.
                 * @param isPrimaryRow whether to flag this as being the user-chosen row, i.e. the row that reflects the
                 * values directly chosen by the user, not additional informational rows.
                 */
                async function makeRow(primary?: number, isPrimaryRow: boolean = false): Promise<FormulaSetInput<AllInputType>> {
                    const newPrimary: {
                        [key: string]: unknown
                    } = {};
                    if (primary !== undefined) {
                        newPrimary[formulaSet!.primaryVariable as string] = primary;
                    }
                    const inputs = {...settings, ...newPrimary};
                    const results: ResultSet = {};
                    for (const fn of funcs) {
                        results[fn.name] = {
                            value: await fn.argExtractor(inputs, outer.generalSettings).then(args => fn.fn(...args)) as number,
                        };
                    }
                    return {
                        generalSettings: outer.generalSettings,
                        inputs: inputs,
                        inputsMax: inputs,
                        isOriginalPrimary: isPrimaryRow,
                        results: results,
                        isRange: false,
                    };
                }

                async function addRow(primary?: number, primaryFlag: boolean = false): Promise<FormulaSetInput<AllInputType>> {
                    const row = await makeRow(primary, primaryFlag);
                    rows.push(row);
                    return row;
                }

                const primaryVariableSpec = getPrimaryVarSpec(formulaSet);
                if (primaryVariableSpec === undefined) {
                    await addRow(undefined, true);
                }
                else if (primaryVariableSpec.type === 'level') {
                    const levels = SupportedLevels;
                    const selectedLevel = this.generalSettings.levelStats.level;
                    for (const level of levels) {
                        const fakeGeneralSettings: GeneralSettings = {
                            ...this.generalSettings,
                            levelStats: LEVEL_STATS[level],
                        };
                        const inputs = {...settings};
                        const results: ResultSet = {};
                        for (const fn of funcs) {
                            const args = await fn.argExtractor(inputs, fakeGeneralSettings);
                            results[fn.name] = {
                                value: fn.fn(...args) as number,
                            };
                        }
                        rows.push({
                            generalSettings: fakeGeneralSettings,
                            inputs: inputs,
                            inputsMax: inputs,
                            isOriginalPrimary: level === selectedLevel,
                            isRange: false,
                            results: results,
                        });
                    }
                }
                else if (primaryVariableSpec.type === 'job') {
                    const jobs = Object.keys(JOB_DATA) as JobName[];
                    const selectedJob = this.generalSettings.classJob;
                    for (const job of jobs) {
                        const fakeGeneralSettings: GeneralSettings = {
                            ...this.generalSettings,
                            classJob: job,
                        };
                        const inputs = {...settings};
                        const results: ResultSet = {};
                        for (const fn of funcs) {
                            const args = await fn.argExtractor(inputs, fakeGeneralSettings);
                            results[fn.name] = {
                                value: fn.fn(...args) as number,
                            };
                        }
                        rows.push({
                            generalSettings: fakeGeneralSettings,
                            inputs: inputs,
                            inputsMax: inputs,
                            isOriginalPrimary: job === selectedJob,
                            isRange: false,
                            results: results,
                        });
                    }
                }
                else if (primaryVariableSpec.type === 'number' && primaryVariableSpec.integer) {
                    const prop = primaryVariableSpec.property;
                    const currentPrimaryValue = settings[prop] as number;
                    const hardMin = primaryVariableSpec.min?.(this.generalSettings) ?? Number.MIN_SAFE_INTEGER;
                    const hardMax = primaryVariableSpec.max?.(this.generalSettings) ?? Number.MAX_SAFE_INTEGER;
                    switch (this.generalSettings.displayType) {
                        case "Show By Tier": {
                            // For tiering display, we start with the user-chosen value, and traverse both ways from
                            // there until we have filled in enough entries to satisfy the `displayEntries` property.
                            const base = await makeRow(currentPrimaryValue, true);
                            // Hard limit of number of entries to calculate in each directly. This should never be
                            // hit in practice.
                            const rangeLimit = 50000;
                            const entriesRange = outer.displayEntries;
                            const lowerOut: typeof rows = [];
                            const upperOut: typeof rows = [];
                            // Compute lower values
                            {
                                let last = base;
                                for (let i = 0; i < rangeLimit; i++) {
                                    const nextVal = currentPrimaryValue - i;
                                    if (nextVal < hardMin) {
                                        break;
                                    }
                                    const next = await makeRow(nextVal);
                                    // If any particular entry has identical results, combine it with the previous
                                    if (resultsEquals(last.results, next.results)) {
                                        last.inputs = next.inputs;
                                        last.isRange = true;
                                    }
                                    else {
                                        // Otherwise, push old previous to the output list, and set a new comparison baseline.
                                        if (last !== base) {
                                            lowerOut.push(last);
                                        }
                                        last = next;
                                        if (lowerOut.length > entriesRange) {
                                            break;
                                        }
                                    }
                                }
                                if (last !== base) {
                                    lowerOut.push(last);
                                }
                            }
                            // Compute upper values
                            {
                                let last = base;
                                for (let i = 0; i < rangeLimit; i++) {
                                    const nextVal = currentPrimaryValue + i;
                                    if (nextVal > hardMax) {
                                        break;
                                    }
                                    const next = await makeRow(nextVal);
                                    // If any particular entry has identical results, combine it with the previous
                                    if (resultsEquals(last.results, next.results)) {
                                        last.inputsMax = next.inputsMax;
                                        last.isRange = true;
                                    }
                                    else {
                                        // Otherwise, push old previous to the output list, and set a new comparison baseline.
                                        if (last !== base) {
                                            upperOut.push(last);
                                        }
                                        last = next;
                                        if (upperOut.length > entriesRange) {
                                            break;
                                        }
                                    }
                                }
                                if (last !== base) {
                                    upperOut.push(last);
                                }
                            }
                            // Combine values.
                            // lower values need to be reversed, since they would be in descending order.
                            lowerOut.reverse();
                            rows.push(...lowerOut);
                            rows.push(base);
                            rows.push(...upperOut);

                            break;
                        }
                        case "Show Full": {
                            // Just calculate every desired row directly.
                            const range = outer.displayEntries;
                            const minValue = Math.max(currentPrimaryValue - range, hardMin);
                            // If the user specifies 250, and the minimum is 200, then we want to expand the range to
                            // compensate.
                            const maxValue = Math.min(minValue + (2 * range), hardMax);
                            for (let i = minValue; i <= maxValue; i++) {
                                await addRow(i, i === currentPrimaryValue);
                            }
                            break;
                        }
                    }
                }
                else {
                    await addRow(undefined, true);
                }
                table.data = [new HeaderRow(), ...rows];
                for (const entry of table.dataRowMap.entries()) {
                    if (entry[0].isOriginalPrimary) {
                        scrollIntoView(entry[1], 'center');
                    }
                }
            };
            this.updateHook = update;
            // const formulaSettings = formulaSet.makeEditorArea(writeProxy(settings, update), update);
            const formulaSettings = this.makeEditorArea(formulaSet, settings, update);
            this.specificSettingsArea.replaceChildren(formulaSettings);

            const newChildren = formulaSet.functions
                .filter(formula => !formula.excludeFormula)
                .map(formula => {
                    const heading = quickElement('h3', [], [formula.name]);
                    const codeArea = quickElement('pre', [], [functionText(formula.fn)]);
                    hljs.configure({
                        languages: ['js'],
                    });
                    hljs.highlightElement(codeArea);
                    codeArea.querySelectorAll('span.hljs-title')
                        .forEach(element => {
                            switch (element.textContent) {
                                case 'fl':
                                    element.setAttribute('title', 'Floor to integer');
                                    break;
                                case 'flp':
                                    element.setAttribute('title', 'Floor to specified number of decimal places');
                                    break;
                            }
                        });
                    const codeOuter = quickElement('div', ['code-outer'], [codeArea]);
                    const formulaText = quickElement('div', ['function-code-area'], [codeOuter]);
                    return quickElement('div', [], [heading, formulaText]);
                });

            this.setFormulaAreaVisible(newChildren.length > 0);

            this.subFormulaeArea.replaceChildren(...newChildren);

            const columns: ColDefs<FormulaSetInput<AllInputType>> = [];
            // Input columns
            if (formulaSet.primaryVariable === 'level') {
                columns.push({
                    displayName: 'Level',
                    shortName: 'lvl',
                    getter: item => item.generalSettings.levelStats.level,
                });
            }
            else if (formulaSet.primaryVariable === 'job') {
                columns.push({
                    displayName: 'Job',
                    shortName: 'job',
                    getter: item => item.generalSettings.classJob,
                });
            }
            formulaSet.variables.forEach(variable => {
                if (variable.type === 'number') {
                    columns.push(col({
                        displayName: variable.label,
                        shortName: 'var-' + variable.property.toString(),
                        getter: item => {
                            const min = item.inputs[variable.property];
                            const max = item.inputsMax[variable.property];
                            return {
                                min: min,
                                max: max,
                                isRange: item.isRange && (min !== max),
                            };
                        },
                        renderer: value => {
                            if (value.isRange) {
                                return document.createTextNode(`${value.min} - ${value.max}`);
                            }
                            else {
                                return document.createTextNode(`${value.min}`);
                            }
                        },
                    }));
                }
            });
            // Output columns
            formulaSet.functions.forEach(fn => {
                const shown = this.isColumnVisible<AllInputType, typeof formulaSet>(formulaSet, fn);
                if (!shown) {
                    return;
                }
                columns.push({
                    displayName: fn.name,
                    shortName: 'function-' + fn.fn.name,
                    getter: item => item.results[fn.name],
                    renderer: (value: Result) => {
                        const node = document.createElement('span');
                        node.textContent = value.value.toString();
                        return node;
                    },
                });
            });
            table.columns = columns;
            // noinspection JSUnusedGlobalSymbols
            table.selectionModel = {
                getSelection(): undefined {
                    return undefined;
                },
                clickCell(cell: never) {
                },
                clickColumnHeader(col: never) {
                },
                clickRow(row: never) {
                },
                isCellSelectedDirectly(cell: never) {
                    return false;
                },
                isColumnHeaderSelected(col: never) {
                    return false;
                },
                isRowSelected(row: CustomRow<FormulaSetInput<AllInputType>>) {
                    return row.dataItem.isOriginalPrimary;
                },
                clearSelection(): void {
                },
            };
            this.tableArea.replaceChildren(table, this.loader);
            this.loading = true;
            table.data = [new HeaderRow()];
            update().then(() => this.loading = false);
        }
        else {
            this.heading.textContent = 'Math';
            this.setFormulaAreaVisible(false);
            this.landingOuter.style.display = '';
        }
        this.menu.querySelectorAll('button').forEach(btn => {
            const active = btn.value === formulaSet?.stub;
            if (active) {
                btn.classList.add('active');
            }
            else {
                btn.classList.remove('active');
            }
        });

    }

    setFormulaAreaVisible(visible: boolean): void {
        if (visible) {
            this.subFormulaeOuter.style.display = '';
        }
        else {
            this.subFormulaeOuter.style.display = 'none';
        }
    }

    get loading(): boolean {
        return this._loading;
    }

    set loading(value: boolean) {
        this._loading = value;
        if (value) {
            this.loader.show();
        }
        else {
            this.loader.hide();
        }
    }

    get level(): SupportedLevel {
        return this._level;
    }

    set level(value: SupportedLevel) {
        this.generalSettings.levelStats = getLevelStats(value);
        this._level = value;
        this.update();
    }

    get landingContent(): HTMLElement | undefined {
        return this.landingInner;
    }

    set landingContent(value: HTMLElement) {
        this.landingOuter.replaceChildren(value);
        this.landingInner = value;
    }

    update() {
        this.updateHook();
    }

    private makeEditorArea<AllInputType extends object>(formulaSet: MathFormulaSet<AllInputType>, settings: AllInputType, update: () => void) {
        const proxy = writeProxy(settings, update);
        const out = document.createElement('div');
        for (const variable of formulaSet.variables) {
            switch (variable.type) {
                case "number": {
                    let editor: HTMLElement;
                    const validators: FbctPostValidator<AllInputType, number>[] = [];
                    validators.push(clampValues(variable.min?.(this.generalSettings), variable.max?.(this.generalSettings)));
                    if (variable.integer) {
                        editor = new FieldBoundIntField(proxy, variable.property, {postValidators: validators});
                    }
                    else {
                        editor = new FieldBoundFloatField(proxy, variable.property, {postValidators: validators});
                    }
                    out.appendChild(labeledInput(variable.label, editor));
                    break;
                }
            }
        }
        // Per-formula column visibility controls
        const vis = this.getVisibleColumns<AllInputType, typeof formulaSet>(formulaSet);
        const hideableFns = formulaSet.functions.filter(fn => isHideable(fn));
        if (hideableFns.length > 0) {
            const visArea = document.createElement('div');
            visArea.classList.add('formula-visibility-area');
            hideableFns.forEach(fn => {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = vis.get(fn.name) ?? true;
                checkbox.id = `formula-vis-${fn.name.replace(/\s+/g, '-')}`;
                const label = labelFor(`Include ${fn.name}`, checkbox);
                const line = quickElement('div', [], [checkbox, label]);
                checkbox.addEventListener('change', () => {
                    vis.set(fn.name, checkbox.checked);
                    // Rebuild UI to update columns
                    this.setFormulaSet(formulaSet);
                });
                visArea.appendChild(line);
            });
            out.appendChild(visArea);
        }
        return out;
    }
}

customElements.define('math-area', MathArea);

/**
 * Opens the math section at the top level
 *
 * @param formulaKey The formula key to pre-open
 */
export function openMath(formulaKey: string | null) {
    const mathArea = new MathArea();
    welcomeArea.id = '';
    mathArea.landingContent = welcomeArea;
    mathArea.classList.add('formula-top-level', 'named-section');
    setMainContent('Math', mathArea);
    const formulaSet = formulaKey !== null ? regMap.get(formulaKey) : null;
    if (formulaSet) {
        mathArea.setFormulaSet(formulaSet);
    }
    else {
        mathArea.setFormulaSet(null);
    }
}
