import {UserDataClient} from "@xivgear/user-data-client/userdata";
import {ACCOUNT_STATE_TRACKER, AccountStateTracker, cookieFetch} from "./account_state";
import {
    DISPLAY_SETTINGS,
    DisplaySettings,
    setDisplaySettingsChangeCallback
} from "@xivgear/common-ui/settings/display_settings";
import {Language} from "@xivgear/i18n/translation";
import {getNextSheetNumber, syncLastSheetNumber} from "@xivgear/core/persistence/saved_sheets";

const userDataClient = new UserDataClient<never>({
    baseUrl: document.location.hostname === 'localhost' ? 'http://localhost:8087' : 'https://accountsvc.xivgear.app',
    // baseUrl: 'http://192.168.1.119:8086',
    customFetch: cookieFetch,
});

class UserDataSyncer {

    constructor(private readonly accountStateTracker: AccountStateTracker, private readonly userDataClient: UserDataClient<never>, private readonly settings: DisplaySettings) {

    }

    async downloadSettings(): Promise<"success" | "not-logged-in" | "none-saved"> {
        const jwt: string | null = this.accountStateTracker.token;
        if (jwt === null) {
            return 'not-logged-in';
        }
        const resp = await this.userDataClient.userdata.getPrefs({
            headers: {
                'Authorization': `Bearer ${jwt}`,
            },
        });
        if (!resp) {
            return 'none-saved';
        }
        const data = resp.data;
        if (!data.found) {
            return 'none-saved';
        }
        const prefs = data.preferences;
        this.settings.lightMode = prefs.lightMode;
        // this.settings.modernTheme = prefs.modernTheme;
        this.settings.languageOverride = (prefs.languageOverride ?? undefined) as Language;
        syncLastSheetNumber(resp.data.nextSetId);
        return 'success';
    }

    async uploadSettings(): Promise<'success' | 'not-logged-in'> {
        const jwt: string | null = this.accountStateTracker.token;
        if (jwt === null) {
            return 'not-logged-in';
        }
        await this.userDataClient.userdata.putPrefs({
            preferences: {
                lightMode: this.settings.lightMode,
                languageOverride: this.settings.languageOverride,
            },
            nextSetId: getNextSheetNumber(),
        }, {
            headers: {
                'Authorization': `Bearer ${jwt}`,
            },
        });
        return 'success';
    }

}

// TODO:
export const USER_DATA_SYNCER = new UserDataSyncer(ACCOUNT_STATE_TRACKER, userDataClient, DISPLAY_SETTINGS);

export async function afterLogin() {
    const result = await USER_DATA_SYNCER.downloadSettings();
    if (result === 'none-saved') {
        await USER_DATA_SYNCER.uploadSettings();
    }
}

export async function afterSettingsChange() {
    await USER_DATA_SYNCER.uploadSettings();
}

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        userDataSyncer?: UserDataSyncer;
    }
}
window.userDataSyncer = USER_DATA_SYNCER;

export function setupUserDataSync() {
    let lastJwt: string | null = null;
    ACCOUNT_STATE_TRACKER.addAccountStateListener(t => {
        if (t.token !== lastJwt) {
            // Only do this after we transition from logged out to logged in
            if (t.token !== null && lastJwt === null) {
                afterLogin();
            }
            lastJwt = t.token;
            setDisplaySettingsChangeCallback(() => {
                afterSettingsChange();
            });
        }
    });

}
