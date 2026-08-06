import {elt} from "@xivgear/common-ui/components/templates";
import {el} from "@xivgear/common-ui/components/util";
import {makeSearchIcon} from "@xivgear/common-ui/components/icons";
import {BaseParamOption, BaseParamSearchModal} from "./baseparamsearch";
import {ItemUICategoryOption, ItemUICategorySearchModal} from "./itemuicategorysearch";
import {ALL_COMBAT_JOBS, JOB_DATA, JobName} from "@xivgear/xivmath/xivconstants";
import {RoleKey} from "@xivgear/xivmath/geartypes";
import {JobIcon} from "./components/job/job_icon";
import {HtmxRequestConfig} from "htmx.org";

// TODO: these can be folded back in when DoH/DoL is merged
const ALL_DOH_JOBS = ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'] as const;
const ALL_DOL_JOBS = ['MIN', 'BTN', 'FSH'] as const;
type SearchJobName = JobName | typeof ALL_DOH_JOBS[number] | typeof ALL_DOL_JOBS[number];
type JobPickerRole = RoleKey | 'DoH' | 'DoL';

interface BaseParamConfigOption {
    id: string;
    value: string;
    tooltip: string;
}

interface BaseFieldConfig {
    field: string;
    label: string;
    category: 'Basic' | 'Advanced' | 'Hidden';
    allowMultiple: boolean;
    default: boolean;
}

type SimpleFieldConfig = BaseFieldConfig & {
    type: 'string' | 'number' | 'boolean' | 'classjobcategory' | 'equipslotcategory';
};
type BaseParamFieldConfig = BaseFieldConfig & {
    type: 'baseparam'
    options?: BaseParamConfigOption[];
}
type ItemUICategoryFieldConfig = BaseFieldConfig & {
    type: 'itemuicategory';
    options?: ItemUICategoryOption[];
}
/**
 * Configuration for a single advanced search field
 */
type FieldConfig = SimpleFieldConfig | BaseParamFieldConfig | ItemUICategoryFieldConfig;

type SortField = 'ROW_ID' | 'NAME' | 'BASE_PARAM' | 'EQUIP_LEVEL' | 'ILVL';
type SortDirection = 'ASCENDING' | 'DESCENDING';

const SORT_FIELDS: Record<SortField, string> = {
    ROW_ID: 'Item ID',
    NAME: 'Name',
    BASE_PARAM: 'Stat',
    EQUIP_LEVEL: 'Equip level',
    ILVL: 'Ilvl',
};

const SORT_DIRECTIONS: Record<SortDirection, string> = {
    ASCENDING: 'Ascending',
    DESCENDING: 'Descending',
};

declare global {
    interface Window {
        /**
         * Advanced field configuration injected by server
         */
        advancedSearchFieldConfig?: FieldConfig[];
    }
}

/**
 * Corresponds to app.xivgear.itemviewer.models.AdvancedSearchStringOperator
 */

type StringOperator = 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS';

/**
 * Corresponds to app.xivgear.itemviewer.models.AdvancedSearchNumberOperator
 */
type MinOperator = 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL' | 'EQUALS' | 'NOT_EQUALS';
type MaxOperator = 'LESS_THAN' | 'LESS_THAN_OR_EQUAL';
type CategoryOperator = 'EQUALS' | 'NOT_EQUALS';

/**
 * Corresponds to app.xivgear.itemviewer.models.AdvancedSearchBooleanValue
 *
 * TODO: remove 'ANY', it's pointless now that you pick and choose which fields to query
 */
type BooleanValue = 'ANY' | 'TRUE' | 'FALSE';

const ADVANCED_VALUE_PREFIX = 'av';

const DEFAULT_STRING_OPERATOR: StringOperator = 'CONTAINS';
const DEFAULT_MIN_OPERATOR: MinOperator = 'GREATER_THAN_OR_EQUAL';
const DEFAULT_MAX_OPERATOR: MaxOperator = 'LESS_THAN_OR_EQUAL';

const DEFAULT_BOOLEAN_VALUE: BooleanValue = 'ANY';

interface SelectOption {
    value: string;
    tooltip: string;
}

const STRING_OPERATORS: Record<StringOperator, SelectOption> = {
    EQUALS: {
        value: '=',
        tooltip: 'Equals',
    },
    NOT_EQUALS: {
        value: '≠',
        tooltip: 'Does Not Equal',
    },
    CONTAINS: {
        value: '*=',
        tooltip: 'Contains String',
    },
    NOT_CONTAINS: {
        value: '!*=',
        tooltip: 'Does Not Contain String',
    },
};

const MIN_OPERATORS: Record<MinOperator, SelectOption> = {
    GREATER_THAN: {
        value: '>',
        tooltip: 'Greater Than',
    },
    GREATER_THAN_OR_EQUAL: {
        value: '≥',
        tooltip: 'Greater Than or Equal To',
    },
    EQUALS: {
        value: '=',
        tooltip: 'Equals',
    },
    NOT_EQUALS: {
        value: '≠',
        tooltip: 'Does Not Equal',
    },
};

const MAX_OPERATORS: Record<MaxOperator, SelectOption> = {
    LESS_THAN: {
        value: '<',
        tooltip: 'Less Than',
    },
    LESS_THAN_OR_EQUAL: {
        value: '≤',
        tooltip: 'Less Than or Equal To',
    },
};

const BOOLEAN_VALUES: Record<BooleanValue, string> = {
    ANY: 'Any',
    TRUE: 'Yes',
    FALSE: 'No',
};

/**
 * Read the data injected by the server. The server places a script tag in the header that sets window.advancedSearchFieldConfig.
 */
function readFieldConfigs(): FieldConfig[] {
    return (window.advancedSearchFieldConfig || []).filter(config => {
        const valid = typeof config.field === 'string'
            && typeof config.label === 'string'
            && ['Basic', 'Advanced', 'Hidden'].includes(config.category)
            && ['string', 'number', 'boolean', 'baseparam', 'itemuicategory', 'classjobcategory', 'equipslotcategory'].includes(config.type);
        if (!valid) {
            console.error('Invalid field config', config);
        }
        return valid && config.category !== 'Hidden';
    });
}

function inputControl(name: string, value: string, placeholder: string, numeric = false): HTMLInputElement {
    return el('input', {
        classes: ['advanced-search-control', 'advanced-search-row-cell'],
        attributes: {
            name,
            type: 'text',
            value,
            placeholder,
            ...(numeric ? {inputmode: 'number'} : {}),
        },
    });
}

/**
 * Formats a form field name (which will become a query parameter) for a given index + field name
 *
 * @param index
 * @param property
 */
function criterionName(index: number, property: string): string {
    return `${ADVANCED_VALUE_PREFIX}(${index}).${property}`;
}

