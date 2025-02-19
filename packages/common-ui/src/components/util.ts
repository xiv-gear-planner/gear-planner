export function makeActionButton(label: string | (Node | string)[], action: (ev: MouseEvent) => void, tooltip?: string) {
    const button = document.createElement("button");
    if (label instanceof Object) {
        button.replaceChildren(...label);
    }
    else {
        button.textContent = label;
    }
    button.addEventListener('click', ev => {
        ev.stopPropagation();
        action(ev);
    });
    if (tooltip !== undefined) {
        button.title = tooltip;
    }
    return button;
}

/**
 * Html 'option' element but carries a data element with it
 */
export class OptionDataElement<X> extends HTMLOptionElement {
    dataValue: X;

    constructor(dataValue: X) {
        super();
        this.dataValue = dataValue;
    }
}

export class DataSelect<X> extends HTMLSelectElement {
    constructor(items: X[], textGetter: (item: X) => string, callback: ((newValue: X) => void) | undefined, initialSelectedItem: typeof items[number] = undefined) {
        super();
        for (const item of items) {
            const opt = new OptionDataElement(item);
            opt.textContent = textGetter(item);
            this.options.add(opt);
            if (initialSelectedItem !== undefined && initialSelectedItem === item) {
                this.selectedIndex = this.options.length - 1;
            }
        }
        if (callback !== undefined) {
            this.addEventListener('change', (event) => {
                callback(this.selectedItem);
            });
        }
    }

    get selectedItem(): X {
        return (this.selectedOptions.item(0) as OptionDataElement<X>).dataValue;
    }

}

let idCounter = 1;

export function labelFor(label: string, labelFor: HTMLElement) {
    const element = document.createElement("label");
    element.textContent = label;
    if (!labelFor.id) {
        labelFor.id = 'lbl-id-' + idCounter++;
    }
    element.htmlFor = labelFor.id;
    return element;
}

export type BooleanListener = (value: boolean) => void;

export class FieldBoundCheckBox<ObjType> extends HTMLInputElement {

    reloadValue: () => void;
    listeners: (BooleanListener)[] = [];

    constructor(private obj: ObjType, private field: { [K in keyof ObjType]: ObjType[K] extends boolean ? K : never }[keyof ObjType], extraArgs: {
        id?: string
    } = {}) {
        super();
        this.type = 'checkbox';
        if (extraArgs.id) {
            this.id = extraArgs.id;
        }
        this.reloadValue = () => {
            // @ts-expect-error - not sure how to properly do this type def to assert that the field both produces *and* accepts booleans.
            this.checked = obj[field];
        };
        this.reloadValue();
        this.addEventListener('change', () => this.notifyListeners());
    }

    private notifyListeners() {
        const newValue: boolean = this.checked;
        // @ts-expect-error - not sure how to properly do this type def to assert that the field both produces *and* accepts booleans.
        this.obj[this.field] = newValue;
        for (const listener of this.listeners) {
            try {
                listener(newValue);
            }
            catch (e) {
                console.error("Error in listener", e);
            }
        }
    }

    addListener(listener: BooleanListener) {
        this.listeners.push(listener);
    }

    addAndRunListener(listener: BooleanListener) {
        this.listeners.push(listener);
        listener(this.checked);
    }

    get currentValue(): boolean {
        return this.checked;
    }

    set currentValue(value: boolean) {
        this.checked = value;
        this.notifyListeners();
    }
}

export interface ValidationContext<ObjType> {
    ignoreChange();

    failValidation(message: string);

    get obj(): ObjType;
}

export interface PreValidationContext<ObjType> extends ValidationContext<ObjType> {
    newRawValue: string;
}

export interface PostValidationContext<ObjType, FieldType> extends ValidationContext<ObjType> {
    newRawValue: string;
    newValue: FieldType;
}

export type FbctPreValidator<ObjType> = (context: PreValidationContext<ObjType>) => void;
export type FbctPostValidator<ObjType, FieldType> = (context: PostValidationContext<ObjType, FieldType>) => void;

export interface FbctArgs<ObjType, FieldType> {
    /**
     * Which event to hook. e.g. 'input' for when any input is entered (the default), or 'change'.
     */
    event?: keyof HTMLElementEventMap;
    /**
     * Validations to be run against the raw input string, before any conversion.
     *
     * Return undefined to indicate no validation error, or return a string containing a validation message.
     */
    preValidators?: FbctPreValidator<ObjType>[];
    /**
     * Validation to be run against the converted input string, before setting the field.
     *
     * Return undefined to indicate no validation error, or return a string containing a validation message.
     */
    postValidators?: FbctPostValidator<ObjType, FieldType>[];

    /**
     * HTML ID to assign to this element.
     */
    id?: string;
    /**
     * The HTML input type. You may wish to change this to 'number' if dealing with numerical fields.
     */
    type?: string;
    /**
     * The HTML input inputmode.
     */
    inputMode?: string;
}

export interface FieldBoundFloatFieldFbctArgs<ObjType, FieldType> extends FbctArgs<ObjType, FieldType> {
    /**
     * Optionally, how many decimal places to fix the float to. You can use 2 to make GCD speeds (i.e. 2.50)
     * show up as 2.50 instead of 2.5.
     */
    fixDecimals?: number;
}

