import {el} from "../util";

export type PasswordFieldWithRepeat = {
    passwordField: HTMLInputElement,
    passwordRepeatField: HTMLInputElement,
    getValue: () => string,
    isValid: () => boolean,
    checkValid: () => boolean
};

export function passwordWithRepeat(passLabel: string = 'Password', validationField: string = 'password'): PasswordFieldWithRepeat {
    const passwordField = el('input', {
        class: 'password-field',
        props: {
            type: 'password',
            placeholder: passLabel,
            autocomplete: 'new-password',
        },
        attributes: {
            'validation-field': validationField,
        },
    });
    const passwordRepeatField = el('input', {
        class: 'password-field',
        props: {
            type: 'password',
            placeholder: 'Repeat Password',
            autocomplete: 'new-password',
        },
        attributes: {
            'validation-field': validationField,
        },
    });

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

