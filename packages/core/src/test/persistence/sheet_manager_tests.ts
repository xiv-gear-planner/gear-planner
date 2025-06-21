import {FakeLocalStorage} from "../test_utils";
import {SheetManagerImpl, SyncStatus} from "../../persistence/saved_sheets";
import {expect} from "chai";
import {SheetExport} from "@xivgear/xivmath/geartypes";

function makeTestData() {
    const storage: Storage = new FakeLocalStorage();
    const mgr = new SheetManagerImpl(storage);
    return {
        storage,
        mgr,
    };
}

describe('sheet_manager', () => {
    it('supports download then upload', () => {
        const {
            storage,
            mgr,
        } = makeTestData();
        const handle = mgr.newSheetFromRemote('sheet-save-123-foo', 5);
        mgr.flush();
        expect(storage.getItem('sheet-save-123-foo')).to.equal('null');
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(0);
        expect(handle.meta.currentVersion).to.equal(0);
        expect(handle.syncStatus).to.equal('never-downloaded' satisfies SyncStatus);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));
        expect(handle).to.be.equal(mgr.getOrCreateForKey(handle.key));
        expect(mgr.lastData).to.have.length(1);

        handle.postDownload(5, {
            foo: "bar",
            saveKey: handle.metaKey,
        } as unknown as SheetExport);
        handle.save();

        const handleGet = mgr.getOrCreateForKey(handle.key);
        expect(handle).to.be.equal(handleGet);
        expect(storage.getItem('sheet-save-123-foo')).to.equal('{"foo":"bar","saveKey":"sheet-save-123-foo-meta"}');
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        expect(handle.meta.currentVersion).to.equal(5);
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));
        expect(handle).to.be.equal(mgr.getOrCreateForKey(handle.key));

        handle.postLocalModification({
            foo: 'baz',
            saveKey: handle.metaKey,
        } as unknown as SheetExport);
        handle.save();

        expect(storage.getItem('sheet-save-123-foo')).to.equal('{"foo":"baz","saveKey":"sheet-save-123-foo-meta"}');
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        expect(handle.meta.currentVersion).to.equal(6);
        expect(handle.syncStatus).to.equal('client-newer-than-server' satisfies SyncStatus);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));

        // Simulate upload
        handle.lastSyncedVersion = 6;
        handle.save();
        expect(storage.getItem('sheet-save-123-foo')).to.equal('{"foo":"baz","saveKey":"sheet-save-123-foo-meta"}');
        expect(handle.meta.serverVersion).to.equal(6);
        expect(handle.meta.lastSyncedVersion).to.equal(6);
        expect(handle.meta.currentVersion).to.equal(6);
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        expect(storage.getItem('sheet-save-123-foo-meta')).to.equal(JSON.stringify(handle.meta));

        mgr.flush();

        const mgr2 = new SheetManagerImpl(storage);
        const data = mgr2.readData();
        expect(data).to.have.length(1);
        expect(data[0].key).to.equal(handle.key);
        expect(data[0].meta.serverVersion).to.equal(6);
        expect(data[0].meta.lastSyncedVersion).to.equal(6);
        expect(data[0].meta.currentVersion).to.equal(6);
        expect(data[0].syncStatus).to.equal('in-sync' satisfies SyncStatus);
        expect(data[0].data).to.deep.equal({
            foo: 'baz',
            saveKey: 'sheet-save-123-foo-meta'
        });
    });
    it('supports upload then download', () => {
        const {
            storage,
            mgr,
        } = makeTestData();
        const handle = mgr.newSheetFromScratch();
        mgr.flush();
        const key = handle.key;
        const metaKey = handle.metaKey;
        expect(storage.getItem(key)).to.equal('null');
        expect(handle.meta.serverVersion).to.equal(0);
        expect(handle.meta.lastSyncedVersion).to.equal(0);
        expect(handle.meta.currentVersion).to.equal(0);
        expect(handle.syncStatus).to.equal('null-data' satisfies SyncStatus);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
        expect(mgr.lastData).to.have.length(1);

        handle.postLocalModification({
            foo: "bar",
            saveKey: handle.metaKey,
        } as unknown as SheetExport);
        expect(handle.meta.serverVersion).to.equal(0);
        expect(handle.meta.lastSyncedVersion).to.equal(0);
        expect(handle.meta.currentVersion).to.equal(1);
        expect(handle.syncStatus).to.equal('never-uploaded' satisfies SyncStatus);
        handle.save();
        expect(storage.getItem(key)).to.equal(`{"foo":"bar","saveKey":"${metaKey}"}`);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));

        handle.lastSyncedVersion = 1;
        expect(handle.meta.serverVersion).to.equal(1);
        expect(handle.meta.lastSyncedVersion).to.equal(1);
        expect(handle.meta.currentVersion).to.equal(1);
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        handle.save();
        expect(storage.getItem(key)).to.equal(`{"foo":"bar","saveKey":"${metaKey}"}`);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));

        handle.serverVersion = 5;
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(1);
        expect(handle.meta.currentVersion).to.equal(1);
        expect(handle.syncStatus).to.equal('server-newer-than-client' satisfies SyncStatus);
        handle.save();
        expect(storage.getItem(key)).to.equal(`{"foo":"bar","saveKey":"${metaKey}"}`);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));

        handle.postDownload(5, {
            foo: "baz",
            saveKey: handle.metaKey,
        } as unknown as SheetExport);
        expect(handle.meta.serverVersion).to.equal(5);
        expect(handle.meta.lastSyncedVersion).to.equal(5);
        expect(handle.meta.currentVersion).to.equal(5);
        expect(handle.syncStatus).to.equal('in-sync' satisfies SyncStatus);
        handle.save();
        expect(storage.getItem(key)).to.equal(`{"foo":"baz","saveKey":"${metaKey}"}`);
        expect(storage.getItem(metaKey)).to.equal(JSON.stringify(handle.meta));
    });
});