/**
 * Creates a select element with the given name, default, and options.
 *
 * @param name
 * @param selectedValue
 * @param options
 */
function selectControl<T extends string>(name: string, selectedValue: T, options: Record<T, string | SelectOption> | Array<[T, string | SelectOption]>): HTMLSelectElement {
    const entries = Array.isArray(options) ? options : Object.entries(options) as Array<[T, string | SelectOption]>;
    const optionElements = entries.map(([optionValue, option]) => {
        const selectOption = typeof option === 'string' ? {value: option} : option;
        return el('option', {
            attributes: typeof option === 'string' || !option.tooltip ? {} : {title: option.tooltip},
            props: {
                value: optionValue,
                selected: optionValue === selectedValue,
            },
        }, [selectOption.value]);
    });
    return el('select', {
        classes: ['advanced-search-control', 'advanced-search-row-cell'],
        attributes: {name},
    }, optionElements);
}

const CATEGORY_OPERATORS: Record<CategoryOperator, SelectOption> = {
    EQUALS: {
        value: '=',
        tooltip: 'Equals',
    },
    NOT_EQUALS: {
        value: '≠',
        tooltip: 'Does Not Equal',
    },
};

/**
 * Base class for the specific types of fields.
 *
 * It is NOT expected that these are neatly cloneable nor constructable from HTML alone - the server never prefills
 * these. It is okay for them to have unexposed internal state.
 */
abstract class AdvancedSearchFieldElement extends HTMLElement {

    // TODO: does it make sense for index to be readonly when we may have to reindex?
    protected constructor(protected readonly config: FieldConfig, protected readonly index: number, protected readonly values: Record<string, string>) {
        super();
        if (!this.config) {
            console.error("FieldConfig was null/undef!");
            throw Error("FieldConfig was null/undef!");
        }
        this.classList.add('advanced-search-row', `advanced-search-${config.field}-row`, 'advanced-search-single-row');
        this.dataset.advancedSearchRow = '';
        this.dataset.field = config.field;
        this.dataset.fieldType = config.type;
    }

    connectedCallback(): void {
        this.dataset.fieldType = this.dataset.fieldType || 'unknown';
    }

    protected fieldInput(): HTMLInputElement {
        return el('input', {
            props: {
                type: 'hidden',
                value: this.config.field,
            },
            attributes: {name: criterionName(this.index, 'field')},
        });
    }
}

/**
 * For a set of inputs representing a numeric range, synchronize the enabled/disabled state of the max operator + value
 * based on the value of the min operator. If the min operator is equals or not equals, then we want to disable the max.
 *
 * @param row The row. Expects sub-elements with `data-number-min-operator`, `data-number-max-operator`, and
 * `data-number-max-input`.
 */
function setNumberRangeState(row: HTMLElement): void {
    const minOperator = row.querySelector<HTMLSelectElement>('[data-number-min-operator]');
    const maxOperator = row.querySelector<HTMLSelectElement>('[data-number-max-operator]');
    const maxInput = row.querySelector<HTMLInputElement>('[data-number-max-input]');
    const disabled = minOperator?.value === 'EQUALS' || minOperator?.value === 'NOT_EQUALS';
    if (maxOperator) {
        maxOperator.disabled = disabled;
    }
    if (maxInput) {
        maxInput.disabled = disabled;
    }
}

function setMinPlaceholder(input: HTMLInputElement, operator: HTMLSelectElement, label: string): void {
    input.placeholder = operator.value === 'EQUALS' || operator.value === 'NOT_EQUALS' ? label : `Min ${label}`;
}

/**
 * Create a 'remove row' button.
 */
function removeButton(): HTMLButtonElement {
    const button = elt('button', {
        classes: ['advanced-search-remove-button'],
        props: {type: 'button'},
    })`X`;
    button.dataset.removeRow = '';
    button.title = 'Remove This Criterion';
    return button;
}

class AdvancedSearchStringField extends AdvancedSearchFieldElement {
    constructor(config: FieldConfig, index: number, values: Record<string, string>) {
        super(config, index, values);
    }

    connectedCallback(): void {
        super.connectedCallback();
        const label = elt('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell']})`${this.config.label}`;
        const operator = selectControl(criterionName(this.index, 'operator'), (this.values.operator as StringOperator) || DEFAULT_STRING_OPERATOR, STRING_OPERATORS);
        const input = inputControl(criterionName(this.index, 'value'), this.values.value || '', this.config.label);
        this.replaceChildren(this.fieldInput(), label, operator, input, el('div', {classes: ['advanced-search-row-cell', 'advanced-search-remove-cell']}, [removeButton()]));
    }
}

/**
 * Number field - allows you to enter a min and max, and an operator for each (gt vs gte, etc), or enter an equals/not
 * equals for the minimum and no maximum to turn it from a range to an (in)equality.
 */
class AdvancedSearchNumberField extends AdvancedSearchFieldElement {
    constructor(config: FieldConfig, index: number, values: Record<string, string>) {
        super(config, index, values);
    }

    connectedCallback(): void {
        super.connectedCallback();
        const {
            config,
            index,
            values,
        } = this;
        this.classList.add('advanced-search-number-row', 'advanced-search-range-row');
        const min = inputControl(criterionName(index, 'minValue'), values.minValue || '', `Min ${config.label}`, true);
        const minOperator = selectControl(criterionName(index, 'minOperator'), (values.minOperator as MinOperator) || DEFAULT_MIN_OPERATOR, MIN_OPERATORS);
        minOperator.dataset.numberMinOperator = '';
        const max = inputControl(criterionName(index, 'maxValue'), values.maxValue || '', `Max ${config.label}`, true);
        const maxOperator = selectControl(criterionName(index, 'maxOperator'), (values.maxOperator as MaxOperator) || DEFAULT_MAX_OPERATOR, MAX_OPERATORS);
        maxOperator.dataset.numberMaxOperator = '';
        max.dataset.numberMaxInput = '';
        const top = el('div', {classes: ['advanced-search-row-line', 'advanced-search-range-row-top']}, [
            elt('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell']})`${config.label}`,
            minOperator,
            min,
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-remove-cell']}, [removeButton()]),
        ]);
        const bottom = el('div', {classes: ['advanced-search-row-line', 'advanced-search-range-row-bottom']}, [
            elt('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell', 'advanced-search-row-and-cell']})`and`,
            maxOperator,
            max,
            el('div'),
        ]);
        minOperator.addEventListener('change', () => {
            setMinPlaceholder(min, minOperator, config.label);
            setNumberRangeState(this);
        });
        this.replaceChildren(this.fieldInput(), top, bottom);
        setMinPlaceholder(min, minOperator, config.label);
        setNumberRangeState(this);
    }
}

/**
 * Special search widget for BaseParams.
 */
