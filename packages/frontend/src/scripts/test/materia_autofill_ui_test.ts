import 'global-jsdom/register';
import {expect} from "chai";
import {GRAPHICAL_SHEET_PROVIDER} from "../components/sheet/provider";
import {GearPlanSheetGui} from "../components/sheet/sheet_gui";
import {CharacterGearSet} from "@xivgear/core/gear";
import {GearItem} from "@xivgear/xivmath/geartypes";

describe("Materia Bulk Actions (UI)", () => {
    let sheet: GearPlanSheetGui;
    let gearSet: CharacterGearSet;
    let weapon: GearItem;
    before(async () => {
        sheet = GRAPHICAL_SHEET_PROVIDER.fromScratch("test", "test", "WAR", 100, undefined, false);
        await sheet.load();
    });
    beforeEach(() => {
        // Set up default priority: dh > everything else
        // Tank gear doesn't naturally have dh, so it shouldn't ever lose on priority due to capping.
        sheet.materiaAutoFillController.prio.statPrio = ['dhit', 'crit', 'determination'];
        gearSet = new CharacterGearSet(sheet);
        sheet.addGearSet(gearSet);
        sheet.selectedGearSet = gearSet;
        weapon = sheet.itemById(49251); // 3 large, 2 small slots
        gearSet.setEquip("Weapon", weapon);
    });
    it("fillEmpty respects locked slots", () => {
        // First slot is locked+empty
        const equipped = gearSet.equipment.Weapon;
        equipped.melds[0].locked = true;
        // Fill empty
        sheet.materiaAutoFillController.fillEmpty();
        const melds = gearSet.equipment.Weapon.melds;
        // Should still be empty because it was locked
        expect(melds[0].equippedMateria).to.be.null;
        // Should not be empty
        expect(melds[1].equippedMateria).to.not.be.null;
        expect(melds[2].equippedMateria).to.not.be.null;
        // dhit is highest prio and never occurs naturally on tank gear, so it should always fill dh
        expect(melds[1].equippedMateria.primaryStat).to.equal('dhit');
        expect(melds[2].equippedMateria.primaryStat).to.equal('dhit');
        expect(melds[3].equippedMateria.primaryStat).to.equal('dhit');
        expect(melds[4].equippedMateria.primaryStat).to.equal('dhit');
        // slots should have the correct materia values
        expect(melds[1].equippedMateria.materiaGrade).to.equal(12);
        expect(melds[2].equippedMateria.materiaGrade).to.equal(12);
        expect(melds[3].equippedMateria.materiaGrade).to.equal(11);
        expect(melds[4].equippedMateria.materiaGrade).to.equal(11);
    });
    it("fillAll respects locked slots", () => {
        // Fill all first, which should fill the first slot with dh
        sheet.materiaAutoFillController.fillAll();
        const melds = gearSet.equipment.Weapon.melds;
        expect(melds[0].equippedMateria.primaryStat).to.equal('dhit');
        // Lock the first slot
        melds[0].locked = true;
        // Change priority: TNC > DH
        sheet.materiaAutoFillController.prio.statPrio = ['tenacity', 'dhit', 'determination'];
        // Fill all again
        sheet.materiaAutoFillController.fillAll();
        // First slot should still be dh because it was locked
        expect(melds[0].equippedMateria.primaryStat).to.equal('dhit');
        // Second slot should now be TNC
        expect(melds[1].equippedMateria.primaryStat).to.equal('tenacity');
    });
    it("lockFilled and lockEmpty work correctly", () => {
        // Equip one materia manually
        const melds = gearSet.equipment.Weapon.melds;
        melds[0].equippedMateria = sheet.getBestMateria('dhit', melds[0]);
        // Lock filled
        sheet.materiaAutoFillController.lockFilled();
        expect(melds[0].locked).to.be.true;
        expect(melds[1].locked).to.be.false;
        // Lock empty
        sheet.materiaAutoFillController.lockEmpty();
        expect(melds[1].locked).to.be.true;
    });
    it("unlockAll and unequipUnlocked work correctly", () => {
        sheet.materiaAutoFillController.fillAll();
        const melds = gearSet.equipment.Weapon.melds;
        // should have filled both
        expect(melds[0].equippedMateria).to.not.be.null;
        expect(melds[1].equippedMateria).to.not.be.null;
        melds[0].locked = true;
        // Unequip unlocked
        sheet.materiaAutoFillController.unequipUnlocked();
        expect(melds[0].equippedMateria).to.not.be.null;
        expect(melds[1].equippedMateria).to.be.null;
        // Unlock all
        sheet.materiaAutoFillController.unlockAll();
        expect(melds[0].locked).to.be.false;
        expect(melds[1].locked).to.be.false;
    });
});
