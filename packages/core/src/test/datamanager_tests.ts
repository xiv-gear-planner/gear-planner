import 'isomorphic-fetch';
import * as assert from "assert";
import {RawStats} from "@xivgear/xivmath/geartypes";
import {NewApiDataManager} from "../datamanager_new";
import {expect} from "chai";
import {SpecialStatType} from "@xivgear/data-api-client/dataapi";

function eq<T>(actual: T, expected: T) {
    assert.equal(actual, expected);
}

function deq<T>(actual: T, expected: T) {
    assert.deepEqual(actual, expected);
}

describe('New Datamanager', () => {
    it('can load some SCH items', async () => {
        const dm = new NewApiDataManager(['SCH'], 90);
        await dm.loadData();
        const codexOfAscension = dm.itemById(40176);
        // Basic item props
        eq(codexOfAscension.id, 40176);
        eq(codexOfAscension.name, 'Codex of Ascension');
        eq(codexOfAscension.nameTranslation.en, 'Codex of Ascension');
        eq(codexOfAscension.nameTranslation.de, 'Kodex des Aufstiegs');
        eq(codexOfAscension.iconUrl.toString(), 'https://v2.xivapi.com/api/asset/ui/icon/033000/033387_hr1.tex?format=png');

        // XivCombatItem props
        deq(codexOfAscension.stats, new RawStats({
            wdPhys: 132,
            wdMag: 132,
            mind: 416,
            crit: 306,
            determination: 214,
            vitality: 412,
            weaponDelay: 3.12,
            defenseMag: 0,
            defensePhys: 0,
        }));

        // GearItem props
        eq(codexOfAscension.displayGearSlotName, 'Weapon');
        eq(codexOfAscension.occGearSlotName, 'Weapon2H');
        eq(codexOfAscension.ilvl, 665);
        eq(codexOfAscension.primarySubstat, 'crit');
        eq(codexOfAscension.secondarySubstat, 'determination');

        deq(codexOfAscension.statCaps, {
            // Primary stats
            // The "Wrong" primary stats are reduced to 70% due to BaseParam.MeldParam
            strength: 291,
            dexterity: 291,
            intelligence: 291,
            mind: 416,

            // Substats
            crit: 306,
            determination: 306,
            dhit: 306,
            piety: 306,
            skillspeed: 306,
            spellspeed: 306,
            tenacity: 306,

            // Other
            wdMag: 132,
            wdPhys: 132,
            weaponDelay: 0, // TODO: ?
            vitality: 412,
            hp: 0,
            // Weapons don't have def/mdef
            defenseMag: 0,
            defensePhys: 0,
            gearHaste: 999_999,
        });
        eq(codexOfAscension.materiaSlots.length, 2);
        eq(codexOfAscension.isCustomRelic, false);
        // Not synced down - "Unsynced version" should just be the same
        eq(codexOfAscension.unsyncedVersion, codexOfAscension);
        eq(codexOfAscension.isUnique, true);
        // eq(codexOfAscension.acquisitionType, 'raid');
        eq(codexOfAscension.relicStatModel, undefined);

        // This item should be filtered out due to being too low of an ilvl
        // const ilvl545book = dm.itemById(34691);
        // eq(ilvl545book, undefined);

        // This item is 560, it just barely makes it
        const ilvl560book = dm.itemById(34053);
        eq(ilvl560book.ilvl, 560);

    }).timeout(20_000);
    it('can get stats of food items', async () => {
        const dm = new NewApiDataManager(['SCH'], 90);
        await dm.loadData();
        const food = dm.foodById(44096);
        eq(food.id, 44096);
        eq(food.name, "Vegetable Soup");
        eq(food.nameTranslation.en, "Vegetable Soup");
        eq(food.nameTranslation.de, "Gemüsesuppe");
        eq(food.primarySubStat, 'dhit');
        eq(food.secondarySubStat, 'determination');
        eq(food.bonuses.dhit.max, 121);
        eq(food.bonuses.dhit.percentage, 10);
        eq(food.bonuses.determination.max, 73);
        eq(food.bonuses.determination.percentage, 10);
    }).timeout(20_000);
    describe('syncs levels correctly', () => {

        // Test cases from https://github.com/xiv-gear-planner/gear-planner/issues/317
        describe('syncs correctly in a lvl 90 i665 instance', () => {
            const dm = new NewApiDataManager(['SGE'], 90, 665);
            before(async () => {
                await dm.loadData();
            });
            it('should not downsync a lvl90 i665 weapon', () => {
                // Wings of Ascension
                const item = dm.itemById(40182);
                expect(item.isSyncedDown).to.eq(false);
            });
            it('should not downsync a lvl90 i660 chest', () => {
                // Augmented Credendum Surcoat of Healing
                const item = dm.itemById(40136);
                expect(item.isSyncedDown).to.eq(false);
            });
            it('should downsync a lvl94 i663 weapon to 660', () => {
                // Cobalt Tungsten Pendulums
                const item = dm.itemById(42162);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            it('should downsync a lvl94 i663 chest to 660', () => {
                // Sarcenet Chestwrap of Healing
                const item = dm.itemById(42192);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
                expect(item.unsyncedVersion.stats.defenseMag).to.eq(758 + 84);
                expect(item.unsyncedVersion.stats.defensePhys).to.eq(433 + 48);
                // Tested in instance
                expect(item.stats.defenseMag).to.eq(837);
                expect(item.stats.defensePhys).to.eq(478);
            });
            it('should remove all def when downsyncing accessories', () => {
                // Dark Horse Champion's Earring of Healing
                const item = dm.itemById(43161);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(665);
                expect(item.unsyncedVersion.stats.defenseMag).to.eq(1);
                expect(item.unsyncedVersion.stats.defensePhys).to.eq(1);
                // Tested in instance
                expect(item.stats.defenseMag).to.eq(0);
                expect(item.stats.defensePhys).to.eq(0);
            });
            it('should downsync a lvl95 i666 weapon to 665', () => {
                // Skydeep Milpreves
                const item = dm.itemById(42239);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(665);
            });
            it('should downsync a lvl95 i666 chest to 665', () => {
                // Skydeep Robe of Healing
                const item = dm.itemById(42269);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(665);
            });
            it('should downsync a lvl96 i669 weapon to 665', () => {
                // White Gold Syrinxi
                const item = dm.itemById(42316);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(665);
            });
            it('should downsync a lvl96 i669 chest to 665', () => {
                // White Gold Visor of Healing
                const item = dm.itemById(42345);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(665);
            });
            it('should downsync a lvl100 i735 weapon to 665', () => {
                // Dark Horse Champion's Milpreves
                const item = dm.itemById(43119);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(665);
            });
            it('should downsync a lvl100 i730 chest to 665', () => {
                // Dark Horse Champion's Hat of Healing
                const item = dm.itemById(43148);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(665);
            });

        });
        // See also https://docs.google.com/spreadsheets/d/1C9OgUzFBTlomSpGV7rnv-M20DEGEJ8gtQN6JLNQ336o/edit?gid=791671595#gid=791671595
        describe('syncs correctly in a lvl 90 no-isync instance', () => {
            const dm = new NewApiDataManager(['SGE'], 90);
            before(async () => {
                await dm.loadData();
            });
            it('should not downsync a lvl90 i665 weapon', () => {
                // Wings of Ascension
                const item = dm.itemById(40182);
                expect(item.isSyncedDown).to.eq(false);
            });
            it('should not downsync a lvl90 i660 chest', () => {
                // Augmented Credendum Surcoat of Healing
                const item = dm.itemById(40136);
                expect(item.isSyncedDown).to.eq(false);
            });
            it('should downsync a lvl93 i660 weapon to 660 (remove melds but not change stats)', () => {
                const item = dm.itemById(42085);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
                expect(item.unsyncedVersion.stats.wdMag).to.eq(item.stats.wdMag);
                expect(item.unsyncedVersion.stats.mind).to.eq(item.stats.mind);
                expect(item.unsyncedVersion.stats.crit).to.eq(item.stats.crit);
                expect(item.unsyncedVersion.stats.determination).to.eq(item.stats.determination);
                expect(item.materiaSlots).to.be.empty;
            });
            it('should downsync a lvl94 i663 weapon to 660', () => {
                // Cobalt Tungsten Pendulums
                const item = dm.itemById(42162);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            it('should downsync a lvl94 i663 chest to 660', () => {
                // Sarcenet Chestwrap of Healing
                const item = dm.itemById(42192);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            it('should downsync a lvl95 i666 weapon to 660', () => {
                // Skydeep Milpreves
                const item = dm.itemById(42239);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            it('should downsync a lvl95 i666 chest to 660', () => {
                // Skydeep Robe of Healing
                const item = dm.itemById(42269);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            it('should downsync a lvl96 i669 weapon to 660', () => {
                // White Gold Syrinxi
                const item = dm.itemById(42316);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            it('should downsync a lvl96 i669 chest to 660', () => {
                // White Gold Visor of Healing
                const item = dm.itemById(42345);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            it('should downsync a lvl100 i735 weapon to 660', () => {
                // Dark Horse Champion's Milpreves
                const item = dm.itemById(43119);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            it('should downsync a lvl100 i730 chest to 660', () => {
                // Dark Horse Champion's Hat of Healing
                const item = dm.itemById(43148);
                expect(item.isSyncedDown).to.eq(true);
                expect(item.syncedDownTo).to.eq(660);
            });
            // TODO
            // it('should downsync a lvl100 i730 weapon to 660 and have +1 vit', () => {
            //     // Dark Horse Champion's Milpreves
            //     const item = dm.itemById(43042);
            //     expect(item.isSyncedDown).to.eq(true);
            //     expect(item.syncedDownTo).to.eq(660);
            //     expect(item.unsyncedVersion.stats.vitality).to.eq(580);
            //     expect(item.stats.vitality).to.eq(411);
            // });
        });
    });
    describe('handles NQ/HQ and special stats correctly', () => {
        const dm = new NewApiDataManager(['WHM'], 100, 700);
        before(async () => {
            await dm.loadData();
        });
        it('handles normal item, below isync', () => {
            // Serenity
            const item = dm.itemById(42574, false);
            expect(item.stats.wdMag).to.eq(137);
            expect(item.stats.mind).to.eq(493);
            expect(item.stats.crit).to.eq(339);
            expect(item.stats.determination).to.eq(237);
        });
        it('handles normal item, exactly at isync', () => {
            // Neo Kingdom Cane
            const item = dm.itemById(42701, false);
            expect(item.stats.wdMag).to.eq(139);
            expect(item.stats.mind).to.eq(520);
            expect(item.stats.crit).to.eq(253);
            expect(item.stats.determination).to.eq(361);
        });
        it('handles normal item, synced', () => {
            // Queensknight Cane
            const item = dm.itemById(46459, false);
            expect(item.stats.wdMag).to.eq(139);
            expect(item.stats.mind).to.eq(520);
            expect(item.stats.crit).to.eq(361);
            expect(item.stats.determination).to.eq(281);
            expect(item.isSyncedDown).to.eq(true);
            expect(item.unsyncedVersion.stats.wdMag).to.eq(148);
        });
        it('handles HQ item, below sync', () => {
            // HQ Claro Walnut Cane
            const item = dm.itemById(42457, false);
            expect(item.stats.wdMag).to.eq(134);
            expect(item.stats.mind).to.eq(449);
            expect(item.stats.piety).to.eq(314);
            expect(item.stats.determination).to.eq(220);
        });
        it('handles NQ item, below sync', () => {
            // NQ Claro Walnut Cane
            const item = dm.itemById(42457, true);
            expect(item.stats.wdMag).to.eq(121);
            expect(item.stats.mind).to.eq(404);
            expect(item.stats.piety).to.eq(283);
            expect(item.stats.determination).to.eq(198);
        });
        it('handles HQ item, above sync', () => {
            // HQ Claro Walnut Cane
            const item = dm.itemById(46015, false);
            expect(item.stats.wdMag).to.eq(139);
            expect(item.stats.mind).to.eq(520);
            expect(item.stats.crit).to.eq(361);
            expect(item.stats.piety).to.eq(279);
        });
        it('handles NQ item, above sync', () => {
            // NQ Ceremonial Wand
            const item = dm.itemById(46015, true);
            expect(item.stats.wdMag).to.eq(132);
            expect(item.stats.mind).to.eq(520);
            expect(item.stats.crit).to.eq(358);
            expect(item.stats.piety).to.eq(251);
        });
        it('handles Occult Crescent item, no bonus', () => {
            // Arcanaut's Robe of Healing +2
            const item = dm.itemById(47844, false);
            expect(item.stats.wdMag).to.eq(0);
            expect(item.stats.mind).to.eq(501);
            expect(item.stats.crit).to.eq(348);
            expect(item.stats.determination).to.eq(271);
        });
        it('handles Occult Crescent item, with bonus', () => {
            // Arcanaut's Robe of Healing +2
            const item = dm.itemById(47844, false);
            item.activeSpecialStat = SpecialStatType.OccultCrescent;
            expect(item.stats.wdMag).to.eq(0);
            expect(item.stats.mind).to.eq(501 + 120);
            expect(item.stats.crit).to.eq(348);
            expect(item.stats.determination).to.eq(271);
        });
    });
});
