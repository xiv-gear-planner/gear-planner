import {setMainContent} from "../base_ui";
import {sksTickMulti, sksToGcd, spsTickMulti, spsToGcd} from "@xivgear/xivmath/xivmath";
import {getLevelStats, JobName} from "@xivgear/xivmath/xivconstants";
import {
    clampValues,
    FieldBoundFloatField,
    FieldBoundIntField,
    labelFor,
    makeActionButton,
    positiveValuesOnly,
    quickElement
} from "../components/util";
import {LevelStats} from "@xivgear/xivmath/geartypes";
import {writeProxy} from "@xivgear/core/util/proxies";
import {setHash} from "../nav_hash";
import {CALC_HASH} from "@xivgear/core/nav/common_nav";

type GeneralSettings = {
    classJob: JobName;
    levelStats: LevelStats;
}

type Func = (...args: unknown[]) => unknown

/**
 * Represents a single, simple formula, e.g. crit stat to crit chance
 */
type MathFormula<AllArgType, FuncType extends Func> = {
    name: string;
    fn: FuncType;
    argExtractor: (arg: AllArgType, gen: GeneralSettings) => Parameters<FuncType>;
    makeResultsDisplay: (result: ReturnType<FuncType>) => Element;
}

/**
 * Represents a set of related formulae, e.g. crit => crit chance, crit damage
 */
type MathFormulaSet<AllArgType extends object> = {
    stub: string;
    name: string;
    functions: MathFormula<AllArgType, Func>[];
    makeDefaultInputs: () => AllArgType;
    makeEditorArea: (args: AllArgType, updateCallback: () => void) => Element;
}

const registered: MathFormulaSet<object>[] = [];
const regMap: Map<string, MathFormulaSet<object>> = new Map();

function registerFormula(formula: MathFormulaSet<object>) {
    registered.push(formula);
    regMap.set(formula.stub, formula);
}

type SksSettings = {
    baseGcd: number,
    sks: number,
    haste: number
}

type SpsSettings = {
    baseGcd: number,
    sps: number,
    haste: number
}

function labeledInput(labelText: string, element: HTMLElement): HTMLDivElement {
    const label = labelFor(labelText, element);
    return quickElement('div', ['vertical-labeled-input'], [label, element]);
}

class MathArea extends HTMLElement {
    private heading: HTMLHeadingElement;
    private specificSettingsArea: HTMLDivElement;
    private subFormulaeArea: HTMLDivElement;
    private resultsArea: HTMLDivElement;

    private readonly generalSettings: GeneralSettings;
    private menu: HTMLDivElement;

    constructor() {
        super();
        this.generalSettings = {
            classJob: 'WHM',
            levelStats: getLevelStats(90)
            // TODO
        };

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

        const genericSettingsArea = quickElement('div', ['generic-settings-area'], []);
        this.specificSettingsArea = quickElement('div', ['specific-settings-area'], []);
        const settingsArea = quickElement('div', ['settings-area'], [genericSettingsArea, this.specificSettingsArea]);
        this.appendChild(settingsArea);

        this.subFormulaeArea = document.createElement('div');
        this.appendChild(this.subFormulaeArea);

        this.resultsArea = document.createElement('div');
        const resultsOuter = quickElement('div', [], [quickElement('h3', [], ['Results']), this.resultsArea]);
        this.appendChild(resultsOuter);
    }

