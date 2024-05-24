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

type BooleanListener = (value: boolean) => void;

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
        this.addEventListener('change', () => this.notifyListeners())
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
        // @ts-expect-error - not sure how to do type def correctly
        this.reloadValue = () => this.value = valueToString(obj[field]);
        this.reloadValue();
        this.addEventListener('focusout', () => {
            if (this.__validationMessage) {
                // This will re-trigger the input event, BUT that's probably okay for now.
                this.reloadValue()
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
                        }
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
                        }
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

export class FieldBoundFloatField<ObjType> extends FieldBoundConvertingTextField<ObjType, number> {
    constructor(obj: ObjType, field: { [K in keyof ObjType]: ObjType[K] extends number ? K : never }[keyof ObjType], extraArgs: FbctArgs<ObjType, number> = {}) {
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
        super(obj, field, (s) => s.toString(), (s) => Number(s), extraArgs);
    }
}

export const positiveValuesOnly = (ctx: PostValidationContext<unknown, number>) => {
    if (ctx.newValue < 0) {
        ctx.failValidation("Value must be positive");
    }
};

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
            return makeSvgGlyph("0 0 448 512", "M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z");
        case 'fa-arrow-up-right-from-square':
            return makeSvgGlyph("0 0 512 512", "M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h82.7L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3V192c0 17.7 14.3 32 32 32s32-14.3 32-32V32c0-17.7-14.3-32-32-32H320zM80 32C35.8 32 0 67.8 0 112V432c0 44.2 35.8 80 80 80H400c44.2 0 80-35.8 80-80V320c0-17.7-14.3-32-32-32s-32 14.3-32 32V432c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16H192c17.7 0 32-14.3 32-32s-14.3-32-32-32H80z");
        case 'fa-copy':
            return makeSvgGlyph("0 0 448 512", "M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L400 115.9V320c0 8.8-7.2 16-16 16zM192 384H384c35.3 0 64-28.7 64-64V115.9c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1H192c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H256c35.3 0 64-28.7 64-64V416H272v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16H96V128H64z");
    }
    const element = document.createElement('i');
    element.classList.add(faType, faIconName);
    return element;
}

export function makeCloseButton() {
    return makeSvgGlyph("0 0 384 512", "M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z");
}

export function makeChevronDown() {
    return makeSvgGlyph("0 0 512 512", "M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z")
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

customElements.define("option-data-element", OptionDataElement, {extends: "option"});
customElements.define("data-select", DataSelect, {extends: "select"});
customElements.define("field-bound-converting-text-field", FieldBoundConvertingTextField, {extends: "input"});
customElements.define("field-bound-text-field", FieldBoundTextField, {extends: "input"});
customElements.define("field-bound-float-field", FieldBoundFloatField, {extends: "input"});
customElements.define("field-bound-int-field", FieldBoundIntField, {extends: "input"});
customElements.define("field-bound-checkbox", FieldBoundCheckBox, {extends: "input"});
customElements.define("field-bound-data-select", FieldBoundDataSelect, {extends: "select"});