export class FieldBoundConvertingTextField<ObjType, FieldType> extends HTMLInputElement {

    reloadValue: () => void;
    private listeners: ((value: FieldType) => void)[] = [];
    private __validationMessage: string | undefined;

    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends FieldType ? K : never }[keyof ObjType], valueToString: (value: FieldType) => string, stringToValue: (string: string) => (FieldType), extraArgs: FbctArgs<ObjType, FieldType> = {}) {
        super();
        if (extraArgs.id) {
            this.id = extraArgs.id;
        }
        this.type = extraArgs.type ?? 'text';
        if (extraArgs.inputMode) {
            this.inputMode = extraArgs.inputMode;
        }
        // @ts-expect-error - not sure how to do type def correctly
        this.reloadValue = () => this.value = valueToString(obj[field]);
        this.reloadValue();
        this.addEventListener('focusout', () => {
            if (this.__validationMessage) {
                // This will re-trigger the input event, BUT that's probably okay for now.
                this.reloadValue();
            }
        });
        const listener = () => {
            try {
                const newRawValue = this.value;
                let _stop = false;
                const fail = (msg) => {
                    _stop = true;
                    this._validationMessage = msg;
                };
                const stop = () => {
                    _stop = true;
                };
                if (extraArgs.preValidators) {
                    const context: PreValidationContext<ObjType> = {
                        get obj(): ObjType {
                            return obj;
                        },
                        newRawValue: newRawValue,
                        failValidation(message: string) {
                            fail(message);
                        },
                        ignoreChange() {
                            stop();
                        },
                    };
                    for (const preValidator of extraArgs.preValidators) {
                        preValidator(context);
                        if (_stop) {
                            return;
                        }
                    }
                }
                const newValue: FieldType = stringToValue(newRawValue);
                if (extraArgs.postValidators) {
                    const context: PostValidationContext<ObjType, FieldType> = {
                        newValue: newValue,
                        get obj(): ObjType {
                            return obj;
                        },
                        newRawValue: newRawValue,
                        failValidation(message: string) {
                            fail(message);
                        },
                        ignoreChange() {
                            stop();
                        },
                    };
                    for (const postValidator of extraArgs.postValidators) {
                        postValidator(context);
                        if (_stop) {
                            return;
                        }
                    }
                }
                // @ts-expect-error - not sure how to do type def correctly
                obj[field] = newValue;
                this._validationMessage = undefined;
                for (const listener of this.listeners) {
                    try {
                        listener(newValue);
                    }
                    catch (e) {
                        console.error("Error in listener", e);
                    }
                }
            }
            catch (e) {
                this._validationMessage = e.toString();
                return;
            }
        };
        this.addEventListener(extraArgs.event ?? 'input', listener);
    }

    addListener(listener: (value: FieldType) => void) {
        this.listeners.push(listener);
    }

    // get validationMessage() {
    //     if (this.__validationMessage === undefined) {
    //         return '';
    //     }
    //     else {
    //         return this.__validationMessage;
    //     }
    // }

    get _validationMessage() {
        return this.__validationMessage;
    }

    set _validationMessage(msg: string | undefined) {
        if (this.__validationMessage !== msg) {
            this.__validationMessage = msg;
            // TODO: can we instantly change validity message by setting it to empty then to the real message?
            // Doesn't seem to work
            this.setCustomValidity('');
            if (msg !== undefined) {
                this.setCustomValidity(msg);
            }
        }
        this.reportValidity();
    }
}

export class FieldBoundConvertingTextField2<ObjType, Field extends keyof ObjType> extends HTMLInputElement {

    reloadValue: () => void;
    listeners: ((value: ObjType[Field]) => void)[] = [];

    constructor(
        obj: ObjType,
        field: Field,
        valueToString: (value: ObjType[Field]) => string,
        stringToValue: (string: string) => (ObjType[Field]),
        extraArgs: FbctArgs<ObjType, ObjType[Field]> = {}
    ) {
        super();
        this.type = 'text';
        this.reloadValue = () => this.value = valueToString(obj[field]);
        this.reloadValue();
        this.addEventListener(extraArgs.event ?? 'input', () => {
            const newValue: ObjType[Field] = stringToValue(this.value);
            obj[field] = newValue;
            for (const listener of this.listeners) {
                try {
                    listener(newValue);
                }
                catch (e) {
                    console.error("Error in listener", e);
                }
            }
        });
    }

    addListener(listener: (value: ObjType[Field]) => void) {
        this.listeners.push(listener);
    }
}

const skipMinus = (ctx: PreValidationContext<never>) => {
    if (ctx.newRawValue === '-') {
        ctx.ignoreChange();
    }
};

// new FieldBoundConvertingTextField(new CharacterGearSet(null), 'food', food => food.toString(), str => new XivApiFoodInfo({}));
export class FieldBoundIntField<ObjType> extends FieldBoundConvertingTextField<ObjType, number> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, number> = {}) {
        const intValidator = (ctx) => {
            if (ctx.newValue % 1 !== 0) {
                ctx.failValidation('Value must be an integer');
            }
        };
        extraArgs.preValidators = [skipMinus, ...(extraArgs.preValidators ?? [])];
        extraArgs.postValidators = [intValidator, ...(extraArgs.postValidators ?? [])];
        // Spinner arrows aren't styleable. Love CSS!
        // extraArgs.type = extraArgs.type ?? 'number';
        // extraArgs.inputMode = extraArgs.inputMode ?? 'numeric';
        super(obj, field, (s) => s.toString(), (s) => Number(s), extraArgs);
        if (this.type === 'numeric') {
            if (!this.step) {
                this.step = '1';
            }
        }
    }
}

