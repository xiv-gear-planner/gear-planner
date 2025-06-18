import {UserDataClient} from "@xivgear/user-data-client/userdata";
import {AccountStateTracker, cookieFetch} from "./account_state";
import {DisplaySettings} from "@xivgear/common-ui/settings/display_settings";
import {Language} from "@xivgear/i18n/translation";

const userDataClient = new UserDataClient({
    baseUrl: document.location.hostname === 'localhost' ? 'http://localhost:8086' : 'https://accountsvc.xivgear.app',
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
        }, {
            headers: {
                'Authorization': `Bearer ${jwt}`,
            },
        });
        return 'success';
    }

}
