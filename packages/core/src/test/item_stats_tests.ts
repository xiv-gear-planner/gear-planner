import {previewItemStatDetail} from "../gear";
import {GearItem, RawStats} from "@xivgear/xivmath/geartypes";
import {expect} from 'chai';
import {NewApiDataManager} from "../datamanager_new";
import {ALL_COMBAT_JOBS, MAIN_STATS} from "@xivgear/xivmath/xivconstants";


describe('Individual item math', () => {
    describe('previewItemStatDetail', () => {
        it('can handle a normal unmelded item', () => {
            const stats = new RawStats({crit: 200});
            const statCaps = new RawStats({crit: 250});
            const preview = previewItemStatDetail({
                stats: stats,
                statCaps: statCaps,
                unsyncedVersion: this,
                isSyncedDown: false,
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
                isSyncedDown: true,
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
                isSyncedDown: true,
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

describe('bug #695 - offhands have wrong stats', () => {
    // This test validates our stat cap calculation logic by verifying that all known items have
    // a big substat exactly equal to their cap
    ALL_COMBAT_JOBS.forEach(job => {
        it(`all normal items for ${job} have big stat, main stat, vitality === stat cap`, async () => {
            const dm = new NewApiDataManager([job], 100, undefined);
            await dm.loadData();
            const failures: string[] = [];
            dm.allItems.forEach(item => {
                if (item.isCustomRelic) {
                    return;
                }
                if (item.isNqVersion) {
                    // TODO: is there a specific pattern we can use for NQ?
                    return;
                }
                if (item.id === 24855 || item.id === 24856) {
                    // Vermillion cloak of casting/health - multi-slot items other than 2H weapon are not supported
                    return;
                }
                const primarySub = item.primarySubstat;
                const primarySubValue = item.stats[primarySub];
                const primarySubCap = item.statCaps[primarySub];
                if (primarySubValue !== primarySubCap) {
                    failures.push(`Item ${item.name} i${item.ilvl} (${item.id}, ${item.occGearSlotName}) has ${primarySub} ${primarySubValue} !== ${primarySubCap} (cap)`);
                }
                // This includes vitality
                MAIN_STATS.forEach(mainStat => {
                    const value = item.stats[mainStat];
                    if (value === 0) {
                        return;
                    }
                    if (mainStat === 'vitality') {
                        // TODO - maybe affected by role stats?
                        // return;
                    }
                    const cap = item.statCaps[mainStat];
                    if (value !== cap) {
                        failures.push(`Item ${item.name} i${item.ilvl} (${item.id}, ${item.occGearSlotName}) has ${mainStat} ${value} !== ${cap} (cap)`);
                    }
                });
            });
            if (failures.length > 0) {
                throw Error(failures.join('\n'));
            }
        });

    })
});


