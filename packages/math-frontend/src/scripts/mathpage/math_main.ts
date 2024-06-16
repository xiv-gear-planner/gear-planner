import {JobName} from "@xivgear/xivmath/xivconstants";
import {LevelStats} from "@xivgear/xivmath/geartypes";
import {DisplayType} from "./math_ui";
import {PropertyOfType} from "@xivgear/core/util/types";

export type GeneralSettings = {
    classJob: JobName;
    levelStats: LevelStats;
    // TODO: this doesn't belong in here
    displayType: DisplayType;
}

export type Func = (...args: unknown[]) => unknown

/**
 * Represents a single, simple formula, e.g. crit stat to crit chance
 */
export type MathFormula<AllArgType, FuncType extends Func> = {
    name: string;
    fn: FuncType;
    argExtractor(arg: AllArgType, gen: GeneralSettings): Promise<Parameters<FuncType>>;
    // makeResultsDisplay: (result: ReturnType<FuncType>) => Element;
}


/**
 * Represents a set of related formulae, e.g. crit => crit chance, crit damage
 */
export type MathFormulaSet<AllArgType extends object> = {
    stub: string;
    name: string;
    functions: MathFormula<AllArgType, Func>[];
    makeDefaultInputs: (generalSettings: GeneralSettings) => AllArgType;
    // makeEditorArea: (args: AllArgType, updateCallback: () => void) => Element;
    variables: {
        type: 'number',
        label: string,
        property: PropertyOfType<AllArgType, number>,
        min?: (generalSettings: GeneralSettings) => number,
        max?: (generalSettings: GeneralSettings) => number,
        integer: boolean,
    }[]
    /**
     * The "primary" variable. If the user enters 100 for this, then the table should show values between
     * 100-x and 100+x for this.
     */
    primaryVariable: PropertyOfType<AllArgType, number>
}

export const registered: MathFormulaSet<object>[] = [];
export const regMap: Map<string, MathFormulaSet<object>> = new Map();

/**
 * Register a formulaSet
 *
 * @param formula The formulaSet to register. Must have a unique {@link MathFormulaSet.stub}.
 */
export function registerFormula<InputType extends object>(formula: MathFormulaSet<InputType>) {
    registered.push(formula as unknown as MathFormulaSet<object>);
    regMap.set(formula.stub, formula as unknown as MathFormulaSet<object>);
}

export type Result = {
    value: number
}

export type ResultSet = {
    [fnKey: string]: Result
}


export type FormulaSetInput<AllArgType extends object> = {
    inputs: AllArgType,
    inputsMax: AllArgType,
    generalSettings: GeneralSettings,
    isOriginalPrimary: boolean,
    results: ResultSet,
    isRange: boolean
}

