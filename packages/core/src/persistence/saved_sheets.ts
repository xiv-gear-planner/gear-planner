import {DEFAULT_SHEET_METADATA, LocalSheetMetadata, SheetExport} from "@xivgear/xivmath/geartypes";
import {GearPlanSheet} from "../sheet";
import {recordError} from "@xivgear/common-ui/analytics/analytics";


export function getNextSheetNumber(): number {
    const lastRaw = localStorage.getItem("last-sheet-number");
    const lastSheetNum = lastRaw ? parseInt(lastRaw) : 0;
    return Math.max(lastSheetNum + 1);
}

export function getNextSheetInternalName() {
    const next = getNextSheetNumber();
    localStorage.setItem("last-sheet-number", next.toString());
    const randomStub = Math.floor(Math.random() * 16384 * 65536);
    return "sheet-save-" + next + '-' + randomStub.toString(16).toLowerCase();
}

export function syncLastSheetNumber(numFromServer: number) {
    if (!numFromServer) {
        return;
    }
    const next = getNextSheetNumber();
    if (numFromServer > next) {
        localStorage.setItem('last-sheet-number', numFromServer.toString());
    }
}

export function sheetMetaKey(sheetKey: string): string {
    return sheetKey + '-meta';
}

export function readSheetMeta(sheetKey: string): LocalSheetMetadata {
    const metaKey = sheetMetaKey(sheetKey);
    const metaRaw = localStorage.getItem(metaKey);
    let meta: LocalSheetMetadata;
    if (metaRaw) {
        meta = {
            ...DEFAULT_SHEET_METADATA,
            ...JSON.parse(metaRaw),
        };
    }
    else {
        meta = {
            ...DEFAULT_SHEET_METADATA,
        };
    }
    return meta;
}


export function deleteSheetByKey(saveKey: string) {
    localStorage.removeItem(saveKey);
}

export type SyncStatus =
    'in-sync'
    | 'client-newer-than-server'
    | 'server-newer-than-client'
    | 'never-uploaded'
    | 'conflict'
    | 'never-downloaded'
    | 'unknown';

export type SheetHandle = {
    key: string,
    data: SheetExport,
    meta: LocalSheetMetadata,
    get sortOrder(): number,
    set sortOrder(value: number),
    save(): void,
    get syncStatus(): SyncStatus,
    get localVersion(): number,
    get lastSyncedVersion(): number,
    set lastSyncedVersion(value: number),
    get serverVersion(): number,
    set serverVersion(value: number),
    postDownload(version: number, data: SheetExport): void,
    postLocalModification(data: SheetExport): void,
    get busy(): boolean,
    doAction<X>(action: Promise<X>): Promise<X>,
}

class SheetHandleImpl implements SheetHandle {

    private metaDirty: boolean = false;
    private dataDirty: boolean = false;

    private pendingActions: Promise<unknown>[] = [];

    private _data: SheetExport;

    constructor(
        public readonly key: string,
        data: SheetExport,
        public readonly meta: LocalSheetMetadata,
        private readonly storage: Storage,
        private readonly updateHook: (h: SheetHandle) => void) {
        this._data = data;
    }

