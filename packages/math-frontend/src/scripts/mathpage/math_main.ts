import {sksTickMulti, sksToGcd, spsTickMulti, spsToGcd} from "@xivgear/xivmath/xivmath";
import {getLevelStats, JobName} from "@xivgear/xivmath/xivconstants";
import {LevelStats} from "@xivgear/xivmath/geartypes";

export type GeneralSettings = {
    classJob: JobName;
    levelStats: LevelStats;
}

export type Func = (...args: unknown[]) => unknown

/**
 * Represents a single, simple formula, e.g. crit stat to crit chance
 */
export type MathFormula<AllArgType, FuncType extends Func> = {
    name: string;
    fn: FuncType;
    argExtractor: (arg: AllArgType, gen: GeneralSettings) => Parameters<FuncType>;
    // makeResultsDisplay: (result: ReturnType<FuncType>) => Element;
}

export type PropertyOfType<ObjectType, PropType> = {
    [K in keyof ObjectType]: ObjectType[K] extends PropType ? K : never;
}[keyof ObjectType] & string


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
        min?: number,
        max?: number,
        integer: boolean
    }[]
    /**
     * The "primary" variable. If the user enters 100 for this, then the table should show values between
     * 100-x and 100+x for this.
     */
    primaryVariable: PropertyOfType<AllArgType, number>
}

export const registered: MathFormulaSet<object>[] = [];
export const regMap: Map<string, MathFormulaSet<object>> = new Map();

// I don't know how to fix this. The addition of the `primaryVariable` property causes this to break.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerFormula<InputType extends object>(formula: MathFormulaSet<InputType>) {
    registered.push(formula as unknown as MathFormulaSet<object>);
    regMap.set(formula.stub, formula as unknown as MathFormulaSet<object>);
}

export type FormulaSetInput<AllArgType extends object> = {
    inputs: AllArgType,
    generalSettings: GeneralSettings,
    isOriginalPrimary: boolean
}

