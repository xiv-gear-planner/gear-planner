import {quickElement} from "../util";

export interface ValidationErrorResponse {
    validationErrors?: ValidationErrorSingle[];
}

export interface ValidationErrorSingle {
    path?: string;
    field?: string;
    message?: string;
}

export function vfWrap(before: () => void, after: () => void): ValidatingFormWrapper {
    return {
        before,
        after,
    };
}

export type ValidatingFormWrapper = {
    before: () => void,
    after: () => void,
}

/**
 * A form with some built-in validation helpers.
 */
export class ValidatingForm<Response extends object> extends HTMLFormElement {

    constructor(args: {
        /**
         * Child elements to add
         */
        children?: (string | Node)[],
        // Pre-hook prior to async function
        /**
         * Pre-hook to validate synchronously, before any async behavior is invoked.
         * Returns the validation messages (empty list indicates no issues).
         */
        preValidate?: () => ValidationErrorSingle[],
        /**
         * Function to be called when pre-validation passes.
         */
        submit: () => Promise<Response | ValidationErrorResponse>,
        /**
         * wrapper.before is invoked before async processing starts, while wrapper.after is invoked
         * afterwards. This is useful for showing a loading indicator.
         */
        wrapper?: ValidatingFormWrapper,
        /**
         * Called after a submit attempt which makes it to any stage whatsoever.
         *
         * @param valid whether the submission went through or not.
         */
        afterSubmitAttempt?: (valid: boolean) => void,
        /**
         * Called after a successful submission.
         *
         * @param value The result of `submit`
         */
        onSuccess: (value: Response) => Promise<void>,
        /**
         * Custom function to display validity messages
         *
         * @param messages Messages if there are errors, empty if not.
         */
        validationMessageDisplayer?: (messages: ValidationErrorSingle[]) => void,
    }) {
        super();
        this.classList.add('validating-form');
        const validationMessageInner = quickElement('div', ['validation-message-inner'], []);
        const validationMessageClose = quickElement('button', ['validation-message-close'], ['X']);
        validationMessageClose.type = 'button';
        const validationMessage = quickElement('div', ['validation-message-holder'], [validationMessageClose, validationMessageInner]);
        validationMessageClose.addEventListener('click', () => {
            validationMessage.classList.remove('failed');
        });
        this.replaceChildren(validationMessage, ...args.children ?? []);
        // We handle the validation ourselves, so we don't want the default behavior
        this.setAttribute("novalidate", "true");
        this.addEventListener('invalid', () => {
            this.resetValidity();
            this.requestSubmit();
        });

        function makeWrapper<P extends unknown[], R>(f: (...p: P) => Promise<R>): (...p: P) => Promise<R> {
            return async (...p: P) => {
                args.wrapper?.before();
                return await f(...p).finally(() => args.wrapper?.after());
            };
        }

        const processValidationErrors = (errors: ValidationErrorSingle[] | null) => {
            if (errors !== null && errors.length > 0) {
                errors.forEach(err => {
                    function markInvalid(el: Element) {
                        el.classList.add('failed');
                        if (el instanceof HTMLInputElement) {
                            el.focus();
                            el.setCustomValidity(err.message ?? 'Invalid input');
                        }
                        else {
                            const ele = el.querySelector('input');
                            ele?.focus();
                            ele?.setCustomValidity(err.message ?? 'Invalid input');
                        }
                    }

                    this.querySelectorAll(`[validation-path="${err.path}"]`).forEach(markInvalid);
                    this.querySelectorAll(`[validation-field="${err.field}"]`).forEach(markInvalid);
                });
                args.afterSubmitAttempt?.(false);
                if (args.validationMessageDisplayer) {
                    args.validationMessageDisplayer?.(errors);
                }
                else {
                    validationMessageInner.textContent = errors[0].message ?? "";
                    validationMessage.classList.add('failed');
                }
                this.reportValidity();
            }
        };
        this.addEventListener('submit', makeWrapper(async (e) => {
            this.resetValidity();
            e.preventDefault();
            if (args.preValidate) {
                const errors = args.preValidate();
                if (errors.length > 0) {
                    processValidationErrors(errors);
                    args.afterSubmitAttempt?.(false);
                    this.reportValidity();
                    return;
                }
            }
            const result: Response | ValidationErrorResponse = await args.submit();
            if ('validationErrors' in result) {
                console.warn('Validation errors', result.validationErrors);
                processValidationErrors(result.validationErrors ?? null);
            }
            else {
                args.afterSubmitAttempt?.(true);
                await args.onSuccess(result as Response);
            }
        }));
    }

    resetValidity(): void {
        // Clear existing validation highlights
        this.querySelectorAll('.failed').forEach(el => el.classList.remove('failed'));
        this.querySelectorAll('input').forEach(el => el.setCustomValidity(""));
    }
}

customElements.define('validating-form', ValidatingForm, {extends: 'form'});
