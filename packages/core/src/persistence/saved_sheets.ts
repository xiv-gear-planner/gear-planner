import {DEFAULT_SHEET_METADATA, LocalSheetMetadata, SheetExport} from "@xivgear/xivmath/geartypes";


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
}

class SheetHandleImpl implements SheetHandle {

    private metaDirty: boolean = false;
    private dataDirty: boolean = false;

    private _data: SheetExport;

    constructor(
        public readonly key: string,
        data: SheetExport,
        public readonly meta: LocalSheetMetadata,
        private readonly storage: Storage
    ) {
        this._data = data;
    }

    get sortOrder(): number {
        if (this.meta.sortOrder !== null) {
            return this.meta.sortOrder;
        }
        return parseInt(this.key.split('-')[2]);
    }

    set sortOrder(sortOrder: number | null) {
        this.meta.sortOrder = sortOrder;
        this.metaDirty = true;
    }

    get lastSyncedVersion(): number {
        return this.meta.lastSyncedVersion;
    }

    set lastSyncedVersion(version: number) {
        this.metaDirty = true;
        this.meta.lastSyncedVersion = version;
        // console.trace(`Setting last synced version to ${version} for ${this.key}`);
    }

    get localVersion(): number {
        return this.meta.currentVersion;
    }

    set localVersion(version: number) {
        this.metaDirty = true;
        this.meta.currentVersion = version;
    }

    get serverVersion(): number {
        return this.meta.serverVersion;
    }

    set serverVersion(version: number) {
        this.metaDirty = true;
        this.meta.serverVersion = version;
        // If the server lost data for some reason, we should do this so that it can re-upload.
        if (version < this.lastSyncedVersion) {
            this.lastSyncedVersion = version;
        }
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
        reportError(`Unknown sync status for sheet ${this.key}: cur ${cur}, lastUp ${lastUploaded}, svr ${svrVer}`);
        return 'unknown';
    }

    postDownload(version: number, data: SheetExport): void {
        this._data = data;
        this.meta.serverVersion = version;
        this.meta.lastSyncedVersion = version;
        this.meta.currentVersion = version;
        this.metaDirty = true;
        this.dataDirty = true;
    }

    postLocalModification(data: SheetExport): void {
        this._data = data;
        this.meta.currentVersion++;
        this.metaDirty = true;
        this.dataDirty = true;
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


export class SheetManager {
    private readonly dataMap = new Map<string, SheetHandle>();
    private _lastData: SheetHandle[] = [];

    constructor(private readonly storage: Storage) {
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
        // TODO: make this re-use existing handle instances, preferring to reload them instead
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
                    const item = new SheetHandleImpl(localStorageKey, imported, meta, outer.storage);
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
        const sheet = new SheetHandleImpl(param.saveKey, null, param.sheetMeta, this.storage);
        console.log(`New sheet: ${sheet.key}`);
        this._lastData.push(sheet);
        sheet.markMetaDirty();
        sheet.markDataDirty();
        return sheet;
    }

    get lastData(): SheetHandle[] {
        return [...this._lastData];
    }
}


