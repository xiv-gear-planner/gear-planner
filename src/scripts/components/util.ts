export function makeActionButton(label: string, action: () => void) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener('click', ev => {
        ev.stopPropagation();
        action();
    });
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
    constructor(items: X[], textGetter: (item: X) => string, callback: ((newValue: X) => void) | undefined, initialSelectedItem: typeof items[number]) {
        super();
        for (let item of items) {
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
            })
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

export class FieldBoundCheckBox<ObjType> extends HTMLInputElement {

    reloadValue: () => void;
    listeners: ((value: boolean) => void)[] = [];

    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends boolean ? K : never }[keyof ObjType], extraArgs: {
        id?: string
    } = {}) {
        super();
        this.type = 'checkbox';
        if (extraArgs.id) {
            this.id = extraArgs.id;
        }
        this.reloadValue = () => {
            // @ts-ignore
            this.checked = obj[field];
        };
        this.reloadValue();
        this.addEventListener('change', () => {
            const newValue: boolean = this.checked;
            // @ts-ignore
            obj[field] = newValue;
            for (let listener of this.listeners) {
                try {
                    listener(newValue);
                } catch (e) {
                    console.error("Error in listener", e);
                }
            }
        })
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
    preValidators?: ((context: PreValidationContext<ObjType>) => void)[];
    /**
     * Validation to be run against the converted input string, before setting the field.
     *
     * Return undefined to indicate no validation error, or return a string containing a validation message.
     */
    postValidators?: ((context: PostValidationContext<ObjType, FieldType>) => void)[];

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
        // @ts-ignore
        this.reloadValue = () => this.value = valueToString(obj[field]);
        this.reloadValue();
        this.addEventListener(extraArgs.event ?? 'input', () => {
            try {
                const newRawValue = this.value;
                let _stop = false;
                const fail = (msg) => {
                    _stop = true;
                    this._validationMessage = msg;
                }
                const stop = () => {
                    _stop = true;
                }
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
                        }
                    }
                    for (let preValidator of extraArgs.preValidators) {
                        preValidator(context);
                        if (_stop) {
                            return;
                        }
                    }
                }
                let newValue: FieldType;
                newValue = stringToValue(newRawValue);
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
                        }
                    }
                    for (let postValidator of extraArgs.postValidators) {
                        postValidator(context);
                        if (_stop) {
                            return;
                        }
                    }
                }
                // @ts-ignore
                obj[field] = newValue;
                this._validationMessage = undefined;
                for (let listener of this.listeners) {
                    try {
                        listener(newValue);
                    } catch (e) {
                        console.error("Error in listener", e);
                    }
                }
            } catch (e) {
                this._validationMessage = e.toString();
                return;
            }
        });
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
        // @ts-ignore
        this.reloadValue = () => this.value = valueToString(obj[field]);
        this.reloadValue();
        this.addEventListener(extraArgs.event ?? 'input', () => {
            const newValue: ObjType[Field] = stringToValue(this.value);
            obj[field] = newValue;
            for (let listener of this.listeners) {
                try {
                    listener(newValue);
                } catch (e) {
                    console.error("Error in listener", e);
                }
            }
        });
    }

    addListener(listener: (value: ObjType[Field]) => void) {
        this.listeners.push(listener);
    }
}

const skipMinus = (ctx: PreValidationContext<any>) => {
    if (ctx.newRawValue === '-') {
        ctx.ignoreChange();
    }
}

// new FieldBoundConvertingTextField(new CharacterGearSet(null), 'food', food => food.toString(), str => new XivApiFoodInfo({}));
export class FieldBoundIntField<ObjType> extends FieldBoundConvertingTextField<ObjType, number> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, number> = {}) {
        const intValidator = (ctx) => {
            if (ctx.newValue % 1 !== 0) {
                ctx.failValidation('Value must be an integer');
            }
        }
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

export class FieldBoundFloatField<ObjType> extends FieldBoundConvertingTextField<ObjType, number> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, number> = {}) {
        const numberValidator = (ctx) => {
            // filter out NaNs and other garbage values
            // noinspection PointlessArithmeticExpressionJS
            if (ctx.newValue * 0 !== 0) {
                ctx.failValidation('Value must be a number');
            }
        }
        extraArgs.preValidators = [skipMinus, ...(extraArgs.preValidators ?? [])];
        extraArgs.postValidators = [numberValidator, ...(extraArgs.postValidators ?? [])];
        // Spinner arrows aren't styleable. Love CSS!
        // extraArgs.type = extraArgs.type ?? 'number';
        // extraArgs.inputMode = extraArgs.inputMode ?? 'numeric';
        super(obj, field, (s) => s.toString(), (s) => Number(s), extraArgs);
    }
}

export const positiveValuesOnly = (ctx: PostValidationContext<any, number>) => {
    if (ctx.newValue < 0) {
        ctx.failValidation("Value must be positive");
    }
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
            //@ts-ignore
            obj[field] = value;
        }, obj[field] as DataType);
    }

    addListener(listener: (value: DataType) => void) {
        this.listeners.push(listener);
    }
}

export function labeledCheckbox(label: string, check: HTMLInputElement): HTMLDivElement {
    const labelElement = labelFor(label, check);
    const div = document.createElement("div");
    div.appendChild(check);
    div.appendChild(labelElement);
    div.classList.add("labeled-checkbox");
    return div;
}

export function quickElement(tag: keyof HTMLElementTagNameMap, classes: string[], nodes: Node[]) {
    const element = document.createElement(tag);
    element.replaceChildren(...nodes);
    element.classList.add(...classes);
    return element
}

customElements.define("option-data-element", OptionDataElement, {extends: "option"});
customElements.define("data-select", DataSelect, {extends: "select"});
customElements.define("field-bound-converting-text-field", FieldBoundConvertingTextField, {extends: "input"});
customElements.define("field-bound-text-field", FieldBoundTextField, {extends: "input"});
customElements.define("field-bound-float-field", FieldBoundFloatField, {extends: "input"});
customElements.define("field-bound-int-field", FieldBoundIntField, {extends: "input"});
customElements.define("field-bound-checkbox", FieldBoundCheckBox, {extends: "input"});
customElements.define("field-bound-data-select", FieldBoundDataSelect, {extends: "select"});