export class FieldBoundOrUndefIntField<ObjType> extends FieldBoundConvertingTextField<ObjType, number | undefined> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends (number | undefined) ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, number | undefined> = {}) {
        const intValidator = (ctx) => {
            if (ctx.newValue !== undefined && ctx.newValue % 1 !== 0) {
                ctx.failValidation('Value must be an integer');
            }
        };
        extraArgs.preValidators = [skipMinus, ...(extraArgs.preValidators ?? [])];
        extraArgs.postValidators = [intValidator, ...(extraArgs.postValidators ?? [])];
        // Spinner arrows aren't styleable. Love CSS!
        // extraArgs.type = extraArgs.type ?? 'number';
        // extraArgs.inputMode = extraArgs.inputMode ?? 'numeric';
        super(obj, field, (s) => s === undefined ? "" : s.toString(), (s) => s.trim() === "" ? undefined : Number(s), extraArgs);
        if (this.type === 'numeric') {
            if (!this.step) {
                this.step = '1';
            }
        }
    }
}

export class FieldBoundFloatField<ObjType> extends FieldBoundConvertingTextField<ObjType, number> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], extraArgs: FieldBoundFloatFieldFbctArgs<ObjType, number> = {}) {
        const numberValidator = (ctx) => {
            // filter out NaNs and other garbage values
            // noinspection PointlessArithmeticExpressionJS
            if (ctx.newValue * 0 !== 0) {
                ctx.failValidation('Value must be a number');
            }
        };
        extraArgs.preValidators = [skipMinus, ...(extraArgs.preValidators ?? [])];
        extraArgs.postValidators = [numberValidator, ...(extraArgs.postValidators ?? [])];
        // Spinner arrows aren't styleable. Love CSS!
        // extraArgs.type = extraArgs.type ?? 'number';
        // extraArgs.inputMode = extraArgs.inputMode ?? 'numeric';
        const toStringFunc = extraArgs.fixDecimals ? (x: number) => x.toFixed(extraArgs.fixDecimals) : (x: number) => x.toString();
        super(obj, field, (s) => toStringFunc(s), (s) => Number(s), extraArgs);
    }
}

export const nonNegative = (ctx: PostValidationContext<never, number>) => {
    if (ctx.newValue < 0) {
        ctx.failValidation("Value cannot be negative");
    }
};

export function clampValues(min: number | undefined, max: number | undefined): (ctx: PostValidationContext<never, number>) => void {
    return (ctx: PostValidationContext<never, number>) => {
        if (min !== undefined && max !== undefined) {
            if (ctx.newValue < min || ctx.newValue > max) {
                ctx.failValidation(`Value must be between ${min} and ${max}`);
            }
        }
        else if (min !== undefined) {
            if (ctx.newValue < min) {
                ctx.failValidation(`Value must be great than or equal to ${min}`);
            }
        }
        else if (max !== undefined) {
            if (ctx.newValue > max) {
                ctx.failValidation(`Value must be less than or equal to ${max}`);
            }
        }
    };
}

export class FieldBoundTextField<ObjType> extends FieldBoundConvertingTextField<ObjType, string> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends string ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, string> = {}) {
        super(obj, field, (s) => s, (s) => s, extraArgs);
    }
}

// export class FieldBoundTextField2<ObjType, Field extends keyof ObjType> extends FieldBoundConvertingTextField2<ObjType, Field> {
//     constructor(obj: ObjType, field: Field, extraArgs: FbctArgs = {}) {
//         super(obj, field, (s) => s, (s) => s, extraArgs);
//     }
// }
export class FieldBoundDataSelect<ObjType, DataType> extends DataSelect<DataType> {

    reloadValue: () => void;
    listeners: ((value: DataType) => void)[] = [];

    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends DataType ? K : never }[keyof ObjType], valueDisplayName: (value: DataType) => string, options: DataType[]) {
        const initialValue: DataType = obj[field] as DataType;
        // Give it something to display
        if (!options.includes(initialValue)) {
            options = [initialValue, ...options];
        }
        super(options, valueDisplayName, value => {
            // @ts-expect-error - not sure how to do type def
            obj[field] = value;
            this.listeners.forEach(listener => listener(value));
        }, obj[field] as DataType);
    }

    addListener(listener: (value: DataType) => void) {
        this.listeners.push(listener);
    }
}

export function labeledComponent(label: string, check: HTMLElement): HTMLDivElement {
    const labelElement = labelFor(label, check);
    const div = document.createElement("div");
    div.appendChild(check);
    div.appendChild(labelElement);
    div.classList.add("labeled-component");
    return div;
}

export function labeledCheckbox(label: string, check: HTMLInputElement): HTMLDivElement {
    const labelElement = labelFor(label, check);
    const div = document.createElement("div");
    div.appendChild(check);
    div.appendChild(labelElement);
    div.classList.add("labeled-checkbox");
    return div;
}

