import {CharacterGearSet} from "../gear";
import {GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../sheet";
import {expect} from "chai";

describe('Set Compatibility Checker', () => {
    // Cane of Ascension (i665 WHM cane)
    const WEAPON_ID = 40173;
    // Credendum Circlet of Healing (i650)
    const UNIQUE_HAT_ID = 40060;
    // Gajaskin Circlet of Healing (i515 crafted)
    const NON_UNIQUE_HAT_ID = 34125;
    // Credendum Robe of Healing (i650 body)
    const UNIQUE_BODY_ID = 40061;
    // Exarchic Coat of Healing (i510 crafted)
    const NON_UNIQUE_BODY_ID = 31862;
    // Relic weapon (WHM Mandervillous Cane)
    const RELIC_WEAPON_ID = 40940;
    // Crit X materia
    const MATERIA_CRIT_X = 33932;
    // Det X materia
    const MATERIA_DET_X = 33933;
    // Piety X materia
    const MATERIA_PIETY_X = 33930;

    let sheet: GearPlanSheet;

    before(async () => {
        sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Compatibility Test", "WHM", 100, undefined, false);
        await sheet.load();
    });

    describe('compatible sets', () => {
        it('should report compatible when no items overlap', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Weapon", sheet.itemById(WEAPON_ID));

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(UNIQUE_HAT_ID));

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('should report compatible when one set has empty slots', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Weapon", sheet.itemById(WEAPON_ID));

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            // No weapon equipped

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('should report compatible when both sets have different items in same slot', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Head", sheet.itemById(UNIQUE_HAT_ID));

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(UNIQUE_BODY_ID));

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('should report compatible when same item has identical materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Head", sheet.itemById(UNIQUE_HAT_ID));
            setA.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.equipment.Head.melds[1].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(UNIQUE_HAT_ID));
            setB.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setB.equipment.Head.melds[1].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('should report compatible when same item has no materia in either set', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Head", sheet.itemById(UNIQUE_HAT_ID));

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(UNIQUE_HAT_ID));

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });
    });

    describe('soft-incompatible sets (non-unique items)', () => {
        it('should report soft-incompatible when same non-unique item has different materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Head", sheet.itemById(NON_UNIQUE_HAT_ID));
            setA.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(NON_UNIQUE_HAT_ID));
            setB.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('soft-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].slotKey).to.equal('Head');
            expect(report.incompatibleSlots[0].reason).to.equal('materia-mismatch');
            expect(report.incompatibleSlots[0].hardBlocker).to.be.false;
            expect(report.incompatibleSlots[0].subIssues[0]).to.eq('Slot 1: 36 CRT ≠ 36 DET');
        });

        it('should report soft-incompatible when one set has materia and other does not', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Head", sheet.itemById(NON_UNIQUE_HAT_ID));
            setA.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(NON_UNIQUE_HAT_ID));
            // No materia

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('soft-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].reason).to.equal('materia-mismatch');
            expect(report.incompatibleSlots[0].hardBlocker).to.be.false;
        });

        it('should report soft-incompatible for multiple differing materia slots', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Head", sheet.itemById(NON_UNIQUE_HAT_ID));
            setA.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.equipment.Head.melds[1].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(NON_UNIQUE_HAT_ID));
            setB.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);
            setB.equipment.Head.melds[1].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('soft-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].subIssues[0]).to.eq('Slot 1: 36 CRT ≠ 36 DET');
            expect(report.incompatibleSlots[0].subIssues[1]).to.eq('Slot 2: 36 DET ≠ 36 PIE');
        });
    });

    describe('hard-incompatible sets (unique items)', () => {
        it('should report hard-incompatible when unique item has different materia', () => {

            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip('Head', sheet.itemById(UNIQUE_HAT_ID));
            setA.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip('Head', sheet.itemById(UNIQUE_HAT_ID));
            setB.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].reason).to.equal('materia-mismatch');
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
        });
    });

    describe('relic stat incompatibilities', () => {
        it('should report hard-incompatible when relic has different stats', () => {
            const relicWeapon = sheet.itemById(RELIC_WEAPON_ID);
            expect(relicWeapon.isCustomRelic).to.be.true;

            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Weapon", relicWeapon);
            setA.equipment.Weapon.relicStats!.crit = 100;
            setA.equipment.Weapon.relicStats!.determination = 50;

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Weapon", relicWeapon);
            setB.equipment.Weapon.relicStats!.crit = 80;
            setB.equipment.Weapon.relicStats!.determination = 50;

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].reason).to.equal('relic-stat-mismatch');
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
            expect(report.incompatibleSlots[0].subIssues[0]).to.eq('crit: 100 ≠ 80');
        });

        it('should report compatible when relic has identical stats', () => {
            const relicWeapon = sheet.itemById(RELIC_WEAPON_ID);
            expect(relicWeapon.isCustomRelic).to.be.true;

            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Weapon", relicWeapon);
            setA.equipment.Weapon.relicStats!.crit = 100;
            setA.equipment.Weapon.relicStats!.determination = 50;

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Weapon", relicWeapon);
            setB.equipment.Weapon.relicStats!.crit = 100;
            setB.equipment.Weapon.relicStats!.determination = 50;

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });
    });

    describe('multiple incompatibilities', () => {
        it('should report all incompatible slots', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Head", sheet.itemById(NON_UNIQUE_HAT_ID));
            setA.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("Body", sheet.itemById(NON_UNIQUE_BODY_ID));
            setA.equipment.Body.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(NON_UNIQUE_HAT_ID));
            setB.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);
            setB.setEquip("Body", sheet.itemById(NON_UNIQUE_BODY_ID));
            setB.equipment.Body.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('soft-incompatible');
            expect(report.incompatibleSlots).to.have.length(2);
            expect(report.incompatibleSlots.map(s => s.slotKey)).to.include.members(['Head', 'Body']);
        });

        it('should report hard-incompatible if any slot is a hard blocker', () => {

            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("Head", sheet.itemById(UNIQUE_HAT_ID));
            setA.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip('Body', sheet.itemById(NON_UNIQUE_BODY_ID));
            setA.equipment.Body.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("Head", sheet.itemById(UNIQUE_HAT_ID));
            setB.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);
            setB.setEquip('Body', sheet.itemById(NON_UNIQUE_BODY_ID));
            setB.equipment.Body.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots.length).to.be.greaterThan(0);
            expect(report.incompatibleSlots.some(s => s.hardBlocker)).to.be.true;
        });
    });

    describe('ring compatibility', () => {
        // Ring item IDs from data
        // Dark Horse Champion's Ring of Healing (i730 raid)
        const UNIQUE_RING_1_ID = 43176;
        // 40238 - Ascension Ring of Healing (i660 unique)
        const UNIQUE_RING_2_ID = 40238;
        // 38154 - Abyssos Ring of Healing (i630 unique)
        const UNIQUE_RING_3_ID = 38154;
        // 41911 - Lar Ring of Healing (i645 crafted)
        const NON_UNIQUE_RING_ID = 41911;

        it('compatible when same ring left slots with same materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('hard-incompatible when same unique ring in left slot has different materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].reason).to.equal('materia-mismatch');
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
        });

        it('compatible when same ring is in left slot of one set and right slot of other set with same materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('hard-incompatible when same unique ring is in different slots with different materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
        });

        it('compatible when both sets have two of same ring with same materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(NON_UNIQUE_RING_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(NON_UNIQUE_RING_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(NON_UNIQUE_RING_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setB.setEquip("RingRight", sheet.itemById(NON_UNIQUE_RING_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('compatible when both sets have two of same ring with same materia, but flipped in slots', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(NON_UNIQUE_RING_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(NON_UNIQUE_RING_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            // Swapped positions
            setB.setEquip("RingLeft", sheet.itemById(NON_UNIQUE_RING_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);
            setB.setEquip("RingRight", sheet.itemById(NON_UNIQUE_RING_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('compatible when both sets have same rings with same materia but flipped', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_2_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
        });

        it('incompatible when both sets have same rings with different materia but flipped', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_2_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
        });

        it('hard-incompatible when both sets have two unique rings with one mismatched', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X); // Different

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
        });

        it('hard-incompatible when both sets have two unique rings with both mismatched', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X);
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(2);
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
            expect(report.incompatibleSlots[1].hardBlocker).to.be.true;
        });

        it('hard-incompatible when one set has unique ring once and other has it twice with different materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(2);
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
            expect(report.incompatibleSlots[1].hardBlocker).to.be.true;
        });

        it('compatible when one set has non-unique ring once and other has it twice with one matching', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(NON_UNIQUE_RING_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(NON_UNIQUE_RING_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setB.setEquip("RingRight", sheet.itemById(NON_UNIQUE_RING_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('compatible when sets have different rings', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_3_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X);
            setB.setEquip("RingRight", sheet.itemById(NON_UNIQUE_RING_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('compatible when sets have one overlapping ring and one different ring with matching materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_3_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });

        it('hard-incompatible when sets have one overlapping unique ring with mismatched materia', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            setA.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setA.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setA.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setA.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X); // Different
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_3_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_PIETY_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('hard-incompatible');
            expect(report.incompatibleSlots).to.have.length(1);
            expect(report.incompatibleSlots[0].hardBlocker).to.be.true;
        });

        it('compatible when one set has no rings and other has rings', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            // No rings

            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';
            setB.setEquip("RingLeft", sheet.itemById(UNIQUE_RING_1_ID));
            setB.equipment.RingLeft.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_CRIT_X);
            setB.setEquip("RingRight", sheet.itemById(UNIQUE_RING_2_ID));
            setB.equipment.RingRight.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_DET_X);

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.compatibilityLevel).to.equal('compatible');
            expect(report.incompatibleSlots).to.have.length(0);
        });
    });

    describe('SetCompatibilityReport', () => {
        it('should contain references to both sets', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.setA).to.equal(setA);
            expect(report.setB).to.equal(setB);
        });

        it('should have empty incompatibleSlots array for compatible sets', () => {
            const setA = new CharacterGearSet(sheet);
            setA.name = 'Set A';
            const setB = new CharacterGearSet(sheet);
            setB.name = 'Set B';

            const report = sheet.checkCompatibility(setA, setB);

            expect(report.incompatibleSlots).to.be.an('array');
            expect(report.incompatibleSlots).to.have.length(0);
        });
    });
}).timeout(30_000);
