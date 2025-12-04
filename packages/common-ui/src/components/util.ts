export function makeActionButton(label: string | (Node | string)[], action: (ev: MouseEvent) => void, tooltip?: string) {
    const button = el("button");
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
    // By default, will not submit forms.
    button.type = 'button';
    return button;
}

/**
 * Create a button that performs an async action. Changes its appearance and disables clicking while the action is in
 * progress.
 *
 * @param label
 * @param action
 * @param tooltip
 */
export function makeAsyncActionButton(label: string | (Node | string)[], action: (ev: MouseEvent) => Promise<void>, tooltip?: string) {
    const button = el('button', {class: 'async-action-button'});
    const loadingBlocker = el('div', {class: 'loading-pane'}, ['...']);
    if (typeof label === 'string') {
        button.replaceChildren(label, loadingBlocker);
    }
    else {
        button.replaceChildren(...label, loadingBlocker);
    }
    button.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        button.classList.add('in-progress');
        button.disabled = true;
        try {
            await action(ev);
        }
        finally {
            button.classList.remove('in-progress');
            button.disabled = false;
        }
    });
    if (tooltip !== undefined) {
        button.title = tooltip;
    }
    // By default, will not submit forms.
    button.type = 'button';
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
    constructor(items: X[], textGetter: (item: X) => string, callback: ((newValue: X) => void) | undefined, initialSelectedItem: (typeof items[number] | undefined) = undefined) {
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

export function randomId(prefix: string = 'unique-id-'): string {
    return prefix + (idCounter++);
}

export function labelFor(label: string | Node, labelFor: HTMLElement) {
    const element = quickElement('label', [], [label]);
    if (!labelFor.id) {
        labelFor.id = randomId('lbl-id-');
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
    ignoreChange(): void;

    failValidation(message: string): void;

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
     * The HTML input inputmode. Common values include 'decimal', 'email', 'none', 'numeric', 'search', 'tel', 'text',
     * and 'url'.
     */
    inputMode?: string;
    /**
     * Sets the pattern attribute
     */
    pattern?: string;
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
        if (extraArgs.pattern) {
            this.pattern = extraArgs.pattern;
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
                const fail = (msg: string) => {
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
                this._validationMessage = String(e);
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

/**
 * Simple pre-validator that causes it to not complain about validation if you enter a single '-', since you are
 * presumably going to type the rest of the number after that.
 *
 * @param ctx
 */
const skipMinus = (ctx: PreValidationContext<unknown>) => {
    if (ctx.newRawValue === '-') {
        ctx.ignoreChange();
    }
};


export class FieldBoundIntField<ObjType> extends FieldBoundConvertingTextField<ObjType, number> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, number> = {}) {
        const intValidator: Exclude<typeof extraArgs.postValidators, undefined>[number] = (ctx) => {
            if (ctx.newValue % 1 !== 0) {
                ctx.failValidation('Value must be an integer');
            }
        };
        extraArgs.preValidators = [skipMinus, ...(extraArgs.preValidators ?? [])];
        extraArgs.postValidators = [intValidator, ...(extraArgs.postValidators ?? [])];
        const defaultSettings: Partial<FbctArgs<ObjType, number>> = {
            pattern: "\\d*",
            inputMode: 'number',
        };
        // Spinner arrows aren't styleable. Love CSS!
        // extraArgs.type = extraArgs.type ?? 'number';
        // extraArgs.inputMode = extraArgs.inputMode ?? 'numeric';
        super(obj, field, (s) => s.toString(), (s) => Number(s), {...defaultSettings, ...extraArgs});
        if (this.type === 'numeric') {
            if (!this.step) {
                this.step = '1';
            }
        }
    }
}

export class FieldBoundIntOrUndefField<ObjType> extends FieldBoundConvertingTextField<ObjType, number | undefined> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends (number | undefined) ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, number | undefined> = {}) {
        const intValidator: Exclude<typeof extraArgs.postValidators, undefined>[number] = (ctx) => {
            if (ctx.newValue !== undefined && ctx.newValue % 1 !== 0) {
                ctx.failValidation('Value must be an integer');
            }
        };
        extraArgs.preValidators = [skipMinus, ...(extraArgs.preValidators ?? [])];
        extraArgs.postValidators = [intValidator, ...(extraArgs.postValidators ?? [])];
        const defaultSettings: Partial<FbctArgs<ObjType, number | undefined>> = {
            // TODO: why do we have skipMinus but then forces a positive integer input?
            pattern: "\\d*",
            inputMode: 'number',
        };
        // Spinner arrows aren't styleable. Love CSS!
        // extraArgs.type = extraArgs.type ?? 'number';
        // extraArgs.inputMode = extraArgs.inputMode ?? 'numeric';
        super(obj, field, (s) => s === undefined ? "" : s.toString(), (s) => s.trim() === "" ? undefined : Number(s), {...extraArgs, ...defaultSettings});
        if (this.type === 'numeric') {
            if (!this.step) {
                this.step = '1';
            }
        }
    }
}

export class FieldBoundFloatField<ObjType> extends FieldBoundConvertingTextField<ObjType, number> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], extraArgs: FieldBoundFloatFieldFbctArgs<ObjType, number> = {}) {
        const numberValidator: Exclude<typeof extraArgs.postValidators, undefined>[number] = (ctx) => {
            // filter out NaNs and other garbage values
            // noinspection PointlessArithmeticExpressionJS
            if (ctx.newValue * 0 !== 0) {
                ctx.failValidation('Value must be a number');
            }
        };
        extraArgs.preValidators = [skipMinus, ...(extraArgs.preValidators ?? [])];
        extraArgs.postValidators = [numberValidator, ...(extraArgs.postValidators ?? [])];
        const defaultSettings: Partial<FbctArgs<ObjType, number | undefined>> = {
            // pattern: "\\d*",
            inputMode: 'decimal',
        };
        // Spinner arrows aren't styleable. Love CSS!
        // extraArgs.type = extraArgs.type ?? 'number';
        // extraArgs.inputMode = extraArgs.inputMode ?? 'numeric';
        const toStringFunc = extraArgs.fixDecimals ? (x: number) => x.toFixed(extraArgs.fixDecimals) : (x: number) => x.toString();
        if (extraArgs.fixDecimals !== undefined) {
            defaultSettings.pattern = `[0-9]*\\.?[0-9]{0,${extraArgs.fixDecimals}}`;
        }
        super(obj, field, (s) => toStringFunc(s), (s) => Number(s), {...defaultSettings, ...extraArgs});
    }
}

