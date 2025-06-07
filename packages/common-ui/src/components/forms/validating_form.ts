export interface ValidationErrorResponse {
    validationErrors?: ValidationErrorSingle[];
}

export interface ValidationErrorSingle {
    path?: string;
    field?: string;
    message?: string;
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
         * Pre-hook to validate synchronously, before any async behavior is invoked
         */
        preValidate?: () => boolean,
        /**
         * Function to be called when pre-validation passes.
         */
        submit: () => Promise<Response | ValidationErrorResponse>,
        /**
         * wrapper.before is invoked before async processing starts, while wrapper.after is invoked
         * afterwards. This is useful for showing a loading indicator.
         */
        wrapper?: {
            before: () => void,
            after: () => void
        },
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
    }) {
        super();
        if (args.children) {
            this.replaceChildren(...args.children);
        }
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
        this.addEventListener('submit', makeWrapper(async (e) => {
            this.resetValidity();
            e.preventDefault();
            if (args.preValidate && !args.preValidate()) {
                args.afterSubmitAttempt?.(false);
                this.reportValidity();
                return;
            }
            const result: Response | ValidationErrorResponse = await args.submit();
            if ('validationErrors' in result) {
                console.warn('Validation errors', result.validationErrors);
                result.validationErrors?.forEach(err => {
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
                this.reportValidity();
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
