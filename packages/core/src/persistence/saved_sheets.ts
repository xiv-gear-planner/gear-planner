import {DEFAULT_SHEET_METADATA, LocalSheetMetadata, SheetExport, SheetSummary} from "@xivgear/xivmath/geartypes";
import {GearPlanSheet} from "../sheet";
import {PublicOnly} from "@xivgear/util/util_types";
import {CURRENT_MAX_LEVEL, JobName} from "@xivgear/xivmath/xivconstants";


export function sheetMetaKey(sheetKey: string): string {
    return sheetKey + '-meta';
}

export type SyncStatus =
    'in-sync'
    | 'client-newer-than-server'
    | 'server-newer-than-client'
    | 'never-uploaded'
    | 'conflict'
    | 'never-downloaded'
    | 'null-data'
    | 'unknown';

function makeSummaryFromData(data: SheetExport): SheetSummary {
    return {
        name: data.name,
        isync: data.ilvlSync,
        level: data.level,
        job: data.job,
        multiJob: data.isMultiJob,
    };
}

class SheetHandleImpl {

    private metaDirty: boolean = false;
    private dataDirty: boolean = false;

    private pendingActions: Promise<unknown>[] = [];

    private _data: SheetExport | null;

    constructor(
        public readonly key: string,
        data: SheetExport,
        public readonly meta: LocalSheetMetadata,
        private readonly storage: Storage,
        private readonly updateHook: (h: SheetHandle) => void
    ) {
        this._data = data;
        if (!this.meta.summary) {
            if (this._data !== null) {
                this.meta.summary = makeSummaryFromData(this._data);
            }
            else {
                console.error(`Missing summary for sheet ${this.key}.`);
            }
        }
    }

    get summary(): SheetSummary {
        return this.meta.summary;
    }

    set summary(value: SheetSummary) {
        this.meta.summary = value;
        this.metaDirty = true;
        this.afterUpdate();
    }

    /**
     * Whether the sheet should be displayed to the user.
     */
    get displayable(): boolean {
        // Always display sheets where there is a conflict.
        if (this.syncStatus === 'conflict') {
            return true;
        }
        if (this.meta.localDeleted) {
            // Don't display locally-deleted sheets.
            return false;
        }
        // Don't delete sheets which have been created but never saved.
        return this.localVersion > 0 || this.serverVersion > 0;
    }

    /**
     * Whether or not an action posted with {@link doAction} is currently in progress.
     */
    get busy(): boolean {
        return this.pendingActions.length > 0;
    }

    /**
     * Perform an asynchronous action. Marks the sheet handle as busy until the promise resolves.
     * Returns the original argument so that you can do things like:
     *
     * ```
     * const result = await sheet.doAction(doSomethingAsync());
     * ```
     *
     * @param action
     */
    doAction<X>(action: Promise<X>): Promise<X> {
        this.pendingActions.push(action);
        this.afterUpdate();
        action.finally(() => {
            this.pendingActions.splice(this.pendingActions.indexOf(action), 1);
            this.afterUpdate();
        });
        return action;
    }

    private afterUpdate() {
        try {
            this.updateHook(this);
        }
        catch (e) {
            console.error("Error calling hook", e);
        }
    }

    /**
     * The sort order of this sheet.
     */
    get sortOrder(): number {
        if (this.meta.sortOrder !== null) {
            return this.meta.sortOrder;
        }
        return parseInt(this.key.split('-')[2]);
    }

    /**
     * Change the sort order of this sheet. Set null to use the natural/default sort.
     *
     * @param sortOrder
     */
    set sortOrder(sortOrder: number | null) {
        this.meta.sortOrder = sortOrder;
        this.meta.currentVersion++;
        this.metaDirty = true;
        this.afterUpdate();
    }

    /**
     * The last version of the sheet that was uploaded to the server.
     */
    get lastSyncedVersion(): number {
        return this.meta.lastSyncedVersion;
    }

    set lastSyncedVersion(version: number) {
        this.metaDirty = true;
        this.meta.lastSyncedVersion = version;
        if (this.meta.serverVersion < version) {
            this.meta.serverVersion = version;
        }
        // console.trace(`Setting last synced version to ${version} for ${this.key}`);
        this.afterUpdate();
    }

    /**
     * The local version of the sheet.
     */
    get localVersion(): number {
        return this.meta.currentVersion;
    }

