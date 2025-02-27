import {Language} from "@xivgear/i18n/translation";


export type PersistentSettings = {
    get lightMode(): boolean | undefined;
    set lightMode(lightMode: boolean);
    get modernTheme(): boolean | undefined;
    set modernTheme(lightMode: boolean);
    get viewDetailedStats(): boolean | undefined;
    set viewDetailedStats(detailedStats: boolean);
    get languageOverride(): Language | undefined;
    set languageOverride(value: Language);
    workersOverride: number | undefined;
    hideWelcomeMessage: boolean;
}

const LIGHT_MODE_KEY = 'light-mode';
const MODERN_THEME_KEY = 'modern-theme';
const DETAILED_STATS_KEY = 'detailed-stats';
const HIDE_WELCOME_KEY = 'hide-welcome-area';
const LANGUAGE_OVERRIDE_KEY = 'language-override';
const WORKERS_OVERRIDE_KEY = 'workers-override';
export const SETTINGS: PersistentSettings = {
    get lightMode(): boolean | undefined {
        return getBool(LIGHT_MODE_KEY);
    },
    set lightMode(value: boolean) {
        setBool(LIGHT_MODE_KEY, value);
    },
    get modernTheme(): boolean | undefined {
        return getBool(MODERN_THEME_KEY);
    },
    set modernTheme(value: boolean) {
        setBool(MODERN_THEME_KEY, value);
    },
    get viewDetailedStats(): boolean | undefined {
        return getBool(DETAILED_STATS_KEY);
    },
    set viewDetailedStats(value: boolean) {
        setBool(DETAILED_STATS_KEY, value);
    },
    get hideWelcomeMessage() {
        return getBool(HIDE_WELCOME_KEY) ?? false;
    },
    set hideWelcomeMessage(value: boolean) {
        setBool(HIDE_WELCOME_KEY, value);
    },
    get languageOverride(): Language | undefined {
        const value = localStorage.getItem(LANGUAGE_OVERRIDE_KEY);
        // Previous versions had a bug where `languageOverride = undefined` would cause the setting to be the
        // string "undefined" instead of an actual null.
        if (!value || value === 'undefined') {
            return undefined;
        }
        return value as Language;
    },
    set languageOverride(value: Language) {
        if (value) {
            localStorage.setItem(LANGUAGE_OVERRIDE_KEY, value);
        }
        else {
            localStorage.removeItem(LANGUAGE_OVERRIDE_KEY);
        }
    },
    get workersOverride(): number | undefined {
        return getInt(WORKERS_OVERRIDE_KEY);
    },
    set workersOverride(value: number | undefined) {
        if (value !== undefined && value < 2) {
            throw new Error("Value must be an integer >= 2");
        }
        setInt(WORKERS_OVERRIDE_KEY, value);
    },
};

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        xivgearSettings: typeof SETTINGS;
    }
}

window.xivgearSettings = SETTINGS;

function getBool(key: string): boolean | undefined {
    const raw = localStorage.getItem(key);
    if (raw === undefined || raw === null) {
        return undefined;
    }
    else {
        return raw === 'true';
    }
}

function setBool(key: string, value: boolean) {
    localStorage.setItem(key, String(value));
}

function getInt(key: string): number | undefined {
    const raw = localStorage.getItem(key);
    if (raw === undefined || raw === null) {
        return undefined;
    }
    return parseInt(raw, 10);
}

function setInt(key: string, value: number | undefined) {
    if (value === undefined) {
        localStorage.removeItem(key);
    }
    else {
        if (Math.floor(value) !== value) {
            throw new Error(`Not an integer: ${value} (${key})`);
        }
        localStorage.setItem(key, value.toString());
    }
}