class AdvancedSearchBaseParamField extends AdvancedSearchFieldElement {
    constructor(protected readonly config: BaseParamFieldConfig, index: number, values: Record<string, string>) {
        super(config, index, values);
    }

    connectedCallback(): void {
        super.connectedCallback();
        const {
            config,
            index,
            values,
        } = this;
        this.classList.add('advanced-search-base-param-row', 'advanced-search-range-row');

        const options: Array<[string, string | SelectOption]> = [
            ['', 'Select stat'],
            ...(config.options || []).map(option => {
                const baseParamOption = option as BaseParamConfigOption;
                return [baseParamOption.id, {
                    value: baseParamOption.value,
                    tooltip: baseParamOption.tooltip,
                }] as [string, SelectOption];
            }),
        ];
        const stat = selectControl(
            criterionName(index, 'baseParamId'),
            values.baseParamId || '',
            options
        );
        const baseParamOptions: BaseParamOption[] = (config.options || [])
            .map(option => ({
                id: option.id,
                name: (option as BaseParamConfigOption).value,
                description: (option as BaseParamConfigOption).tooltip,
            }));
        const chooseStatButton = el('button', {
            attributes: {
                type: 'button',
                title: 'Select a stat',
            },
        }, [makeSearchIcon()]);
        chooseStatButton.addEventListener('click', () => {
            new BaseParamSearchModal(baseParamOptions, id => {
                stat.value = id;
                stat.dispatchEvent(new Event('change', {bubbles: true}));
            }).attachAndShowTop();
        });
        const withHqSpecialHidden = el('input', {
            props: {
                type: 'hidden',
                value: 'off',
            },
            attributes: {
                name: criterionName(index, 'withHqSpecial'),
            },
        });
        // TODO: should be checked by default
        const withHqSpecial = el('input', {
            props: {
                type: 'checkbox',
                checked: values.withHqSpecial === null || values.withHqSpecial === 'on' || values.withHqSpecial === 'true' || values.withHqSpecial === '1' || values.withHqSpecial === undefined || values.withHqSpecial === 'false' || values.withHqSpecial === 'on',
            },
            attributes: {
                name: criterionName(index, 'withHqSpecial'),
            },
        });
        const hqLabel = el('label', {classes: ['advanced-search-checkbox-label']}, [withHqSpecial, '+HQ/Special']);
        const min = inputControl(criterionName(index, 'minValue'), values.minValue || '', `Min ${config.label}`, true);
        const minOperator = selectControl(criterionName(index, 'minOperator'), (values.minOperator as MinOperator) || DEFAULT_MIN_OPERATOR, MIN_OPERATORS);
        minOperator.dataset.numberMinOperator = '';
        const max = inputControl(criterionName(index, 'maxValue'), values.maxValue || '', `Max ${config.label}`, true);
        const maxOperator = selectControl(criterionName(index, 'maxOperator'), (values.maxOperator as MaxOperator) || DEFAULT_MAX_OPERATOR, MAX_OPERATORS);
        maxOperator.dataset.numberMaxOperator = '';
        max.dataset.numberMaxInput = '';

        const headerCell = el('div', {classes: ['advanced-search-row-cell', 'advanced-search-base-param-header-cell']}, [
            elt('span')`${config.label}`,
            stat,
            chooseStatButton,
        ]);
        const header = el('div', {classes: ['advanced-search-row-line', 'advanced-search-header-row']}, [
            headerCell,
            el('div', {classes: ['advanced-search-row-cell']}, [hqLabel]),
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-remove-cell']}, [removeButton()]),
        ]);
        const middle = el('div', {classes: ['advanced-search-row-line', 'advanced-search-range-row-middle']}, [
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell']}),
            minOperator,
            min,
            el('div'),
        ]);
        const bottom = el('div', {classes: ['advanced-search-row-line', 'advanced-search-range-row-bottom']}, [
            elt('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell', 'advanced-search-row-and-cell']})`and`,
            maxOperator,
            max,
            el('div'),
        ]);
        minOperator.addEventListener('change', () => {
            setMinPlaceholder(min, minOperator, config.label);
            setNumberRangeState(this);
        });
        this.replaceChildren(this.fieldInput(), withHqSpecialHidden, header, middle, bottom);
        setMinPlaceholder(min, minOperator, config.label);
        setNumberRangeState(this);
    }
}

/**
 * Special search widget for ItemUICategory.
 */
class AdvancedSearchItemUICategoryField extends AdvancedSearchFieldElement {
    constructor(protected readonly config: ItemUICategoryFieldConfig, index: number, values: Record<string, string>) {
        super(config, index, values);
    }

    connectedCallback(): void {
        super.connectedCallback();
        const {
            config,
            index,
            values,
        } = this;
        const options = (config.options || []) as ItemUICategoryOption[];
        const category = selectControl(criterionName(index, 'categoryId'), values.categoryId || '', [
            ['', 'Select category'],
            ...options.map(option => [option.id, option.name] as [string, string]),
        ]);
        const operator = selectControl(criterionName(index, 'operator'), (values.operator as CategoryOperator) || 'EQUALS', {
            EQUALS: CATEGORY_OPERATORS.EQUALS,
            NOT_EQUALS: CATEGORY_OPERATORS.NOT_EQUALS,
        });
        const chooseButton = el('button', {
            attributes: {
                type: 'button',
                title: 'Select a category',
            },
        }, [makeSearchIcon()]);
        chooseButton.addEventListener('click', () => new ItemUICategorySearchModal(options, id => {
            category.value = id;
            category.dispatchEvent(new Event('change', {bubbles: true}));
        }).attachAndShowTop());
        const header = el('div', {classes: ['advanced-search-row-line', 'advanced-search-header-row', 'advanced-search-item-ui-category-header-row']}, [
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-item-ui-category-label-cell']}, [elt('span')`${config.label}`, operator]),
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-item-ui-category-selection-cell']}, [category, chooseButton]),
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-remove-cell']}, [removeButton()]),
        ]);
        this.replaceChildren(this.fieldInput(), header);
    }
}

/**
 * Boolean filter.
 */
class AdvancedSearchBooleanField extends AdvancedSearchFieldElement {
    constructor(config: FieldConfig, index: number, values: Record<string, string>) {
        super(config, index, values);
    }

    connectedCallback(): void {
        super.connectedCallback();
        const {
            config,
            index,
            values,
        } = this;
        const label = elt('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell']})`${config.label}`;
        label.classList.add('advanced-search-boolean-field-cell');
        this.replaceChildren(
            label,
            this.fieldInput(),
            selectControl(criterionName(index, 'value'), (values.value as BooleanValue) || DEFAULT_BOOLEAN_VALUE, BOOLEAN_VALUES),
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-remove-cell']}, [removeButton()])
        );
    }
}

type ClassJobOperator = 'ALL' | 'ANY' | 'NONE';

