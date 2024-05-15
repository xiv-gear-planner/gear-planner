import {previewItemStatDetail} from "../gear";
import {GearItem, RawStats} from "@xivgear/xivmath/geartypes";
import {expect} from 'chai';


describe('Individual item math', () => {
    describe('previewItemStatDetail', () => {
        it('can handle a normal unmelded item', () => {
            const stats = new RawStats({crit: 200});
            const statCaps = new RawStats({crit: 250});
            const preview = previewItemStatDetail({
                stats: stats,
                statCaps: statCaps,
                unsyncedVersion: this,
                isSyncedDown: false
            } as GearItem, 'crit');
            expect(preview.mode).to.equal('unmelded');
            expect(preview.cap).to.equal(250);
            expect(preview.effectiveAmount).to.equal(200);
            expect(preview.fullAmount).to.equal(200);
            expect(preview.overcapAmount).to.equal(0);
        });
        it('can handle a normal downsynced item', () => {
            const stats = new RawStats({crit: 200});
            const statCaps = new RawStats({crit: 250});
            const syncedStats = new RawStats({crit: 180});
            const syncedStatCaps = new RawStats({crit: 180});
            const preview = previewItemStatDetail({
                stats: syncedStats,
                statCaps: syncedStatCaps,
                unsyncedVersion: {
                    stats: stats,
                    statCaps: statCaps,
                },
                isSyncedDown: true
            } as GearItem, 'crit');
            expect(preview.mode).to.equal('synced-down');
            expect(preview.cap).to.equal(180);
            expect(preview.effectiveAmount).to.equal(180);
            expect(preview.fullAmount).to.equal(200);
            expect(preview.overcapAmount).to.equal(20);
        });
        it('can handle a downsynced item where the stat in question is not capped', () => {
            const stats = new RawStats({crit: 150});
            const statCaps = new RawStats({crit: 250});
            const syncedStats = new RawStats({crit: 150});
            const syncedStatCaps = new RawStats({crit: 180});
            const preview = previewItemStatDetail({
                stats: syncedStats,
                statCaps: syncedStatCaps,
                unsyncedVersion: {
                    stats: stats,
                    statCaps: statCaps,
                },
                isSyncedDown: true
            } as GearItem, 'crit');
            expect(preview.mode).to.equal('unmelded');
            expect(preview.cap).to.equal(180);
            expect(preview.effectiveAmount).to.equal(150);
            expect(preview.fullAmount).to.equal(150);
            expect(preview.overcapAmount).to.equal(0);
        });

    });
});

// TODO: add more tests for the gear sheet as a whole after untangling