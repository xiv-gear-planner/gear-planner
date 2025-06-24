import {RequestParams, SheetMetadata, UserDataClient} from "@xivgear/user-data-client/userdata";
import {ACCOUNT_STATE_TRACKER, AccountStateTracker, cookieFetch} from "./account_state";
import {
    DISPLAY_SETTINGS,
    DisplaySettings,
    setDisplaySettingsChangeCallback
} from "@xivgear/common-ui/settings/display_settings";
import {Language} from "@xivgear/i18n/translation";
import {SheetExport, SheetSummary} from "@xivgear/xivmath/geartypes";
import {SheetHandle, SheetManager} from "@xivgear/core/persistence/saved_sheets";
import {JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {SHEET_MANAGER} from "../components/saved_sheet_impl";

const userDataClient = new UserDataClient<never>({
    baseUrl: document.location.hostname === 'localhost' ? 'http://localhost:8087' : 'https://accountsvc.xivgear.app',
    // baseUrl: 'http://192.168.1.119:8086',
    customFetch: cookieFetch,
});

export class UserDataSyncer {

    constructor(private readonly accountStateTracker: AccountStateTracker,
                private readonly userDataClient: UserDataClient<never>,
                private readonly settings: DisplaySettings,
                private readonly sheetMgr: SheetManager) {
    }

    async downloadSettings(): Promise<"success" | "not-logged-in" | "none-saved"> {
        const jwt: string | null = this.accountStateTracker.token;
        if (jwt === null) {
            return 'not-logged-in';
        }
        console.info("Downloading settings");
        const resp = await this.userDataClient.userdata.getPrefs(this.buildParams());
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
        this.sheetMgr.syncLastSheetNumber(resp.data.nextSetId);
        return 'success';
    }

    async uploadSettings(): Promise<'success' | 'not-logged-in'> {
        // TODO: need to upload new next-sheet-id after making a new sheet
        const jwt: string | null = this.accountStateTracker.token;
        if (jwt === null) {
            return 'not-logged-in';
        }
        console.info("Uploading settings");
        await this.userDataClient.userdata.putPrefs({
            preferences: {
                lightMode: this.settings.lightMode,
                languageOverride: this.settings.languageOverride,
            },
            nextSetId: this.sheetMgr.getNextSheetNumber(),
        }, this.buildParams());
        return 'success';
    }

    async syncSheets(): Promise<'success' | 'not-logged-in' | 'nothing-to-do'> {
        const result = await this.prepSheetSync();
        if (result === 'not-logged-in') {
            return 'not-logged-in';
        }
        if (result === 'nothing-to-do') {
            return 'nothing-to-do';
        }
        return await this.performSync();
    }

    /**
     * Asks the server about what sheets and sheet versions it has.
     */
    async prepSheetSync(): Promise<'need-sync' | 'not-logged-in' | 'nothing-to-do'> {
        const jwt: string | null = this.accountStateTracker.token;
        if (jwt === null) {
            return 'not-logged-in';
        }
        const mgr = this.sheetMgr;
        const allSheets = mgr.allSheets;
        const existingSheetsMap = new Map<string, SheetHandle>();
        const noServerVersion = new Set<SheetHandle>();
        allSheets.forEach(sheet => {
            existingSheetsMap.set(sheet.key, sheet);
            noServerVersion.add(sheet);
        });
        const newSheets: SheetMetadata[] = [];
        const serverData = await this.userDataClient.userdata.getSheetsList(this.buildParams());
        serverData.data.sheets.forEach(sheetMeta => {
            const deletedFromServer = sheetMeta.deleted;
            const key = sheetMeta.saveKey;
            if (existingSheetsMap.has(key)) {
                const handle = existingSheetsMap.get(key);
                handle.serverVersion = sheetMeta.version;
                noServerVersion.delete(handle);
                if (deletedFromServer) {
                    handle.deleteServer(sheetMeta.version);
                }
                else {
                    handle.meta.serverDeleted = false;
                }
            }
            else if (!deletedFromServer) {
                newSheets.push(sheetMeta);
            }
            // Don't bother creating a handle for something that we never had locally and which has already been
            // deleted from the server.
        });
        noServerVersion.forEach(sheet => {
            sheet.serverVersion = 0;
        });
        const newHandles: SheetHandle[] = [];
        newSheets.forEach(sheetMeta => {
            const svrVer = sheetMeta.version ?? 1;
            // TODO: need to update logic in the application elsewhere to account for this "dummy sheet" concept.
            // Basically, if the local version is 0, then we know that the sheet exists on the server, and we should
            // display it iff the user is logged in. If the user wishes to open this sheet, then we need to download
            // it on demand.
            const svrSum = sheetMeta.summary;
            const localSum: SheetSummary = {
                job: svrSum.job as JobName,
                name: svrSum.name,
                multiJob: svrSum.multiJob,
                level: svrSum.level as SupportedLevel,
                isync: svrSum.isync,
            };
            const newSheet = mgr.newSheetFromRemote(
                sheetMeta.saveKey, svrVer, localSum
            );
            newHandles.push(newSheet);
        });
        mgr.resort();
        // At this point, we have only downloaded metadata. We have not synchronized any actual sheet contents.
        mgr.flush();
        mgr.afterSheetListChange();
        if (mgr.allDisplayableSheets.find(sheet => sheet.syncStatus !== "in-sync") !== undefined) {
            return 'need-sync';
        }
        else {
            return 'nothing-to-do';
        }
    }

    private async performSync(): Promise<'success' | 'not-logged-in' | 'nothing-to-do'> {
        const mgr = this.sheetMgr;
        const jwt: string | null = this.accountStateTracker.token;
        if (jwt === null) {
            return 'not-logged-in';
        }
        // TODO: deleted sheets
        // TODO: send back 429 too many requests if throttled
        // TODO: better log messages, hard to tell what's going on
        // TODO: server should just compress
        try {
            for (const sheetHandle of mgr.allDisplayableSheets) {
                switch (sheetHandle.syncStatus) {
                    case "in-sync":
                        // Nothing do do
                        continue;
                    case "never-uploaded":
                    case "client-newer-than-server":
                        if (sheetHandle.meta.localDeleted) {
                            console.info(`Deleting: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} -> ${sheetHandle.serverVersion}`);
                            // TODO: needs to handle 409 conflict without blowing up
                            await sheetHandle.doAction(this.userDataClient.userdata.deleteSheet(sheetHandle.key, {
                                lastSyncedVersion: sheetHandle.lastSyncedVersion,
                                newSheetVersion: sheetHandle.localVersion,
                            }, this.buildParams()));
                        }
                        else {
                            console.info(`Uploading: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} -> ${sheetHandle.serverVersion}`);
                            const data = sheetHandle.dataNow;
                            if (!data) {
                                console.error(`Data is null for sheet ${sheetHandle.key} (${sheetHandle.name})!`);
                                break;
                            }
                            // TODO: needs to handle 409 conflict without blowing up
                            await sheetHandle.doAction(this.userDataClient.userdata.putSheet(sheetHandle.key, {
                                sheetData: data,
                                sheetSummary: sheetHandle.summary,
                                sortOrder: sheetHandle.sortOrder,
                                lastSyncedVersion: sheetHandle.lastSyncedVersion,
                                newSheetVersion: sheetHandle.localVersion,
                            }, this.buildParams()));
                        }
                        sheetHandle.lastSyncedVersion = sheetHandle.localVersion;
                        break;
                    case "never-downloaded":
                    case "server-newer-than-client": {
                        // TODO: is there anything we need to do to "finalize" a server->client delete?
                        console.info(`Downloading: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} <- ${sheetHandle.serverVersion}`);
                        const resp = await this.userDataClient.userdata.getSheet(sheetHandle.key, this.buildParams());
                        sheetHandle.postDownload(resp.data.metadata.version, resp.data.sheetData as SheetExport);
                        break;
                    }
                    case "conflict":
                        console.warn(`Sheet conflict! ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} > ${sheetHandle.lastSyncedVersion} < ${sheetHandle.serverVersion}`);
                        break;
                    case "unknown":
                        // Can't fix this, and would have already been logged
                        break;
                    case "null-data":
                        break;
                }
            }
        }
        finally {
            mgr.resort();
            mgr.flush();
        }
        return 'success';
    }

    private buildParams(): RequestParams {
        return {
            headers: {
                'Authorization': `Bearer ${this.accountStateTracker.token}`,
            },
        };
    }

}

export const USER_DATA_SYNCER = new UserDataSyncer(ACCOUNT_STATE_TRACKER, userDataClient, DISPLAY_SETTINGS, SHEET_MANAGER);

export async function afterLogin() {
    const result = await USER_DATA_SYNCER.downloadSettings();
    if (result === 'none-saved') {
        console.info("No settings found, uploading ours");
        await USER_DATA_SYNCER.uploadSettings();
    }
}

export async function afterSettingsChange() {
    console.info("afterSettingsChange");
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
    let wasValid: boolean = false;
    ACCOUNT_STATE_TRACKER.addAccountStateListener(t => {
        if (t.token !== lastJwt) {
            // Only do this after we transition from logged out to logged in and the account is verified
            const valid = t.token !== null && t.accountState.verified;
            if (valid && !wasValid) {
                afterLogin();
            }
            wasValid = valid;
            lastJwt = t.token;
            // TODO: this is receiving our own updates from the afterLogin() call above.
            // We need to not loopback.
            setDisplaySettingsChangeCallback(() => {
                afterSettingsChange();
            });
        }
    });

}
