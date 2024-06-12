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
import {getLevelStats, JOB_DATA, JobName, SupportedLevel, SupportedLevels} from "@xivgear/xivmath/xivconstants";
import {setHash} from "../nav_hash";
import {CALC_HASH} from "@xivgear/core/nav/common_nav";
import {writeProxy} from "@xivgear/core/util/proxies";
import {ShowHideButton} from "@xivgear/common-ui/components/show_hide_chevron";
import {CustomRow, CustomTable, HeaderRow} from "../tables";
import {scrollIntoView} from "@xivgear/common-ui/util/scrollutil";
import hljs from "highlight.js/lib/core";
import {FormulaSetInput, GeneralSettings, MathFormulaSet, registered, regMap} from "./math_main";
import {setMainContent} from "../base_ui";
import javascript from "highlight.js/lib/languages/javascript";

hljs.registerLanguage('javascript', javascript);


function labeledInput(labelText: string, element: HTMLElement): HTMLDivElement {
    const label = labelFor(labelText, element);
    return quickElement('div', ['vertical-labeled-input'], [label, element]);
}

// TODO: add intro area to page
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

    constructor() {
        super();
        this.generalSettings = {
            classJob: 'WHM',
            levelStats: undefined,
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

        const jobDropdown = new FieldBoundDataSelect(writeProxy(this.generalSettings, () => this.update()), 'classJob', item => item, Object.keys(JOB_DATA) as JobName[]);
        const levelDropdown = new FieldBoundDataSelect(writeProxy(this as {
            'level': SupportedLevel
        }, () => this.update()), 'level', item => item.toString(), [...SupportedLevels]);
        const genericSettingsArea = quickElement('div', ['generic-settings-area'], [labeledInput('Job', jobDropdown), labeledInput('Level', levelDropdown)]);

        this.specificSettingsArea = quickElement('div', ['specific-settings-area'], []);
        const settingsArea = quickElement('div', ['settings-area'], [genericSettingsArea, this.specificSettingsArea]);
        this.appendChild(settingsArea);

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

    setFormulaSet<AllInputType extends object>(formulaSet: MathFormulaSet<AllInputType> | null) {
        if (formulaSet !== null) {

            const table = new CustomTable<FormulaSetInput<AllInputType>, (FormulaSetInput<AllInputType> | undefined)>();
            this.heading.textContent = formulaSet.name;
            this.subFormulaeOuter.style.display = '';
            const settings: AllInputType = formulaSet.makeDefaultInputs(this.generalSettings);
            const outer = this;
            const update = () => {
                const rows: FormulaSetInput<AllInputType>[] = [];

                function addRow(primary?: number, primaryFlag: boolean = false) {
                    const newPrimary = {};
                    if (primary !== undefined) {
                        newPrimary[formulaSet.primaryVariable as string] = primary;
                    }
                    const inputs = {...settings, ...newPrimary};
                    rows.push({
                        generalSettings: outer.generalSettings,
                        inputs: inputs,
                        isOriginalPrimary: primaryFlag
                    });
                }

                const primaryVariableSpec = formulaSet.variables.find(v => v.property === formulaSet.primaryVariable);
                if (primaryVariableSpec) {
                    const prop = primaryVariableSpec.property;
                    if (primaryVariableSpec.integer) {
                        const currentPrimaryValue = settings[prop] as number;
                        const minValue = Math.max(currentPrimaryValue - 20, primaryVariableSpec.min ?? Number.MIN_SAFE_INTEGER);
                        const maxValue = Math.min(currentPrimaryValue + 20, primaryVariableSpec.max ?? Number.MAX_SAFE_INTEGER);
                        for (let i = minValue; i <= maxValue; i++) {
                            addRow(i, i === currentPrimaryValue);
                        }
                    }
                    else {
                        addRow(undefined, true);
                    }
                }
                else {
                    addRow(undefined, true);
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

            this.subFormulaeArea.replaceChildren(...formulaSet.functions.map(formula => {
                const heading = quickElement('h3', [], [formula.name]);
                const codeArea = quickElement('pre', [], [formula.fn.toString()]);
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
                    getter: item => item.inputs[variable.property]
                });
            });
            formulaSet.functions.forEach(fn => {
                columns.push({
                    displayName: fn.name,
                    shortName: 'function-' + fn.fn.name,
                    getter: item => {
                        const extracted = fn.argExtractor(item.inputs, item.generalSettings);
                        return fn.fn(...extracted);
                    }
                })
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
            this.tableArea.replaceChildren(table);
            update();
        }
        else {
            this.heading.textContent = 'Math';
            this.subFormulaeOuter.style.display = 'none';
        }
        this.menu.querySelectorAll('button').forEach(btn => {
            const active = btn.value === formulaSet?.stub;
            if (active) {
                btn.classList.add('active');
            }
            else {
                btn.classList.remove('active');
            }
        })
    }

    get level(): SupportedLevel {
        return this._level;
    }

    set level(value: SupportedLevel) {
        this.generalSettings.levelStats = getLevelStats(value);
        this._level = value;
        this.update();
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
                    validators.push(clampValues(variable.min, variable.max));
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
