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
import {RefreshLoop} from "@xivgear/util/refreshloop";
import {Inactivitytimer} from "@xivgear/util/inactivitytimer";
import {recordError} from "@xivgear/common-ui/analytics/analytics";

const userDataClient = new UserDataClient<never>({
    baseUrl: document.location.hostname === 'localhost' ? 'http://localhost:8087' : 'https://userdata.xivgear.app',
    // baseUrl: 'http://192.168.1.119:8086',
    customFetch: cookieFetch,
});

export class UserDataSyncer {

    private suppressSettingsUpload: boolean = false;

    /*
    There is a 3-way strategy for auto syncing:
    We have a normal refresh loop which starts the first time you get a valid token.
    When you update a set, we don't want to sync frequent tiny changes immediately, so we also have an inactivity timer
    to only refresh every so often.
    We also trigger it on a hash change.
     */

    private readonly sheetRefresh: RefreshLoop;
    private readonly sheetInactivityTimer: Inactivitytimer;

    constructor(private readonly accountStateTracker: AccountStateTracker,
                private readonly userDataClient: UserDataClient<never>,
                private readonly settings: DisplaySettings,
                private readonly sheetMgr: SheetManager) {
        const outer = this;
        this.sheetMgr.setAsyncLoader({
            // Function for loading a sheet when we don't have the data locally
            load: async (sheet: SheetHandle) => {
                // Wait for token
                await accountStateTracker.verifiedTokenPromise;
                const result = await outer.syncOne(sheet);
                if (result === 'success' || result === 'nothing-to-do') {
                    return;
                }
                throw new Error('Could not sync');
            },
            canLoad: () => {
                return accountStateTracker.hasVerifiedToken;
            },
            canLoadAsync: async () => {
                return (await accountStateTracker.verifiedTokenPromise) !== null;
            },
        });
        this.sheetMgr.setUpdateHook('user-data-syncer', {
            onSheetLocalChange: function (handle: SheetHandle): void {
                outer.onSheetChange();
            },
        });
        this.sheetRefresh = new RefreshLoop(async () => {
            await this.syncSheets();
        }, () => {
            if (this.accountStateTracker.hasVerifiedToken) {
                // Refresh every 3 minutes by default
                return 180_000;
            }
            else {
                return 600_000;
            }
        });
        this.sheetInactivityTimer = new Inactivitytimer(15_000, () => {
            this.triggerRefreshNow();
        });
    }

    async downloadSettings(): Promise<"success" | "not-logged-in" | "none-saved"> {
        const jwt: string | null = this.accountStateTracker.verifiedToken;
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
        this.suppressSettingsUpload = true;
        try {
            this.settings.lightMode = prefs.lightMode;
            // this.settings.modernTheme = prefs.modernTheme;
            this.settings.languageOverride = (prefs.languageOverride ?? undefined) as Language;
            this.sheetMgr.syncLastSheetNumber(resp.data.nextSetId);
        }
        finally {
            this.suppressSettingsUpload = false;
        }
        return 'success';
    }

