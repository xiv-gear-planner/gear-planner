import type {SideMenuMode} from "./persistent_settings";
import {SETTINGS} from "./persistent_settings";
import {isValidLanguage, Language, setCurrentLanguage} from "@xivgear/i18n/translation";
import {writeProxy} from "@xivgear/util/proxies";

// This is declared as a custom event since it really works like a resize, so we want to track it
// in much the same way.
declare global {
    interface CustomEventMap {
        'side-menu-mode-change': Event;
    }

    interface WindowEventMap extends CustomEventMap {
    }
}

const DEFAULT_LIGHT_MODE = false;
const DEFAULT_MODERN_THEME = true;
const WIDE_SIDE_MENU_DEFAULT: SideMenuMode = 'auto';

class DisplaySettingsImpl implements DisplaySettings {
    private _lightMode!: boolean;
    private _modernTheme!: boolean;
    private _languageOverride: Language | undefined;
    private _reverseSort!: boolean;
    private _sideMenuMode!: SideMenuMode;

    loadSettings() {
        const settings = SETTINGS;
        this._lightMode = settings.lightMode ?? DEFAULT_LIGHT_MODE;
        this._modernTheme = settings.modernTheme ?? DEFAULT_MODERN_THEME;
        this._languageOverride = settings.languageOverride;
        this._reverseSort = settings.reverseItemSort ?? false;
        this._sideMenuMode = SETTINGS.wideSideMenuMode ?? WIDE_SIDE_MENU_DEFAULT;
        this.applyLightMode();
        this.applyModernTheme();
        this.applySideMenuMode();
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

    get languageOverride(): Language | undefined {
        return this._languageOverride;
    }

    set languageOverride(value: Language | undefined) {
        this._languageOverride = value;
        SETTINGS.languageOverride = value;
        this.applyLanguage();
    }

    get reverseItemSort(): boolean {
        return this._reverseSort;
    }

    set reverseItemSort(value: boolean) {
        this._reverseSort = value;
        SETTINGS.reverseItemSort = value;
    }

    /**
     * Get the display mode for the side menu. It can be 'hidden', 'auto', or 'sticky'. 'hidden' is where you only get
     * the button in the top left to open the menu. 'auto' is where you have a narrow persistent bar, and hovering over
     * it expands it such that it displays above the content. Mousing out or clicking an option collapses it.
     * 'sticky' is where it is indefinitely shown, and does displace the content beneath it.
     *
     * On narrow screens, the menu works differently. It starts in 'hidden' mode, but can be opened by clicking the
     * button. Clicking an item will cause it to hide again.
     */
    get sideMenuMode(): SideMenuMode {
        return this._sideMenuMode;
    }

    set sideMenuMode(value: SideMenuMode) {
        this._sideMenuMode = value;
        SETTINGS.wideSideMenuMode = value;
        this.applySideMenuMode();
    }

    private applySideMenuMode() {
        const body = document.querySelector('body');
        if (body === null) {
            throw Error(`Unable to set side menu mode because body was null!`);
        }
        body.classList.remove('side-menu-mode-hidden', 'side-menu-mode-auto', 'side-menu-mode-sticky');
        body.classList.add(`side-menu-mode-${this._sideMenuMode}`);
        body.classList.remove('side-menu-auto-expanded', 'side-menu-auto-suppressed');
        window.dispatchEvent(new Event('side-menu-mode-change'));
    }

    private applyLightMode() {
        const body = document.querySelector('body');
        if (body === null) {
            throw Error(`Unable to set light mode because body was null!`);
        }
        body.style.setProperty('--transition-time', '0');
        body.style.setProperty('--input-transition-time', '0');
        body.classList.toggle('light-mode', this._lightMode);
        setTimeout(() => {
            body.style.removeProperty('--transition-time');
            body.style.removeProperty('--input-transition-time');
        }, 10);
    }

    private applyModernTheme() {
        const body = document.querySelector('body');
        if (body === null) {
            throw Error(`Unable to set modern theme because body was null!`);
        }
        // Disable transitions temporarily - it doesn't make sense here
        body.style.setProperty('--transition-time', '0');
        body.style.setProperty('--input-transition-time', '0');
        body.classList.toggle('modern', this._modernTheme);
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

// TODO: this should only capture public members
export interface DisplaySettings extends DisplaySettingsImpl {
}

let afterSettingsChange: (() => void) = () => {
};

export function setDisplaySettingsChangeCallback(cb: () => void) {
    afterSettingsChange = cb;
}

export const DISPLAY_SETTINGS: DisplaySettings = writeProxy(new DisplaySettingsImpl(), () => {
    afterSettingsChange();
});