    set localVersion(version: number) {
        this.metaDirty = true;
        this.meta.currentVersion = version;
        this.afterUpdate();
    }

    /**
     * The highest version of the sheet that the server has, but has not necessarily been downloaded.
     */
    get serverVersion(): number {
        return this.meta.serverVersion;
    }

    /**
     * Inform the handle of a new server version which is NOT a deletion
     *
     * @param version
     */
    set serverVersion(version: number) {
        this.metaDirty = true;
        this.meta.serverDeleted = false;
        this.meta.serverVersion = version;
        // If the server lost data for some reason, we should do this so that it can re-upload.
        if (version < this.meta.lastSyncedVersion) {
            this.meta.lastSyncedVersion = version;
        }
        this.afterUpdate();
    }

    get metaKey(): string {
        return sheetMetaKey(this.key);
    }

    /**
     * Save the sheet and metadata.
     */
    flush(): void {
        if (this.metaDirty) {
            // TODO: make meta key a method
            this.storage.setItem(this.metaKey, JSON.stringify(this.meta));
            this.metaDirty = false;
        }
        if (this.dataDirty) {
            this.storage.setItem(this.key, JSON.stringify(this._data));
            this.dataDirty = false;
        }
    }

    get syncStatus(): SyncStatus {
        const meta = this.meta;
        // the version that the client has
        const cur = meta.currentVersion;
        if (cur === 0 || this._data === null) {
            if (this.serverVersion === 0) {
                return 'null-data';
            }
            return 'never-downloaded';
        }
        const lastUploaded = meta.lastSyncedVersion;
        if (lastUploaded === 0) {
            // this branch means that the server does not have this set at all
            return 'never-uploaded';
        }
        // the server version
        const svrVer = meta.serverVersion;
        if (cur === lastUploaded) {
            // This branch means that we have uploaded our latest
            if (cur === svrVer) {
                // Our version is still the "true" version
                return 'in-sync';
            }
            else if (cur < svrVer) {
                // Another client uploaded a newer version
                return 'server-newer-than-client';
            }
        }
        else {
            // We have not uploaded our latest version yet
            if (lastUploaded === svrVer) {
                // The server has the same version we previously uploaded.
                // i.e. no concurrent changes.
                return 'client-newer-than-server';
            }
            else if (lastUploaded < svrVer) {
                // The server has a different version.
                // i.e. both server and client have changed.
                return 'conflict';
            }
        }
        console.warn('Unknown sync status for sheet ' + this.key, meta, cur, lastUploaded, svrVer);
        return 'unknown';
    }

    /**
     * Update the metadata after downloading a new version of the sheet.
     *
     * @param version
     * @param data
     */
    postDownload(version: number, data: SheetExport): void {
        this._data = data;
        this.meta.serverVersion = version;
        this.meta.lastSyncedVersion = version;
        this.meta.currentVersion = version;
        this.meta.summary = makeSummaryFromData(data);
        this.meta.localDeleted = false;
        this.meta.serverDeleted = false;
        this.metaDirty = true;
        this.dataDirty = true;
        this.afterUpdate();
    }

    /**
     * Set new data and bump version.
     *
     * @param data
     */
    postLocalModification(data: SheetExport): void {
        this._data = data;
        this.meta.summary = makeSummaryFromData(data);
        this.meta.currentVersion++;
        this.metaDirty = true;
        this.dataDirty = true;
        this.meta.localDeleted = false;
        this.afterUpdate();
    }

    async readData(): Promise<SheetExport> {
        if (this._data === null) {
            throw new Error("TODO"); // TODO load from server on-demand
        }
        return this._data;
    }

    get dataNow(): SheetExport | null {
        return this._data;
    }

    get name(): string {
        return this._data?.name ?? this.summary.name;
    }

    get job(): JobName {
        return this._data?.job ?? this.summary.job;
    }

    get level(): number {
        return this._data?.level ?? this.summary.level;
    }

    get ilvlSync(): number | undefined {
        if (this._data !== null) {
            return this._data.ilvlSync;
        }
        return this.summary.isync;
    }

    get multiJob(): boolean {
        return this._data?.isMultiJob ?? this.summary.multiJob;
    }

    markMetaDirty(): void {
        this.metaDirty = true;
    }