    async uploadSettings(): Promise<'success' | 'not-logged-in' | 'suppressed'> {
        if (this.suppressSettingsUpload) {
            return 'suppressed';
        }
        // TODO: need to upload new next-sheet-id after making a new sheet
        const jwt: string | null = this.accountStateTracker.verifiedToken;
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
        console.log("syncSheets");
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
        const jwt: string | null = this.accountStateTracker.verifiedToken;
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
                noServerVersion.delete(handle);
                if (deletedFromServer) {
                    handle.deleteServerToClient(sheetMeta.version);
                    existingSheetsMap.delete(key);
                }
                else {
                    handle.setServerVersion(sheetMeta.version, sheetMeta.versionKey);
                    // If this would mean that we should download, then we should trust the server's sort order.
                    if (handle.syncStatus === 'server-newer-than-client') {
                        handle.meta.sortOrder = sheetMeta.sortOrder ?? null;
                        handle.markMetaDirty();
                    }
                }
            }
            else if (!deletedFromServer) {
                newSheets.push(sheetMeta);
            }
            // Don't bother creating a handle for something that we never had locally and which has already been
            // deleted from the server.
        });
        noServerVersion.forEach(sheet => {
            sheet.setServerVersion(0, 0);
        });
        const newHandles: SheetHandle[] = [];
        newSheets.forEach(sheetMeta => {
            const svrVer = sheetMeta.version ?? 1;
            // If the local version is 0, then we know that the sheet exists on the server, and we should
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
        if (mgr.allSheets.find(sheet => sheet.syncStatus !== "in-sync") !== undefined) {
            return 'need-sync';
        }
        else {
            return 'nothing-to-do';
        }
    }

    async syncOne(sheetHandle: SheetHandle): Promise<'success' | 'not-logged-in' | 'nothing-to-do'> {
        return await sheetHandle.doAction((async () => {
            if (this.accountStateTracker.token === null) {
                return 'not-logged-in';
            }
            switch (sheetHandle.syncStatus) {
                case "in-sync":
                case "conflict":
                case 'trash':
                    return 'nothing-to-do';
                case "client-newer-than-server":
                case "never-uploaded": {
                    /*
                    Logic for handling force put.
                    Example: last synced = 5, local = 6, server = 7. We need to set the local version to 8, so
                    that the server believes that it is actually newer. We also specify 7 as the last synced
                    version, since the server will still want to do a conflict check.
                     */
                    // Compute the 'effective local version' as described above.
                    const isForcePut = sheetHandle.hasConflict && sheetHandle.conflictResolutionStrategy === 'keep-local';
                    const effectiveLocalVersion: number = isForcePut ? Math.max(sheetHandle.localVersion, sheetHandle.serverVersion + 1) : sheetHandle.localVersion;
                    const effectiveLastSynced: number = isForcePut ? sheetHandle.serverVersion : sheetHandle.lastSyncedVersion;
                    if (sheetHandle.meta.localDeleted) {
                        console.info(`Deleting: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} -> ${sheetHandle.serverVersion}`);
                        // TODO: needs to handle 409 conflict without blowing up
                        await sheetHandle.doAction(this.userDataClient.userdata.deleteSheet(sheetHandle.key, {
                            lastSyncedVersion: effectiveLocalVersion,
                            newSheetVersion: effectiveLastSynced,
                        }, this.buildParams()));
                        sheetHandle.localVersion = effectiveLocalVersion;
                        sheetHandle.lastSyncedVersion = effectiveLocalVersion;
                        sheetHandle.conflictResolutionStrategy = null;
                    }
                    else {
                        console.info(`Uploading: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} -> ${sheetHandle.serverVersion}`);
                        const data = sheetHandle.dataNow;
                        if (!data) {
                            throw Error(`Data is null for sheet ${sheetHandle.key} (${sheetHandle.name})!`);
                        }
                        // TODO: needs to handle 409 conflict without blowing up
                        await sheetHandle.doAction(this.userDataClient.userdata.putSheet(sheetHandle.key, {
                            sheetData: data,
                            sheetSummary: sheetHandle.summary,
                            // Don't use the sheetHandle.sortOrder property - we want to only sync explicit order changes
                            sortOrder: sheetHandle.meta.sortOrder,
                            lastSyncedVersion: effectiveLastSynced,
                            newSheetVersion: effectiveLocalVersion,
                            // forcePut: isForcePut,
                        }, this.buildParams()));
                        sheetHandle.localVersion = effectiveLocalVersion;
                        sheetHandle.lastSyncedVersion = effectiveLocalVersion;
                        sheetHandle.conflictResolutionStrategy = null;
                    }
                    return 'success';
                }
                case "server-newer-than-client":
                case "never-downloaded":
                case "null-data": {
                    // Do the sync
                    console.info(`Downloading: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} <- ${sheetHandle.serverVersion}`);
                    const resp = await this.userDataClient.userdata.getSheet(sheetHandle.key, this.buildParams());
                    sheetHandle.postDownload(resp.data.metadata.version, resp.data.sheetData as SheetExport, resp.data.metadata.sortOrder ?? null, resp.data.metadata.versionKey);
                    return 'success';
                }
                case "unknown":
                    return 'nothing-to-do';
            }
        })());
    }

    private async performSync(): Promise<'success' | 'not-logged-in' | 'nothing-to-do'> {
        const mgr = this.sheetMgr;
        const jwt: string | null = this.accountStateTracker.verifiedToken;
        if (jwt === null) {
            return 'not-logged-in';
        }
        // TODO: send back 429 too many requests if throttled
        // TODO: better log messages, hard to tell what's going on
        try {
            for (const sheetHandle of mgr.allSheets) {
                const syncStatus = sheetHandle.syncStatus;
                try {
                    switch (syncStatus) {
                        case "in-sync":
                        case 'trash':
                            // Nothing do do
                            continue;
                        case "never-uploaded":
                        case "client-newer-than-server": {

                            // TODO: needs to handle 409 conflict without blowing up
                            /*
                            Logic for handling force put.
                            Example: last synced = 5, local = 6, server = 7. We need to set the local version to 8, so
                            that the server believes that it is actually newer. We also specify 7 as the last synced
                            version, since the server will still want to do a conflict check.
                             */
                            // Compute the 'effective local version' as described above.
                            const isForcePut = sheetHandle.hasConflict && sheetHandle.conflictResolutionStrategy === 'keep-local';
                            const effectiveLocalVersion: number = isForcePut ? Math.max(sheetHandle.localVersion, sheetHandle.serverVersion + 1) : sheetHandle.localVersion;
                            const effectiveLastSynced: number = isForcePut ? sheetHandle.serverVersion : sheetHandle.lastSyncedVersion;
                            if (sheetHandle.meta.localDeleted) {
                                console.info(`Deleting: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} -> ${sheetHandle.serverVersion}`);
                                // TODO: needs to handle 409 conflict without blowing up
                                await sheetHandle.doAction(this.userDataClient.userdata.deleteSheet(sheetHandle.key, {
                                    lastSyncedVersion: effectiveLastSynced,
                                    newSheetVersion: effectiveLocalVersion,
                                }, this.buildParams()));
                                sheetHandle.lastSyncedVersion = sheetHandle.localVersion;
                            }
                            else {
                                console.info(`Uploading: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} -> ${sheetHandle.serverVersion}`);
                                const data = sheetHandle.dataNow;
                                if (!data) {
                                    console.error(`Data is null for sheet ${sheetHandle.key} (${sheetHandle.name})!`);
                                    break;
                                }
                                await sheetHandle.doAction(this.userDataClient.userdata.putSheet(sheetHandle.key, {
                                    sheetData: data,
                                    sheetSummary: sheetHandle.summary,
                                    // Don't use the sheetHandle.sortOrder property - we want to only sync explicit order changes
                                    sortOrder: sheetHandle.meta.sortOrder,
                                    lastSyncedVersion: effectiveLastSynced,
                                    newSheetVersion: effectiveLocalVersion,
                                    // forcePut: isForcePut,
                                }, this.buildParams()));
                                sheetHandle.localVersion = effectiveLocalVersion;
                                sheetHandle.lastSyncedVersion = effectiveLocalVersion;
                                sheetHandle.conflictResolutionStrategy = null;
                            }
                            break;
                        }
                        case "never-downloaded":
                        case "server-newer-than-client": {
                            console.info(`Downloading: ${sheetHandle.key}: ${sheetHandle.name} ${sheetHandle.localVersion} <- ${sheetHandle.serverVersion}`);
                            const resp = await this.userDataClient.userdata.getSheet(sheetHandle.key, this.buildParams());
                            sheetHandle.postDownload(resp.data.metadata.version, resp.data.sheetData as SheetExport, resp.data.metadata.sortOrder ?? null, resp.data.metadata.versionKey);
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
                catch (e) {
                    recordError("performSync", e, {'syncHandle': `key: ${sheetHandle.key}, l ${sheetHandle.localVersion} ls ${sheetHandle.lastSyncedVersion} svr ${sheetHandle.serverVersion} status ${syncStatus}`});
                }
                sheetHandle.flush();
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

    startRefreshLoop(): void {
        return this.sheetRefresh.start();
    }

    async triggerRefreshNow(): Promise<void> {
        if (this.accountStateTracker.hasVerifiedToken) {
            await this.sheetRefresh.refresh();
        }
    }

    onSheetChange(): void {
        this.sheetInactivityTimer.ping();
    }

    get available(): boolean {
        return this.accountStateTracker.hasVerifiedToken;
    }

}

export const USER_DATA_SYNCER = new UserDataSyncer(ACCOUNT_STATE_TRACKER, userDataClient, DISPLAY_SETTINGS, SHEET_MANAGER);

export async function afterLogin() {
    const result = await USER_DATA_SYNCER.downloadSettings();
    if (result === 'none-saved') {
        console.info("No settings found, uploading ours");
        await USER_DATA_SYNCER.uploadSettings();
    }
    USER_DATA_SYNCER.startRefreshLoop();
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
            setDisplaySettingsChangeCallback(() => {
                afterSettingsChange();
            });
        }
    });

}

declare global {
    interface CustomEventMap {
        locationchange: CustomEvent<{}>; // e.g., detail is the new URL string
    }

    interface WindowEventMap extends CustomEventMap {
    }
}

window.addEventListener('locationchange', () => {
    USER_DATA_SYNCER.onSheetChange();
});

(function (history: History) {
    const push = history.pushState;
    const replace = history.replaceState;

    function notify() {
        window.dispatchEvent(new Event('locationchange'));
    }

    history.pushState = function (...args) {
        const res = push.apply(this, args);
        notify();
        return res;
    };
    history.replaceState = function (...args) {
        const res = replace.apply(this, args);
        notify();
        return res;
    };

    window.addEventListener('popstate', notify);
})(window.history);

