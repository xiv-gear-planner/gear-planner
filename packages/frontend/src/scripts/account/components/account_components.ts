import {BaseModal} from "@xivgear/common-ui/components/modal";
import {AccountStateTracker} from "../account_state";
import {makeActionButton, quickElement} from "@xivgear/common-ui/components/util";

class AccountModal extends BaseModal {
    constructor(tracker: AccountStateTracker) {
        super();
        this.headerText = 'Account';
        this.contentArea.appendChild(new AccountManagementInner(tracker));
    }
}

class AccountManagementInner extends HTMLElement {
    constructor(private readonly tracker: AccountStateTracker) {
        super();
    }

    refresh(): void {
        if (this.tracker.loggedIn) {
            const accountState = this.tracker.accountState;
            const text = quickElement('span', [], [`Logged in as ${accountState.email}`]);
            // TODO: show email verification input, and resend button
            const logoutButton = makeActionButton('Log Out', () => {
                // this.tracker.logOut(); // TODO
            });
            if (!accountState.verified) {
                const verificationCodeInput = quickElement('input', ['verification-code-input'], []);
                verificationCodeInput.placeholder = 'Verification Code';
                const submitButton = makeActionButton('Submit', () => {
                });
                const resendButton = makeActionButton('Resend', () => {
                    // this.tracker.resendVerificationCode(); // TODO
                });
                const verifyForm = quickElement('form', [], [verificationCodeInput, submitButton]);
                verifyForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    // await this.tracker.submitVerificationCode(verificationCodeInput.value); // TODO
                });
            }
            this.replaceChildren(text, logoutButton);
        }
        else {
            // Login section
            {
                const loginHeader = quickElement('h3', [], ['Login']);
                const email = quickElement('input', ['email-field'], []);
                email.type = 'email';
                email.placeholder = 'Email';
                const passwordField = quickElement('input', ['password-field'], []);
                passwordField.type = 'password';
                passwordField.placeholder = 'Password';
                const submitButton = makeActionButton('Login', () => {
                });
                submitButton.type = 'submit';

                const loginForm = quickElement('form', ['login-form'], [loginHeader, email, passwordField]);
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const accountInfo = await this.tracker.login(email.value, passwordField.value);
                    if (accountInfo === null) {
                        // Login failed
                        alert('Login failed');
                    }
                    else {
                        // Login succeeded
                        this.refresh();
                    }
                });
            }
            // Register section
            {
                const registerHeader = quickElement('h3', [], ['Register']);
                const email = quickElement('input', ['email-field'], []);
                email.type = 'email';
                email.placeholder = 'Email';
                const passwordField = quickElement('input', ['password-field'], []);
                passwordField.type = 'password';
                passwordField.placeholder = 'Password';
                const passwordRepeatField = quickElement('input', ['password-field'], []);
                passwordRepeatField.type = 'password';
                passwordRepeatField.placeholder = 'Repeat Password';
                const displayName = quickElement('input', ['display-name-field'], []);
                passwordRepeatField.placeholder = 'Display Name';
                // TODO: captcha

                const submitButton = makeActionButton('Register', () => {
                });
                submitButton.type = 'submit';
                const registrationForm = quickElement('form', ['register-form'], [
                    registerHeader,
                    email,
                    passwordField,
                    passwordRepeatField,
                    displayName,
                    submitButton,
                ]);
                registrationForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (passwordField.value !== passwordRepeatField.value) {
                        alert('Passwords do not match');
                        return;
                    }
                    // await this.tracker.register(email.value, passwordField.value, displayName.value); // TODO
                    this.refresh();
                });
            }

        }
    }
}
