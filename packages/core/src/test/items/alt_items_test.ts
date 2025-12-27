import {GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../../sheet";
import {CharacterGearSet} from "../../gear";
import {expect} from "chai";

describe('alt items logic', () => {
    let sheet: GearPlanSheet;

    before(async () => {
        sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Alt Items Test", "SGE", 70, 290, false);
        await sheet.load();
    });

    describe('alt items', () => {
        it('should not list unique items as alts if they are already equipped', () => {
            // Dzi of the Crimson Lotus
            const i300WEP = sheet.itemById(35776);
            // All 3 of these rings are alts of each other.
            // Edemete Ring of Healing (sps>crit unique)
            const uniqueRing1 = sheet.itemById(32416);
            // Edenchoir Ring of Healing (crit>sps unique - syncs to same as edenmete)
            const uniqueRing2 = sheet.itemById(29115);
            // Ametrine Ring of Healing (sps>crit non-unique)
            const nonUniqueRing = sheet.itemById(34153);
            const setA = new CharacterGearSet(sheet);
            setA.setEquip('Weapon', i300WEP);
            setA.setEquip('RingLeft', uniqueRing1);
            setA.setEquip('RingRight', nonUniqueRing);

            const ur1Alts = setA.getAltItemsFor(uniqueRing1);
            // This isn't actually equipped, but that doesn't matter
            const ur2Alts = setA.getAltItemsFor(uniqueRing2);
            const nuAlts = setA.getAltItemsFor(nonUniqueRing);

            // Should never list itself as an alt
            expect(ur1Alts).to.not.contain(uniqueRing1);
            // Should contain this because it is not equipped
            expect(ur1Alts).to.contain(uniqueRing2);
            // Should contain this because it is not unique
            expect(ur1Alts).to.contain(nonUniqueRing);

            // Should never list itself as an alt
            expect(ur2Alts).to.not.contain(uniqueRing2);
            // Should not list ur1 as an alt because it is equipped and unique
            expect(ur2Alts).not.to.contain(uniqueRing1);
            // Should contain this because it is not unique
            expect(ur2Alts).to.contain(nonUniqueRing);

            // Should never list itself as an alt
            expect(nuAlts).to.not.contain(nonUniqueRing);
            // Should not list ur1 as an alt because it is equipped and unique
            expect(nuAlts).not.to.contain(uniqueRing1);
            // Should contain this because it is not equipped.
            expect(nuAlts).to.contain(uniqueRing2);
        });
    });
});

