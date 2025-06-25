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
        expect(mgr.allDisplayableSheets).to.have.length(1);

        // Download the actual data
        handle.postDownload(5, {
            ...summaryToPartialData(summary),
            foo: "bar",
            saveKey: handle.metaKey,
        } as Partial<SheetExport> as SheetExport, null);
        handle.flush();

        const handleGet = mgr.getOrCreateForKey(handle.key);
        expect(handle).to.be.equal(handleGet);
        expect(JSON.parse(storage.getItem('sheet-save-123-foo'))['foo']).to.equal('bar');
        expect(JSON.parse(storage.getItem('sheet-save-123-foo'))['name']).to.equal('BLU Test');
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        expect(handle.meta.currentVersion).to.equal(5);
        expect(handle.meta.sortOrder).to.be.null;
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));
        expect(handle).to.be.equal(mgr.getOrCreateForKey(handle.key));

        // Locally modify
        handle.postLocalModification({
            ...summaryToPartialData(summary),
            name: 'Modified name',
            foo: 'baz',
            saveKey: handle.metaKey,
        } as Partial<SheetExport> as SheetExport);
        handle.flush();

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
        // expect(data[0].dataNow).to.deep.equal({
        //     foo: 'baz',
        //     saveKey: 'sheet-save-123-foo-meta',
        // });

        // Simulate server-side deletion
        // First, try no-op by specifying a version too low
        handle.deleteServer(6);
        expect(handle.meta.serverDeleted).to.be.false;

        // Now, a real deletion
        handle.deleteServer(7);
        expect(handle.meta.serverDeleted).to.be.true;
        expect(handle.meta.localDeleted).to.be.true;
        expect(handle.dataNow).to.be.null;
        expect(handle.meta.currentVersion).to.equal(7);
        expect(handle.meta.serverVersion).to.equal(7);
        expect(handle.meta.lastSyncedVersion).to.equal(7);
        handle.flush();
        expect(storage.getItem('sheet-save-123-foo')).to.equal('null');
        // TODO
        // expect(storage.getItem('sheet-save-123-foo-meta')).to.be.null;
        expect(mgr.allDisplayableSheets).to.have.length(0);

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

        handle.serverVersion = 5;
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(1);
        expect(handle.meta.currentVersion).to.equal(1);
        expect(handle.syncStatus).to.equal('server-newer-than-client' satisfies SyncStatus);
        handle.flush();
        expect(JSON.parse(storage.getItem(key))['saveKey']).to.equal(key);
        expect(JSON.parse(storage.getItem(key))['foo']).to.equal('bar');
        expect(JSON.parse(storage.getItem(key))['name']).to.equal(summary.name);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));

        handle.postDownload(5, {
            ...summaryToPartialData(summary),
            name: "Modified name",
            foo: "baz",
            saveKey: key,
        } as unknown as SheetExport, 6.5);
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

        // Local delete
        handle.deleteLocal();
        expect(handle.meta.localDeleted).to.be.true;
        expect(handle.dataNow).to.be.null;
        expect(handle.meta.currentVersion).to.equal(6);
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        handle.flush();
        expect(storage.getItem(key)).to.be.null;

        // Simualte sending delete to server
        handle.lastSyncedVersion = 6;
        expect(handle.dataNow).to.be.null;
        expect(handle.meta.currentVersion).to.equal(6);
        expect(handle.meta.serverVersion).to.equal(6);
        expect(handle.meta.lastSyncedVersion).to.equal(6);
        handle.flush();
        expect(storage.getItem(key)).to.be.null;
        // TODO: should this fully delete the metadata too? No reason to keep it around if the data is gone from local
        // and the server agrees that the data is deleted.
    });

    // TODO: deletion conflict flows
});
