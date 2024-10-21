import 'global-jsdom/register';
import 'isomorphic-fetch';
import * as assert from "assert";
import {RawStats} from "@xivgear/xivmath/geartypes";
import {NewApiDataManager} from "../datamanager_new";
import {XivApiDataManager} from "../datamanager_xivapi";
import {expect} from "chai";

function eq<T>(actual: T, expected: T) {
    assert.equal(actual, expected);
}

function deq<T>(actual: T, expected: T) {
    assert.deepEqual(actual, expected);
}

describe('Old Datamanager', () => {
    it('can load some SCH items', async () => {
        const dm = new XivApiDataManager('SCH', 90);
        await dm.loadData();
        const codexOfAscension = dm.itemById(40176);
        // Basic item props
        eq(codexOfAscension.id, 40176);
        eq(codexOfAscension.name, 'Codex of Ascension');
        // TODO: fix the extra / ?
        eq(codexOfAscension.iconUrl.toString(), 'https://beta.xivapi.com/api/1/asset/ui/icon/033000/033387_hr1.tex?format=png');

        // XivCombatItem props
        deq(codexOfAscension.stats, new RawStats({
            wdPhys: 132,
            wdMag: 132,
            mind: 416,
            crit: 306,
            determination: 214,
            vitality: 412,
            weaponDelay: 3.12
        }));

        // GearItem props
        eq(codexOfAscension.displayGearSlotName, 'Weapon');
        eq(codexOfAscension.occGearSlotName, 'Weapon2H');
        eq(codexOfAscension.ilvl, 665);
        eq(codexOfAscension.primarySubstat, 'crit');
        eq(codexOfAscension.secondarySubstat, 'determination');

        deq(codexOfAscension.statCaps, {
            // Primary stats
            strength: 416,
            dexterity: 416,
            intelligence: 416,
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
            weaponDelay: NaN, // TODO: ?
            vitality: 412,
            hp: 0
        });
        eq(codexOfAscension.materiaSlots.length, 2);
        eq(codexOfAscension.isCustomRelic, false);
        // Not synced down - "Unsynced version" should just be the same
        eq(codexOfAscension.unsyncedVersion, codexOfAscension);
        eq(codexOfAscension.isUnique, true);
        // eq(codexOfAscension.acquisitionType, 'raid');
        eq(codexOfAscension.relicStatModel, undefined);

        // This item should be filtered out due to being too low of an ilvl
        const ilvl545book = dm.itemById(34691);
        eq(ilvl545book, undefined);

        // This item is 560, it just barely makes it
        const ilvl560book = dm.itemById(34053);
        eq(ilvl560book.ilvl, 560);

    }).timeout(20_000);
    it('can get stats of food items', async () => {
        const dm = new XivApiDataManager('SCH', 90);
        await dm.loadData();
        const food = dm.foodById(44096);
        eq(food.id, 44096);
        eq(food.name, "Vegetable Soup");
        eq(food.primarySubStat, 'dhit');
        eq(food.secondarySubStat, 'determination');
        eq(food.bonuses.dhit.max, 121);
        eq(food.bonuses.dhit.percentage, 10);
        eq(food.bonuses.determination.max, 73);
        eq(food.bonuses.determination.percentage, 10);
    }).timeout(20_000);
});

describe('New Datamanager', () => {
    it('can load some SCH items', async () => {
        const dm = new NewApiDataManager('SCH', 90);
        await dm.loadData();
        const codexOfAscension = dm.itemById(40176);
        // Basic item props
        eq(codexOfAscension.id, 40176);
        eq(codexOfAscension.name, 'Codex of Ascension');
        // TODO: fix the extra / ?
        eq(codexOfAscension.iconUrl.toString(), 'https://beta.xivapi.com/api/1/asset/ui/icon/033000/033387_hr1.tex?format=png');

        // XivCombatItem props
        deq(codexOfAscension.stats, new RawStats({
            wdPhys: 132,
            wdMag: 132,
            mind: 416,
            crit: 306,
            determination: 214,
            vitality: 412,
            weaponDelay: 3.12
        }));

        // GearItem props
        eq(codexOfAscension.displayGearSlotName, 'Weapon');
        eq(codexOfAscension.occGearSlotName, 'Weapon2H');
        eq(codexOfAscension.ilvl, 665);
        eq(codexOfAscension.primarySubstat, 'crit');
        eq(codexOfAscension.secondarySubstat, 'determination');

        deq(codexOfAscension.statCaps, {
            // Primary stats
            strength: 416,
            dexterity: 416,
            intelligence: 416,
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
            hp: 0
        });
        eq(codexOfAscension.materiaSlots.length, 2);
        eq(codexOfAscension.isCustomRelic, false);
        // Not synced down - "Unsynced version" should just be the same
        eq(codexOfAscension.unsyncedVersion, codexOfAscension);
        eq(codexOfAscension.isUnique, true);
        // eq(codexOfAscension.acquisitionType, 'raid');
        eq(codexOfAscension.relicStatModel, undefined);

        // This item should be filtered out due to being too low of an ilvl
        // TODO: the new DataManager should just load everything, and filtering should be done visually
        // const ilvl545book = dm.itemById(34691);
        // eq(ilvl545book, undefined);

        // This item is 560, it just barely makes it
        const ilvl560book = dm.itemById(34053);
        eq(ilvl560book.ilvl, 560);

    }).timeout(20_000);
    it('can get stats of food items', async () => {
        const dm = new NewApiDataManager('SCH', 90);
        await dm.loadData();
        const food = dm.foodById(44096);
        eq(food.id, 44096);
        eq(food.name, "Vegetable Soup");
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
            const dm = new NewApiDataManager('SGE', 90, 665);
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
            const dm = new NewApiDataManager('SGE', 90);
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
});
