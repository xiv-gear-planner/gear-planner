import {FakeLocalStorage} from "../test_utils";
import {SheetManagerImpl, SyncStatus} from "../../persistence/saved_sheets";
import {expect} from "chai";
import {SheetExport, SheetSummary} from "@xivgear/xivmath/geartypes";
import {SupportedLevel} from "@xivgear/xivmath/xivconstants";

function makeTestData() {
    const storage: Storage = new FakeLocalStorage();
    const mgr = new SheetManagerImpl(storage);
    return {
        storage,
        mgr,
    };
}

function summaryToPartialData(summary: SheetSummary): Partial<SheetExport> {
    return {
        name: summary.name,
        ilvlSync: summary.isync,
        isMultiJob: summary.multiJob,
        job: summary.job,
        level: summary.level as SupportedLevel,
    };
}

describe('sheet_manager', () => {
    it('supports download then upload', () => {
        const {
            storage,
            mgr,
        } = makeTestData();
        const summary: SheetSummary = {
            job: 'BLU',
            level: 90,
            multiJob: false,
            name: "BLU Test",
        };
        // Simulate download from server of a set that the client has never seen
        // Metadata-only download
        const handle = mgr.newSheetFromRemote('sheet-save-123-foo', 5, summary);
        mgr.flush();
        expect(storage.getItem('sheet-save-123-foo')).to.equal('null');
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(0);
        expect(handle.meta.currentVersion).to.equal(0);
        expect(handle.syncStatus).to.equal('never-downloaded' satisfies SyncStatus);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));
        expect(handle).to.be.equal(mgr.getOrCreateForKey(handle.key));
        expect(mgr.allSheets).to.have.length(1);
        expect(mgr.allDisplayableSheets).to.have.length(0);

        // Download the actual data
        handle.postDownload(5, {
            ...summaryToPartialData(summary),
            foo: "bar",
            saveKey: handle.metaKey,
        } as Partial<SheetExport> as SheetExport, null, 0);
        handle.flush();

        const handleGet = mgr.getOrCreateForKey(handle.key);
        expect(handle).to.be.equal(handleGet);
        expect(JSON.parse(storage.getItem('sheet-save-123-foo'))['foo']).to.equal('bar');
        expect(JSON.parse(storage.getItem('sheet-save-123-foo'))['name']).to.equal('BLU Test');
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        expect(handle.meta.currentVersion).to.equal(5);
        expect(handle.meta.sortOrder).to.be.null;
        expect(handle.meta.unsyncedModifications ?? []).to.have.length(0);
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));
        expect(handle).to.be.equal(mgr.getOrCreateForKey(handle.key));
        expect(mgr.allSheets).to.have.length(1);
        expect(mgr.allDisplayableSheets).to.have.length(1);

        // Locally modify
        handle.postLocalModification({
            ...summaryToPartialData(summary),
            name: 'Modified name',
            foo: 'baz',
            saveKey: handle.metaKey,
        } as Partial<SheetExport> as SheetExport);
        handle.flush();

        expect(handle.meta.unsyncedModifications).to.have.length(1);
        expect(JSON.parse(storage.getItem('sheet-save-123-foo'))['foo']).to.equal('baz');
        expect(JSON.parse(storage.getItem('sheet-save-123-foo'))['name']).to.equal('Modified name');
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        expect(handle.meta.currentVersion).to.equal(6);
        expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));

        // Simulate upload
        handle.lastSyncedVersion = 6;
        handle.flush();
        expect(JSON.parse(storage.getItem('sheet-save-123-foo'))['foo']).to.equal('baz');
        expect(JSON.parse(storage.getItem('sheet-save-123-foo'))['name']).to.equal('Modified name');
        expect(handle.meta.serverVersion).to.equal(6);
        expect(handle.meta.lastSyncedVersion).to.equal(6);
        expect(handle.meta.currentVersion).to.equal(6);
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        expect(handle.meta.unsyncedModifications).to.have.length(0);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));

        mgr.flush();

        // Load from scratch, make sure it still looks correct
        const mgr2 = new SheetManagerImpl(storage);
        const data = mgr2.allDisplayableSheets;
        expect(data).to.have.length(1);
        expect(data[0].key).to.equal(handle.key);
        expect(data[0].meta.serverVersion).to.equal(6);
        expect(data[0].meta.lastSyncedVersion).to.equal(6);
        expect(data[0].meta.currentVersion).to.equal(6);
        expect(data[0].syncStatus).to.equal('in-sync' satisfies SyncStatus);
        expect(data[0].dataNow.name).to.equal('Modified name');
        expect(data[0].meta.unsyncedModifications).to.have.length(0);
        // expect(data[0].dataNow).to.deep.equal({
        //     foo: 'baz',
        //     saveKey: 'sheet-save-123-foo-meta',
        // });

        // Simulate server-side deletion
        // First, try no-op by specifying a version too low
        handle.deleteServerToClient(5);
        expect(handle.meta.serverDeleted).to.be.false;

        // Now, a real deletion
        handle.deleteServerToClient(7);
        expect(handle.meta.serverDeleted).to.be.true;
        expect(handle.meta.localDeleted).to.be.true;
        expect(handle.dataNow).to.be.null;
        expect(handle.meta.currentVersion).to.equal(7);
        expect(handle.meta.serverVersion).to.equal(7);
        expect(handle.meta.lastSyncedVersion).to.equal(7);
        expect(handle.meta.unsyncedModifications).to.have.length(0);
        handle.flush();
        expect(storage.getItem('sheet-save-123-foo')).to.be.null;
        expect(storage.getItem('sheet-save-123-foo-meta')).to.be.null;
        expect(mgr.allDisplayableSheets).to.have.length(0);
        // Should NOT still have this in-memory
        expect(mgr.allSheets).to.have.length(0);

        // But should be gone when we reload
        const mgr3 = new SheetManagerImpl(storage);
        expect(mgr3.allDisplayableSheets).to.have.length(0);
        expect(mgr3.allSheets).to.have.length(0);
    });
    it('supports upload then download', () => {
        const {
            storage,
            mgr,
        } = makeTestData();

        const summary: SheetSummary = {
            job: 'BLU',
            level: 90,
            multiJob: false,
            name: "BLU Test",
            isync: 666,
        };

        const handle = mgr.newSheetFromScratch(summary);
        mgr.flush();
        const key = handle.key;
        const metaKey = handle.metaKey;
        expect(storage.getItem(key)).to.equal('null');
        expect(handle.meta.serverVersion).to.equal(0);
        expect(handle.meta.lastSyncedVersion).to.equal(0);
        expect(handle.meta.currentVersion).to.equal(0);
        expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
        // Not displayable yet
        expect(mgr.allDisplayableSheets).to.have.length(0);
        expect(mgr.allSheets).to.have.length(1);

        handle.postLocalModification({
            ...summaryToPartialData(summary),
            foo: "bar",
            saveKey: key,
        } as Partial<SheetExport> as SheetExport);
        expect(handle.meta.serverVersion).to.equal(0);
        expect(handle.meta.lastSyncedVersion).to.equal(0);
        expect(handle.meta.currentVersion).to.equal(1);
        expect(handle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
        expect(handle.meta.unsyncedModifications).to.have.length(1);
        handle.flush();
        expect(JSON.parse(storage.getItem(key))['saveKey']).to.equal(key);
        expect(JSON.parse(storage.getItem(key))['foo']).to.equal('bar');
        expect(JSON.parse(storage.getItem(key))['name']).to.equal(summary.name);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));

        handle.lastSyncedVersion = 1;
        expect(handle.meta.serverVersion).to.equal(1);
        expect(handle.meta.lastSyncedVersion).to.equal(1);
        expect(handle.meta.currentVersion).to.equal(1);
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        handle.flush();
        expect(JSON.parse(storage.getItem(key))['saveKey']).to.equal(key);
        expect(JSON.parse(storage.getItem(key))['foo']).to.equal('bar');
        expect(JSON.parse(storage.getItem(key))['name']).to.equal(summary.name);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
        expect(handle.meta.unsyncedModifications).to.have.length(0);

        handle.setServerVersion(5, 0);
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(1);
        expect(handle.meta.currentVersion).to.equal(1);
        expect(handle.syncStatus).to.equal('server-newer-than-client' satisfies SyncStatus);
        handle.flush();
        expect(JSON.parse(storage.getItem(key))['saveKey']).to.equal(key);
        expect(JSON.parse(storage.getItem(key))['foo']).to.equal('bar');
        expect(JSON.parse(storage.getItem(key))['name']).to.equal(summary.name);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
        expect(handle.meta.unsyncedModifications).to.have.length(0);

        handle.postDownload(5, {
            ...summaryToPartialData(summary),
            name: "Modified name",
            foo: "baz",
            saveKey: key,
        } as unknown as SheetExport, 6.5, 0);
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        expect(handle.meta.currentVersion).to.equal(5);
        expect(handle.meta.sortOrder).to.equal(6.5);
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        handle.flush();
        expect(JSON.parse(storage.getItem(key))['saveKey']).to.equal(key);
        expect(JSON.parse(storage.getItem(key))['foo']).to.equal('baz');
        expect(JSON.parse(storage.getItem(key))['name']).to.equal('Modified name');
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
        expect(handle.meta.unsyncedModifications).to.have.length(0);

        // Local delete
        handle.deleteLocal();
        expect(handle.meta.localDeleted).to.be.true;
        expect(handle.dataNow).to.be.null;
        expect(handle.meta.currentVersion).to.equal(6);
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        handle.flush();
        expect(storage.getItem(key)).to.equal('null');

        // Simualte sending delete to server
        handle.lastSyncedVersion = 6;
        expect(handle.dataNow).to.be.null;
        expect(handle.meta.localDeleted).to.be.true;
        expect(handle.meta.serverDeleted).to.be.true;
        expect(handle.meta.currentVersion).to.equal(6);
        expect(handle.meta.serverVersion).to.equal(6);
        expect(handle.meta.lastSyncedVersion).to.equal(6);
        handle.flush();
        expect(storage.getItem(key)).to.be.null;
        expect(storage.getItem(metaKey)).to.be.null;
    });
    it('can reload if not dirty', () => {
        // If a handle is not dirty, then 'flush' calls the
        const {
            storage,
            mgr,
        } = makeTestData();
        const summary: SheetSummary = {
            job: 'BLU',
            level: 90,
            multiJob: false,
            name: "BLU Test",
            isync: 666,
        };
        const handle = mgr.newSheetFromScratch(summary);
        const key = handle.key;
        expect(handle.localVersion).to.equal(0);
        expect(handle.lastSyncedVersion).to.equal(0);
        expect(handle.serverVersion).to.equal(0);
        mgr.flush();
        handle.postLocalModification({
            ...summaryToPartialData(summary),
            description: "bar",
            saveKey: key,
        } as SheetExport);
        expect(handle.localVersion).to.equal(1);
        expect(handle.lastSyncedVersion).to.equal(0);
        expect(handle.serverVersion).to.equal(0);

        const newMgr = new SheetManagerImpl(storage);
        const newHandle = newMgr.getByKey(key);
        expect(newHandle).to.not.be.null;
        expect(newHandle.localVersion).to.equal(1);
        expect(newHandle.lastSyncedVersion).to.equal(0);
        expect(newHandle.serverVersion).to.equal(0);

        // Modify first handle, second handle should see it after flush
        handle.postLocalModification({
            ...handle.dataNow,
            description: "bar2",
        } as SheetExport);
        handle.flush();
        expect(handle.localVersion).to.equal(2);
        expect(handle.lastSyncedVersion).to.equal(0);
        expect(handle.serverVersion).to.equal(0);
        // Old version should not have updated yet
        expect(newHandle.localVersion).to.equal(1);
        expect(newHandle.lastSyncedVersion).to.equal(0);
        expect(newHandle.serverVersion).to.equal(0);

        newHandle.flush();
        // Now it updates
        expect(newHandle.localVersion).to.equal(2);
        expect(newHandle.lastSyncedVersion).to.equal(0);
        expect(newHandle.serverVersion).to.equal(0);
        expect(newHandle.dataNow.description).to.equal('bar2');

        // Let's go the other way now
        // Try a metadata-only change
        newHandle.lastSyncedVersion = 2;
        expect(newHandle.localVersion).to.equal(2);
        expect(newHandle.lastSyncedVersion).to.equal(2);
        expect(newHandle.serverVersion).to.equal(2);
        newHandle.flush();

        expect(handle.localVersion).to.equal(2);
        expect(handle.lastSyncedVersion).to.equal(0);
        expect(handle.serverVersion).to.equal(0);
        handle.flush();
        expect(handle.localVersion).to.equal(2);
        expect(handle.lastSyncedVersion).to.equal(2);
        expect(handle.serverVersion).to.equal(2);

    });
    describe('bug 687', () => {
        describe('fix existing bugged clients where lastSynced==0', () => {
            it('client and server equal', () => {
                // In this test, we have a sheet where the client uploads, but fails to commit the upload. Thus, instead of
                // having server == local == lastSynced, we have server == local > 0, but lastSynced == 0.
                const {
                    storage,
                    mgr,
                } = makeTestData();

                const summary: SheetSummary = {
                    job: 'BLU',
                    level: 90,
                    multiJob: false,
                    name: "BLU Test",
                    isync: 666,
                };

                const handle = mgr.newSheetFromScratch(summary);
                mgr.flush();
                const key = handle.key;
                const metaKey = handle.metaKey;
                expect(storage.getItem(key)).to.equal('null');
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(0);
                expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
                // Not displayable yet
                expect(mgr.allDisplayableSheets).to.have.length(0);
                expect(mgr.allSheets).to.have.length(1);

                handle.postLocalModification({
                    ...summaryToPartialData(summary),
                    foo: "bar",
                    saveKey: key,
                } as Partial<SheetExport> as SheetExport);
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(1);
                expect(handle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
                handle.flush();
                expect(JSON.parse(storage.getItem(key))['saveKey']).to.equal(key);
                expect(JSON.parse(storage.getItem(key))['foo']).to.equal('bar');
                expect(JSON.parse(storage.getItem(key))['name']).to.equal(summary.name);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
                expect(handle.meta.unsyncedModifications).to.have.length(1);

                handle.setServerVersion(1, 0);

                expect(handle.meta.serverVersion).to.equal(1);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(1);
                expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(0);
            });
            it('client newer than server', () => {
                // In this test, we have a sheet where the client uploads, but fails to commit the upload, and then the client
                // makes another modification.
                const {
                    storage,
                    mgr,
                } = makeTestData();

                const summary: SheetSummary = {
                    job: 'BLU',
                    level: 90,
                    multiJob: false,
                    name: "BLU Test",
                    isync: 666,
                };

                const handle = mgr.newSheetFromScratch(summary);
                mgr.flush();
                const key = handle.key;
                const metaKey = handle.metaKey;
                expect(storage.getItem(key)).to.equal('null');
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(0);
                expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
                // Not displayable yet
                expect(mgr.allDisplayableSheets).to.have.length(0);
                expect(mgr.allSheets).to.have.length(1);

                handle.postLocalModification({
                    ...summaryToPartialData(summary),
                    foo: "bar",
                    saveKey: key,
                } as Partial<SheetExport> as SheetExport);
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(1);
                expect(handle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
                handle.flush();
                expect(JSON.parse(storage.getItem(key))['saveKey']).to.equal(key);
                expect(JSON.parse(storage.getItem(key))['foo']).to.equal('bar');
                expect(JSON.parse(storage.getItem(key))['name']).to.equal(summary.name);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));

                handle.postLocalModification({
                    ...summaryToPartialData(summary),
                    foo: "baz",
                    saveKey: key,
                } as Partial<SheetExport> as SheetExport);
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(2);
                expect(handle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
                handle.flush();
                expect(handle.meta.unsyncedModifications).to.have.length(2);

                handle.setServerVersion(1, 0);

                expect(handle.meta.serverVersion).to.equal(1);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(2);
                expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(1);
            });
            it('server newer than client', () => {
                // In this test, we have a sheet where the client uploads, but fails to commit the upload, and then the server
                // gets a newer version from another client.
                const {
                    storage,
                    mgr,
                } = makeTestData();

                const summary: SheetSummary = {
                    job: 'BLU',
                    level: 90,
                    multiJob: false,
                    name: "BLU Test",
                    isync: 666,
                };

                const handle = mgr.newSheetFromScratch(summary);
                mgr.flush();
                const key = handle.key;
                const metaKey = handle.metaKey;
                expect(storage.getItem(key)).to.equal('null');
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(0);
                expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
                // Not displayable yet
                expect(mgr.allDisplayableSheets).to.have.length(0);
                expect(mgr.allSheets).to.have.length(1);

                handle.postLocalModification({
                    ...summaryToPartialData(summary),
                    foo: "bar",
                    saveKey: key,
                } as Partial<SheetExport> as SheetExport);
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(1);
                expect(handle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
                handle.flush();
                expect(JSON.parse(storage.getItem(key))['saveKey']).to.equal(key);
                expect(JSON.parse(storage.getItem(key))['foo']).to.equal('bar');
                expect(JSON.parse(storage.getItem(key))['name']).to.equal(summary.name);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
                expect(handle.meta.unsyncedModifications).to.have.length(1);

                handle.setServerVersion(2, 0);

                expect(handle.meta.serverVersion).to.equal(2);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(1);
                expect(handle.syncStatus).to.equal('server-newer-than-client' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(0);
            });
        });
        describe('fix problem going forward with server version key', () => {
            it('client and server equal', () => {
                // In this test, we have a sheet where the client uploads, but fails to commit the upload. Thus, instead of
                // having server == local == lastSynced, we have server == local > 0, but lastSynced == 0.
                const {
                    storage,
                    mgr,
                } = makeTestData();

                const summary: SheetSummary = {
                    job: 'BLU',
                    level: 90,
                    multiJob: false,
                    name: "BLU Test",
                    isync: 666,
                };

                const handle = mgr.newSheetFromScratch(summary);
                mgr.flush();
                const key = handle.key;
                const metaKey = handle.metaKey;
                expect(storage.getItem(key)).to.equal('null');
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(0);
                expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
                // Not displayable yet
                expect(mgr.allDisplayableSheets).to.have.length(0);
                expect(mgr.allSheets).to.have.length(1);
                expect(handle.meta.unsyncedModifications ?? []).to.have.length(0);

                handle.postLocalModification({
                    ...summaryToPartialData(summary),
                    foo: "bar",
                    saveKey: key,
                } as Partial<SheetExport> as SheetExport);
                expect(handle.meta.unsyncedModifications).to.have.length(1);
                {
                    const modRecord = handle.meta.unsyncedModifications[0];
                    expect(modRecord[0]).to.equal(1);
                }
                handle.lastSyncedVersion = 1;
                expect(handle.meta.serverVersion).to.equal(1);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(1);
                expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(0);
                handle.flush();

                handle.postLocalModification({
                    ...summaryToPartialData(summary),
                    foo: "baz",
                    saveKey: key,
                } as Partial<SheetExport> as SheetExport);

                expect(handle.meta.serverVersion).to.equal(1);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(2);
                expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(1);
                const modRecord = handle.meta.unsyncedModifications[0];
                expect(modRecord[0]).to.equal(2);
                const modKey = modRecord[1];

                handle.setServerVersion(2, modKey);
                expect(handle.meta.serverVersion).to.equal(2);
                expect(handle.meta.lastSyncedVersion).to.equal(2);
                expect(handle.meta.currentVersion).to.equal(2);
                expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(0);
            });
            it('client newer than server', () => {
                // This test is like the one above, but we perform more client modifications, such that the client
                // is able to partially resolve the issue, but still has unpushed modifications.
                const {
                    storage,
                    mgr,
                } = makeTestData();

                const summary: SheetSummary = {
                    job: 'BLU',
                    level: 90,
                    multiJob: false,
                    name: "BLU Test",
                    isync: 666,
                };

                const handle = mgr.newSheetFromScratch(summary);
                mgr.flush();
                const key = handle.key;
                const metaKey = handle.metaKey;
                expect(storage.getItem(key)).to.equal('null');
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(0);
                expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
                // Not displayable yet
                expect(mgr.allDisplayableSheets).to.have.length(0);
                expect(mgr.allSheets).to.have.length(1);
                expect(handle.meta.unsyncedModifications ?? []).to.have.length(0);

                handle.postLocalModification({
                    ...summaryToPartialData(summary),
                    foo: "bar",
                    saveKey: key,
                } as Partial<SheetExport> as SheetExport);
                expect(handle.meta.unsyncedModifications).to.have.length(1);
                {
                    const modRecord = handle.meta.unsyncedModifications[0];
                    expect(modRecord[0]).to.equal(1);
                }
                handle.lastSyncedVersion = 1;
                expect(handle.meta.serverVersion).to.equal(1);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(1);
                expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(0);
                handle.flush();

                for (let i = 0; i < 5; i++) {
                    handle.postLocalModification({
                        ...summaryToPartialData(summary),
                        foo: `baz${i}`,
                        saveKey: key,
                    } as Partial<SheetExport> as SheetExport);
                }

                expect(handle.meta.serverVersion).to.equal(1);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(6);
                expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(5);
                for (let i = 0; i < 5; i++) {
                    const modRecord = handle.meta.unsyncedModifications[i];
                    expect(modRecord[0]).to.equal(i + 2);
                }
                // Let's take the third one
                const modRecord = handle.meta.unsyncedModifications[2];
                const modKey = modRecord[1];
                expect(modRecord[0]).to.equal(4);

                handle.setServerVersion(4, modKey);
                expect(handle.meta.serverVersion).to.equal(4);
                expect(handle.meta.lastSyncedVersion).to.equal(4);
                expect(handle.meta.currentVersion).to.equal(6);
                expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(2);
            });
            it('server newer than client', () => {
                // This test is like the one above, but the server has an even newer version than anything on the
                // client.
                const {
                    storage,
                    mgr,
                } = makeTestData();

                const summary: SheetSummary = {
                    job: 'BLU',
                    level: 90,
                    multiJob: false,
                    name: "BLU Test",
                    isync: 666,
                };

                const handle = mgr.newSheetFromScratch(summary);
                mgr.flush();
                const key = handle.key;
                const metaKey = handle.metaKey;
                expect(storage.getItem(key)).to.equal('null');
                expect(handle.meta.serverVersion).to.equal(0);
                expect(handle.meta.lastSyncedVersion).to.equal(0);
                expect(handle.meta.currentVersion).to.equal(0);
                expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
                expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
                // Not displayable yet
                expect(mgr.allDisplayableSheets).to.have.length(0);
                expect(mgr.allSheets).to.have.length(1);
                expect(handle.meta.unsyncedModifications ?? []).to.have.length(0);

                handle.postLocalModification({
                    ...summaryToPartialData(summary),
                    foo: "bar",
                    saveKey: key,
                } as Partial<SheetExport> as SheetExport);
                expect(handle.meta.unsyncedModifications).to.have.length(1);
                {
                    const modRecord = handle.meta.unsyncedModifications[0];
                    expect(modRecord[0]).to.equal(1);
                }
                handle.lastSyncedVersion = 1;
                expect(handle.meta.serverVersion).to.equal(1);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(1);
                expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(0);
                handle.flush();

                for (let i = 0; i < 5; i++) {
                    handle.postLocalModification({
                        ...summaryToPartialData(summary),
                        foo: `baz${i}`,
                        saveKey: key,
                    } as Partial<SheetExport> as SheetExport);
                }

                expect(handle.meta.serverVersion).to.equal(1);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(6);
                expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(5);
                for (let i = 0; i < 5; i++) {
                    const modRecord = handle.meta.unsyncedModifications[i];
                    expect(modRecord[0]).to.equal(i + 2);
                }

                handle.setServerVersion(8, -123);
                expect(handle.meta.serverVersion).to.equal(8);
                expect(handle.meta.lastSyncedVersion).to.equal(1);
                expect(handle.meta.currentVersion).to.equal(6);
                expect(handle.syncStatus).to.equal('conflict' satisfies SyncStatus);
                expect(handle.meta.unsyncedModifications).to.have.length(5);
            });

        });
    });
    describe('conflicts', () => {
        it('force upload, same ver num', () => {
            const {
                storage,
                mgr,
            } = makeTestData();

            const summary: SheetSummary = {
                job: 'BLU',
                level: 90,
                multiJob: false,
                name: "BLU Test",
                isync: 666,
            };

            const handle = mgr.newSheetFromScratch(summary);
            mgr.flush();
            const key = handle.key;
            const metaKey = handle.metaKey;
            expect(storage.getItem(key)).to.equal('null');
            expect(handle.meta.serverVersion).to.equal(0);
            expect(handle.meta.lastSyncedVersion).to.equal(0);
            expect(handle.meta.currentVersion).to.equal(0);
            expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
            expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
            // Not displayable yet
            expect(mgr.allDisplayableSheets).to.have.length(0);
            expect(mgr.allSheets).to.have.length(1);
            expect(handle.meta.unsyncedModifications ?? []).to.have.length(0);

            handle.postLocalModification({
                ...summaryToPartialData(summary),
                foo: "bar",
                saveKey: key,
            } as Partial<SheetExport> as SheetExport);
            expect(handle.meta.unsyncedModifications).to.have.length(1);
            expect(handle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
            expect(handle.meta.serverVersion).to.equal(0);
            expect(handle.meta.lastSyncedVersion).to.equal(0);
            expect(handle.meta.currentVersion).to.equal(1);

            handle.lastSyncedVersion = 1;
            expect(handle.meta.serverVersion).to.equal(1);
            expect(handle.meta.lastSyncedVersion).to.equal(1);
            expect(handle.meta.currentVersion).to.equal(1);

            expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
            expect(handle.meta.unsyncedModifications).to.have.length(0);

            handle.postLocalModification({
                ...summaryToPartialData(summary),
                foo: "baz",
                saveKey: key,
            } as Partial<SheetExport> as SheetExport);
            expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
            expect(handle.meta.unsyncedModifications).to.have.length(1);
            handle.setServerVersion(2, 0);
            expect(handle.meta.serverVersion).to.equal(2);
            expect(handle.meta.lastSyncedVersion).to.equal(1);
            expect(handle.meta.currentVersion).to.equal(2);
            expect(handle.syncStatus).to.equal('conflict' satisfies SyncStatus);

            handle.conflictResolutionStrategy = 'keep-local';
            expect(handle.trueSyncStatus).to.equal('conflict' satisfies SyncStatus);
            expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
            // These are not affected by the conflict resolution strategy - they are handled in the UDS
            expect(handle.meta.serverVersion).to.equal(2);
            expect(handle.meta.lastSyncedVersion).to.equal(1);
            expect(handle.meta.currentVersion).to.equal(2);
        });
        it('deletion conflict bug, c2s', () => {
            // Ran into this when I was messing around. It is a legitimate conflict, but the client doesn't seem to
            // want to recognize it as a conflict for some reason.
            const storage = new FakeLocalStorage();
            storage.setItem('sheet-save-183-8ff2-meta', `{"currentVersion":22,"lastSyncedVersion":21,"serverVersion":34,"sortOrder":205.375,"hasConflict":false,"forcePush":false,"serverDeleted":false,"localDeleted":true,"summary":{"name":"OC Healer Test","isync":700,"level":100,"job":"WHM","multiJob":false}}`);
            storage.setItem('sheet-save-183-8ff2', 'null');
            const mgr = new SheetManagerImpl(storage);

            expect(mgr.allSheets).to.have.length(1);
            const theSheet = mgr.allSheets[0];
            expect(theSheet.meta.serverDeleted).to.equal(false);
            expect(theSheet.meta.localDeleted).to.equal(true);
            expect(theSheet.meta.lastSyncedVersion).to.equal(21);
            expect(theSheet.meta.currentVersion).to.equal(22);
            expect(theSheet.meta.serverVersion).to.equal(34);

            expect(theSheet.syncStatus).to.equal('conflict' satisfies SyncStatus);

        });
        it('deletion conflict bug, s2c', () => {
            // In this test, we have a conflict when processing a server-to-client deletion
            const storage = new FakeLocalStorage();
            // Start with a local modification
            storage.setItem('sheet-save-183-8ff2-meta', `{"currentVersion":35,"lastSyncedVersion":34,"serverVersion":34,"sortOrder":205.375,"hasConflict":false,"forcePush":false,"serverDeleted":false,"localDeleted":false,"summary":{"name":"OC Healer Test","isync":700,"level":100,"job":"WHM","multiJob":false}}`);
            storage.setItem('sheet-save-183-8ff2', '{}');
            const mgr = new SheetManagerImpl(storage);

            expect(mgr.allSheets).to.have.length(1);
            const theSheet = mgr.allSheets[0];
            expect(theSheet.meta.serverDeleted).to.equal(false);
            expect(theSheet.meta.localDeleted).to.equal(false);
            expect(theSheet.meta.currentVersion).to.equal(35);
            expect(theSheet.meta.lastSyncedVersion).to.equal(34);
            expect(theSheet.meta.serverVersion).to.equal(34);

            expect(theSheet.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);

            theSheet.deleteServerToClient(35);

            expect(theSheet.syncStatus).to.equal('conflict' satisfies SyncStatus);
            expect(theSheet.meta.serverDeleted).to.equal(true);
            expect(theSheet.meta.localDeleted).to.equal(false);
            expect(theSheet.meta.currentVersion).to.equal(35);
            expect(theSheet.meta.lastSyncedVersion).to.equal(34);
            expect(theSheet.meta.serverVersion).to.equal(35);

        });
        it('save local as new copy', () => {
            const {
                storage,
                mgr,
            } = makeTestData();

            const summary: SheetSummary = {
                job: 'BLU',
                level: 90,
                multiJob: false,
                name: "BLU Test",
                isync: 666,
            };

            const handle = mgr.newSheetFromScratch(summary);
            mgr.flush();
            const key = handle.key;
            const metaKey = handle.metaKey;
            expect(storage.getItem(key)).to.equal('null');
            expect(handle.meta.serverVersion).to.equal(0);
            expect(handle.meta.lastSyncedVersion).to.equal(0);
            expect(handle.meta.currentVersion).to.equal(0);
            expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
            expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
            // Not displayable yet
            expect(mgr.allDisplayableSheets).to.have.length(0);
            expect(mgr.allSheets).to.have.length(1);
            expect(handle.meta.unsyncedModifications ?? []).to.have.length(0);

            handle.postLocalModification({
                ...summaryToPartialData(summary),
                foo: "bar",
                saveKey: key,
            } as Partial<SheetExport> as SheetExport);
            expect(handle.meta.unsyncedModifications).to.have.length(1);
            expect(handle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
            expect(handle.meta.serverVersion).to.equal(0);
            expect(handle.meta.lastSyncedVersion).to.equal(0);
            expect(handle.meta.currentVersion).to.equal(1);

            handle.lastSyncedVersion = 1;
            expect(handle.meta.serverVersion).to.equal(1);
            expect(handle.meta.lastSyncedVersion).to.equal(1);
            expect(handle.meta.currentVersion).to.equal(1);

            expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
            expect(handle.meta.unsyncedModifications).to.have.length(0);

            handle.postLocalModification({
                ...summaryToPartialData(summary),
                foo: "baz",
                saveKey: key,
            } as Partial<SheetExport> as SheetExport);
            expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
            expect(handle.meta.unsyncedModifications).to.have.length(1);
            handle.setServerVersion(2, 0);
            expect(handle.meta.serverVersion).to.equal(2);
            expect(handle.meta.lastSyncedVersion).to.equal(1);
            expect(handle.meta.currentVersion).to.equal(2);
            expect(handle.syncStatus).to.equal('conflict' satisfies SyncStatus);

            const newHandle = handle.saveLocalAsDefault();

            // Does not affect original - you have to still set the conflict resolution strategy
            expect(handle.syncStatus).to.equal('conflict' satisfies SyncStatus);

            expect(newHandle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
            // Should have changed key
            expect(newHandle.key).to.not.equal(handle.key);
            expect(newHandle.name).to.equal(handle.name + ' Copy');
            expect(newHandle.dataNow.saveKey).to.not.equal(handle.key);
            expect(newHandle.dataNow.saveKey).to.eq(newHandle.key);
        });
    });

});
