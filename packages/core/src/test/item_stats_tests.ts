import {CharacterGearSet, previewItemStatDetail} from "../gear";
import {GearItem, RawStatKey, RawStats} from "@xivgear/xivmath/geartypes";
import {expect} from 'chai';
import {NewApiDataManager} from "../datamanager_new";
import {ALL_COMBAT_JOBS, MAIN_STATS} from "@xivgear/xivmath/xivconstants";
import {HEADLESS_SHEET_PROVIDER} from "../sheet";


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
                if (item.id === 34455 || item.id === 34474) {
                    // Known issue with this specific PLD 1H+Shield
                    return;
                }
                const primarySub = item.primarySubstat;
                const primarySubValue = item.stats[primarySub];
                const primarySubCap = item.statCaps[primarySub];
                if (primarySubValue !== primarySubCap) {
                    // A few ilvls have different caps for dhit and tenacity
                    if (primarySub === 'dhit' || primarySub === 'tenacity') {
                        const ilvlSyncInfo = dm.getIlvlSyncInfo(item.ilvl);
                        const thisCap = ilvlSyncInfo.substatCap(item.occGearSlotName, primarySub);
                        // The cap for the "normal" substats
                        const normalCap = ilvlSyncInfo.substatCap(item.occGearSlotName, 'crit');
                        if (thisCap !== normalCap && primarySubValue === normalCap) {
                            return;
                        }
                    }
                    failures.push(`Item ${item.name} i${item.ilvl} (${item.id}, ${item.occGearSlotName}) has substat ${primarySub} ${primarySubValue} !== ${primarySubCap} (cap)`);
                }
                // This includes vitality
                MAIN_STATS.forEach(mainStat => {
                    const value = item.stats[mainStat];
                    if (value === 0) {
                        return;
                    }
                    const cap = item.statCaps[mainStat];
                    // See bug #715
                    if (item.ilvl === 380
                        && (item.usableByJob('WHM') || item.usableByJob('RDM'))
                        && (item.occGearSlotName === 'Head' || item.occGearSlotName === 'Hand' || item.occGearSlotName === 'Feet')
                        && mainStat === 'vitality'
                    ) {
                        return;
                    }
                    if (mainStat === 'vitality' && item.jobs.length > 15) {
                        // Preorder earrings - these seem to not follow the pattern exactly
                        if (item.ilvl === 290 && item.stats.vitality === 46) {
                            return;
                        }
                        else if (item.ilvl === 430 && item.stats.vitality === 80) {
                            return;
                        }
                        else if (item.ilvl === 560 && item.stats.vitality === 115) {
                            return;
                        }
                    }
                    if (value !== cap) {
                        failures.push(`Item ${item.name} i${item.ilvl} (${item.id}, ${item.occGearSlotName}) has mainstat ${mainStat} ${value} !== ${cap} (cap)`);
                    }
                });
                const defStats: RawStatKey[] = ["defensePhys", "defenseMag"];
                defStats.forEach(defStat => {
                    const value = item.stats[defStat];
                    if (value === 0) {
                        return;
                    }
                    const cap = item.statCaps[defStat];
                    // For some reason, the cap is 0, but the actual value is 1 for accessories.
                    if (value === 0 || value === 1) {
                        return;
                    }
                    // Allow a margin of error of one unless we find a confirmed-wrong case.
                    if (Math.abs(value - cap) > 1) {
                        failures.push(`Item ${item.name} i${item.ilvl} (${item.id}, ${item.occGearSlotName}) has defstat ${defStat} ${value} !== ${cap} (cap)`);
                    }

                });
            });
            if (failures.length > 0) {
                throw Error(failures.join('\n'));
            }
        }).timeout(30_000);

    });
});


describe('Feature 24 - support items that give primary/secondary stat directly such as pre-order earrings', () => {
    const sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, 'main stat test sheet', 'NIN', 80, 430, true);
    before(async function () {
        this.timeout(30_000);
        await sheet.load();
        sheet.partyBonus = 0;
    });
    it('Supports primary and secondary stats', () => {
        // Menphina's earring (i430 - no sync)
        const menphina = sheet.itemById(33648);
        expect(menphina.stats.extraMainStat).to.equal(78);
        expect(menphina.stats.extraSecondaryStat).to.equal(79);
        expect(menphina.stats.vitality).to.equal(80);
        expect(menphina.stats.determination).to.equal(79);
        expect(menphina.primarySubstat).to.eq('determination');
        expect(menphina.secondarySubstat).to.be.null;
        const set = new CharacterGearSet(sheet);
        const statsBefore = set.computedStats;
        const dexterityBefore = statsBefore.dexterity;
        const dhitBefore = statsBefore.dhit;
        expect(dexterityBefore).to.equal(374);
        expect(dhitBefore).to.equal(380);
        set.setEquip("Ears", menphina);
        const statsAfter = set.computedStats;
        const dexterityAfter = statsAfter.dexterity;
        const dhitAfter = statsAfter.dhit;
        expect(dexterityAfter).to.eq(374 + 78);
        expect(dhitAfter).to.eq(380 + 79);
    });
    it('Respects ilvl downsync', () => {
        // Azeyma's earring (i560 - should be synced)
        const azeyma = sheet.itemById(41081);
        expect(azeyma.stats.extraMainStat).to.equal(78);
        expect(azeyma.stats.extraSecondaryStat).to.equal(79);
        expect(azeyma.stats.vitality).to.equal(80);
        expect(azeyma.stats.determination).to.equal(79);
        expect(azeyma.unsyncedVersion.stats.extraMainStat).to.equal(115);
        expect(azeyma.unsyncedVersion.stats.extraSecondaryStat).to.equal(111);
        expect(azeyma.unsyncedVersion.stats.vitality).to.equal(115);
        expect(azeyma.unsyncedVersion.stats.determination).to.equal(111);
        expect(azeyma.primarySubstat).to.eq('determination');
        expect(azeyma.secondarySubstat).to.be.null;
        const set = new CharacterGearSet(sheet);
        const statsBefore = set.computedStats;
        const dexterityBefore = statsBefore.dexterity;
        const dhitBefore = statsBefore.dhit;
        expect(dexterityBefore).to.equal(374);
        expect(dhitBefore).to.equal(380);
        set.setEquip("Ears", azeyma);
        const statsAfter = set.computedStats;
        const dexterityAfter = statsAfter.dexterity;
        const dhitAfter = statsAfter.dhit;
        expect(dexterityAfter).to.eq(374 + 78);
        expect(dhitAfter).to.eq(380 + 79);
    });

    it('Does not treat said items as custom relics', () => {
        const menphina = sheet.itemById(33648);
        expect(menphina.isCustomRelic).to.equal(false);
    });
}).timeout(30_000);
