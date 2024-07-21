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

});