export function labeledRadioButton(label: string, radioButton: HTMLInputElement): HTMLDivElement {
    const labelElement = labelFor(label, radioButton);
    const div = document.createElement("div");
    div.appendChild(radioButton);
    div.appendChild(labelElement);
    div.classList.add("labeled-radio-button");
    return div;
}

export function quickElement<X extends keyof HTMLElementTagNameMap>(tag: X, classes: string[], nodes: Parameters<ParentNode['replaceChildren']>): HTMLElementTagNameMap[X] {
    const element = document.createElement(tag);
    element.replaceChildren(...nodes);
    element.classList.add(...classes);
    return element;
}

function makePath(pathD: string) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
    path.setAttribute('d', pathD);
    return path;
}

function makeSvgGlyph(viewbox: string, ...paths: string[]) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    for (const pathD of paths) {
        const path = makePath(pathD);
        svg.appendChild(path);
    }
    svg.classList.add('svg-glyph');
    svg.setAttribute("viewBox", viewbox);
    return svg;
}

export function faIcon(faIconName: string, faType: string = 'fa-regular') {

    switch (faIconName) {
        case 'fa-plus':
            return makeSvgGlyph("0 0 448 512", "M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z");
        case 'fa-trash-can':
            return makeTrashIcon();
        case 'fa-arrow-up-right-from-square':
            return makeSvgGlyph("0 0 512 512", "M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h82.7L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3V192c0 17.7 14.3 32 32 32s32-14.3 32-32V32c0-17.7-14.3-32-32-32H320zM80 32C35.8 32 0 67.8 0 112V432c0 44.2 35.8 80 80 80H400c44.2 0 80-35.8 80-80V320c0-17.7-14.3-32-32-32s-32 14.3-32 32V432c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16H192c17.7 0 32-14.3 32-32s-14.3-32-32-32H80z");
        case 'fa-copy':
            return makeSvgGlyph("0 0 448 512", "M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L400 115.9V320c0 8.8-7.2 16-16 16zM192 384H384c35.3 0 64-28.7 64-64V115.9c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1H192c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H256c35.3 0 64-28.7 64-64V416H272v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16H96V128H64z");
    }
    const element = document.createElement('i');
    element.classList.add(faType, faIconName);
    return element;
}

export function makeTrashIcon() {
    return makeSvgGlyph("0 0 448 512", "M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z");
}

export function makeCloseButton() {
    return makeSvgGlyph("0 0 384 512", "M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z");
}

export function makeChevronDown() {
    return makeSvgGlyph("0 0 512 512", "M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z");
}

// from https://www.svgrepo.com/svg/446141/warning
export function warningIcon() {
    const svg = makeSvgGlyph(
        "0 0 48 48",
        "M24,9,40.6,39H7.5L24,9M2.3,40A2,2,0,0,0,4,43H44a2,2,0,0,0,1.7-3L25.7,4a2,2,0,0,0-3.4,0Z",
        "M22,19v9a2,2,0,0,0,4,0V19a2,2,0,0,0-4,0Z");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
    circle.setAttribute('cx', "24");
    circle.setAttribute('cy', "34");
    circle.setAttribute('r', "2");
    svg.appendChild(circle);
    return svg;
}

// from https://www.svgrepo.com/svg/446033/stop-warning
export function errorIcon() {
    return makeSvgGlyph(
        "0 0 48 48",
        "M43.4,15.1,32.9,4.6A2,2,0,0,0,31.5,4h-15a2,2,0,0,0-1.4.6L4.6,15.1A2,2,0,0,0,4,16.5v15a2,2,0,0,0,.6,1.4L15.1,43.4a2,2,0,0,0,1.4.6h15a2,2,0,0,0,1.4-.6L43.4,32.9a2,2,0,0,0,.6-1.4v-15A2,2,0,0,0,43.4,15.1ZM40,30.6,30.6,40H17.4L8,30.6V17.4L17.4,8H30.6L40,17.4Z",
        "M26.8,24l5.6-5.6a2,2,0,0,0-2.8-2.8L24,21.2l-5.6-5.6a2,2,0,0,0-2.8,2.8L21.2,24l-5.6,5.6a1.9,1.9,0,0,0,0,2.8,1.9,1.9,0,0,0,2.8,0L24,26.8l5.6,5.6a1.9,1.9,0,0,0,2.8,0,1.9,1.9,0,0,0,0-2.8Z");
}

export function githubIcon() {
    return makeSvgGlyph("0 0 96 96",
        "M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z");
}

