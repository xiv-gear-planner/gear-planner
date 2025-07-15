import {quickElement} from "../util";

export type PasswordFieldWithRepeat = {
    passwordField: HTMLInputElement,
    passwordRepeatField: HTMLInputElement,
    getValue: () => string,
    isValid: () => boolean,
    checkValid: () => boolean
};

export function passwordWithRepeat(passLabel: string = 'Password', validationField: string = 'password'): PasswordFieldWithRepeat {
    const passwordField = quickElement('input', ['password-field'], []);
    passwordField.type = 'password';
    passwordField.placeholder = passLabel;
    passwordField.autocomplete = 'new-password';
    passwordField.setAttribute('validation-field', validationField);
    const passwordRepeatField = quickElement('input', ['password-field'], []);
    passwordRepeatField.type = 'password';
    passwordRepeatField.placeholder = 'Repeat Password';
    passwordRepeatField.autocomplete = 'new-password';
    passwordRepeatField.setAttribute('validation-field', validationField);

    function getValue(): string {
        return passwordField.value;
    }

    function isValid(): boolean {
        return passwordField.value === passwordRepeatField.value;
    }

    function checkValid(): boolean {
        if (!isValid()) {
            passwordRepeatField.setCustomValidity('Passwords do not match');
            return false;
        }
        return true;
    }

    return {
        passwordField,
        passwordRepeatField,
        getValue,
        isValid,
        checkValid,
    };
}

