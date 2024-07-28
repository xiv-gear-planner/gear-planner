import {HEADLESS_SHEET_PROVIDER} from "../sheet";
import {expect} from "chai";
import {CharacterGearSet} from "../gear";
import 'global-jsdom/register'

describe('Custom items support', () => {
    it('Supports a custom item', async () => {
        // Setup
        const sheet = HEADLESS_SHEET_PROVIDER.fromScratch("foo", "foo", 'SGE', 100, undefined);
        await sheet.load();

        // Make one set before adding the custom item to make sure we can still use it.
        const set1 = new CharacterGearSet(sheet);
        sheet.addGearSet(set1);

        // Make custom item
        const custom = sheet.newCustomItem('Weapon2H');
        custom.stats.wdMag = 200;
        custom.stats.wdPhys = 200;
        custom.stats.spellspeed = 500;
        custom.stats.mind = 1000;

        const gearItem = sheet.itemById(custom.id);
        // Should be exactly the same object, there's no cloning going on
        expect(gearItem).eq(custom);

        const set2 = new CharacterGearSet(sheet);
        sheet.addGearSet(set2);

        set1.setEquip('Weapon', custom);
        set2.setEquip('Weapon', custom);

        expect(set1.computedStats.wdPhys).to.eq(200);
        expect(set1.computedStats.wdMag).to.eq(200);

        expect(set2.computedStats.wdPhys).to.eq(200);
        expect(set2.computedStats.wdMag).to.eq(200);

    }).timeout(30_000);
    it('Supports a custom food', async () => {
        const sheet = HEADLESS_SHEET_PROVIDER.fromScratch("foo", "foo", 'SGE', 100, undefined);
        await sheet.load();

        // Make one set before adding the custom item to make sure we can still use it.
        const set1 = new CharacterGearSet(sheet);
        sheet.addGearSet(set1);

        // Validate stats beforehand
        expect(set1.computedStats.crit).to.eq(420);
        expect(set1.computedStats.dhit).to.eq(420);

        // Make custom item
        const custom = sheet.newCustomFood();
        custom.customData.primaryStat = 'crit';
        custom.customData.primaryStatBonus.percentage = 12;
        custom.customData.primaryStatBonus.max = 200;
        custom.customData.secondaryStat = 'dhit';

        expect(custom.bonuses.crit.max).to.eq(200);
        expect(custom.bonuses.crit.percentage).to.eq(12);
        expect(custom.bonuses.dhit.max).to.eq(100);
        expect(custom.bonuses.dhit.percentage).to.eq(10);

        expect(custom.primarySubStat).to.eq('crit');
        expect(custom.secondarySubStat).to.eq('dhit');

        const foodItem = sheet.foodById(custom.id);
        // Should be exactly the same object, there's no cloning going on
        expect(foodItem).eq(custom);

        const set2 = new CharacterGearSet(sheet);
        sheet.addGearSet(set2);

        set1.food = custom;
        set2.food = custom;

        // Validate stats afterwards
        expect(set1.computedStats.crit).to.eq(470);
        expect(set1.computedStats.dhit).to.eq(462);

    }).timeout(30_000);
});