    get busy(): boolean {
        return this.pendingActions.length > 0;
    }

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
        this.updateHook(this);
    }

    get sortOrder(): number {
        if (this.meta.sortOrder !== null) {
            return this.meta.sortOrder;
        }
        return parseInt(this.key.split('-')[2]);
    }

    set sortOrder(sortOrder: number | null) {
        this.meta.sortOrder = sortOrder;
        this.meta.currentVersion++;
        this.metaDirty = true;
        this.afterUpdate();
    }

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

    get localVersion(): number {
        return this.meta.currentVersion;
    }

    set localVersion(version: number) {
        this.metaDirty = true;
        this.meta.currentVersion = version;
        this.afterUpdate();
    }

    get serverVersion(): number {
        return this.meta.serverVersion;
    }

    set serverVersion(version: number) {
        this.metaDirty = true;
        this.meta.serverVersion = version;
        // If the server lost data for some reason, we should do this so that it can re-upload.
        if (version < this.meta.lastSyncedVersion) {
            this.meta.lastSyncedVersion = version;
        }
        this.afterUpdate();
    }

    save(): void {
        if (this.metaDirty) {
            // TODO: make meta key a method
            const metaKey = sheetMetaKey(this.key);
            this.storage.setItem(metaKey, JSON.stringify(this.meta));
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
        if (cur === 0 || this.data === null) {
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
        recordError('get syncStatus', `Unknown sync status for sheet ${this.key}: cur ${cur}, lastUp ${lastUploaded}, svr ${svrVer}`);
        return 'unknown';
    }

    postDownload(version: number, data: SheetExport): void {
        this._data = data;
        this.meta.serverVersion = version;
        this.meta.lastSyncedVersion = version;
        this.meta.currentVersion = version;
        this.metaDirty = true;
        this.dataDirty = true;
        this.afterUpdate();
    }

    postLocalModification(data: SheetExport): void {
        this._data = data;
        this.meta.currentVersion++;
        this.metaDirty = true;
        this.dataDirty = true;
        this.afterUpdate();
    }

    get data(): SheetExport {
        return this._data;
    }

    markMetaDirty(): void {
        this.metaDirty = true;
    }

    markDataDirty(): void {
        this.dataDirty = true;
    }
}


export interface SheetManager {
    readonly lastData: SheetHandle[];

    setUpdateHook(hook: (handle: SheetHandle) => void): void;

    callUpdateHook(handle: SheetHandle): void;

    /**
     * Debug method which will reset the sort order of all sheets
     */
    resetAll(): void;

    readData(): SheetHandle[];

    reorderTo(draggedSheet: SheetHandle, draggedTo: SheetHandle): 'up' | 'down' | null;

    resort(): void;

    flush(): void;

    newSheet(param: {
        saveKey: string;
        sheetMeta: LocalSheetMetadata
    }): SheetHandle;

    getOrCreateForKey(key: string): SheetHandle;

    saveData(sheet: GearPlanSheet): void;

    saveAs(sheet: SheetExport): string;
}

export const DUMMY_SHEET_MGR: SheetManager = {
    lastData: [],
    callUpdateHook(handle: SheetHandle): void {
    },
    flush(): void {
    },
    getOrCreateForKey(key: string): SheetHandle {
        return undefined;
    },
    newSheet(param: {
        saveKey: string;
        sheetMeta: LocalSheetMetadata
    }): SheetHandle {
        return undefined;
    },
    readData(): SheetHandle[] {
        return [];
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
    setUpdateHook(hook: (handle: SheetHandle) => void): void {
    },
};

export class SheetManagerImpl implements SheetManager {
    private readonly dataMap = new Map<string, SheetHandle>();
    private _lastData: SheetHandle[] = [];
    private _updateHook: (handle: SheetHandle) => void = () => {
    };

    constructor(private readonly storage: Storage) {
    }

    setUpdateHook(hook: (handle: SheetHandle) => void) {
        this._updateHook = hook;
    }

    callUpdateHook(handle: SheetHandle) {
        this._updateHook(handle);
    }

    /**
     * Debug method which will reset the sort order of all sheets
     */
    resetAll(): void {
        this._lastData.forEach(item => {
            item.sortOrder = null;
        });
        this.readData();
        this.flush();
    }

    readData(): SheetHandle[] {
        // TODO: make this able to load meta-only keys
        const items: SheetHandle[] = [];
        const outer = this;
        for (const localStorageKey in localStorage) {
            if (localStorageKey.startsWith("sheet-save-") && !localStorageKey.endsWith("-meta")) {
                const imported = JSON.parse(this.storage.getItem(localStorageKey)) as SheetExport;
                if (imported === null) {
                    // Sheet has not been downloaded yet
                    console.info(`Sheet not downloaded: ${localStorageKey}`);
                }
                else if (imported?.saveKey) {
                    if (this.dataMap.has(localStorageKey)) {
                        const existing = this.dataMap.get(localStorageKey);
                        items.push(existing);
                        continue;
                    }
                    const meta = readSheetMeta(localStorageKey);
                    const item = new SheetHandleImpl(localStorageKey, imported, meta, outer.storage, (h) => this.callUpdateHook(h));
                    this.dataMap.set(localStorageKey, item);
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
        this._lastData.forEach(item => item.save());
    }

    newSheet(param: {
        saveKey: string;
        sheetMeta: LocalSheetMetadata
    }): SheetHandle {
        const sheet = new SheetHandleImpl(param.saveKey, null, param.sheetMeta, this.storage, (h) => this.callUpdateHook(h));
        console.log(`New sheet: ${sheet.key}`);
        this._lastData.push(sheet);
        sheet.markMetaDirty();
        sheet.markDataDirty();
        return sheet;
    }

    get lastData(): SheetHandle[] {
        return [...this._lastData];
    }

    getOrCreateForKey(key: string): SheetHandle {
        if (this.dataMap.has(key)) {
            return this.dataMap.get(key)!;
        }
        const meta = readSheetMeta(key);
        const item = new SheetHandleImpl(key, null, meta, this.storage, (h) => this.callUpdateHook(h));
        this.dataMap.set(key, item);
        this._lastData.push(item);
        return item;
    }

    saveData(sheet: GearPlanSheet) {
        const saveKey = sheet.saveKey;
        const handle = this.getOrCreateForKey(saveKey);
        handle.postLocalModification(sheet.exportSheet(false));
        handle.save();
    }

    saveAs(sheet: SheetExport): string {
        const saveKey = getNextSheetInternalName();
        const handle = this.getOrCreateForKey(saveKey);
        handle.postLocalModification(sheet);
        handle.save();
        return saveKey;
    }
}


