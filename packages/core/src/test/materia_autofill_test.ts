import {expect} from "chai";
import {GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../sheet";
import {CharacterGearSet} from "../gear";
import {GearItem, Materia} from "@xivgear/xivmath/geartypes";
describe("Materia Autofill Modes", () => {
    let sheet: GearPlanSheet;
    let gearSet: CharacterGearSet;
    let item1: GearItem;
    let item2: GearItem;
    before(async () => {
        sheet = HEADLESS_SHEET_PROVIDER.fromScratch("test", "test", "WAR", 100, undefined, false);
        await sheet.load();
        // Set dhit as highest priority since tank gear never naturally has it
        sheet.materiaAutoFillController.prio.statPrio = ['dhit', 'crit', 'determination'];
        sheet.materiaAutoFillController.prio.minGcd = 2.50;
        item1 = sheet.itemById(49251);
        item2 = sheet.itemById(49484);
        expect(item1).to.not.be.undefined;
        expect(item2).to.not.be.undefined;
    });
    beforeEach(() => {
        gearSet = new CharacterGearSet(sheet);
    });
    it(`autofill (Prio Fill) mode`, () => {
        const controller = sheet.materiaAutoFillController;
        controller.autoFillMode = 'autofill';
        // Setup: item1 in memory with one locked and one unlocked meld
        gearSet.setEquip("Weapon", item1);
        const equipped = gearSet.equipment.Weapon;
        const matCrit = sheet.getBestMateria('crit', equipped.melds[0]);
        const matDet = sheet.getBestMateria('determination', equipped.melds[1]);
        equipped.melds[0].equippedMateria = matCrit;
        equipped.melds[0].locked = true;
        equipped.melds[1].equippedMateria = matDet;
        equipped.melds[1].locked = false;
        // Save to memory
        gearSet.setEquip("Weapon", null);
        // Re-equip with autofill
        gearSet.setEquip("Weapon", item1, controller);
        const reEquipped = gearSet.equipment.Weapon;
        // Locked should be restored from memory
        expect(reEquipped.melds[0].equippedMateria.id).to.equal(matCrit.id);
        expect(reEquipped.melds[0].locked).to.be.true;
        // Unlocked should still be filled by priority.
        expect(reEquipped.melds[1].equippedMateria).to.not.be.null;
        expect(reEquipped.melds[1].locked).to.be.false;
        // In this specific case, it should fill dhit because it is highest prio and WAR gear doesn't have it naturally.
        expect(reEquipped.melds[1].equippedMateria.primaryStat).to.equal('dhit');
    });
    it(`leave_empty (Leave Empty) mode`, () => {
        const controller = sheet.materiaAutoFillController;
        controller.autoFillMode = 'leave_empty';
        gearSet.setEquip("Weapon", item1);
        const equipped = gearSet.equipment.Weapon;
        const matCrit = sheet.getBestMateria('crit', equipped.melds[0]);
        const matDet = sheet.getBestMateria('determination', equipped.melds[1]);
        equipped.melds[0].equippedMateria = matCrit;
        equipped.melds[0].locked = true;
        equipped.melds[1].equippedMateria = matDet;
        equipped.melds[1].locked = false;
        gearSet.setEquip("Weapon", null);
        gearSet.setEquip("Weapon", item1, controller);
        const reEquipped = gearSet.equipment.Weapon;
        // Locked should be restored
        expect(reEquipped.melds[0].equippedMateria.id).to.equal(matCrit.id);
        expect(reEquipped.melds[0].locked).to.be.true;
        // Unlocked should be empty
        expect(reEquipped.melds[1].equippedMateria).to.be.null;
        expect(reEquipped.melds[1].locked).to.be.false;
    });
    it(`retain_slot (Keep Slot Melds) mode`, () => {
        const controller = sheet.materiaAutoFillController;
        controller.autoFillMode = 'retain_slot';
        // Equip item1 and meld it
        gearSet.setEquip("Weapon", item1);
        const equipped1 = gearSet.equipment.Weapon;
        const matCrit = sheet.getBestMateria('crit', equipped1.melds[0]);
        const matDet = sheet.getBestMateria('determination', equipped1.melds[1]);
        equipped1.melds[0].equippedMateria = matCrit;
        equipped1.melds[0].locked = true;
        equipped1.melds[1].equippedMateria = matDet;
        equipped1.melds[1].locked = false;
        // Switch to item2 with retain_slot
        gearSet.setEquip("Weapon", item2, controller);
        const reEquipped = gearSet.equipment.Weapon;
        // Both melds should be carried over from item1
        expect(reEquipped.melds[0].equippedMateria.id).to.equal(matCrit.id);
        expect(reEquipped.melds[0].locked).to.be.true;
        expect(reEquipped.melds[1].equippedMateria.id).to.equal(matDet.id);
        expect(reEquipped.melds[1].locked).to.be.false;
    });
    it(`retain_slot_else_prio (Keep Slot Melds, else Prio Fill) mode`, () => {
        const controller = sheet.materiaAutoFillController;
        controller.autoFillMode = 'retain_slot_else_prio';
        // Test case 1: Slot has melds to retain
        gearSet.setEquip("Weapon", item1);
        const equipped1 = gearSet.equipment.Weapon;
        const matCrit = sheet.getBestMateria('crit', equipped1.melds[0]);
        equipped1.melds[0].equippedMateria = matCrit;
        gearSet.setEquip("Weapon", item2, controller);
        expect(gearSet.equipment.Weapon.melds[0].equippedMateria.id).to.equal(matCrit.id);
        // Test case 2: Slot was empty, should use prio
        gearSet.setEquip("Weapon", null); // Clear slot
        gearSet.setEquip("Weapon", item1, controller); // item1 was cleared, but wait, setEquip(null) clears 'old' for the next call.
        const reEquipped = gearSet.equipment.Weapon;
        expect(reEquipped.melds[0].equippedMateria).to.not.be.null;
        expect(reEquipped.melds[0].equippedMateria.primaryStat).to.equal('dhit');
    });
    it(`retain_item (Keep Item Melds) mode`, () => {
        const controller = sheet.materiaAutoFillController;
        controller.autoFillMode = 'retain_item';
        // Setup item1 melds in memory
        gearSet.setEquip("Weapon", item1);
        const equipped1 = gearSet.equipment.Weapon;
        const matCrit = sheet.getBestMateria('crit', equipped1.melds[0]);
        equipped1.melds[0].equippedMateria = matCrit;
        equipped1.melds[0].locked = false;
        gearSet.setEquip("Weapon", null);
        // Switch to item2 then back to item1 with retain_item
        gearSet.setEquip("Weapon", item2);
        gearSet.setEquip("Weapon", item1, controller);
        const reEquipped = gearSet.equipment.Weapon;
        // Should restore item1's melds even if unlocked
        expect(reEquipped.melds[0].equippedMateria.id).to.equal(matCrit.id);
    });
    it(`retain_item_else_prio (Keep Item Melds, else Prio Fill) mode`, () => {
        const controller = sheet.materiaAutoFillController;
        controller.autoFillMode = 'retain_item_else_prio';
        // Case 1: Item has memory
        gearSet.setEquip("Weapon", item1);
        const equipped1 = gearSet.equipment.Weapon;
        const matCrit = sheet.getBestMateria('crit', equipped1.melds[0]);
        equipped1.melds[0].equippedMateria = matCrit;
        gearSet.setEquip("Weapon", null);
        gearSet.setEquip("Weapon", item1, controller);
        expect(gearSet.equipment.Weapon.melds[0].equippedMateria.id).to.equal(matCrit.id);
        // Case 2: Item has no memory, use prio
        gearSet.setEquip("Weapon", item2, controller);
        expect(gearSet.equipment.Weapon.melds[0].equippedMateria).to.not.be.null;
        expect(gearSet.equipment.Weapon.melds[0].equippedMateria.primaryStat).to.equal('dhit');
    });
    it("should respect locked empty slots in all modes", () => {
        // Test that if a slot is empty+locked, it stays empty+locked even if we would normally want the empty slots filled
        const controller = sheet.materiaAutoFillController;
        controller.autoFillMode = 'autofill';
        gearSet.setEquip("Weapon", item1);
        gearSet.equipment.Weapon.melds[0].locked = true;
        gearSet.equipment.Weapon.melds[0].equippedMateria = null;
        // Save to memory
        gearSet.setEquip("Weapon", null);
        // Re-equip with autofill
        gearSet.setEquip("Weapon", item1, controller);
        expect(gearSet.equipment.Weapon.melds[0].equippedMateria).to.be.null;
        expect(gearSet.equipment.Weapon.melds[0].locked).to.be.true;
    });
});