const CLASS_JOB_OPERATORS: Record<ClassJobOperator, string> = {
    ALL: 'All of',
    ANY: 'Any of',
    NONE: 'None of',
};

type EquipSlotOperator = 'ALL' | 'ANY';
type EquipSlotValueOperator = 'EQUIPPABLE' | 'NOT_EQUIPPABLE' | 'BLOCKS';

const EQUIP_SLOT_OPERATORS: Record<EquipSlotOperator, string> = {
    ALL: 'All of',
    ANY: 'Any of',
};

const EQUIP_SLOT_VALUE_OPERATORS: Record<EquipSlotValueOperator, string> = {
    EQUIPPABLE: 'Equippable to',
    NOT_EQUIPPABLE: 'Not equippable to',
    BLOCKS: 'Blocks equipping to',
};

interface EquipSlotOption {
    value: string;
    label: string;
    icon: string;
}

// TODO: harmonize this with the normal xivgear types
const EQUIP_SLOT_ROWS: readonly [EquipSlotOption | null, EquipSlotOption | null][] = [
    [{
        value: 'MAIN_HAND',
        label: 'Weapon',
        icon: 'weapon',
    }, null],
    [{
        value: 'HEAD',
        label: 'Head',
        icon: 'head',
    }, {
        value: 'OFFHAND',
        label: 'Off-Hand/Shield',
        icon: 'offhand',
    }],
    [{
        value: 'BODY',
        label: 'Body',
        icon: 'body',
    }, {
        value: 'EARRING',
        label: 'Earring',
        icon: 'earring',
    }],
    [{
        value: 'GLASSES',
        label: 'Hands',
        icon: 'hands',
    }, {
        value: 'NECK',
        label: 'Neck',
        icon: 'neck',
    }],
    [{
        value: 'LEGS',
        label: 'Legs',
        icon: 'legs',
    }, {
        value: 'WRIST',
        label: 'Wrist',
        icon: 'wrist',
    }],
    [{
        value: 'FEET',
        label: 'Feet',
        icon: 'feet',
    }, {
        value: 'RIGHT_RING',
        label: 'Right Ring',
        icon: 'ring',
    }],
    [null, {
        value: 'LEFT_RING',
        label: 'Left Ring',
        icon: 'ring',
    }],
    [null, {
        value: 'SOUL_CRYSTAL',
        label: 'Soul Crystal',
        icon: 'soul-crystal',
    }],
];

const JOB_ROLE_ORDER: readonly JobPickerRole[] = ['Tank', 'Healer', 'Melee', 'Ranged', 'Caster', 'DoH', 'DoL'];

/**
 * Class/job picker
 */
class AdvancedSearchClassJobCategoryField extends AdvancedSearchFieldElement {
    constructor(config: FieldConfig, index: number, values: Record<string, string>) {
        super(config, index, values);
    }

    // TODO: this can be simplified once doh/dol is fully merged
    private jobPickerRole(job: SearchJobName): JobPickerRole {
        if ((ALL_DOH_JOBS as readonly string[]).includes(job)) {
            return 'DoH';
        }
        if ((ALL_DOL_JOBS as readonly string[]).includes(job)) {
            return 'DoL';
        }
        return JOB_DATA[job as JobName].role;
    }

    // We do this instead of just the normal checkbox behavior because it will interfere with dragging
    private setJobSelection(label: HTMLLabelElement, selected: boolean): void {
        const checkbox = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!checkbox) {
            return;
        }
        checkbox.checked = selected;
        label.classList.toggle('selected', selected);
        checkbox.dispatchEvent(new Event('input', {bubbles: true}));
    }

    private addJobPickerDragBehavior(jobPicker: HTMLElement): void {
        let dragSelection: boolean | null = null;

        const stopDragging = (): void => {
            dragSelection = null;
            document.removeEventListener('pointerup', stopDragging);
            document.removeEventListener('pointercancel', stopDragging);
            document.body.style.userSelect = '';
        };

        jobPicker.addEventListener('pointerdown', event => {
            const target = event.target instanceof Element
                ? event.target.closest<HTMLLabelElement>('[data-job-label]')
                : null;
            if (!target) {
                return;
            }
            event.preventDefault();
            const checkbox = target.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (!checkbox) {
                return;
            }
            dragSelection = !checkbox.checked;
            this.setJobSelection(target, dragSelection);
            // TODO: use draghelper for this
            document.addEventListener('pointerup', stopDragging);
            document.addEventListener('pointercancel', stopDragging);
            document.body.style.userSelect = 'none';
        });

        jobPicker.addEventListener('change', event => {
            const checkbox = event.target instanceof HTMLInputElement ? event.target : null;
            const label = checkbox?.closest<HTMLLabelElement>('[data-job-label]');
            if (label && checkbox) {
                this.setJobSelection(label, checkbox.checked);
            }
        });

        jobPicker.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target : null;
            const jobLabel = target?.closest<HTMLLabelElement>('[data-job-label]');
            if (jobLabel) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            const roleButton = target?.closest<HTMLButtonElement>('[data-role-control]');
            const selectionButton = target?.closest<HTMLButtonElement>('[data-selection-control]');
            if (selectionButton) {
                event.preventDefault();
                event.stopPropagation();
                const select = selectionButton.dataset.selectionControl === 'select-all';
                const labels = [...jobPicker.querySelectorAll<HTMLLabelElement>('[data-job-label]')];
                labels.forEach(label => this.setJobSelection(label, select));
                return;
            }

            if (!roleButton) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const section = roleButton.closest<HTMLElement>('[data-job-role-section]');
            if (!section) {
                return;
            }
            const labels = [...section.querySelectorAll<HTMLLabelElement>('[data-job-label]')];
            const select = !labels.every(label => label.querySelector<HTMLInputElement>('input')?.checked);
            labels.forEach(label => this.setJobSelection(label, select));
        });

        jobPicker.addEventListener('pointerenter', event => {
            if (dragSelection === null) {
                return;
            }
            const target = event.target instanceof Element
                ? event.target.closest<HTMLLabelElement>('[data-job-label]')
                : null;
            if (target && jobPicker.contains(target)) {
                this.setJobSelection(target, dragSelection);
            }
        }, true);
    }

    private readonly clearJobSelectionValidation = (): void => {
        this.querySelectorAll<HTMLInputElement>('input[name$=".jobs"]').forEach(jobInput => {
            jobInput.setCustomValidity('');
        });
    };

    connectedCallback(): void {
        super.connectedCallback();
        const {
            config,
            index,
            values,
        } = this;
        const selectedJobs = new Set((values.jobs || '').split(',').filter(Boolean));
        const operator = selectControl(
            criterionName(index, 'operator'),
            (values.operator as ClassJobOperator) || 'ANY',
            CLASS_JOB_OPERATORS
        );
        operator.classList.add('advanced-search-class-job-operator');
        const jobSections = new Map<string, HTMLElement>();
        JOB_ROLE_ORDER.forEach(role => {
            const section = el('div', {
                classes: ['advanced-search-class-job-section', `advanced-search-class-job-section-${role.toLowerCase()}`],
                attributes: {'data-job-role-section': role},
            });
            section.appendChild(el('button', {
                classes: ['advanced-search-class-job-role'],
                attributes: {
                    type: 'button',
                    'data-role-control': '',
                },
            }, [new JobIcon(role)]));
            jobSections.set(role, section);
        });
        const allJobs: readonly SearchJobName[] = [...ALL_COMBAT_JOBS, ...ALL_DOH_JOBS, ...ALL_DOL_JOBS];
        allJobs.forEach((job: SearchJobName) => {
            const checkbox = el('input', {
                props: {
                    type: 'checkbox',
                    checked: selectedJobs.has(job),
                },
                attributes: {
                    name: criterionName(index, 'jobs'),
                    value: job,
                },
            });
            const label = el('label', {
                classes: ['advanced-search-class-job-label', ...(selectedJobs.has(job) ? ['selected'] : [])],
                attributes: {'data-job-label': ''},
            }, [checkbox, new JobIcon(job)]);
            label.title = job;
            jobSections.get(this.jobPickerRole(job))?.appendChild(label);
        });
        const jobPicker = el('div', {classes: ['advanced-search-class-job-picker']},
            JOB_ROLE_ORDER.map(role => jobSections.get(role)!));
        const selectionControls = el('div', {classes: ['advanced-search-class-job-selection-controls']}, [
            el('button', {
                attributes: {
                    type: 'button',
                    'data-selection-control': 'select-all',
                },
            }, ['Select all']),
            el('button', {
                attributes: {
                    type: 'button',
                    'data-selection-control': 'deselect-all',
                },
            }, ['Deselect all']),
        ]);
        jobPicker.appendChild(selectionControls);
        this.addJobPickerDragBehavior(jobPicker);
        jobPicker.addEventListener('input', this.clearJobSelectionValidation);
        const label = elt('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell']})`${config.label}`;
        const top = el('div', {classes: ['advanced-search-row-line', 'advanced-search-class-job-top-row']}, [
            label,
            operator,
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-remove-cell']}, [removeButton()]),
        ]);
        const jobs = el('div', {classes: ['advanced-search-row-line', 'advanced-search-class-job-picker-row']}, [
            jobPicker,
        ]);
        this.replaceChildren(
            this.fieldInput(),
            top,
            jobs
        );
    }
}

