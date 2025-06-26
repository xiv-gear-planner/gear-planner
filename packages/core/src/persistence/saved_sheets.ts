import {DEFAULT_SHEET_METADATA, SheetExport, SheetMetadata} from "@xivgear/xivmath/geartypes";


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

export function readSheetMeta(sheetKey: string): SheetMetadata {
    const metaKey = sheetMetaKey(sheetKey);
    const metaRaw = localStorage.getItem(metaKey);
    let meta: SheetMetadata;
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

export type SelectableSheet = {
    key: string,
    sheet: SheetExport,
    meta: SheetMetadata,
    get sortOrder(): number,
    set sortOrder(value: number),
    save(): void,
    isSynced(): boolean,
    get localVersion(): number,
    get lastSyncedVersion(): number,
}

export class SheetManager {
    private readonly dataMap = new Map<string, SelectableSheet>();
    private lastData: SelectableSheet[] = [];

    constructor(private readonly storage: Storage) {
    }

    /**
     * Debug method which will reset the sort order of all sheets
     */
    resetAll(): void {
        this.lastData.forEach(item => {
            item.sortOrder = null;
        });
        this.readData();
        this.flush();
    }

    readData(): SelectableSheet[] {
        const items: SelectableSheet[] = [];
        const outer = this;
        for (const localStorageKey in localStorage) {
            if (localStorageKey.startsWith("sheet-save-")) {
                try {
                    const imported = JSON.parse(this.storage.getItem(localStorageKey)) as SheetExport;
                    if (imported?.saveKey) {
                        if (this.dataMap.has(localStorageKey)) {
                            const existing = this.dataMap.get(localStorageKey);
                            items.push(existing);
                            continue;
                        }
                        const meta = readSheetMeta(localStorageKey);
                        const defaultSort = parseInt(localStorageKey.split('-')[2]);
                        let dirty = false;
                        const item = {
                            key: localStorageKey,
                            sheet: imported,
                            meta: meta,
                            get sortOrder(): number {
                                if (meta.sortOrder !== null) {
                                    return meta.sortOrder;
                                }
                                return defaultSort;
                            },
                            set sortOrder(value: number | null) {
                                meta.sortOrder = value;
                                dirty = true;
                            },
                            save() {
                                if (!dirty) {
                                    return;
                                }
                                const metaKey = sheetMetaKey(localStorageKey);
                                outer.storage.setItem(metaKey, JSON.stringify(this.meta));
                                dirty = false;
                            },
                            isSynced: function (): boolean {
                                return meta.currentVersion === meta.lastSyncedVersion;
                            },
                            get localVersion() {
                                return meta.currentVersion;
                            },
                            get lastSyncedVersion() {
                                return meta.lastSyncedVersion;
                            },
                            set lastSyncedVersion(value: number) {
                                meta.lastSyncedVersion = value;
                                dirty = true;
                            },
                        } satisfies SelectableSheet;
                        this.dataMap.set(localStorageKey, item);
                        items.push(item);
                    }
                }
                catch (e) {
                    console.error("Error reading sheet", e);
                }
            }
        }
        this.lastData = items;
        // This has the effect of also sorting items
        this.resort();
        return items;
    }

    reorderTo(draggedSheet: SelectableSheet, draggedTo: SelectableSheet): 'up' | 'down' | null {
        // Index where we want the dragged sheet to go to
        const fromIndex = this.lastData.indexOf(draggedSheet);
        const toIndex = this.lastData.indexOf(draggedTo);
        const lastIndex = this.lastData.length - 1;
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
            const secondBasis = this.lastData[secondBasisIndex].sortOrder;
            const primaryBasis = draggedTo.sortOrder;
            const newSort = (primaryBasis + secondBasis) / 2;
            draggedSheet.sortOrder = newSort;
            out = isDown ? 'down' : 'up';
        }
        this.resort();
        return out;
    }

    private resort() {
        this.lastData.sort((left, right) => {
            return right.sortOrder - left.sortOrder;
        });

    }

    flush(): void {
        this.lastData.forEach(item => item.save());
    }
}


