import {DataApiEquipSlotMap} from "../datamanager_new";
import {expect} from "chai";
import {EquipSlots} from "@xivgear/xivmath/geartypes";
import {FakeLocalStorage} from "./test_utils";
import {HEADLESS_SHEET_PROVIDER} from "../sheet";
import {CharacterGearSet} from "../gear";
import {EquipSlotCategory} from "@xivgear/data-api-client/dataapi";

describe('DataApiEquipSlotMap', () => {
    it('should map slots correctly for single-slot item', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 1,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.displayGearSlotName).to.eq('Body');
        expect(daesm.getBlockedSlots()).to.be.empty;
        EquipSlots.forEach(slot => {
            if (slot === 'Body') {
                expect(daesm.canEquipTo(slot)).to.be.true;
            }
            else {
                expect(daesm.canEquipTo(slot)).to.be.false;
            }
        });
    });
    it('should map slots correctly for slot-blocking item (ChestLegsFeet)', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 1,
            ears: 0,
            feet: -1,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: -1,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('ChestLegsFeet');
        expect(daesm.displayGearSlotName).to.eq('Body');
        expect(daesm.getBlockedSlots()).to.deep.eq(['Legs', 'Feet']);
        EquipSlots.forEach(slot => {
            if (slot === 'Body') {
                expect(daesm.canEquipTo(slot)).to.be.true;
            }
            else {
                expect(daesm.canEquipTo(slot)).to.be.false;
            }
        });
    });
    it('should map slots correctly for Weapon2H', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 1,
            neck: 0,
            offHand: -1,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Weapon2H');
        expect(daesm.displayGearSlotName).to.eq('Weapon');
        expect(daesm.getBlockedSlots()).to.deep.eq(['OffHand']);
        expect(daesm.canEquipTo('Weapon')).to.be.true;
        expect(daesm.canEquipTo('OffHand')).to.be.false;
    });
    it('should map slots correctly for Weapon1H', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 1,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Weapon1H');
        expect(daesm.displayGearSlotName).to.eq('Weapon');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('Weapon')).to.be.true;
        expect(daesm.canEquipTo('OffHand')).to.be.false;
    });
    it('should map slots correctly for Ring', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 1,
            fingerR: 1,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Ring');
        expect(daesm.displayGearSlotName).to.eq('Ring');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('RingLeft')).to.be.true;
        expect(daesm.canEquipTo('RingRight')).to.be.true;
    });
    it('should map slots correctly for ChestHeadLegsFeet', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 1,
            ears: 0,
            feet: -1,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: -1,
            legs: -1,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('ChestHeadLegsFeet');
        expect(daesm.displayGearSlotName).to.eq('Body');
        expect(daesm.getBlockedSlots()).to.deep.eq(['Head', 'Legs', 'Feet']);
        expect(daesm.canEquipTo('Body')).to.be.true;
        expect(daesm.canEquipTo('Head')).to.be.false;
        expect(daesm.canEquipTo('Legs')).to.be.false;
        expect(daesm.canEquipTo('Feet')).to.be.false;
    });
    it('should map slots correctly for ChestHead', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 1,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: -1,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('ChestHead');
        expect(daesm.displayGearSlotName).to.eq('Body');
        expect(daesm.getBlockedSlots()).to.deep.eq(['Head']);
        expect(daesm.canEquipTo('Body')).to.be.true;
        expect(daesm.canEquipTo('Head')).to.be.false;
    });
    it('should map slots correctly for ChestLegsGloves', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 1,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: -1,
            head: 0,
            legs: -1,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('ChestLegsGloves');
        expect(daesm.displayGearSlotName).to.eq('Body');
        expect(daesm.getBlockedSlots()).to.deep.eq(['Hand', 'Legs']);
        expect(daesm.canEquipTo('Body')).to.be.true;
        expect(daesm.canEquipTo('Hand')).to.be.false;
        expect(daesm.canEquipTo('Legs')).to.be.false;
    });
    it('should map slots correctly for HeadChestHandsLegsFeet', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 1,
            ears: 0,
            feet: -1,
            fingerL: 0,
            fingerR: 0,
            gloves: -1,
            head: -1,
            legs: -1,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('HeadChestHandsLegsFeet');
        expect(daesm.displayGearSlotName).to.eq('Body');
        expect(daesm.getBlockedSlots()).to.deep.eq(['Head', 'Hand', 'Legs', 'Feet']);
        expect(daesm.canEquipTo('Body')).to.be.true;
        expect(daesm.canEquipTo('Head')).to.be.false;
        expect(daesm.canEquipTo('Hand')).to.be.false;
        expect(daesm.canEquipTo('Legs')).to.be.false;
        expect(daesm.canEquipTo('Feet')).to.be.false;
    });
    it('should map slots correctly for OffHand', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 1,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('OffHand');
        expect(daesm.displayGearSlotName).to.eq('OffHand');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('OffHand')).to.be.true;
    });
    it('should map slots correctly for Head', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 1,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Head');
        expect(daesm.displayGearSlotName).to.eq('Head');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('Head')).to.be.true;
    });
    it('should map slots correctly for Hand', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 1,
            head: 0,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Hand');
        expect(daesm.displayGearSlotName).to.eq('Hand');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('Hand')).to.be.true;
    });
    it('should map slots correctly for Legs', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 1,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Legs');
        expect(daesm.displayGearSlotName).to.eq('Legs');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('Legs')).to.be.true;
    });
    it('should map slots correctly for Feet', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 1,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Feet');
        expect(daesm.displayGearSlotName).to.eq('Feet');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('Feet')).to.be.true;
    });
    it('should map slots correctly for Ears', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 1,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Ears');
        expect(daesm.displayGearSlotName).to.eq('Ears');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('Ears')).to.be.true;
    });
    it('should map slots correctly for Neck', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 0,
            neck: 1,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Neck');
        expect(daesm.displayGearSlotName).to.eq('Neck');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('Neck')).to.be.true;
    });
    it('should map slots correctly for Wrist', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: 0,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 0,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 1,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('Wrist');
        expect(daesm.displayGearSlotName).to.eq('Wrist');
        expect(daesm.getBlockedSlots()).to.be.empty;
        expect(daesm.canEquipTo('Wrist')).to.be.true;
    });
    it('should map slots correctly for LegsFeet', () => {
        const daesm = new DataApiEquipSlotMap({
            body: 0,
            ears: 0,
            feet: -1,
            fingerL: 0,
            fingerR: 0,
            gloves: 0,
            head: 0,
            legs: 1,
            mainHand: 0,
            neck: 0,
            offHand: 0,
            wrists: 0,
        } as EquipSlotCategory);
        expect(daesm.occGearSlotName).to.eq('LegsFeet');
        expect(daesm.displayGearSlotName).to.eq('Legs');
        expect(daesm.getBlockedSlots()).to.deep.eq(['Feet']);
        expect(daesm.canEquipTo('Legs')).to.be.true;
        expect(daesm.canEquipTo('Feet')).to.be.false;
    });
});