/**
 * Equipment-slot relationship picker. The hidden checkboxes keep the form
 * accessible and serializable while the shared equipment-slot sprite conveys
 * the selection state.
 */
class AdvancedSearchEquipSlotCategoryField extends AdvancedSearchFieldElement {
    constructor(config: FieldConfig, index: number, values: Record<string, string>) {
        super(config, index, values);
    }

    connectedCallback(): void {
        super.connectedCallback();
        const config = this.config;
        const index = this.index;
        const values = this.values;
        const selectedSlots = new Set((values.slots || '').split(',').map(slot => slot.trim()).filter(Boolean));
        const operator = selectControl(
            criterionName(index, 'operator'),
            (values.operator as EquipSlotOperator) || 'ANY',
            EQUIP_SLOT_OPERATORS
        );
        const valueOperator = selectControl(
            criterionName(index, 'valueOperator'),
            (values.valueOperator as EquipSlotValueOperator) || 'EQUIPPABLE',
            EQUIP_SLOT_VALUE_OPERATORS
        );
        operator.title = 'Combine selected slots with this operator';
        valueOperator.title = 'Match this relationship to the selected slots';

        const options: HTMLLabelElement[] = [];
        const slotInputId = (slot: EquipSlotOption): string => `advanced-search-slot-${index}-${slot.value}`;
        const updateOptionState = (): void => {
            const blocked = valueOperator.value !== 'EQUIPPABLE';
            options.forEach(option => {
                const checkbox = option.querySelector<HTMLInputElement>('input');
                const icon = option.querySelector<HTMLElement>('.equip-slot-square');
                const selected = checkbox?.checked === true;
                option.classList.toggle('selected', selected);
                icon?.classList.toggle('equip-slot-state-allowed', selected && !blocked);
                icon?.classList.toggle('equip-slot-state-blocked', selected && blocked);
            });
        };
        const makeOption = (slot: EquipSlotOption | null): HTMLLabelElement | HTMLDivElement => {
            if (slot === null) {
                return el('div', {classes: ['equip-slot-square', 'equip-slot-square-empty']});
            }
            const checkbox = el('input', {
                props: {
                    type: 'checkbox',
                    checked: selectedSlots.has(slot.value),
                },
                attributes: {
                    id: slotInputId(slot),
                    name: criterionName(index, 'slots'),
                    value: slot.value,
                    'aria-label': slot.label,
                },
            });
            const option = el('label', {
                classes: ['advanced-search-equip-slot-option'],
                attributes: {
                    title: slot.label,
                    'data-slot': slot.value,
                },
            }, [checkbox, el('span', {classes: ['equip-slot-square', `equip-slot-icon-${slot.icon}`]})]);
            checkbox.addEventListener('change', updateOptionState);
            options.push(option);
            return option;
        };
        const picker = el('div', {classes: ['equip-slot-grid', 'advanced-search-equip-slot-picker']});
        EQUIP_SLOT_ROWS.forEach(([left, right]) => {
            const leftLabel = left
                ? el('label', {
                    classes: ['equip-slot-label'],
                    attributes: {for: slotInputId(left)},
                }, [left.label])
                : el('span', {classes: ['equip-slot-label']});
            const rightLabel = right
                ? el('label', {
                    classes: ['equip-slot-label'],
                    attributes: {for: slotInputId(right)},
                }, [right.label])
                : el('span', {classes: ['equip-slot-label']});
            picker.appendChild(el('div', {classes: ['equip-slot-row']}, [
                leftLabel,
                makeOption(left),
                makeOption(right),
                rightLabel,
            ]));
        });
        valueOperator.addEventListener('change', updateOptionState);
        updateOptionState();

        const top = el('div', {classes: ['advanced-search-row-line', 'advanced-search-equip-slot-top-row']}, [
            elt('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell']})`${config.label}`,
            el('div', {classes: ['advanced-search-equip-slot-operators']}, [valueOperator, operator]),
            el('div', {classes: ['advanced-search-row-cell', 'advanced-search-remove-cell']}, [removeButton()]),
        ]);
        const slots = el('div', {classes: ['advanced-search-row-line', 'advanced-search-equip-slot-picker-row']}, [picker]);
        this.replaceChildren(this.fieldInput(), top, slots);
    }
}

