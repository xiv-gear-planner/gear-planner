import {BaseModal} from "@xivgear/common-ui/components/modal";
import {ACCOUNT_STATE_TRACKER, AccountStateTracker} from "../account_state";
import {labeledCheckbox, makeActionButton, quickElement} from "@xivgear/common-ui/components/util";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";

class AccountModal extends BaseModal {
    private readonly loadingBlocker: LoadingBlocker;
    constructor(tracker: AccountStateTracker) {
        super();
        this.headerText = 'Account';
        this.loadingBlocker = new LoadingBlocker();
        this.loadingBlocker.classList.add('with-bg');
        this.inner.appendChild(this.loadingBlocker);
        this.contentArea.appendChild(new AccountManagementInner(tracker, this.loadingBlocker));
    }
}

class AccountManagementInner extends HTMLElement {

    constructor(private readonly tracker: AccountStateTracker, private readonly loadingBlocker: LoadingBlocker) {
        super();
        this.style.position = 'relative';
        this.loadingBlocker.style.position = 'absolute';
        this.loadingBlocker.style.inset = '0 0 0 0';
        this.refresh();
    }

    showLoadingBlocker(): void {
        this.loadingBlocker.show();
    }

    hideLoadingBlocker(): void {
        this.loadingBlocker.hide();
    }

    indicateLoading<P extends unknown[], R>(f: (...args: P) => Promise<R>): (...args: P) => Promise<R> {
        return async (...args: P) => {
            this.showLoadingBlocker();
            return await f(...args).finally(() => this.hideLoadingBlocker());
        };
    }