    markDataDirty(): void {
        this.dataDirty = true;
    }

    private fullyDelete(): void {
        this.meta.serverDeleted = true;
        this.meta.localDeleted = true;
        this._data = null;
        this.markDataDirty();
        this.markMetaDirty();
    }

    deleteLocal(): void {
        this.localVersion++;
        this.meta.localDeleted = true;
        this._data = null;
        this.storage.removeItem(this.key);
        this.markMetaDirty();
        // TODO finish
    }

    deleteServer(serverVersion: number): void {
        /*
        Server deletion:
        When we get word that the item was deleted on the server:
        1. serverVersion > lastSyncedVersion == localVersion, then the sheet is deleted. We can set lastSyncedVersion
            and localVersion to the new server version, and mark it as both locally and remotely deleted.
        2. serverVersion == lastSyncedVersion - we would have already seen the deletion, thus we can treat it as no-op.
        3. serverVersion < lastSyncedVersion - invalid
        4. serverVersion > lastSyncedVersion < localVersion - conflict. Do not mark as deleted locally unless and
            until the user resolves the conflict.
         */
        if (serverVersion > this.meta.serverVersion) {
            if (this.lastSyncedVersion === this.localVersion) {
                // True and proper deletion
                this.meta.serverVersion = serverVersion;
                this.meta.lastSyncedVersion = serverVersion;
                this.meta.currentVersion = serverVersion;
                this.fullyDelete();
            }
            else {
                // Conflict!
                // TODO
            }
        }
    }
}

export type SheetHandle = PublicOnly<SheetHandleImpl>;


export interface SheetManager {
    readonly allDisplayableSheets: SheetHandle[];
    readonly allSheets: SheetHandle[];

    setUpdateHook(hook: SyncUpdateHook): void;

    afterSheetUpdate(handle: SheetHandle): void;

    afterSheetListChange(): void;

    /**
     * Debug method which will reset the sort order of all sheets
     */
    resetAll(): void;

    reorderTo(draggedSheet: SheetHandle, draggedTo: SheetHandle): 'up' | 'down' | null;

    resort(): void;

    flush(): void;

    newSheetFromRemote(saveKey: string, remoteVersion: number, summary: SheetSummary): SheetHandle;

    getOrCreateForKey(key: string): SheetHandle;

    saveData(sheet: GearPlanSheet): void;

    saveAs(sheet: SheetExport): string;

    getNextSheetNumber(): number;

    getNextSheetInternalName(): string;

    syncLastSheetNumber(numFromServer: number): void;
}

/**
 * Used for headless sheets
 */
export const DUMMY_SHEET_MGR: SheetManager = {
    afterSheetListChange(): void {
    },
    setUpdateHook(hook: SyncUpdateHook): void {
    },
    allDisplayableSheets: [],
    afterSheetUpdate(handle: SheetHandle): void {
    },
    flush(): void {
    },
    getOrCreateForKey(key: string): SheetHandle {
        return undefined;
    },
    reorderTo(draggedSheet: SheetHandle, draggedTo: SheetHandle): "up" | "down" | null {
        return undefined;
    },
    resetAll(): void {
    },
    resort(): void {
    },
    saveAs(sheet: SheetExport): string {
        return "";
    },
    saveData(sheet: GearPlanSheet): void {
    },
    newSheetFromRemote(saveKey: string, remoteVersion: number): SheetHandle {
        throw new Error("Function not implemented.");
    },
    getNextSheetNumber(): number {
        return 1;
    },
    getNextSheetInternalName(): string {
        return "sheet-save-1";
    },
    syncLastSheetNumber(numFromServer: number): void {
    },
    allSheets: [],
};

export type SyncUpdateHook = {
    onSheetUpdate: (handle: SheetHandle) => void;
    onSheetListChange: () => void;
}

export class SheetManagerImpl implements SheetManager {
    private readonly dataMap = new Map<string, SheetHandle>();
    private _lastData: SheetHandle[] = [];
    private _updateHook: SyncUpdateHook;

    constructor(private readonly storage: Storage) {
    }

    setUpdateHook(hook: SyncUpdateHook) {
        this._updateHook = hook;
    }

    afterSheetUpdate(handle: SheetHandle) {
        this._updateHook?.onSheetUpdate?.(handle);
    }

    afterSheetListChange() {
        this._updateHook?.onSheetListChange?.();
    }

