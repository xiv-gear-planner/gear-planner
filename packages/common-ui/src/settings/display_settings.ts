import {SETTINGS} from "./persistent_settings";
import {isValidLanguage, Language, setCurrentLanguage} from "@xivgear/core/i18n/translation";


const DEFAULT_LIGHT_MODE = false;
const DEFAULT_MODERN_THEME = true;

class DisplaySettingsImpl {
    private _lightMode: boolean;
    private _modernTheme: boolean;
    private _languageOverride: Language | undefined;

    loadSettings() {
        const settings = SETTINGS;
        this._lightMode = settings.lightMode ?? DEFAULT_LIGHT_MODE;
        this._modernTheme = settings.modernTheme ?? DEFAULT_MODERN_THEME;
        this._languageOverride = settings.languageOverride;
        this.applyLightMode();
        this.applyModernTheme();
        this.applyLanguage();
    }


    get lightMode(): boolean {
        return this._lightMode;
    }

    set lightMode(value: boolean) {
        this._lightMode = value;
        SETTINGS.lightMode = value;
        this.applyLightMode();
    }

    get modernTheme(): boolean {
        return this._modernTheme;
    }

    set modernTheme(value: boolean) {
        this._modernTheme = value;
        SETTINGS.modernTheme = value;
        this.applyModernTheme();
    }

    get languageOverride(): Language {
        return this._languageOverride;
    }

    set languageOverride(value: Language) {
        this._languageOverride = value;
        SETTINGS.languageOverride = value;
        this.applyLanguage();
    }

    private applyLightMode() {
        const lightMode = this._lightMode;
        const body = document.querySelector('body');
        body.style.setProperty('--transition-time', '0');
        body.style.setProperty('--input-transition-time', '0');
        const lightModeClass = 'light-mode';
        if (lightMode) {
            body.classList.add(lightModeClass);
        }
        else {
            body.classList.remove(lightModeClass);
        }
        setTimeout(() => {
            body.style.removeProperty('--transition-time');
            body.style.removeProperty('--input-transition-time');
        }, 10);
    }

    private applyModernTheme() {
        const body = document.querySelector('body');
        body.style.setProperty('--transition-time', '0');
        body.style.setProperty('--input-transition-time', '0');
        const modernTheme = this._modernTheme;
        if (modernTheme) {
            body.classList.add('modern');
        }
        else {
            body.classList.remove('modern');
        }
        setTimeout(() => {
            body.style.removeProperty('--transition-time');
            body.style.removeProperty('--input-transition-time');
        }, 10);
    }

    private applyLanguage() {
        if (this._languageOverride) {
            setCurrentLanguage(this._languageOverride);
        }
        else {
            if (navigator.languages) {
                for (const lang in navigator.languages) {
                    if (isValidLanguage(lang)) {
                        setCurrentLanguage(lang);
                        return;
                    }
                }
            }
            setCurrentLanguage('en');
        }
    }
}

export interface DisplaySettings extends DisplaySettingsImpl {
}

export const DISPLAY_SETTINGS: DisplaySettings = new DisplaySettingsImpl();