    refresh(): void {
        this.hideLoadingBlocker();
        // States:
        // Logged in, verified: Display account management (display name change, email change).
        // Logged in, not verified: Display verification code form, with option to enter code or resend code.
        // Not logged in: Display login form and registration form.
        if (this.tracker.loggedIn) {
            const accountState = this.tracker.accountState;
            const text = quickElement('span', [], ['Logged in as:', quickElement('br'), accountState.email]);
            const logoutButton = makeActionButton('Log Out', this.indicateLoading(async () => {
                await this.tracker.logout();
                this.refresh();
            }));
            if (!accountState.verified) {
                // UI for verifying email.
                const txt = quickElement('span', [], ['You have not verified your email yet. If you have just registered, you should have received a code in your email.']);
                const verificationCodeInput = quickElement('input', ['verification-code-input'], []);
                verificationCodeInput.placeholder = 'Verification Code';
                verificationCodeInput.type = 'text';
                const submitButton = makeActionButton('Submit', () => {
                });
                submitButton.type = 'submit';
                const resendButton = makeActionButton('Resend', () => this.indicateLoading(async () => {
                    try {
                        await this.tracker.resendVerificationCode(); // TODO test
                        alert('Verification code resent');
                    }
                    catch (e) {
                        console.error("error re-sending verification code", e);
                        alert('There was an error sending the verification code. Please try again later.');
                    }
                })());
                const verifyForm = quickElement('form', [], [txt, verificationCodeInput, resendButton, submitButton]);
                verifyForm.addEventListener('submit', this.indicateLoading(async (e) => {
                    e.preventDefault();
                    verificationCodeInput.classList.remove('failed');
                    const verified = await this.tracker.submitVerificationCode(parseInt(verificationCodeInput.value)); // TODO test
                    if (verified) {
                        this.refresh();
                    }
                    else {
                        verificationCodeInput.classList.add('failed');
                    }
                }));
                this.replaceChildren(text, quickElement('br'), logoutButton, verifyForm);
            }
            else {
                this.replaceChildren(text, quickElement('br'), logoutButton);

            }
        }
        else {
            // Login section
            const children: HTMLElement[] = [];
            {
                const loginHeader = quickElement('h3', [], ['Login']);
                const email = quickElement('input', ['email-field'], []);
                email.type = 'email';
                email.placeholder = 'Email';
                email.autocomplete = 'email';
                const passwordField = quickElement('input', ['password-field'], []);
                passwordField.type = 'password';
                passwordField.placeholder = 'Password';
                passwordField.autocomplete = 'current-password';
                const submitButton = makeActionButton('Login', () => {
                });
                submitButton.type = 'submit';

                const loginForm = quickElement('form', ['login-form'], [loginHeader, email, passwordField, submitButton]);
                loginForm.addEventListener('submit', this.indicateLoading(async (e) => {
                    e.preventDefault();
                    const accountInfo = await this.tracker.login(email.value, passwordField.value);
                    if (accountInfo === null) {
                        // Login failed
                        loginHeader.classList.add('failed');
                        loginHeader.textContent = 'Login Failed';
                    }
                    else {
                        // Login succeeded
                        await this.tracker.refreshInfo();
                        this.refresh();
                    }
                }));
                children.push(loginForm);
            }
            // Divider
            {
                const divider = quickElement('h3', ['divider-heading'], ['OR']);
                children.push(divider);
            }
            // Register section
            {
                const registerHeader = quickElement('h3', [], ['Register']);
                const email = quickElement('input', ['email-field'], []);
                email.type = 'email';
                email.placeholder = 'Email (Not Displayed Publicly)';
                email.autocomplete = 'email';
                email.setAttribute('validation-field', 'email');
                const passwordField = quickElement('input', ['password-field'], []);
                passwordField.type = 'password';
                passwordField.placeholder = 'Password';
                passwordField.autocomplete = 'new-password';
                passwordField.setAttribute('validation-field', 'password');
                const passwordRepeatField = quickElement('input', ['password-field'], []);
                passwordRepeatField.type = 'password';
                passwordRepeatField.placeholder = 'Repeat Password';
                passwordRepeatField.autocomplete = 'new-password';
                passwordRepeatField.setAttribute('validation-field', 'password');
                const displayName = quickElement('input', ['display-name-field'], []);
                displayName.type = 'text';
                displayName.placeholder = 'Display Name (May Be Changed)';
                displayName.autocomplete = 'username';
                displayName.setAttribute('validation-field', 'displayName');
                // TODO: captcha

                const privacyCheckbox = document.createElement('input');
                privacyCheckbox.type = 'checkbox';
                const privacyCbl = labeledCheckbox(quickElement('span', [], ['I agree to the Privacy Policy']), privacyCheckbox);
                privacyCheckbox.addEventListener('change', () => {
                    privacyCbl.classList.remove('failed');
                });

                const submitButton = makeActionButton('Register', () => {
                });
                submitButton.type = 'submit';
                const registrationForm = quickElement('form', ['register-form'], [
                    registerHeader,
                    email,
                    passwordField,
                    passwordRepeatField,
                    displayName,
                    privacyCbl,
                    submitButton,
                ]);

                function resetValidity() {
                    // Clear existing validation highlights
                    registrationForm.querySelectorAll('.failed').forEach(el => el.classList.remove('failed'));
                }

                // We handle the validation ourselves, so we don't want the default behavior
                registrationForm.setAttribute("novalidate", "true");
                registrationForm.addEventListener('invalid', () => {
                    resetValidity();
                    registrationForm.requestSubmit();
                });
                registrationForm.addEventListener('submit', this.indicateLoading(async (e) => {
                    e.preventDefault();
                    if (passwordField.value !== passwordRepeatField.value) {
                        alert('Passwords do not match');
                        return;
                    }
                    if (!privacyCheckbox.checked) {
                        privacyCbl.classList.add('failed');
                        return;
                    }
                    const result = await this.tracker.register(email.value, passwordField.value, displayName.value);
                    if ('validationErrors' in result) {

                        console.warn('Validation errors', result.validationErrors);

                        resetValidity();

                        // Check response
                        result.validationErrors.forEach(err => {
                            function markInvalid(el: HTMLElement) {
                                el.classList.add('failed');
                                if (el instanceof HTMLInputElement) {
                                    el.focus();
                                    el.setCustomValidity(err.message);
                                }
                                else {
                                    const ele = el.querySelector('input');
                                    ele?.focus();
                                    ele?.setCustomValidity(err.message);
                                }
                            }

                            registrationForm.querySelectorAll(`[validation-path="${err.path}"]`).forEach(markInvalid);
                            registrationForm.querySelectorAll(`[validation-field="${err.field}"]`).forEach(markInvalid);
                        });

                        // Overall status
                        registerHeader.classList.add('failed');
                    }
                    else {
                        // Login succeeded
                        await this.tracker.refreshInfo();
                        this.refresh();
                    }
                }));
                children.push(registrationForm);
            }
            this.replaceChildren(...children);

        }
    }
}

export function showAccountModal() {
    new AccountModal(ACCOUNT_STATE_TRACKER).attachAndShow();
}

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        showAccountModal?: typeof showAccountModal;
    }
}
window.showAccountModal = showAccountModal;

customElements.define('account-modal', AccountModal);
customElements.define('account-inner', AccountManagementInner);