export function settingsIcon() {
    return makeSvgGlyph("0 0 24 24",
        "M10.7673 1.01709C10.9925 0.999829 11.2454 0.99993 11.4516 1.00001L12.5484 1.00001C12.7546 0.99993 13.0075 0.999829 13.2327 1.01709C13.4989 1.03749 13.8678 1.08936 14.2634 1.26937C14.7635 1.49689 15.1915 1.85736 15.5007 2.31147C15.7454 2.67075 15.8592 3.0255 15.9246 3.2843C15.9799 3.50334 16.0228 3.75249 16.0577 3.9557L16.1993 4.77635L16.2021 4.77788C16.2369 4.79712 16.2715 4.81659 16.306 4.8363L16.3086 4.83774L17.2455 4.49865C17.4356 4.42978 17.6693 4.34509 17.8835 4.28543C18.1371 4.2148 18.4954 4.13889 18.9216 4.17026C19.4614 4.20998 19.9803 4.39497 20.4235 4.70563C20.7734 4.95095 21.0029 5.23636 21.1546 5.4515C21.2829 5.63326 21.4103 5.84671 21.514 6.02029L22.0158 6.86003C22.1256 7.04345 22.2594 7.26713 22.3627 7.47527C22.4843 7.7203 22.6328 8.07474 22.6777 8.52067C22.7341 9.08222 22.6311 9.64831 22.3803 10.1539C22.1811 10.5554 21.9171 10.8347 21.7169 11.0212C21.5469 11.1795 21.3428 11.3417 21.1755 11.4746L20.5 12L21.1755 12.5254C21.3428 12.6584 21.5469 12.8205 21.7169 12.9789C21.9171 13.1653 22.1811 13.4446 22.3802 13.8461C22.631 14.3517 22.7341 14.9178 22.6776 15.4794C22.6328 15.9253 22.4842 16.2797 22.3626 16.5248C22.2593 16.7329 22.1255 16.9566 22.0158 17.14L21.5138 17.9799C21.4102 18.1535 21.2828 18.3668 21.1546 18.5485C21.0028 18.7637 20.7734 19.0491 20.4234 19.2944C19.9803 19.6051 19.4613 19.7901 18.9216 19.8298C18.4954 19.8612 18.1371 19.7852 17.8835 19.7146C17.6692 19.6549 17.4355 19.5703 17.2454 19.5014L16.3085 19.1623L16.306 19.1638C16.2715 19.1835 16.2369 19.2029 16.2021 19.2222L16.1993 19.2237L16.0577 20.0443C16.0228 20.2475 15.9799 20.4967 15.9246 20.7157C15.8592 20.9745 15.7454 21.3293 15.5007 21.6886C15.1915 22.1427 14.7635 22.5032 14.2634 22.7307C13.8678 22.9107 13.4989 22.9626 13.2327 22.983C13.0074 23.0002 12.7546 23.0001 12.5484 23H11.4516C11.2454 23.0001 10.9925 23.0002 10.7673 22.983C10.5011 22.9626 10.1322 22.9107 9.73655 22.7307C9.23648 22.5032 8.80849 22.1427 8.49926 21.6886C8.25461 21.3293 8.14077 20.9745 8.07542 20.7157C8.02011 20.4967 7.97723 20.2475 7.94225 20.0443L7.80068 19.2237L7.79791 19.2222C7.7631 19.2029 7.72845 19.1835 7.69396 19.1637L7.69142 19.1623L6.75458 19.5014C6.5645 19.5702 6.33078 19.6549 6.11651 19.7146C5.86288 19.7852 5.50463 19.8611 5.07841 19.8298C4.53866 19.7901 4.01971 19.6051 3.57654 19.2944C3.2266 19.0491 2.99714 18.7637 2.84539 18.5485C2.71718 18.3668 2.58974 18.1534 2.4861 17.9798L1.98418 17.14C1.87447 16.9566 1.74067 16.7329 1.63737 16.5248C1.51575 16.2797 1.36719 15.9253 1.32235 15.4794C1.26588 14.9178 1.36897 14.3517 1.61976 13.8461C1.81892 13.4446 2.08289 13.1653 2.28308 12.9789C2.45312 12.8205 2.65717 12.6584 2.82449 12.5254L3.47844 12.0054V11.9947L2.82445 11.4746C2.65712 11.3417 2.45308 11.1795 2.28304 11.0212C2.08285 10.8347 1.81888 10.5554 1.61972 10.1539C1.36893 9.64832 1.26584 9.08224 1.3223 8.52069C1.36714 8.07476 1.51571 7.72032 1.63732 7.47528C1.74062 7.26715 1.87443 7.04347 1.98414 6.86005L2.48605 6.02026C2.58969 5.84669 2.71714 5.63326 2.84534 5.45151C2.9971 5.23637 3.22655 4.95096 3.5765 4.70565C4.01966 4.39498 4.53862 4.20999 5.07837 4.17027C5.50458 4.1389 5.86284 4.21481 6.11646 4.28544C6.33072 4.34511 6.56444 4.4298 6.75451 4.49867L7.69141 4.83775L7.69394 4.8363C7.72844 4.8166 7.7631 4.79712 7.79791 4.77788L7.80068 4.77635L7.94225 3.95571C7.97723 3.7525 8.02011 3.50334 8.07542 3.2843C8.14077 3.0255 8.25461 2.67075 8.49926 2.31147C8.80849 1.85736 9.23648 1.49689 9.73655 1.26937C10.1322 1.08936 10.5011 1.03749 10.7673 1.01709ZM14.0938 4.3363C14.011 3.85634 13.9696 3.61637 13.8476 3.43717C13.7445 3.2858 13.6019 3.16564 13.4352 3.0898C13.2378 3.00002 12.9943 3.00002 12.5073 3.00002H11.4927C11.0057 3.00002 10.7621 3.00002 10.5648 3.0898C10.3981 3.16564 10.2555 3.2858 10.1524 3.43717C10.0304 3.61637 9.98895 3.85634 9.90615 4.3363L9.75012 5.24064C9.69445 5.56333 9.66662 5.72467 9.60765 5.84869C9.54975 5.97047 9.50241 6.03703 9.40636 6.13166C9.30853 6.22804 9.12753 6.3281 8.76554 6.52822C8.73884 6.54298 8.71227 6.55791 8.68582 6.57302C8.33956 6.77078 8.16643 6.86966 8.03785 6.90314C7.91158 6.93602 7.83293 6.94279 7.70289 6.93196C7.57049 6.92094 7.42216 6.86726 7.12551 6.7599L6.11194 6.39308C5.66271 6.2305 5.43809 6.14921 5.22515 6.16488C5.04524 6.17811 4.87225 6.23978 4.72453 6.34333C4.5497 6.46589 4.42715 6.67094 4.18206 7.08103L3.72269 7.84965C3.46394 8.2826 3.33456 8.49907 3.31227 8.72078C3.29345 8.90796 3.32781 9.09665 3.41141 9.26519C3.51042 9.4648 3.7078 9.62177 4.10256 9.9357L4.82745 10.5122C5.07927 10.7124 5.20518 10.8126 5.28411 10.9199C5.36944 11.036 5.40583 11.1114 5.44354 11.2504C5.47844 11.379 5.47844 11.586 5.47844 12C5.47844 12.414 5.47844 12.621 5.44354 12.7497C5.40582 12.8887 5.36944 12.9641 5.28413 13.0801C5.20518 13.1875 5.07927 13.2876 4.82743 13.4879L4.10261 14.0643C3.70785 14.3783 3.51047 14.5352 3.41145 14.7349C3.32785 14.9034 3.29349 15.0921 3.31231 15.2793C3.33461 15.501 3.46398 15.7174 3.72273 16.1504L4.1821 16.919C4.4272 17.3291 4.54974 17.5342 4.72457 17.6567C4.8723 17.7603 5.04528 17.8219 5.2252 17.8352C5.43813 17.8508 5.66275 17.7695 6.11199 17.607L7.12553 17.2402C7.42216 17.1328 7.5705 17.0791 7.7029 17.0681C7.83294 17.0573 7.91159 17.064 8.03786 17.0969C8.16644 17.1304 8.33956 17.2293 8.68582 17.427C8.71228 17.4421 8.73885 17.4571 8.76554 17.4718C9.12753 17.6719 9.30853 17.772 9.40635 17.8684C9.50241 17.963 9.54975 18.0296 9.60765 18.1514C9.66662 18.2754 9.69445 18.4367 9.75012 18.7594L9.90615 19.6637C9.98895 20.1437 10.0304 20.3837 10.1524 20.5629C10.2555 20.7142 10.3981 20.8344 10.5648 20.9102C10.7621 21 11.0057 21 11.4927 21H12.5073C12.9943 21 13.2378 21 13.4352 20.9102C13.6019 20.8344 13.7445 20.7142 13.8476 20.5629C13.9696 20.3837 14.011 20.1437 14.0938 19.6637L14.2499 18.7594C14.3055 18.4367 14.3334 18.2754 14.3923 18.1514C14.4502 18.0296 14.4976 17.963 14.5936 17.8684C14.6915 17.772 14.8725 17.6719 15.2344 17.4718C15.2611 17.4571 15.2877 17.4421 15.3141 17.427C15.6604 17.2293 15.8335 17.1304 15.9621 17.0969C16.0884 17.064 16.167 17.0573 16.2971 17.0681C16.4295 17.0791 16.5778 17.1328 16.8744 17.2402L17.888 17.607C18.3372 17.7696 18.5619 17.8509 18.7748 17.8352C18.9547 17.8219 19.1277 17.7603 19.2754 17.6567C19.4502 17.5342 19.5728 17.3291 19.8179 16.919L20.2773 16.1504C20.536 15.7175 20.6654 15.501 20.6877 15.2793C20.7065 15.0921 20.6721 14.9034 20.5885 14.7349C20.4895 14.5353 20.2921 14.3783 19.8974 14.0643L19.1726 13.4879C18.9207 13.2876 18.7948 13.1875 18.7159 13.0801C18.6306 12.9641 18.5942 12.8887 18.5564 12.7497C18.5215 12.6211 18.5215 12.414 18.5215 12C18.5215 11.586 18.5215 11.379 18.5564 11.2504C18.5942 11.1114 18.6306 11.036 18.7159 10.9199C18.7948 10.8126 18.9207 10.7124 19.1725 10.5122L19.8974 9.9357C20.2922 9.62176 20.4896 9.46479 20.5886 9.26517C20.6722 9.09664 20.7065 8.90795 20.6877 8.72076C20.6654 8.49906 20.5361 8.28259 20.2773 7.84964L19.8179 7.08102C19.5728 6.67093 19.4503 6.46588 19.2755 6.34332C19.1277 6.23977 18.9548 6.1781 18.7748 6.16486C18.5619 6.14919 18.3373 6.23048 17.888 6.39307L16.8745 6.75989C16.5778 6.86725 16.4295 6.92093 16.2971 6.93195C16.167 6.94278 16.0884 6.93601 15.9621 6.90313C15.8335 6.86965 15.6604 6.77077 15.3142 6.57302C15.2877 6.55791 15.2611 6.54298 15.2345 6.52822C14.8725 6.3281 14.6915 6.22804 14.5936 6.13166C14.4976 6.03703 14.4502 5.97047 14.3923 5.84869C14.3334 5.72467 14.3055 5.56332 14.2499 5.24064L14.0938 4.3363Z",
        "M12 8.00002C9.79085 8.00002 7.99999 9.79088 7.99999 12C7.99999 14.2092 9.79085 16 12 16C14.2091 16 16 14.2092 16 12C16 9.79088 14.2091 8.00002 12 8.00002ZM9.99999 12C9.99999 10.8955 10.8954 10 12 10C13.1046 10 14 10.8955 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 9.99999 13.1046 9.99999 12Z"
    );
    // return makeSvgGlyph("0 0 512 512",
    //     "M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z");
}