// HEADLESS_SHEET_PROVIDER uses localStorage to save/load, so we still need this
// noinspection JSConstantReassignment
global.localStorage = new FakeLocalStorage();

describe('Slot blocking in gear sets', () => {
    it('should generate a set issue when equipping items in blocked slots', async () => {
        // Create sheet and set
        const sheet = HEADLESS_SHEET_PROVIDER.fromScratch("test", "test", 'BLM', 100, undefined, false);
        await sheet.load();
        const set = new CharacterGearSet(sheet);
        sheet.addGearSet(set);

        // Equip a random weapon so we don't get noise due to the "no weapon" issue
        const weap = sheet.itemById(34051);
        set.setEquip('Weapon', weap);

        // Vermillion Cloak of Casting (24855) additionally blocks the head slot
        const vermillionCloak = sheet.itemById(24855);
        expect(vermillionCloak.occGearSlotName).to.eq('ChestHead');
        expect(vermillionCloak.slotMapping.getBlockedSlots()).to.deep.eq(['Head']);
        set.setEquip('Body', vermillionCloak);

        // Equip any head piece (33977 - Spaekona's Petasos)
        const headPiece = sheet.itemById(33977);
        expect(headPiece.occGearSlotName).to.eq('Head');
        set.setEquip('Head', headPiece);

        // Should generate an issue. The issue should be blamed on the head piece.
        const issues = set.issues;
        expect(issues.length).to.eq(1);
        const issue = issues[0];
        expect(issue.affectedSlots).to.deep.eq(['Head']);
        expect(issue.description).to.include(vermillionCloak.nameTranslation.en);
        expect(issue.severity).to.eq('error');
    }).timeout(30_000);
});