    setFormulaSet<SettingsType extends object>(formulaSet: MathFormulaSet<SettingsType> | null) {
        if (formulaSet !== null) {

            this.heading.textContent = formulaSet.name;
            const settings: SettingsType = formulaSet.makeDefaultInputs();
            const outer = this;
            const update = () => {
                this.resultsArea.replaceChildren(...formulaSet.functions.map(formula => {
                    const result = formula.fn(...formula.argExtractor(settings, outer.generalSettings));
                    return quickElement('div', [], [`${formula.name}: ${result}`]);
                }));
            };
            const formulaSettings = formulaSet.makeEditorArea(writeProxy(settings, update), update);
            this.specificSettingsArea.replaceChildren(formulaSettings);

            this.subFormulaeArea.replaceChildren(...formulaSet.functions.map(formula => {
                const heading = quickElement('h3', [], [formula.name]);
                const formulaText = quickElement('div', [], [formula.fn.toString()]);
                return quickElement('div', [], [heading, formulaText]);
            }));
            update();
        }
        else {
            this.heading.textContent = 'Math';
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
}

function registerFormulae() {
    // TODO: should this be handling multiple formulae in one go? e.g. crit has chance, damage, and autocrit damage
    // Should use one single set of inputs
    const sks: MathFormulaSet<SksSettings> = {
        stub: 'sks',
        name: 'Skill Speed',
        functions: [
            {
                name: 'SkS to GCD',
                fn: sksToGcd,
                argExtractor: (args, gen) => {
                    return [args.baseGcd, gen.levelStats, args.sks, args.haste]
                },
                makeResultsDisplay: () => {
                    return document.createElement('div');
                },
            },
            {
                name: 'SkS DoT Multi',
                fn: sksTickMulti,
                argExtractor: (args, gen) => {
                    return [gen.levelStats, args.sks]
                },
                makeResultsDisplay: () => {
                    return document.createElement('div');
                },
            },
        ],
        makeEditorArea: (settings: SksSettings) => {
            const baseGcd = new FieldBoundFloatField(settings, 'baseGcd', {postValidators: [positiveValuesOnly]});
            const sks = new FieldBoundIntField(settings, 'sks', {postValidators: [positiveValuesOnly]});
            const haste = new FieldBoundIntField(settings, 'haste', {postValidators: [clampValues(0, 99)]});
            return quickElement('div', [], [
                labeledInput('Base GCD', baseGcd),
                labeledInput('Skill Speed', sks),
                labeledInput('Haste', haste)]);
        },
        makeDefaultInputs: () => {
            return {
                baseGcd: 2.5,
                levelStats: getLevelStats(90),
                sks: getLevelStats(90).baseSubStat,
                haste: 0
            }
        },
    };
    registerFormula(sks);

    const sps: MathFormulaSet<SpsSettings> = {
        stub: 'sps',
        name: 'Spell Speed',
        functions: [
            {
                name: 'SpS to GCD',
                fn: spsToGcd,
                argExtractor: (args, gen) => {
                    return [args.baseGcd, gen.levelStats, args.sps, args.haste]
                },
                makeResultsDisplay: () => {
                    return document.createElement('div');
                },
            },
            {
                name: 'SpS DoT Multi',
                fn: spsTickMulti,
                argExtractor: (args, gen) => {
                    return [gen.levelStats, args.sps]
                },
                makeResultsDisplay: () => {
                    return document.createElement('div');
                },
            },
        ],
        makeEditorArea: (settings: SpsSettings) => {
            const baseGcd = new FieldBoundFloatField(settings, 'baseGcd', {postValidators: [positiveValuesOnly]});
            const sps = new FieldBoundIntField(settings, 'sps', {postValidators: [positiveValuesOnly]});
            const haste = new FieldBoundIntField(settings, 'haste', {postValidators: [clampValues(0, 99)]});
            return quickElement('div', [], [
                labeledInput('Base GCD', baseGcd),
                labeledInput('Spell Speed', sps),
                labeledInput('Haste', haste)]);
        },
        makeDefaultInputs: () => {
            return {
                baseGcd: 2.5,
                levelStats: getLevelStats(90),
                sps: getLevelStats(90).baseSubStat,
                haste: 0
            }
        },
    };
    registerFormula(sps);
}

registerFormulae();

export function openMath(formulaKey: string | null) {
    const mathArea = new MathArea();
    const formulaSet = regMap.get(formulaKey);
    mathArea.classList.add('formula-top-level');
    setMainContent('Math', mathArea);
    if (formulaSet) {
        mathArea.setFormulaSet(formulaSet);
    }
    else {
        mathArea.setFormulaSet(null);
    }
}

customElements.define('math-area', MathArea);