    /**
     * Debug method which will reset the sort order of all sheets
     */
    resetAll(): void {
        this._lastData.forEach(item => {
            item.sortOrder = null;
        });
        this.flush();
    }

    get allDisplayableSheets(): SheetHandle[] {
        if (this._lastData.length === 0) {
            this.readData();
        }
        return this._lastData.filter(item => item.displayable);
    }

    get allSheets(): SheetHandle[] {
        if (this._lastData.length === 0) {
            this.readData();
        }
        return this._lastData;
    }

    private readData(): SheetHandle[] {
        // TODO: make this able to load meta-only keys, but not ones that have been deleted, and not ones that were
        // created but never saved.
        // TODO: consolidate readData() with get lastData. It should just work universally.
        const items: SheetHandle[] = [];
        const outer = this;
        for (const storageKey in this.storage) {
            if (storageKey.startsWith("sheet-save-") && !storageKey.endsWith("-meta")) {
                const imported = JSON.parse(this.storage.getItem(storageKey) ?? 'null') as SheetExport;
                if (imported === null) {
                    // Sheet has not been downloaded yet
                    console.info(`Sheet not downloaded: ${storageKey}`);
                }
                else if (imported?.saveKey) {
                    if (this.dataMap.has(storageKey)) {
                        const existing = this.dataMap.get(storageKey);
                        items.push(existing);
                        continue;
                    }
                    const meta = this.readSheetMeta(storageKey);
                    const item = new SheetHandleImpl(storageKey, imported, meta, outer.storage, (h) => this.afterSheetUpdate(h));
                    this.dataMap.set(storageKey, item);
                    items.push(item);
                }
            }
        }
        this._lastData = items;
        // This has the effect of also sorting items
        this.resort();
        return items;
    }

    reorderTo(draggedSheet: SheetHandle, draggedTo: SheetHandle): 'up' | 'down' | null {
        // Index where we want the dragged sheet to go to
        const fromIndex = this._lastData.indexOf(draggedSheet);
        const toIndex = this._lastData.indexOf(draggedTo);
        const lastIndex = this._lastData.length - 1;
        // Four scenarios:
        // 1. Sheet is dragged to a position between two other sheets
        //  In this case, we can just set the sheet's sort order to be between the two other sheets
        // 2. Sheet is dragged to the end of the list
        //  In this case, we can set the sheet's sort order to the last item's index minus one
        // 3. Sheet is dragged to the beginning of the list
        //  In this case, we need to be careful - we want a *new* sheet to still be at the top of the list,
        //  so we set the sort order to be the index of the first sheet plus a very small amount.
        // 4. Sheet is dragged to itself
        //  No-op
        let out: 'down' | 'up';
        if (toIndex === 0) {
            // Scenario 3
            draggedSheet.sortOrder = draggedTo.sortOrder + 0.0001;
            out = 'up';
        }
        else if (toIndex === lastIndex) {
            draggedSheet.sortOrder = draggedTo.sortOrder - 1;
            out = 'down';
        }
        else if (draggedSheet === draggedTo) {
            // No-op
            return null;
        }
        else {
            // In-between
            // e.g. if index 4 is dragged to index 1, then it should push the existing index 1 down by taking on a
            // sort order value between the current index 0 and 1.
            // If index 4 is dragged to index 6, then it should push the existing index 6 up by taking on a sort
            // order value between the current index 6 and 7.
            const isDown: boolean = toIndex > fromIndex;
            const secondBasisIndex = toIndex + (isDown ? 1 : -1);
            const secondBasis = this._lastData[secondBasisIndex].sortOrder;
            const primaryBasis = draggedTo.sortOrder;
            const newSort = (primaryBasis + secondBasis) / 2;
            draggedSheet.sortOrder = newSort;
            out = isDown ? 'down' : 'up';
        }
        this.resort();
        return out;
    }

    resort() {
        this._lastData.sort((left, right) => {
            return right.sortOrder - left.sortOrder;
        });

    }

    flush(): void {
        this._lastData.forEach(item => item.flush());
    }

