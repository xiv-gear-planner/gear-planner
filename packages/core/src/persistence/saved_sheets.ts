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
    | 'trash'
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

export type ConflictResolutionStrategy = 'keep-local' | 'keep-remote';

class SheetHandleImpl {
    private metaDirty: boolean = false;
    private dataDirty: boolean = false;

    private pendingActions: Promise<unknown>[] = [];

    private _data: SheetExport | null;
    private readonly storage: Storage;
    private readonly updateHook: (h: SheetHandle) => void;
    private readonly localUpdateHook: (h: SheetHandle) => void;

    private _conflictResolutionStrategy: ConflictResolutionStrategy | null = null;

    public meta: LocalSheetMetadata;

    constructor(
        public readonly key: string,
        data: SheetExport,
        meta: LocalSheetMetadata,
        private readonly mgr: SheetManagerImpl
    ) {
        this.meta = meta;
        this._data = data;
        if (!this.meta.summary) {
            if (this._data !== null) {
                this.meta.summary = makeSummaryFromData(this._data);
            }
            else {
                console.error(`Missing summary for sheet ${this.key}.`);
                this.meta.summary = {
                    job: 'BLU',
                    level: CURRENT_MAX_LEVEL,
                    multiJob: false,
                    name: "Error no summary",
                };
            }
        }
        this.storage = mgr.storage;
        this.updateHook = h => mgr.afterSheetUpdate(h);
        this.localUpdateHook = h => mgr.afterSheetLocalChange(h);
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
        // Don't display locally-deleted sheets.
        if (this.meta.localDeleted) {
            return false;
        }
        // If the sheet has any local data, display it.
        if (this.localVersion > 0) {
            return true;
        }
        // If we don't have it locally, but we can load it, then that works too.
        // When we do get a valid token, this will refresh anyway, so it's fine that this information
        // becomes outdated.
        if (this.serverVersion > 0 && this.mgr.asyncLoader.canLoad(this)) {
            return true;
        }
        // If no condition applies, don't display.
        return false;
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

    private afterLocalUpdate() {
        try {
            this.localUpdateHook(this);
        }
        catch (e) {
            console.error("Error calling hook", e);
        }
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
            // If we synced a deletion to the server, mark it as locally deleted as well.
            if (this.meta.localDeleted) {
                this.fullyDelete();
                this.meta.serverDeleted = true;
            }
        }
        this.pruneSyncRecords();
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

    private fixMissedSync(serverVersion: number, versionKey: number) {
        // https://github.com/xiv-gear-planner/gear-planner/issues/687#issuecomment-3039439225
        // If server received a push but we didn't commit that locally, then we end up in a state where
        // e.g. server = 19, local = 20, lastSynced = 0 - realistically, the last synced version is 19.
        // But if it was legitimately updated elsewhere, e.g. server = 21, local = 20, lastSynced = 0, then
        // the correct state would be lastSynced = 20.
        // Either way, the conflict is resolved.
        if (this.meta.lastSyncedVersion === 0 && this.localVersion > 0 && serverVersion > 0) {
            this.meta.lastSyncedVersion = Math.min(this.localVersion, serverVersion);
        }
        // https://github.com/xiv-gear-planner/gear-planner/issues/687
        if (this.meta.unsyncedModifications) {
            for (let i = 0; i < this.meta.unsyncedModifications.length; i++) {
                const mod = this.meta.unsyncedModifications[i];
                if (mod[1] === versionKey) {
                    this.meta.lastSyncedVersion = Math.max(mod[0], this.meta.lastSyncedVersion);
                    break;
                }
            }
        }
        this.pruneSyncRecords();
    }

    private pruneSyncRecords() {
        if (this.meta.unsyncedModifications) {
            this.meta.unsyncedModifications = this.meta.unsyncedModifications.filter(mod => mod[0] > this.meta.lastSyncedVersion);
        }
    }

    /**
     * Inform the handle of a new server serverVersion which is NOT a deletion
     *
     * @param serverVersion
     * @param versionKey
     */
    setServerVersion(serverVersion: number, versionKey: number) {
        this.metaDirty = true;
        this.meta.serverDeleted = false;
        this.meta.serverVersion = serverVersion;
        // If the server lost data for some reason, we should do this so that it can re-upload.
        if (serverVersion < this.meta.lastSyncedVersion) {
            this.meta.lastSyncedVersion = serverVersion;
        }
        this.fixMissedSync(serverVersion, versionKey);
        this.afterUpdate();
    }

    get metaKey(): string {
        return sheetMetaKey(this.key);
    }

    get isTrash(): boolean {
        // console.log(`isTrash ${this.key} ${this.meta.localDeleted} ${this.meta.serverDeleted}`);
        return this.meta.localDeleted && this.meta.serverDeleted;
    }

    /**
     * Save the sheet and metadata.
     */
    flush(): void {
        let reloaded = false;
        if (this.metaDirty) {
            if (this.isTrash) {
                console.log(`removing ${this.metaKey}`);
                this.storage.removeItem(this.metaKey);
            }
            else {
                this.storage.setItem(this.metaKey, JSON.stringify(this.meta));
            }
            this.metaDirty = false;
        }
        else {
            const old = JSON.stringify(this.meta);
            const incoming = this.storage.getItem(this.metaKey);
            if (incoming && old !== incoming) {
                this.meta = JSON.parse(incoming);
                if (this.trueSyncStatus !== 'conflict') {
                    this._conflictResolutionStrategy = null;
                }
                reloaded = true;
            }
        }
        if (this.dataDirty) {
            if (this.isTrash) {
                console.log(`removing ${this.key}`);
                this.storage.removeItem(this.key);
            }
            else {
                this.storage.setItem(this.key, JSON.stringify(this._data));
            }
            this.dataDirty = false;
        }
        else {
            this._data = JSON.parse(this.storage.getItem(this.key) ?? 'null');
        }
        if (reloaded) {
            this.afterUpdate();
        }
    }

    get syncStatus(): SyncStatus {
        const trueStatus = this.trueSyncStatus;
        if (trueStatus === 'conflict') {
            // We return the 'conflict' status except if the user has specifically opted for a particular conflict
            // resolution strategy.
            if (this._conflictResolutionStrategy === 'keep-local') {
                return 'client-newer-than-server';
            }
            else if (this._conflictResolutionStrategy === 'keep-remote') {
                return 'server-newer-than-client';
            }
        }
        return trueStatus;
    }

    get trueSyncStatus(): SyncStatus {
        if (this.isTrash) {
            return 'trash';
        }
        const meta = this.meta;
        // the version that the client has
        const cur = meta.currentVersion;
        if (cur === 0 || this._data === null) {
            if (this.serverVersion === 0) {
                // Not really a valid state.
                return 'null-data';
            }
            if (this.meta.localDeleted) {
                // If BOTH local and server have been deleted, then we don't really care if there's technically a version
                // mismatch.
                if (this.meta.serverDeleted) {
                    return 'in-sync';
                }
                // If this is not the case, then we need to fall back to normal sync behavior, because there could
                // potentially be a conflict.
            }
            else {
                return 'never-downloaded';
            }
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
     * @param serverVersion
     * @param data
     * @param sortOrder
     * @param versionKey
     */
    postDownload(serverVersion: number, data: SheetExport, sortOrder: number | null, versionKey: number): void {
        this._data = data;
        this.meta.serverVersion = serverVersion;
        this.meta.lastSyncedVersion = serverVersion;
        this.meta.currentVersion = serverVersion;
        this.meta.summary = makeSummaryFromData(data);
        this.meta.localDeleted = false;
        this.meta.serverDeleted = false;
        this.meta.sortOrder = sortOrder;
        this._conflictResolutionStrategy = null;
        this.metaDirty = true;
        this.dataDirty = true;
        this.fixMissedSync(serverVersion, versionKey);
        this.afterUpdate();
    }

    /**
     * Set new data and bump version.
     *
     * @param data
     */
    postLocalModification(data: SheetExport): void {
        // Don't treat it as a local modification if the save didn't actually alter anything but the timestamp.
        // TODO: better/more efficient way?
        const oldData = {...this._data};
        delete oldData.timestamp;
        const newData = {...data};
        delete newData.timestamp;

        if (JSON.stringify(oldData) === JSON.stringify(newData)) {
            return;
        }

        this._data = data;
        this.meta.summary = makeSummaryFromData(data);
        this.meta.currentVersion++;
        this.metaDirty = true;
        this.dataDirty = true;
        this.meta.localDeleted = false;
        this._conflictResolutionStrategy = null;
        if (this.meta.unsyncedModifications === undefined) {
            this.meta.unsyncedModifications = [];
        }
        const randomId = Math.floor(Math.random() * 16384 * 65536) + 1;
        this.meta.unsyncedModifications.push([this.meta.currentVersion, randomId]);
        this.afterLocalUpdate();
        this.flush();
        this.afterUpdate();
    }

    /**
     * Read the data.
     */
    async readData(): Promise<SheetExport> {
        const status = this.syncStatus;
        if (status === 'never-downloaded' || status === 'server-newer-than-client') {
            if (await this.mgr.asyncLoader.canLoadAsync(this)) {
                await this.mgr.asyncLoader.load(this);
                if (this._data === null) {
                    throw new Error("Async loader did not load data");
                }
            }
            else {
                throw new Error("Async loader not available");
            }
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
        console.info(`fullyDelete ${this.key}`);
        this.meta.serverDeleted = true;
        this.meta.localDeleted = true;
        this._data = null;
        this.markDataDirty();
        this.markMetaDirty();
        this.flush();
        this.mgr.remove(this);
    }

    deleteLocal(): void {
        this.localVersion++;
        this.meta.localDeleted = true;
        this._data = null;
        this.markMetaDirty();
        this.markDataDirty();
    }

    deleteServerToClient(serverVersion: number): void {
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
        console.log(`deleteServer ${this.key}`);
        if (serverVersion >= this.meta.serverVersion) {
            if (this.lastSyncedVersion === this.localVersion) {
                // True and proper deletion
                this.meta.serverVersion = serverVersion;
                this.meta.lastSyncedVersion = serverVersion;
                this.meta.currentVersion = serverVersion;
                this.fullyDelete();
            }
            else {
                console.warn(`deleteServer conflict! server ${this.serverVersion} lastSynced ${this.lastSyncedVersion} local ${this.localVersion}`);
                this.meta.serverDeleted = true;
                this.meta.serverVersion = serverVersion;
                this.afterUpdate();
            }
        }
    }

    get conflictResolutionStrategy(): ConflictResolutionStrategy | null {
        return this._conflictResolutionStrategy;
    }

    set conflictResolutionStrategy(value: ConflictResolutionStrategy | null) {
        if (this.syncStatus !== 'conflict') {
            return;
        }
        this._conflictResolutionStrategy = value;
        this.afterUpdate();
    }

    get hasConflict(): boolean {
        return this.trueSyncStatus === 'conflict';
    }

    saveLocalAsDefault(): SheetHandle {
        const newName = this.name + " Copy";
        const newHandle = this.mgr.newSheetFromScratch({
            ...this.meta.summary,
            name: newName,
        });
        newHandle.postLocalModification({
            ...this._data,
            name: newName,
            saveKey: newHandle.key,
        });
        newHandle.flush();
        this.mgr.afterSheetListChange();
        return newHandle;
    }
}

export type SheetHandle = PublicOnly<SheetHandleImpl>;


export interface SheetManager {
    readonly allDisplayableSheets: SheetHandle[];
    readonly allSheets: SheetHandle[];

    setUpdateHook(key: string, hook: SyncUpdateHook): void;

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

    newSheetFromScratch(summary: SheetSummary): SheetHandle;

    setAsyncLoader(loader: SheetAsyncLoader): void;

    getByKey(sheetKey: string): SheetHandle | null;
}

/**
 * Used for headless sheets
 */
export const DUMMY_SHEET_MGR: SheetManager = {
    getByKey(sheetKey: string): SheetHandle | null {
        return undefined;
    },
    setAsyncLoader(loader: SheetAsyncLoader): void {
    },
    newSheetFromScratch(summary: SheetSummary): SheetHandle {
        return undefined;
    },
    afterSheetListChange(): void {
    },
    setUpdateHook(key: string, hook: SyncUpdateHook): void {
    },
    allDisplayableSheets: [],
    allSheets: [],
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
};

export type SyncUpdateHook = {
    onSheetUpdate?: (handle: SheetHandle) => void;
    onSheetListChange?: () => void;
    onSheetLocalChange?: (handle: SheetHandle) => void;
}

export type SheetAsyncLoader = {
    load: (sheet: SheetHandle) => Promise<void>;
    canLoad: (sheet: SheetHandle) => boolean;
    canLoadAsync: (sheet: SheetHandle) => Promise<boolean>;
};

const NoopAsyncLoader: SheetAsyncLoader = {
    load: async (key: SheetHandle) => {
        throw new Error("Noop async loader");
    },
    canLoad: (key: SheetHandle) => false,
    canLoadAsync: (key: SheetHandle) => Promise.resolve(false),
};

export class SheetManagerImpl implements SheetManager {
    private readonly dataMap = new Map<string, SheetHandle>();
    private allItems: SheetHandle[] = [];
    private _updateHookMap: Map<string, SyncUpdateHook> = new Map();
    asyncLoader: SheetAsyncLoader = NoopAsyncLoader;

    constructor(readonly storage: Storage) {
    }

    setUpdateHook(key: string, hook: SyncUpdateHook) {
        this._updateHookMap.set(key, hook);
    }

    afterSheetUpdate(handle: SheetHandle) {
        this._updateHookMap.forEach(hook => {
            hook.onSheetUpdate?.(handle);
        });
    }

    afterSheetListChange() {
        this._updateHookMap.forEach(hook => {
            hook.onSheetListChange?.();
        });
    }

    afterSheetLocalChange(handle: SheetHandle) {
        this._updateHookMap.forEach(hook => {
            hook.onSheetLocalChange?.(handle);
        });
    }

    setAsyncLoader(loader: SheetAsyncLoader) {
        this.asyncLoader = loader;
    }

    /**
     * Debug method which will reset the sort order of all sheets
     */
    resetAll(): void {
        this.allItems.forEach(item => {
            item.sortOrder = null;
        });
        this.flush();
    }

    get allDisplayableSheets(): SheetHandle[] {
        if (this.allItems.length === 0) {
            this.readAll();
        }
        return this.allItems.filter(item => item.displayable);
    }

    get allSheets(): SheetHandle[] {
        if (this.allItems.length === 0) {
            this.readAll();
        }
        return this.allItems;
    }

    private readOne(dataKey: string): SheetHandle | null {
        const data = JSON.parse(this.storage.getItem(dataKey) ?? 'null') as SheetExport;
        const metaFound = sheetMetaKey(dataKey) in this.storage;
        if (data !== null || metaFound) {
            const out = new SheetHandleImpl(dataKey, data, this.readSheetMeta(dataKey), this);
            this.dataMap.set(dataKey, out);
            // We do not add it to the list because the list being empty is used as the trigger for loading the list
            // from scratch. Plus it would be useless to display a "list" with only a single item in any circumstance.
            // When we use this method via readAll, that method already handles assembling the list.
            return out;
        }
        return null;
    }

    private readAll(): SheetHandle[] {
        const items: SheetHandle[] = [];
        for (const storageKey in this.storage) {
            if (storageKey.startsWith("sheet-save-") && !storageKey.endsWith("-meta")) {
                if (this.dataMap.has(storageKey)) {
                    const existing = this.dataMap.get(storageKey);
                    items.push(existing);
                    continue;
                }
                const handle = this.readOne(storageKey);
                items.push(handle);
            }
        }
        this.allItems = items;
        // This has the effect of also sorting items
        this.resort();
        return items;
    }

    reorderTo(draggedSheet: SheetHandle, draggedTo: SheetHandle): 'up' | 'down' | null {
        // Index where we want the dragged sheet to go to
        const fromIndex = this.allItems.indexOf(draggedSheet);
        const toIndex = this.allItems.indexOf(draggedTo);
        const lastIndex = this.allItems.length - 1;
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
            const secondBasis = this.allItems[secondBasisIndex].sortOrder;
            const primaryBasis = draggedTo.sortOrder;
            const newSort = (primaryBasis + secondBasis) / 2;
            draggedSheet.sortOrder = newSort;
            out = isDown ? 'down' : 'up';
        }
        this.resort();
        return out;
    }

    resort() {
        this.allItems.sort((left, right) => {
            return right.sortOrder - left.sortOrder;
        });

    }

    flush(): void {
        this.allItems.forEach(item => item.flush());
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
        const handle = new SheetHandleImpl(saveKey, null, sheetMeta, this);
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
        const handle = new SheetHandleImpl(this.getNextSheetInternalName(), null, sheetMeta, this);
        // Mark metadata as dirty
        handle.markMetaDirty();
        handle.markDataDirty();
        this.registerNew(handle);
        return handle;
    }

    private registerNew(handle: SheetHandle) {
        this.dataMap.set(handle.key, handle);
        this.allItems.unshift(handle);
    }

    getOrCreateForKey(key: string): SheetHandle {
        if (this.dataMap.has(key)) {
            return this.dataMap.get(key)!;
        }
        const meta = this.readSheetMeta(key);
        const item = new SheetHandleImpl(key, null, meta, this);
        this.dataMap.set(key, item);
        this.allItems.push(item);
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

    getByKey(sheet: string): SheetHandle | null {
        if (!this.dataMap.has(sheet)) {
            return this.readOne(sheet);
        }
        return this.dataMap.get(sheet);
    }

    remove(toDelete: SheetHandle) {
        this.dataMap.delete(toDelete.key);
        this.allItems = this.allItems.filter(item => item !== toDelete);
        this.afterSheetListChange();
    }
}