export function makeCalcIcon() {
    // <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H64zM96 64H288c17.7 0 32 14.3 32 32v32c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32zm32 160a32 32 0 1 1 -64 0 32 32 0 1 1 64 0zM96 352a32 32 0 1 1 0-64 32 32 0 1 1 0 64zM64 416c0-17.7 14.3-32 32-32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32zM192 256a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm32 64a32 32 0 1 1 -64 0 32 32 0 1 1 64 0zm64-64a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm32 64a32 32 0 1 1 -64 0 32 32 0 1 1 64 0zM288 448a32 32 0 1 1 0-64 32 32 0 1 1 0 64z"/></svg>
    //
    // return makeSvgGlyph("0 0 384 512",
    //     "M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H64zM96 64H288c17.7 0 32 14.3 32 32v32c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32zm32 160a32 32 0 1 1 -64 0 32 32 0 1 1 64 0zM96 352a32 32 0 1 1 0-64 32 32 0 1 1 0 64zM64 416c0-17.7 14.3-32 32-32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32zM192 256a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm32 64a32 32 0 1 1 -64 0 32 32 0 1 1 64 0zm64-64a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm32 64a32 32 0 1 1 -64 0 32 32 0 1 1 64 0zM288 448a32 32 0 1 1 0-64 32 32 0 1 1 0 64z");
    // <svg width="64px" height="64px" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M4 4.5H11M4 8.5H5M7 8.5H8M10 8.5H11M4 11.5H5M7 11.5H8M10 11.5H11M2.5 14.5H12.5C13.0523 14.5 13.5 14.0523 13.5 13.5V1.5C13.5 0.947715 13.0523 0.5 12.5 0.5H2.5C1.94772 0.5 1.5 0.947716 1.5 1.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5Z" stroke="#000000"></path> </g></svg>
    const svg = makeSvgGlyph("0 0 15 15",
        "M4 4.5H11M4 8.5H5M7 8.5H8M10 8.5H11M4 11.5H5M7 11.5H8M10 11.5H11M2.5 14.5H12.5C13.0523 14.5 13.5 14.0523 13.5 13.5V1.5C13.5 0.947715 13.0523 0.5 12.5 0.5H2.5C1.94772 0.5 1.5 0.947716 1.5 1.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5Z");
    svg.classList.add('svg-line');
    return svg;
}

