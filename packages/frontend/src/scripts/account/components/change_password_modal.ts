import {BaseModal} from "@xivgear/common-ui/components/modal";
import {passwordWithRepeat} from "@xivgear/common-ui/components/forms/form_elements";
import {makeActionButton, quickElement} from "@xivgear/common-ui/components/util";
import {ValidatingForm, ValidationErrorSingle, vfWrap} from "@xivgear/common-ui/components/forms/validating_form";
import {ChangePasswordResponse, ValidationErrorResponse} from "@xivgear/account-service-client/accountsvc";
import {AccountStateTracker} from "../account_state";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";

export class ChangePasswordModal extends BaseModal {
    private readonly loadingBlocker: LoadingBlocker;

    constructor(private readonly acs: AccountStateTracker, private readonly afterPwChange: () => void) {
        super();

        this.loadingBlocker = new LoadingBlocker();
        this.loadingBlocker.classList.add('with-bg');
        this.loadingBlocker.style.position = 'absolute';
        this.loadingBlocker.style.inset = '0 0 0 0';
        this.hideLoadingBlocker();
        this.inner.appendChild(this.loadingBlocker);

        const outer = this;
        this.headerText = 'Change Password';
        const curPassField = quickElement('input', ['password-field'], []);
        curPassField.type = 'password';
        curPassField.placeholder = 'Current Password';
        curPassField.autocomplete = 'current-password';
        curPassField.setAttribute('validation-field', 'currentPassword');
        const pwrf = passwordWithRepeat('New Password', 'newPassword');

        const submitButton = makeActionButton('Change', () => {
        });
        submitButton.type = 'submit';
        const cancelButton = makeActionButton('Cancel', () => outer.close());
        const buttonArea = quickElement('div', ['button-area'], [submitButton, cancelButton]);

        const form = new ValidatingForm<ChangePasswordResponse>({
            async submit(): Promise<ValidationErrorResponse | ChangePasswordResponse> {
                const result = await outer.acs.changePassword(curPassField.value, pwrf.passwordField.value);
                // TODO: consider making a "post validation" method in ValidatingForm that makes this a bit cleaner
                if ('passwordCorrect' in result && !result.passwordCorrect) {
                    return {
                        validationErrors: [{
                            field: 'currentPassword',
                            message: 'Incorrect Password',
                        }],
                    } satisfies ValidationErrorResponse;
                }
                return result;
            },
            children: [
                curPassField,
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
            async onSuccess(value: ChangePasswordResponse): Promise<void> {
                alert('Your password has been changed.');
                // TODO: this needs to refresh the account modal
                outer.close();
                afterPwChange();
            },
            wrapper: vfWrap(() => outer.showLoadingBlocker(), () => outer.hideLoadingBlocker()),
        });
        this.contentArea.appendChild(form);
    }

    showLoadingBlocker(): void {
        this.loadingBlocker.show();
    }

    hideLoadingBlocker(): void {
        this.loadingBlocker.hide();
    }
}

customElements.define('change-password-modal', ChangePasswordModal);
