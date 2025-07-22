import {BaseModal} from "@xivgear/common-ui/components/modal";
import {AccountStateTracker} from "../account_state";
import {makeActionButton, quickElement} from "@xivgear/common-ui/components/util";
import {passwordWithRepeat} from "@xivgear/common-ui/components/forms/form_elements";
import {ValidatingForm, ValidationErrorSingle, vfWrap} from "@xivgear/common-ui/components/forms/validating_form";
import {ValidationErrorResponse} from "@xivgear/account-service-client/accountsvc";

export class FinalizePasswordResetModal extends BaseModal {

    constructor(email: string, private readonly acs: AccountStateTracker) {
        super();
        const outer = this;
        this.headerText = 'Reset Password';
        const text = quickElement('span', [], ['Please enter the code we sent to ', quickElement('b', [], [email]), '.']);
        const tokenField = quickElement('input', ['password-field'], []);
        tokenField.placeholder = 'Password Reset Code';
        tokenField.pattern = '[0-9]*';
        tokenField.inputMode = 'numeric';
        // TODO: should this be data-validation-field
        tokenField.setAttribute('validation-field', 'token');
        const pwrf = passwordWithRepeat('New Password', 'newPassword');

        const submitButton = makeActionButton('Submit', () => {
        });
        submitButton.type = 'submit';
        const cancelButton = makeActionButton('Cancel', () => outer.close());
        const buttonArea = quickElement('div', ['button-area'], [submitButton, cancelButton]);

        const form = new ValidatingForm<'success'>({
            async submit(): Promise<ValidationErrorResponse | 'success'> {
                return await outer.acs.finalizePasswordReset(email, parseInt(tokenField.value), pwrf.passwordField.value);
            },
            children: [
                text,
                tokenField,
                pwrf.passwordField,
                pwrf.passwordRepeatField,
                buttonArea,
            ],
            preValidate(): ValidationErrorSingle[] | null {
                const out: ValidationErrorSingle[] = [];
                if (!pwrf.isValid()) {
                    out.push({
                        field: 'password',
                        message: 'Passwords do not match',
                    });
                }
                return out;
            },
            async onSuccess(value: 'success'): Promise<void> {
                alert('Your password has been changed. You can now log in with the new password.');
                // Don't refresh the account modal - we want the email to stay
                outer.close();
            },
            wrapper: vfWrap(() => outer.showLoadingBlocker(), () => outer.hideLoadingBlocker()),
        });
        this.contentArea.appendChild(form);
    }
}

customElements.define('finalize-password-reset-modal', FinalizePasswordResetModal);