export function makeDollarIcon() {
    const svg = makeSvgGlyph("-1 0 26 24",
        "M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z");
    svg.classList.add('svg-line');
    svg.classList.add('svg-bigger');
    return svg;
    // return makeSvgGlyph("0 0 48 48",
    //     "M26,21.9V10.5a15.4,15.4,0,0,1,5.2,2.1,2.2,2.2,0,0,0,3.1-.7A1.8,1.8,0,0,0,33.9,9,17.1,17.1,0,0,0,26,6.2V4a2,2,0,0,0-4,0V6c-6.3.5-10.8,4.4-10.8,9.7h0c0,6,4.3,8.4,10.8,10V37.6a16.7,16.7,0,0,1-7.3-3.1,2,2,0,0,0-3,.4c-1,1.3-.9,2.3.1,3A19.8,19.8,0,0,0,22,41.8V44a2,2,0,0,0,4,0V41.9c6.5-.5,11-4.4,11-10h0C37,26.7,33.7,23.7,26,21.9ZM16,15.5h0c0-2.8,2.4-4.8,6-5.1V21C17,19.6,16,17.9,16,15.5ZM32.2,32.3c0,2.9-2.5,5-6.2,5.4v-11c5.1,1.4,6.2,3.1,6.2,5.5Z"
    //     )
}

export function makePatreonIcon() {
    const svg = makeSvgGlyph("-10 -10 276 276",
        "M45.1355837,0 L45.1355837,246.35001 L0,246.35001 L0,0 L45.1355837,0 Z M163.657111,0 C214.65668,0 256,41.3433196 256,92.3428889 C256,143.342458 214.65668,184.685778 163.657111,184.685778 C112.657542,184.685778 71.3142222,143.342458 71.3142222,92.3428889 C71.3142222,41.3433196 112.657542,0 163.657111,0 Z");
    svg.classList.add('svg-line');
    svg.style.strokeWidth = '15px';
    return svg;
}