export class FieldBoundFloatOrUndefField<ObjType> extends FieldBoundConvertingTextField<ObjType, number | undefined> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends (number | undefined) ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, number | undefined> = {}) {
        extraArgs.preValidators = [skipMinus, ...(extraArgs.preValidators ?? [])];
        const defaultSettings: Partial<FbctArgs<ObjType, number | undefined>> = {
            inputMode: 'number',
        };
        super(obj, field, (s) => s === undefined ? "" : s.toString(), (s) => s.trim() === "" ? undefined : Number(s), {...extraArgs, ...defaultSettings});
        if (this.type === 'numeric') {
            if (!this.step) {
                this.step = '1';
            }
        }
    }
}

export const nonNegative = (ctx: PostValidationContext<never, number>) => {
    if (ctx.newValue < 0) {
        ctx.failValidation("Value cannot be negative");
    }
};

export function clampValuesOrUndef<Ignored>(min: number | undefined, max: number | undefined): (ctx: PostValidationContext<Ignored, number | undefined>) => void {
    return (ctx: PostValidationContext<Ignored, number | undefined>) => {
        if (ctx.newValue === undefined) {
            return;
        }
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

export function clampValues<Ignored>(min: number | undefined, max: number | undefined): (ctx: PostValidationContext<Ignored, number>) => void {
    return (ctx: PostValidationContext<Ignored, number>) => {
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

export function labeledComponent(label: string | Node, check: HTMLElement): HTMLDivElement {
    const labelElement = labelFor(label, check);
    return el('div', {class: 'labeled-component'}, [
        check,
        labelElement,
    ]);
}

export function labeledCheckbox(label: string | Node, check: HTMLInputElement): HTMLDivElement {
    const labelElement = labelFor(label, check);
    return el('div', {class: 'labeled-checkbox'}, [
        check,
        labelElement,
    ]);
}

export function labeledRadioButton(label: string | Node, radioButton: HTMLInputElement): HTMLDivElement {
    const labelElement = labelFor(label, radioButton);
    return el('div', {class: 'labeled-radio-button'}, [
        radioButton,
        labelElement,
    ]);
}

export function quickElement<X extends keyof HTMLElementTagNameMap>(tag: X, classes: string[] = [], nodes: Parameters<ParentNode['replaceChildren']> = []): HTMLElementTagNameMap[X] {
    const element = document.createElement(tag);
    if (nodes.length > 0) {
        element.replaceChildren(...nodes);
    }
    if (classes.length > 0) {
        element.classList.add(...classes);
    }
    return element;
}

export type ElOpts<X extends keyof HTMLElementTagNameMap> = {
    /**
     * If specified, adds a single class to the element.
     */
    class?: string;
    /**
     * If specified, adds multiple classes to the element.
     */
    classes?: string[];
    /**
     * If specified, sets the id of the element.
     */
    id?: string;
    /**
     * If specified, sets the title of the element.
     */
    title?: string;
    /**
     * If specified, sets any other arbitrary properties of the element.
     */
    props?: Partial<HTMLElementTagNameMap[X]>;
    /**
     * If specified, sets any arbitrary attributes of the element.
     */
    attributes?: {
        [K: string]: string;
    };
};

/**
 * Create an element with the given tag, options, and children.
 *
 * @param tag The tag to create
 * @param opts The options to use
 * @param nodes Child nodes
 */
export function el<X extends keyof HTMLElementTagNameMap>(tag: X, opts: ElOpts<X> = {}, nodes: Parameters<ParentNode['replaceChildren']> = []) {
    const classes = opts.classes ?? [];
    if (opts.class) {
        classes.push(opts.class);
    }
    const out = quickElement(tag, classes, nodes);
    if (opts.id) {
        out.id = opts.id;
    }
    if (opts.props) {
        for (const [key, value] of Object.entries(opts.props)) {
            out[key as keyof typeof out] = value;
        }
    }
    if (opts.attributes) {
        for (const [key, value] of Object.entries(opts.attributes)) {
            out.setAttribute(key, value);
        }
    }
    return out;
}

customElements.define("option-data-element", OptionDataElement, {extends: "option"});
customElements.define("data-select", DataSelect, {extends: "select"});
customElements.define("field-bound-converting-text-field", FieldBoundConvertingTextField, {extends: "input"});
customElements.define("field-bound-text-field", FieldBoundTextField, {extends: "input"});
customElements.define("field-bound-float-field", FieldBoundFloatField, {extends: "input"});
customElements.define("field-bound-int-or-undef-field", FieldBoundIntOrUndefField, {extends: "input"});
customElements.define("field-bound-float-or-undef-field", FieldBoundFloatOrUndefField, {extends: "input"});
customElements.define("field-bound-int-field", FieldBoundIntField, {extends: "input"});
customElements.define("field-bound-checkbox", FieldBoundCheckBox, {extends: "input"});
customElements.define("field-bound-data-select", FieldBoundDataSelect, {extends: "select"});
