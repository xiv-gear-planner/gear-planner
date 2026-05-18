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

describe('materia alt items logic', () => {
    let sheet: GearPlanSheet;
    let set: CharacterGearSet;

    before(async () => {
        sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Alt Items Test", "BLU", 80, 535, false);
        await sheet.load();
        set = new CharacterGearSet(sheet);
    });
    it('should not list lower level weapons as alts because the materia slots cannot accept higher ilvl materia', () => {
        // Blue-eyes
        const lvl80wep = sheet.itemById(40345);
        // Gentlemage's Umbrella
        const lvl80wep2 = sheet.itemById(40476);
        // Exquisite Gentlemage's Umbrella
        const lvl80wep3 = sheet.itemById(41700);

        // Predatrice
        const lvl70wep = sheet.itemById(32644);
        // Friar Rush
        const lvl70wep2 = sheet.itemById(32645);

        const alts70 = set.getAltItemsFor(lvl70wep);
        expect(alts70).to.contain(lvl80wep);
        expect(alts70).to.contain(lvl80wep2);
        expect(alts70).to.contain(lvl80wep3);
        // should not contain self
        expect(alts70).to.not.contain(lvl70wep);
        expect(alts70).to.contain(lvl70wep2);

        const alts80 = set.getAltItemsFor(lvl80wep);
        // should not contain self
        expect(alts80).to.not.contain(lvl80wep);
        expect(alts80).to.contain(lvl80wep2);
        expect(alts80).to.contain(lvl80wep3);
        expect(alts80).to.not.contain(lvl70wep);
        expect(alts80).to.not.contain(lvl70wep2);
    });

});