export function mySheetsIcon() {
    return makeSvgGlyph("0 0 192 192",
        "m80 38 4.243-4.243A6 6 0 0 0 80 32v6Zm16 16-4.243 4.243A6 6 0 0 0 96 60v-6Zm58 94H38v12h116v-12ZM28 138V54H16v84h12Zm10-94h42V32H38v12Zm37.757-1.757 16 16 8.486-8.486-16-16-8.486 8.486ZM164 70v68h12V70h-12ZM96 60h58V48H96v12Zm-58 88c-5.523 0-10-4.477-10-10H16c0 12.15 9.85 22 22 22v-12Zm116 12c12.15 0 22-9.85 22-22h-12c0 5.523-4.477 10-10 10v12Zm22-90c0-12.15-9.85-22-22-22v12c5.523 0 10 4.477 10 10h12ZM28 54c0-5.523 4.477-10 10-10V32c-12.15 0-22 9.85-22 22h12Z");
}

export function newSheetIcon() {
    return makeSvgGlyph("0 0 24 24",
        "M18,24H0V6h6v2H2v14h14v-4H6V0h18v18h-6V24z M8,16h14V2H8V16z M16,13h-2v-3h-3V8h3V5h2v3h3v2h-3V13z");
}

export function importIcon() {
    const svg = makeSvgGlyph("0 0 24 24");
    svg.innerHTML = "<g id=\"SVGRepo_bgCarrier\" stroke-width=\"0\"></g><g id=\"SVGRepo_tracerCarrier\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></g><g id=\"SVGRepo_iconCarrier\"><polyline id=\"primary\" points=\"15 13 11 13 11 9\" style=\"fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;\"></polyline><line id=\"primary-2\" data-name=\"primary\" x1=\"21\" y1=\"3\" x2=\"11\" y2=\"13\" style=\"fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;\"></line><path id=\"primary-3\" data-name=\"primary\" d=\"M19,13.89V20a1,1,0,0,1-1,1H4a1,1,0,0,1-1-1V6A1,1,0,0,1,4,5h6.11\" style=\"fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;\"></path></g>";
    svg.classList.add('svg-line');
    return svg;
    // <svg fill="#000000" viewBox="0 0 24 24" id="import-left" data-name="Flat Line" xmlns="http://www.w3.org/2000/svg" class="icon flat-line"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><polyline id="primary" points="15 13 11 13 11 9" style="fill: none; stroke: #000000; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline><line id="primary-2" data-name="primary" x1="21" y1="3" x2="11" y2="13" style="fill: none; stroke: #000000; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></line><path id="primary-3" data-name="primary" d="M19,13.89V20a1,1,0,0,1-1,1H4a1,1,0,0,1-1-1V6A1,1,0,0,1,4,5h6.11" style="fill: none; stroke: #000000; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path></g></svg>
    // return makeSvgGlyph("0 0 24 24",
    //     "M19,13.89V20a1,1,0,0,1-1,1H4a1,1,0,0,1-1-1V6A1,1,0,0,1,4,5h6.11")
}

export function discordIcon() {
    const svg = makeSvgGlyph('0 0 127.14 96.36',
        "M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
    );
    return svg;
}

export function undoIcon() {
    const svg = makeSvgGlyph("0 0 24 24", "M10 8H5V3M5.29102 16.3569C6.22284 17.7918 7.59014 18.8902 9.19218 19.4907C10.7942 20.0913 12.547 20.1624 14.1925 19.6937C15.8379 19.225 17.2893 18.2413 18.3344 16.8867C19.3795 15.5321 19.963 13.878 19.9989 12.1675C20.0347 10.4569 19.5211 8.78001 18.5337 7.38281C17.5462 5.98561 16.1366 4.942 14.5122 4.40479C12.8878 3.86757 11.1341 3.86499 9.5083 4.39795C7.88252 4.93091 6.47059 5.97095 5.47949 7.36556");
    svg.classList.add('svg-line');
    return svg;
}

export function redoIcon() {
    const svg = makeSvgGlyph("0 0 24 24", "M10 8H5V3M5.29102 16.3569C6.22284 17.7918 7.59014 18.8902 9.19218 19.4907C10.7942 20.0913 12.547 20.1624 14.1925 19.6937C15.8379 19.225 17.2893 18.2413 18.3344 16.8867C19.3795 15.5321 19.963 13.878 19.9989 12.1675C20.0347 10.4569 19.5211 8.78001 18.5337 7.38281C17.5462 5.98561 16.1366 4.942 14.5122 4.40479C12.8878 3.86757 11.1341 3.86499 9.5083 4.39795C7.88252 4.93091 6.47059 5.97095 5.47949 7.36556");
    svg.style.transform = 'scaleX(-1)';
    svg.classList.add('svg-line');
    return svg;
}

customElements.define("option-data-element", OptionDataElement, {extends: "option"});
customElements.define("data-select", DataSelect, {extends: "select"});
customElements.define("field-bound-converting-text-field", FieldBoundConvertingTextField, {extends: "input"});
customElements.define("field-bound-text-field", FieldBoundTextField, {extends: "input"});
customElements.define("field-bound-float-field", FieldBoundFloatField, {extends: "input"});
customElements.define("field-bound-int-or-undef-field", FieldBoundOrUndefIntField, {extends: "input"});
customElements.define("field-bound-int-field", FieldBoundIntField, {extends: "input"});
customElements.define("field-bound-checkbox", FieldBoundCheckBox, {extends: "input"});
customElements.define("field-bound-data-select", FieldBoundDataSelect, {extends: "select"});
