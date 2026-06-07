import {GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../../sheet";
import {CharacterGearSet} from "../../gear";
import {expect} from "chai";

describe('DoH stats tests', () => {
    let sheet: GearPlanSheet;

    before(async () => {
        sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "DoH Items Test", 'BSM', 100, undefined, false);
        await sheet.load();
    });
    it('can equip items with correct stats', () => {
        const set = new CharacterGearSet(sheet);
        const afflatusHammer = sheet.itemById(39826);
        const afflatusFile = sheet.itemById(39837);
        const afflatusEar = sheet.itemById(39856);

        // Direct stats
        expect(afflatusHammer.stats.craftsmanship).to.equal(1208);
        expect(afflatusHammer.stats.control).to.equal(638);
        expect(afflatusHammer.stats.cp).to.equal(0);

        expect(afflatusFile.stats.craftsmanship).to.equal(1208);
        expect(afflatusFile.stats.control).to.equal(638);
        expect(afflatusFile.stats.cp).to.equal(0);

        expect(afflatusEar.stats.craftsmanship).to.equal(69);
        expect(afflatusEar.stats.control).to.equal(0);
        expect(afflatusEar.stats.cp).to.equal(74);

        // Stat caps
        expect(afflatusHammer.statCaps.craftsmanship).to.equal(1421);
        expect(afflatusHammer.statCaps.control).to.equal(750);
        expect(afflatusHammer.statCaps.cp).to.equal(7);

        expect(afflatusFile.statCaps.craftsmanship).to.equal(1421);
        expect(afflatusFile.statCaps.control).to.equal(750);
        expect(afflatusFile.statCaps.cp).to.equal(7);

        expect(afflatusEar.statCaps.craftsmanship).to.equal(81);
        expect(afflatusEar.statCaps.control).to.equal(113);
        expect(afflatusEar.statCaps.cp).to.equal(88);


    });
});
