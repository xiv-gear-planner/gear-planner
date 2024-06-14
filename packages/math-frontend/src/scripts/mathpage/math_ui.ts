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
import {getLevelStats, JOB_DATA, JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {setHash} from "../nav_hash";
import {CALC_HASH} from "@xivgear/core/nav/common_nav";
import {writeProxy} from "@xivgear/core/util/proxies";
import {ShowHideButton} from "@xivgear/common-ui/components/show_hide_chevron";
import {CustomRow, CustomTable, HeaderRow} from "../tables";
import {scrollIntoView} from "@xivgear/common-ui/util/scrollutil";
import hljs from "highlight.js/lib/core";
import {FormulaSetInput, GeneralSettings, MathFormulaSet, registered, regMap, Result, ResultSet} from "./math_main";
import {setMainContent, welcomeArea} from "../base_ui";
import javascript from "highlight.js/lib/languages/javascript";
import {fieldBoundLevelSelect} from "@xivgear/common-ui/components/level_picker";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";

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

export class MathArea extends HTMLElement {
    private readonly heading: HTMLHeadingElement;
    private readonly specificSettingsArea: HTMLDivElement;
    private readonly subFormulaeArea: HTMLDivElement;

    private readonly generalSettings: GeneralSettings;
    private _level: SupportedLevel;
    private menu: HTMLDivElement;
    private updateHook: () => void = () => undefined;
    private readonly tableArea: HTMLDivElement;
    private readonly subFormulaeOuter: HTMLDivElement;
    private landingInner: HTMLElement;
    private landingOuter: HTMLElement;
    private displayEntries: number = 100;
    private _loading: boolean;
    private readonly loader = new LoadingBlocker();
    private readonly formulaSettingsStickyHolder: Map<MathFormulaSet<object>, object> = new Map();

    constructor() {
        super();
        this.generalSettings = {
            classJob: 'WHM',
            levelStats: undefined,
            displayType: 'Show By Tier'
        };
        this.level = 90;

        this.heading = document.createElement('h1');
        this.appendChild(this.heading);

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

        const displayType = new FieldBoundDataSelect(writeProxy(this.generalSettings, () => this.update()), 'displayType', item => item.toString(), [...tableDisplayOptions]);
        const jobDropdown = new FieldBoundDataSelect(writeProxy(this.generalSettings, () => this.update()), 'classJob', item => item, Object.keys(JOB_DATA) as JobName[]);
        const levelDropdown = fieldBoundLevelSelect(writeProxy(this as {
            'level': SupportedLevel
        }, () => this.update()), 'level');
        const genericSettingsArea = quickElement('div', ['generic-settings-area'], [labeledInput('Table Style', displayType), labeledInput('Job', jobDropdown), labeledInput('Level', levelDropdown)]);

        this.specificSettingsArea = quickElement('div', ['specific-settings-area'], []);
        const settingsArea = quickElement('div', ['settings-area'], [genericSettingsArea, this.specificSettingsArea]);
        this.appendChild(settingsArea);

        this.landingOuter = document.createElement('div');
        this.appendChild(this.landingOuter);

        this.tableArea = quickElement('div', ['math-result-table-holder'], []);
        this.appendChild(this.tableArea);

        this.subFormulaeOuter = document.createElement('div');

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

        const formulaHeader = quickElement('h3', [], ['Show/Hide Formulae', showHide]);
        formulaHeader.addEventListener('click', ev => {
            showHide.toggle();
        });
        this.subFormulaeOuter.appendChild(formulaHeader);

        this.subFormulaeOuter.appendChild(this.subFormulaeArea);
        this.appendChild(this.subFormulaeOuter);

    }

    getSettingsFor<AllInputType extends object>(formulaSet: MathFormulaSet<AllInputType>): AllInputType {
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

    setFormulaSet<AllInputType extends object>(formulaSet: MathFormulaSet<AllInputType> | null) {
        if (formulaSet !== null) {

            const table = new CustomTable<FormulaSetInput<AllInputType>, (FormulaSetInput<AllInputType> | undefined)>();
            this.landingOuter.style.display = 'none';
            this.heading.textContent = formulaSet.name;
            this.subFormulaeOuter.style.display = '';
            const settings: AllInputType = this.getSettingsFor(formulaSet);
            const outer = this;
            // TODO: this is way too big, can it be moved somewhere
            const update = async () => {
                const rows: FormulaSetInput<AllInputType>[] = [];
                const funcs = formulaSet.functions;

                async function makeRow(primary?: number, primaryFlag: boolean = false): Promise<FormulaSetInput<AllInputType>> {
                    const newPrimary = {};
                    if (primary !== undefined) {
                        newPrimary[formulaSet.primaryVariable as string] = primary;
                    }
                    const inputs = {...settings, ...newPrimary};
                    const results: ResultSet = {};
                    for (const fn of funcs) {
                        results[fn.name] = {
                            value: await fn.argExtractor(inputs, outer.generalSettings).then(args => fn.fn(...args)) as number
                        }
                    }
                    return {
                        generalSettings: outer.generalSettings,
                        inputs: inputs,
                        inputsMax: inputs,
                        isOriginalPrimary: primaryFlag,
                        results: results,
                        isRange: false
                    };
                }

                async function addRow(primary?: number, primaryFlag: boolean = false): Promise<FormulaSetInput<AllInputType>> {
                    const row = await makeRow(primary, primaryFlag);
                    rows.push(row);
                    return row;
                }

                const primaryVariableSpec = formulaSet.variables.find(v => v.property === formulaSet.primaryVariable);
                if (primaryVariableSpec && primaryVariableSpec.integer) {
                    const prop = primaryVariableSpec.property;
                    const currentPrimaryValue = settings[prop] as number;
                    const hardMin = primaryVariableSpec.min?.(this.generalSettings) ?? Number.MIN_SAFE_INTEGER;
                    const hardMax = primaryVariableSpec.max?.(this.generalSettings) ?? Number.MAX_SAFE_INTEGER;
                    switch (this.generalSettings.displayType) {
                        case "Show By Tier": {
                            const base = await makeRow(currentPrimaryValue, true);
                            const rangeLimit = 50000;
                            const entriesRange = outer.displayEntries;
                            const lowerOut = [];
                            const upperOut = [];
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
                                    // Otherwise, push old previous to the output list, and set a new comparison baseline.
                                    else {
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
                                    // Otherwise, push old previous to the output list, and set a new comparison baseline.
                                    else {
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
                            lowerOut.reverse();
                            rows.push(...lowerOut);
                            rows.push(base);
                            rows.push(...upperOut);

                            break;
                        }
                        case "Show Full": {
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
                // const combinedRows = outer.combineRows(rows);
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

            this.subFormulaeArea.replaceChildren(...formulaSet.functions.map(formula => {
                const heading = quickElement('h3', [], [formula.name]);
                const codeArea = quickElement('pre', [], [functionText(formula.fn)]);
                hljs.configure({
                    languages: ['js']
                });
                hljs.highlightElement(codeArea);
                const codeOuter = quickElement('div', ['code-outer'], [codeArea]);
                const formulaText = quickElement('div', ['function-code-area'], [codeOuter]);
                return quickElement('div', [], [heading, formulaText]);
            }));

            const columns: typeof table.columns = [];
            formulaSet.variables.forEach(variable => {
                columns.push({
                    displayName: variable.label,
                    shortName: 'var-' + variable.property.toString(),
                    getter: item => {
                        const min = item.inputs[variable.property]
                        const max = item.inputsMax[variable.property];
                        return {
                            min: min,
                            max: max,
                            isRange: item.isRange && (min !== max)
                        }
                    },
                    renderer: value => {
                        if (value.isRange) {
                            return document.createTextNode(`${value.min} - ${value.max}`);
                        }
                        else {
                            return document.createTextNode(`${value.min}`);
                        }
                    }
                });
            });
            formulaSet.functions.forEach(fn => {
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
                }
            };
            this.tableArea.replaceChildren(table, this.loader);
            this.loading = true;
            table.data = [new HeaderRow()];
            update().then(() => this.loading = false);
        }
        else {
            this.heading.textContent = 'Math';
            this.subFormulaeOuter.style.display = 'none';
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

    get loading(): boolean {
        return this._loading;
    }

    set loading(value: boolean) {
        this._loading = value;
        if (value) {
            this.loader.show()
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

    get landingContent() {
        return this.landingInner;
    }

    set landingContent(value: HTMLElement) {
        this.landingOuter.replaceChildren(value);
        this.landingInner = value;
    }

    update() {
        this.updateHook();
    }

    private makeEditorArea<AllArgType extends object>(formulaSet: MathFormulaSet<AllArgType>, settings: AllArgType, update: () => void) {
        const proxy = writeProxy(settings, update);
        const out = document.createElement('div');
        for (const variable of formulaSet.variables) {
            switch (variable.type) {
                case "number": {
                    let editor: HTMLElement;
                    const validators: FbctPostValidator<AllArgType, number>[] = [];
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
        return out;
    }
}

customElements.define('math-area', MathArea);

export function openMath(formulaKey: string | null) {
    const mathArea = new MathArea();
    welcomeArea.id = '';
    mathArea.landingContent = welcomeArea;
    const formulaSet = regMap.get(formulaKey);
    mathArea.classList.add('formula-top-level', 'named-section');
    setMainContent('Math', mathArea);
    if (formulaSet) {
        mathArea.setFormulaSet(formulaSet);
    }
    else {
        mathArea.setFormulaSet(null);
    }
}