    newSheetFromRemote(saveKey: string, remoteVersion: number, summary: SheetSummary): SheetHandle {
        const sheetMeta: LocalSheetMetadata = {
            currentVersion: 0,
            lastSyncedVersion: 0,
            serverVersion: remoteVersion,
            sortOrder: null,
            hasConflict: false,
            forcePush: false,
            serverDeleted: false,
            localDeleted: false,
            summary: summary,
        };
        const handle = new SheetHandleImpl(saveKey, null, sheetMeta, this.storage, (h) => this.afterSheetUpdate(h));
        console.log(`New sheet: ${handle.key}`);
        this.registerNew(handle);
        handle.markMetaDirty();
        handle.markDataDirty();
        return handle;
    }

    newSheetFromScratch(summary: SheetSummary): SheetHandle {
        const sheetMeta: LocalSheetMetadata = {
            localDeleted: false,
            serverDeleted: false,
            // Starts at version 0 because we haven't actually saved anything locally at this point.
            currentVersion: 0,
            lastSyncedVersion: 0,
            serverVersion: 0,
            sortOrder: null,
            hasConflict: false,
            forcePush: false,
            summary: summary,
        };
        const handle = new SheetHandleImpl(this.getNextSheetInternalName(), null, sheetMeta, this.storage, (h) => this.afterSheetUpdate(h));
        // Mark metadata as dirty
        handle.markMetaDirty();
        handle.markDataDirty();
        this.registerNew(handle);
        return handle;
    }

    private registerNew(handle: SheetHandle) {
        this.dataMap.set(handle.key, handle);
        this._lastData.push(handle);
    }

    getOrCreateForKey(key: string): SheetHandle {
        if (this.dataMap.has(key)) {
            return this.dataMap.get(key)!;
        }
        const meta = this.readSheetMeta(key);
        const item = new SheetHandleImpl(key, null, meta, this.storage, (h) => this.afterSheetUpdate(h));
        this.dataMap.set(key, item);
        this._lastData.push(item);
        return item;
    }

    saveData(sheet: GearPlanSheet) {
        const saveKey = sheet.saveKey;
        const handle = this.getOrCreateForKey(saveKey);
        handle.postLocalModification(sheet.exportSheet(false));
        handle.flush();
    }

    saveAs(sheet: SheetExport): string {
        const saveKey = this.getNextSheetInternalName();
        const handle = this.getOrCreateForKey(saveKey);
        handle.postLocalModification(sheet);
        handle.flush();
        return saveKey;
    }

    getNextSheetNumber(): number {
        const lastRaw = this.storage.getItem("last-sheet-number");
        const lastSheetNum = lastRaw ? parseInt(lastRaw) : 0;
        return Math.max(lastSheetNum + 1);
    }

    getNextSheetInternalName() {
        const next = this.getNextSheetNumber();
        this.storage.setItem("last-sheet-number", next.toString());
        const randomStub = Math.floor(Math.random() * 16384 * 65536);
        return "sheet-save-" + next + '-' + randomStub.toString(16).toLowerCase();
    }

    syncLastSheetNumber(numFromServer: number) {
        if (!numFromServer) {
            return;
        }
        const next = this.getNextSheetNumber();
        if (numFromServer > next) {
            this.storage.setItem('last-sheet-number', numFromServer.toString());
        }
    }

    private readSheetMeta(sheetKey: string): LocalSheetMetadata {
        const metaKey = sheetMetaKey(sheetKey);
        const metaRaw = this.storage.getItem(metaKey);
        let meta: LocalSheetMetadata;
        if (metaRaw) {
            meta = {
                ...DEFAULT_SHEET_METADATA,
                ...JSON.parse(metaRaw),
            };
        }
        else {
            try {
                let summary: SheetSummary;
                const data = JSON.parse(this.storage.getItem(sheetKey) ?? 'null');
                if (data) {
                    summary = makeSummaryFromData(data as SheetExport);
                }
                else {
                    summary = {
                        name: 'ERROR',
                        job: 'BLU',
                        level: CURRENT_MAX_LEVEL,
                        multiJob: false,
                    };
                }
                meta = {
                    ...DEFAULT_SHEET_METADATA,
                    summary: summary,
                };
            }
            catch (e) {
                console.error("Error reading sheet metadata", e);
                return {
                    ...DEFAULT_SHEET_METADATA,
                    summary: {
                        name: 'ERROR',
                        job: 'BLU',
                        level: CURRENT_MAX_LEVEL,
                        multiJob: false,
                    },
                };
            }
        }
        return meta;
    }
}


