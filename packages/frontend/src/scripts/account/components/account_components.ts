import {BaseModal} from "@xivgear/common-ui/components/modal";
import {ACCOUNT_STATE_TRACKER, AccountStateTracker, ACCOUNT_STATE_BROADCAST_CHANNEL, TokenState} from "../account_state";
import {labeledCheckbox, makeActionButton, quickElement} from "@xivgear/common-ui/components/util";
import {ValidatingForm, vfWrap} from "@xivgear/common-ui/components/forms/validating_form";
import {
    RegisterResponse,
    ValidationErrorResponse,
    ValidationErrorSingle
} from "@xivgear/account-service-client/accountsvc";
import {passwordWithRepeat} from "@xivgear/common-ui/components/forms/form_elements";
import {showPrivacyPolicyModal} from "../../components/ads";
import {ChangePasswordModal} from "./change_password_modal";
import {LogoutModal} from "./logout_modal";
import {SheetPickerTable} from "../../components/saved_sheet_picker";
import {USER_DATA_SYNCER} from "../user_data";

class AccountModal extends BaseModal {

    constructor(tracker: AccountStateTracker) {
        super();
        this.headerText = 'Account';
        this.contentArea.appendChild(new AccountManagementInner(tracker, b => this.loadingBlockerVisible = b));
    }
}

class AccountManagementInner extends HTMLElement {

    constructor(private readonly tracker: AccountStateTracker, private readonly loadingBlockerHook: (blocked: boolean) => void) {
        super();
        this.style.position = 'relative';
        this.refresh();
    }

    showLoadingBlocker(): void {
        this.loadingBlockerHook(true);
    }

    hideLoadingBlocker(): void {
        this.loadingBlockerHook(false);
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
            const elements: Node[] = [];
            const accountState = this.tracker.accountState;
            const text = quickElement('span', [], ['Logged in as:', quickElement('br'), accountState.email]);
            elements.push(text);
            elements.push(quickElement('br'));
            const chgPassButton = makeActionButton('Change Password', () => {
                new ChangePasswordModal(this.tracker, () => this.refresh()).attachAndShowTop();
            });
            elements.push(chgPassButton);
            const logoutButton = makeActionButton('Log Out', this.indicateLoading(async () => {
                new LogoutModal(this.tracker, () => this.refresh()).attachAndShowTop();
            }));
            elements.push(logoutButton);
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
                elements.push(verifyForm);
            }
            this.replaceChildren(...elements);
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
                const pwrf = passwordWithRepeat();
                const displayName = quickElement('input', ['display-name-field'], []);
                displayName.type = 'text';
                displayName.placeholder = 'Display Name (May Be Changed)';
                displayName.autocomplete = 'username';
                displayName.setAttribute('validation-field', 'displayName');
                // TODO: captcha if required

                const privacyCheckbox = document.createElement('input');
                privacyCheckbox.type = 'checkbox';
                const privacyLink = quickElement('a', [], ['Privacy Policy']);
                privacyLink.href = '#';
                privacyLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    showPrivacyPolicyModal();
                });
                const privacyCbl = labeledCheckbox(quickElement('span', [], ['I agree to the ', privacyLink]), privacyCheckbox);
                privacyCheckbox.addEventListener('change', () => {
                    privacyCbl.classList.remove('failed');
                });
                privacyCbl.setAttribute('validation-field', 'privacy');

                const cookieCheckbox = document.createElement('input');
                cookieCheckbox.type = 'checkbox';
                const cookieCbl = labeledCheckbox(quickElement('span', [], ['I consent to cookies (required for account services)']), cookieCheckbox);
                cookieCbl.addEventListener('change', () => {
                    cookieCbl.classList.remove('failed');
                });
                cookieCbl.setAttribute('validation-field', 'cookie');

                const submitButton = makeActionButton('Register', () => {
                });
                submitButton.type = 'submit';
                const outer = this;
                const registrationForm = new ValidatingForm<RegisterResponse>({
                    afterSubmitAttempt(valid: boolean): void {
                        if (valid) {
                            registerHeader.classList.remove('failed');
                        }
                        else {
                            registerHeader.classList.add('failed');
                        }
                    },
                    children: [
                        registerHeader,
                        email,
                        pwrf.passwordField,
                        pwrf.passwordRepeatField,
                        displayName,
                        privacyCbl,
                        cookieCbl,
                        submitButton,
                    ],
                    async onSuccess(value: RegisterResponse): Promise<void> {
                        // Login succeeded
                        await outer.tracker.refreshInfo();
                        outer.refresh();
                    },
                    preValidate(): ValidationErrorSingle[] | null {
                        const out: ValidationErrorSingle[] = [];
                        if (!privacyCheckbox.checked) {
                            out.push({
                                field: 'privacy',
                                message: 'You must agree to the privacy policy',
                            });
                        }
                        if (!cookieCheckbox.checked) {
                            out.push({
                                field: 'cookie',
                                message: 'You must consent to cookies as they are required to log in',
                            });
                        }
                        if (!pwrf.isValid()) {
                            out.push({
                                field: 'password',
                                message: 'Passwords do not match',
                            });
                        }
                        return out;
                    },
                    submit(): Promise<ValidationErrorResponse | RegisterResponse> {
                        return outer.tracker.register(email.value, pwrf.getValue(), displayName.value);
                    },
                    wrapper: vfWrap(() => this.showLoadingBlocker(), () => this.hideLoadingBlocker()),
                });

                children.push(registrationForm);
            }
            this.replaceChildren(...children);

        }
    }
}

export function showAccountModal() {
    new AccountModal(ACCOUNT_STATE_TRACKER).attachAndShowExclusively();
}

export function setupAccountUi() {
    // First, find the button
    const accountButton = document.querySelector('#account-button');
    if (!accountButton) {
        console.error("Could not find account button");
        reportError('Could not find account button');
        return;
    }
    accountButton.addEventListener('click', (e) => {
        e.preventDefault();
        showAccountModal();
    });
    const accountButtonText = accountButton.lastElementChild;
    ACCOUNT_STATE_TRACKER.addAccountStateListener((tracker, after, before) => {
        const body = document.querySelector('body');
        if (!body) {
            return;
        }
        if (tracker.loggedIn) {
            if (tracker.accountState.verified) {
                body.setAttribute('data-accountstate', 'logged-in-verified');
            }
            else {
                body.setAttribute('data-accountstate', 'logged-in-unverified');
            }
            accountButtonText.textContent = 'Account';
            if (tracker.token === null) {
                body.setAttribute('data-tokenstate', 'not-loaded');
            }
            else {
                if (tracker.hasVerifiedToken) {
                    body.setAttribute('data-tokenstate', 'verified');
                }
                else {
                    body.setAttribute('data-tokenstate', 'not-verified');
                }
            }
        }
        else {
            accountButtonText.textContent = 'Log In';
            body.setAttribute('data-accountstate', 'not-logged-in');
            body.setAttribute('data-tokenstate', 'not-logged-in');
        }
        // Also update a body-level class
    });
    // Refresh sheet picker after transitioning from logged out to logged in,
    // but only if the sheet picker table is visible
    ACCOUNT_STATE_TRACKER.addTokenListener((oldState: TokenState | null, newState: TokenState) => {
        console.log('token state changed', newState, oldState);
        if (newState.verified && !oldState?.verified) {
            document.querySelectorAll('table').forEach(table => {
                if (table instanceof SheetPickerTable) {
                    USER_DATA_SYNCER.triggerRefreshNow();
                }
            });
        }
    });
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