/**
 * Given a field configuration, construct the correct element for it.
 *
 * @param config
 * @param index
 * @param values
 */
function makeRowElement(config: FieldConfig, index: number, values: Record<string, string>): HTMLElement {
    switch (config.type) {
        case 'string':
            return new AdvancedSearchStringField(config, index, values);
        case 'number':
            return new AdvancedSearchNumberField(config, index, values);
        case 'baseparam':
            return new AdvancedSearchBaseParamField(config, index, values);
        case 'itemuicategory':
            return new AdvancedSearchItemUICategoryField(config, index, values);
        case 'boolean':
            return new AdvancedSearchBooleanField(config, index, values);
        case 'classjobcategory':
            return new AdvancedSearchClassJobCategoryField(config, index, values);
        case 'equipslotcategory':
            return new AdvancedSearchEquipSlotCategoryField(config, index, values);
    }
}

customElements.define('advanced-search-string-field', AdvancedSearchStringField);
customElements.define('advanced-search-number-field', AdvancedSearchNumberField);
customElements.define('advanced-search-boolean-field', AdvancedSearchBooleanField);
customElements.define('advanced-search-base-param-field', AdvancedSearchBaseParamField);
customElements.define('advanced-search-item-ui-category-field', AdvancedSearchItemUICategoryField);
customElements.define('advanced-search-class-job-category-field', AdvancedSearchClassJobCategoryField);
customElements.define('advanced-search-equip-slot-category-field', AdvancedSearchEquipSlotCategoryField);


/**
 * Try to extract the query rows for a particular field out of a URLSearchParams. Used to populate the form when loading
 * the page.
 *
 * @param params
 * @param field
 */
function queryRowsForField(params: URLSearchParams, field: string): Record<string, string>[] {
    const rows: Record<number, Record<string, string>> = {};
    const avFields: Record<number, string> = {};

    // First, build an index-to-field lookup by looking for the `.field` property parameters.
    // e.g. if we see `av(5).field=foo`, then set avFields[5] to "foo"
    params.forEach((value, key) => {
        const match = key.match(new RegExp(`^${ADVANCED_VALUE_PREFIX}\\((\\d+)\\)\\.field$`));
        if (match) {
            const index = Number(match[1]);
            avFields[index] = value;
        }
    });

    // Then, populate the actual values for each field.
    params.forEach((value, key) => {
        const avMatch = key.match(new RegExp(`^${ADVANCED_VALUE_PREFIX}\\((\\d+)\\)\\.(.+)$`));
        if (avMatch) {
            const index = Number(avMatch[1]);
            // We already processed the .field property, so ignore it.
            // Also ignore anything that isn't related to the field at hand.
            if (avMatch[2] === 'field' || avFields[index] !== field) {
                return;
            }
            // Pull rows[index] or initialize to an empty object
            const row = (rows[index] ??= {});
            // For jobs/slots, the actual value we want may be spread across multiple params
            // TODO: didn't we combine it into a single param?
            if (avMatch[2] === 'jobs' || avMatch[2] === 'slots') {
                row[avMatch[2]] = row[avMatch[2]] ? `${row[avMatch[2]]},${value}` : value;
            }
            else {
                row[avMatch[2]] = value;
            }
            return;
        }
    });
    return Object.keys(rows).sort((a, b) => Number(a) - Number(b)).map(index => rows[Number(index)]);
}

function reindexRows(grid: HTMLElement): void {
    grid.querySelectorAll<HTMLElement>('[data-advanced-search-row]').forEach((item, index) => {
        item.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name]').forEach(input => {
            const property = input.name.match(/\.([^.]*)$/)?.[1];
            if (property) {
                input.name = criterionName(index, property);
            }
        });
    });
}

function insertRowInFieldOrder(grid: HTMLElement, newRow: HTMLElement, fieldConfigs: FieldConfig[]): void {
    const field = newRow.dataset.field;
    const fieldIndex = fieldConfigs.findIndex(config => config.field === field);
    const nextRow = [...grid.querySelectorAll<HTMLElement>('[data-advanced-search-row]')]
        .find(existing => fieldConfigs.findIndex(config => config.field === existing.dataset.field) > fieldIndex);
    grid.insertBefore(newRow, nextRow || null);
}

function buildSelectedResultUrl(form: HTMLFormElement, selectedId: string): string {
    const grid = form.querySelector<HTMLElement>('.advanced-search-criteria-grid');
    if (grid) {
        reindexRows(grid);
    }
    const formData = new FormData(form);
    collapseClassJobParameters(formData);
    const params = new URLSearchParams(formData as unknown as URLSearchParams);
    params.set('selected', selectedId);
    const query = params.toString();
    return query ? `/Items/advanced-search?${query}` : '/Items/advanced-search';
}

function collapseClassJobParameters(formData: FormData): void {
    const jobParameterNames = new Set<string>();
    formData.forEach((_value, name) => {
        if (/^av\(\d+\)\.(jobs|slots)$/.test(name)) {
            jobParameterNames.add(name);
        }
    });
    jobParameterNames.forEach(name => {
        const jobs = formData.getAll(name)
            .flatMap(value => String(value).split(','))
            .map(job => job.trim())
            .filter(Boolean);
        formData.delete(name);
        if (jobs.length > 0) {
            formData.set(name, jobs.join(','));
        }
    });
}

declare global {
    interface Document {
        addEventListener(type: 'htmx:configRequest', listener: (this: Document, ev: CustomEvent<HtmxRequestConfig>) => void): void;
    }
}

document.addEventListener('htmx:configRequest', event => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || form.id !== 'advanced-search-form') {
        return;
    }
    const formData = event.detail.formData as FormData;
    collapseClassJobParameters(formData);
    const parameters = (event as CustomEvent<{
        parameters: Record<string, unknown>
    }>).detail.parameters;
    formData.forEach((value, name) => {
        if (/^av\(\d+\)\.(jobs|slots)$/.test(name)) {
            parameters[name] = value;
        }
    });
});

const validationErrorClearHandler = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
        return;
    }
    const row = event.target.closest<HTMLElement>('[data-advanced-search-row]');
    row?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name]')
        .forEach(input => input.setCustomValidity(''));
};

/**
 * The outer grid element for holding the criteria, including the buttons for adding more fields.
 *
 * Will start with either the default fields, or fields parsed from the current URL.
 */
class AdvancedSearchCriteriaGrid extends HTMLElement {

    private initialized: boolean = false;

