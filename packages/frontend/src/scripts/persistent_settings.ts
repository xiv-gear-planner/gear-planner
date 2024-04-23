

export type PersistentSettings = {
    get lightMode(): boolean | undefined;
    set lightMode(lightMode: boolean);
    get viewDetailedStats(): boolean | undefined;
    set viewDetailedStats(detailedStats: boolean);
    hideWelcomeMessage: boolean;
}

const LIGHT_MODE_KEY = 'light-mode';
const DETAILED_STATS_KEY = 'detailed-stats';
const HIDE_WELCOME_KEY = 'hide-welcome-area';
export const SETTINGS: PersistentSettings = {
    get lightMode(): boolean | undefined {
        return getBool(LIGHT_MODE_KEY)
    },
    set lightMode(value: boolean) {
        setBool(LIGHT_MODE_KEY, value);
    },
    get viewDetailedStats(): boolean | undefined {
        return getBool(DETAILED_STATS_KEY)
    },
    set viewDetailedStats(value: boolean) {
        setBool(DETAILED_STATS_KEY, value);
    },
    get hideWelcomeMessage() {
        return getBool(HIDE_WELCOME_KEY) ?? false;
    },
    set hideWelcomeMessage(value: boolean) {
        setBool(HIDE_WELCOME_KEY, value);
    }
}

function getBool(key: string): boolean | undefined {
    const raw = localStorage.getItem(key);
    if (raw === undefined) {
        return undefined;
    }
    else {
        return raw === 'true';
    }
}
function setBool(key: string, value: boolean) {
    localStorage.setItem(key, String(value));
}