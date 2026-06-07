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

        // Equip it all
        set.setEquip('Weapon', afflatusHammer);
        set.setEquip('OffHand', afflatusFile);
        set.setEquip('Ears', afflatusEar);

        {
            set.forceRecalc();
            const computed = set.computedStats;
            expect(computed.control).to.eq(1276);
            expect(computed.craftsmanship).to.eq(2485);
            // -10 because it doesn't have the materia
            expect(computed.cp).to.eq(264 - 10);
        }

        set.equipment.Ears.melds[0].equippedMateria = sheet.getMateriaById(33939);


        // Checked vs in-game values
        {
            set.forceRecalc();
            const computed = set.computedStats;
            expect(computed.control).to.eq(1276);
            expect(computed.craftsmanship).to.eq(2485);
            expect(computed.cp).to.eq(264);
        }

        set.equipment.Weapon.melds[0].equippedMateria = sheet.getMateriaById(33939);
        // It will overcap a little bit - it gives 10 CP but the cap is 7
        {
            set.forceRecalc();
            const computed = set.computedStats;
            expect(computed.control).to.eq(1276);
            expect(computed.craftsmanship).to.eq(2485);
            expect(computed.cp).to.eq(264 + 7);
        }
    });
});

describe('DoL stats tests', () => {
    let sheet: GearPlanSheet;

    before(async () => {
        sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "DoH Items Test", 'MIN', 100, undefined, false);
        await sheet.load();
    });
    it('can equip items with correct stats', () => {

        const set = new CharacterGearSet(sheet);
        const afflatusPick = sheet.itemById(39833);
        const afflatusSledge = sheet.itemById(39844);
        const afflatusEar = sheet.itemById(39860);
        const everseekerBody = sheet.itemById(44438);

        // Direct stats
        expect(afflatusPick.stats.vitality).to.equal(159);
        expect(afflatusPick.stats.gathering).to.equal(1227);
        expect(afflatusPick.stats.perception).to.equal(701);
        expect(afflatusPick.stats.gp).to.equal(0);

        expect(afflatusSledge.stats.vitality).to.equal(0);
        expect(afflatusSledge.stats.gathering).to.equal(701);
        expect(afflatusSledge.stats.perception).to.equal(1227);
        expect(afflatusSledge.stats.gp).to.equal(0);

        expect(afflatusEar.stats.vitality).to.equal(0);
        expect(afflatusEar.stats.gathering).to.equal(0);
        expect(afflatusEar.stats.perception).to.equal(0);
        expect(afflatusEar.stats.gp).to.equal(98);

        expect(everseekerBody.stats.vitality).to.equal(205);
        expect(everseekerBody.stats.gathering).to.equal(905);
        expect(everseekerBody.stats.perception).to.equal(453);
        expect(everseekerBody.stats.gp).to.equal(9);

        // Stat caps
        expect(afflatusPick.statCaps.gathering).to.equal(1444);
        expect(afflatusPick.statCaps.perception).to.equal(825);
        expect(afflatusPick.statCaps.gp).to.equal(9);

        expect(afflatusSledge.statCaps.gathering).to.equal(825);
        expect(afflatusSledge.statCaps.perception).to.equal(1444);
        expect(afflatusSledge.statCaps.gp).to.equal(9);

        expect(afflatusEar.statCaps.gathering).to.equal(41);
        expect(afflatusEar.statCaps.perception).to.equal(41);
        expect(afflatusEar.statCaps.gp).to.equal(115);

        // Adding a 4th item since the above items would have identical gathering and perception, so if they were
        // somehow flipped, the tests would still pass.
        expect(everseekerBody.statCaps.gathering).to.equal(1065);
        expect(everseekerBody.statCaps.perception).to.equal(533);
        expect(everseekerBody.statCaps.gp).to.equal(10);

        // Equip it all
        set.setEquip('Weapon', afflatusPick);
        set.setEquip('OffHand', afflatusSledge);
        set.setEquip('Ears', afflatusEar);
        set.setEquip('Body', everseekerBody);

        {
            set.forceRecalc();
            const computed = set.computedStats;
            expect(computed.gathering).to.eq(2833);
            expect(computed.perception).to.eq(2381);
            // -10 because it doesn't have the materia
            expect(computed.gp).to.eq(507);
        }

        // Provides 11 GP
        const gpMateria = sheet.getMateriaById(41777);
        set.equipment.Ears.melds[0].equippedMateria = gpMateria;

        // Checked vs in-game values
        {
            set.forceRecalc();
            const computed = set.computedStats;
            expect(computed.gathering).to.eq(2833);
            expect(computed.perception).to.eq(2381);
            expect(computed.gp).to.eq(507 + 11);
        }

        set.equipment.Weapon.melds[0].equippedMateria = gpMateria;
        // It will overcap a little bit - it gives 10 gp but the cap is 7
        {
            set.forceRecalc();
            const computed = set.computedStats;
            expect(computed.gathering).to.eq(2833);
            expect(computed.perception).to.eq(2381);
            // This one only provides 9
            expect(computed.gp).to.eq(507 + 11 + 9);
        }
    });
});