    private readonly validationErrorHandler = (event: Event): void => {
        const customEvent = event as CustomEvent<{
            pushUrl?: string;
            invalidFields?: Record<string, string>;
        }>;
        const pushUrl = customEvent.detail?.pushUrl;
        const currentUrl = window.location.pathname + window.location.search;
        if (typeof pushUrl === 'string' && pushUrl !== currentUrl) {
            window.history.pushState({}, '', pushUrl);
        }

        const form = this.closest('form');
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        const invalidFields = customEvent.detail?.invalidFields ?? {};
        let firstInvalid: HTMLInputElement | null = null;
        for (const input of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name]')) {
            input.setCustomValidity('');
            const rawName = input.getAttribute('name');
            const message = rawName ? invalidFields[rawName] : undefined;
            if (message) {
                input.setCustomValidity(message);
                if (firstInvalid === null && input instanceof HTMLInputElement) {
                    firstInvalid = input;
                }
            }
        }

        if (firstInvalid !== null) {
            firstInvalid.reportValidity();
            firstInvalid.focus();
        }
        else {
            form.reportValidity();
        }
    };

    disconnectedCallback(): void {
        document.removeEventListener('advanced-search-validation-error', this.validationErrorHandler);
        this.removeEventListener('input', validationErrorClearHandler);
        this.removeEventListener('change', validationErrorClearHandler);
    }

    connectedCallback(): void {
        document.addEventListener('advanced-search-validation-error', this.validationErrorHandler);
        this.addEventListener('input', validationErrorClearHandler);
        this.addEventListener('change', validationErrorClearHandler);
        if (this.initialized) {
            console.log('AdvancedSearchCriteriaGrid: Already Initialized');
            return;
        }
        else {
            console.log('AdvancedSearchCriteriaGrid: Initializing...');
        }
        this.initialized = true;
        this.classList.add('advanced-search-criteria-grid');
        const form = this.closest('form');
        if (!form) {
            console.error('AdvancedSearchCriteriaGrid: Form Not Found!');
            return;
        }
        const fieldConfigs = readFieldConfigs();
        if (fieldConfigs.length === 0) {
            console.error('AdvancedSearchCriteriaGrid: FieldConfigs Not Found!');
            return;
        }

        const params = new URLSearchParams(window.location.search);
        // In order to preserve the 'selected' URL query param, use a hidden input
        const selectedSlot = el('span', {id: 'item-advanced-selected-field-slot'});
        const selected = params.get('selected');
        if (selected) {
            const selectedInput = el('input', {
                props: {
                    type: 'hidden',
                    name: 'selected',
                    value: selected,
                },
            });
            selectedSlot.replaceChildren(selectedInput);
        }

        const emptyState = elt('div', {
            id: 'advanced-search-empty-state',
            classes: ['item-search-empty'],
        })`Add a field to start.`;

        const grid = this;
        const footer = el('div', {classes: ['advanced-search-footer']});
        const addGroup = el('div', {classes: ['advanced-search-add-field-group']});

        const initialSort = {
            field: (params.get('sortField') as SortField) || 'ROW_ID',
            direction: (params.get('sortDirection') as SortDirection) || 'ASCENDING',
            baseParamId: params.get('sortBaseParamId') || '',
            withHqSpecial: params.getAll('sortWithHqSpecial').some(value => ['on', 'true', '1'].includes(value.toLowerCase())),
        };
        const sortField = selectControl<SortField>('sortField', initialSort.field, SORT_FIELDS);
        const sortDirection = selectControl<SortDirection>('sortDirection', initialSort.direction, SORT_DIRECTIONS);
        const baseParamConfig = fieldConfigs.find(config => config.field === 'baseParam') as BaseParamFieldConfig | undefined;
        const sortBaseParam = selectControl<string>('sortBaseParamId', initialSort.baseParamId, [
            ['', 'Select stat'],
            ...(baseParamConfig?.options || []).map(option => [option.id, {
                value: option.value,
                tooltip: option.tooltip,
            }] as [string, SelectOption]),
        ]);
        const baseParamOptions: BaseParamOption[] = (baseParamConfig?.options || [])
            .map(option => ({
                id: option.id,
                name: option.value,
                description: option.tooltip,
            }));
        const chooseSortStatButton = el('button', {
            attributes: {
                type: 'button',
                title: 'Select a stat',
            },
        }, [makeSearchIcon()]);
        chooseSortStatButton.addEventListener('click', () => {
            new BaseParamSearchModal(baseParamOptions, id => {
                sortBaseParam.value = id;
                sortBaseParam.dispatchEvent(new Event('change', {bubbles: true}));
            }).attachAndShowTop();
        });
        const sortBaseParamCell = el('div', {classes: ['advanced-search-sort-base-param-cell']}, [
            sortBaseParam,
            chooseSortStatButton,
        ]);
        const sortWithHqSpecialHidden = el('input', {
            props: {
                type: 'hidden',
                value: 'off',
            },
            attributes: {name: 'sortWithHqSpecial'},
        });
        // TODO: should be on by default
        const sortWithHqSpecial = el('input', {
            props: {
                type: 'checkbox',
                checked: params.getAll('sortWithHqSpecial').some(value => ['on', 'true', '1'].includes(value.toLowerCase())),
            },
            attributes: {name: 'sortWithHqSpecial'},
        });
        const sortWithHqSpecialLabel = el('label', {classes: ['advanced-search-checkbox-label']}, [
            sortWithHqSpecial,
            '+HQ/Special',
        ]);
        const sortWithHqSpecialCell = el('div', {classes: ['advanced-search-sort-hq-cell']}, [
            sortWithHqSpecialHidden,
            sortWithHqSpecialLabel,
        ]);
        const sortBaseParamRow = el('div', {classes: ['advanced-search-sort-row-line']}, [
            sortBaseParamCell,
        ]);
        const sortWithHqSpecialRow = el('div', {classes: ['advanced-search-sort-row-line']}, [
            sortWithHqSpecialCell,
        ]);
        const sortSpacerRow = el('div', {classes: ['advanced-search-sort-row-line', 'spacer']}, [
        ]);
        const updateSortBaseParamState = (): void => {
            const isBaseParam = sortField.value === 'BASE_PARAM';
            sortBaseParam.disabled = !isBaseParam;
            sortBaseParamCell.style.display = isBaseParam ? '' : 'none';
            sortWithHqSpecialHidden.disabled = !isBaseParam;
            sortWithHqSpecial.disabled = !isBaseParam;
            sortWithHqSpecialCell.style.display = isBaseParam ? '' : 'none';
            sortBaseParamRow.style.display = isBaseParam ? '' : 'none';
            sortWithHqSpecialRow.style.display = isBaseParam ? '' : 'none';
        };
        sortField.addEventListener('change', updateSortBaseParamState);
        const sortControls = el('div', {classes: ['advanced-search-sort-controls']}, [
            sortField,
            sortDirection,
        ]);
        const sortRow = el('div', {classes: ['advanced-search-sort-row']}, [
            el('div', {classes: ['advanced-search-sort-row-line']}, [
                elt('div', {classes: ['advanced-search-row-cell', 'advanced-search-row-field-cell']})`Sort by`,
                sortControls,
            ]),
            sortBaseParamRow,
            sortWithHqSpecialRow,
            sortSpacerRow,
        ]);
        grid.prepend(sortRow);
        updateSortBaseParamState();

        const categoryLabels: Record<'Basic' | 'Advanced', string> = {
            Basic: 'Basic Properties',
            Advanced: 'Advanced Properties',
        };
        (['Basic', 'Advanced'] as const).forEach(category => {
            const categoryGroup = el('div', {classes: ['advanced-search-add-field-category']});
            categoryGroup.appendChild(elt('h3', {classes: ['advanced-search-add-field-category-header']})`${categoryLabels[category]}`);
            const categoryButtons = el('div', {classes: ['advanced-search-add-field-category-buttons']});
            fieldConfigs.filter(config => config.category === category).forEach(config => {
                const button = el('button', {
                    classes: ['advanced-search-add-field-button'],
                    props: {type: 'button'},
                });
                button.dataset.addField = config.field;
                button.textContent = config.label;
                button.title = `Add a filter for '${config.label}'`;
                categoryButtons.appendChild(button);
            });
            categoryGroup.appendChild(categoryButtons);
            addGroup.appendChild(categoryGroup);
        });

        // Submit behavior is handled by htmx
        const actions = el('div', {classes: ['advanced-search-actions']});
        const submit = elt('button', {props: {type: 'submit'}})`Search`;
        const reset = elt('button', {
            class: 'reset-button',
            props: {type: 'button'},
        })`Reset`;
        const revert = elt('button', {
            class: 'revert-button',
            props: {type: 'button'},
        })`Revert`;
        actions.append(submit, reset, revert);
        footer.append(actions, addGroup);
        form.replaceChildren(selectedSlot, emptyState, grid, footer);

        const updateEmptyState = () => {
            emptyState.hidden = grid.querySelector('[data-field]') !== null;
        };

        grid.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target.closest('[data-remove-row]') : null;
            const newRow = target?.closest('[data-advanced-search-row]');
            if (newRow) {
                newRow.remove();
                updateEmptyState();
                updateRevertState();
            }
        });

        const rowsByField = new Map(fieldConfigs.map(config => [config.field, queryRowsForField(params, config.field)]));
        const hasQueryRows = [...rowsByField.values()].some(rows => rows.length > 0);
        const initialRows: Array<{
            config: FieldConfig,
            values: Record<string, string>
        }> = [];
        fieldConfigs.forEach(config => {
            const rows = rowsByField.get(config.field) || [];
            if (!hasQueryRows && config.default && rows.length === 0) {
                rows.push({
                    operator: 'CONTAINS',
                    value: '',
                });
            }
            rows.forEach(values => initialRows.push({
                config,
                values,
            }));
        });

        // TODO: refactor this
        const renderRows = (rows: Array<{
            config: FieldConfig,
            values: Record<string, string>
        }>): void => {
            grid.querySelectorAll<HTMLElement>('[data-advanced-search-row]').forEach(existing => existing.remove());
            rows.forEach((input) => grid.appendChild(makeRowElement(input.config, 0, input.values)));
            reindexRows(grid);
            updateEmptyState();
        };

        // TODO: refactor this
        const rowsSignature = (rows: Array<{
            config: FieldConfig,
            values: Record<string, string>
        }>): string => JSON.stringify(rows.map((input) => ({
            field: input.config.field,
            values: Object.fromEntries(Object.entries(input.values).sort(([a], [b]) => a.localeCompare(b))),
        })));
        const currentSort = (): {
            field: SortField,
            direction: SortDirection,
            baseParamId: string,
            withHqSpecial: boolean
        } => ({
            field: sortField.value as SortField,
            direction: sortDirection.value as SortDirection,
            baseParamId: sortBaseParam.value,
            withHqSpecial: sortWithHqSpecial.checked,
        });
        const sortSignature = (values: {
            field: SortField,
            direction: SortDirection,
            baseParamId: string,
            withHqSpecial: boolean
        }): string =>
            JSON.stringify(values);
        const currentRows = (): Array<{
            config: FieldConfig,
            values: Record<string, string>
        }> => {
            reindexRows(grid);
            const formData = new FormData(form);
            collapseClassJobParameters(formData);
            const currentParams = new URLSearchParams(formData as unknown as URLSearchParams);
            return fieldConfigs.flatMap(config => queryRowsForField(currentParams, config.field)
                .map(values => ({
                    config,
                    values,
                })));
        };
        let checkpointRows = initialRows;
        let checkpointSort = initialSort;
        const updateRevertState = (): void => {
            revert.disabled = rowsSignature(currentRows()) === rowsSignature(checkpointRows)
                && sortSignature(currentSort()) === sortSignature(checkpointSort);
        };

        renderRows(checkpointRows);
        updateRevertState();

        reset.addEventListener('click', () => {
            renderRows([]);
            sortField.value = 'ROW_ID';
            sortDirection.value = 'ASCENDING';
            sortBaseParam.value = '';
            sortWithHqSpecial.checked = false;
            updateSortBaseParamState();
            updateRevertState();
        });
        revert.addEventListener('click', () => {
            renderRows(checkpointRows);
            sortField.value = checkpointSort.field;
            sortDirection.value = checkpointSort.direction;
            sortBaseParam.value = checkpointSort.baseParamId;
            sortWithHqSpecial.checked = checkpointSort.withHqSpecial;
            updateSortBaseParamState();
            updateRevertState();
        });
        grid.addEventListener('input', updateRevertState);
        grid.addEventListener('change', updateRevertState);

        addGroup.querySelectorAll<HTMLElement>('[data-add-field]').forEach(button => button.addEventListener('click', () => {
            const field = button.dataset.addField;
            if (!field) {
                return;
            }
            const config = fieldConfigs.find(candidate => candidate.field === field);

            const count = grid.querySelectorAll(`[data-field="${field}"]`).length;
            if (!config || (!config.allowMultiple && count > 0)) {
                return;
            }
            const newRow = makeRowElement(config, count, {});
            insertRowInFieldOrder(grid, newRow, fieldConfigs);
            reindexRows(grid);
            updateEmptyState();
            updateRevertState();
        }));
        reindexRows(grid);
        updateEmptyState();

        // Actual form behavior is driven by HTMX, this just prepares the fields for submission
        form.addEventListener('submit', () => {
            reindexRows(grid);
            checkpointRows = currentRows();
            checkpointSort = currentSort();
            updateRevertState();
        });

        document.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target.closest('[data-advanced-push-url]') : null;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            const selectedId = target.dataset.advancedSelectedId;
            if (selectedId) {
                target.setAttribute('hx-push-url', buildSelectedResultUrl(form, selectedId));
            }
        }, true);
    }
}

customElements.define('advanced-search-criteria-grid', AdvancedSearchCriteriaGrid);
