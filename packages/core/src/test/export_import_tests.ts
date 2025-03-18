import {CharacterGearSet} from "../gear";
import {GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../sheet";
import {expect} from "chai";


describe('importing and exporting', () => {
    describe('can export and import', async () => {

        // Cane of Ascension (i665 WHM cane)
        const WEAPON_ID = 40173;
        // Credendum Circlet of Healing (i650)
        const HAT_ID = 40060;
        // Crit X materia
        const MATERIA_ID = 33932;

        let sheet: GearPlanSheet;
        let set: CharacterGearSet;

        before(async () => {
            sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Foo", "WHM", 100, 735);
            await sheet.load();
            sheet.race = 'Wildwood';
            sheet.partyBonus = 3;
            // If default set added, delete it
            if (sheet.sets.length > 0) {
                sheet.delGearSet(sheet.sets[0]);
            }
            set = new CharacterGearSet(sheet);
            set.name = 'Bar';
            set.setEquip("Weapon", sheet.itemById(WEAPON_ID));
            set.equipment.Weapon.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_ID);
            set.setEquip("Head", sheet.itemById(HAT_ID));
            set.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_ID);
            set.forceRecalc();
            sheet.addGearSet(set);
        });
        it('can export sheet correctly', async () => {
            const setExport = sheet.exportGearSet(set, true);
            expect(setExport.race).to.eq('Wildwood');
            expect(setExport.partyBonus).to.eq(3);
            expect(setExport.ilvlSync).to.eq(735);
            expect(setExport.name).to.eq("Bar");
            expect(setExport.items.Weapon.id).to.eq(WEAPON_ID);
            expect(setExport.items.Weapon.materia[0].id).to.eq(MATERIA_ID);
            expect(setExport.items.Head.id).to.eq(HAT_ID);
            expect(setExport.items.Head.materia[0].id).to.eq(MATERIA_ID);
        });
        it('can export set and import as a fresh sheet', async () => {
            const setExport = sheet.exportGearSet(set, true);
            const newSheet = HEADLESS_SHEET_PROVIDER.fromSetExport(setExport);
            await newSheet.load();
            expect(newSheet.race).to.equal('Wildwood');
            expect(newSheet.partyBonus).to.equal(3);
            // Should come from set name
            expect(newSheet.sheetName).to.equal('Bar');

            expect(newSheet.sets).to.have.length(1);
            const newSet = newSheet.sets[0];

            expect(newSet.name).to.equal('Bar');
            const weapon = newSet.equipment.Weapon;
            expect(weapon.gearItem.id).to.equal(WEAPON_ID);
            expect(weapon.melds[0].equippedMateria.id).to.equal(MATERIA_ID);
        });
        it('can export sheet and import as a fresh sheet', async () => {
            const sheetExport = sheet.exportSheet(true);
            const newSheet = HEADLESS_SHEET_PROVIDER.fromExport(sheetExport);
            await newSheet.load();
            expect(newSheet.race).to.equal('Wildwood');
            expect(newSheet.partyBonus).to.equal(3);
            // Should come from set name
            expect(newSheet.sheetName).to.equal('Foo');

            expect(newSheet.sets).to.have.length(1);
            const newSet = newSheet.sets[0];

            expect(newSet.name).to.equal('Bar');
            const weapon = newSet.equipment.Weapon;
            expect(weapon.gearItem.id).to.equal(WEAPON_ID);
            expect(weapon.melds[0].equippedMateria.id).to.equal(MATERIA_ID);
        });
        it('can export set and import onto a sheet', async () => {
            const setExport = sheet.exportGearSet(set, true);
            // Note that we are doing a cross-job import
            const newSheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Foo2", 'SGE', 90, 665);
            await newSheet.load();
            // If default set added, delete it
            if (newSheet.sets.length > 0) {
                newSheet.delGearSet(newSheet.sets[0]);
            }
            expect(newSheet.sets).to.have.length(0);
            newSheet.addGearSet(newSheet.importGearSet(setExport));
            expect(newSheet.sets).to.have.length(1);

            // Does not keep these
            expect(newSheet.race).to.equal(undefined);
            expect(newSheet.partyBonus).to.equal(5);
            // Should come from set name
            expect(newSheet.sheetName).to.equal('Foo2');

            const newSet = newSheet.sets[0];

            expect(newSet.name).to.equal('Bar');

            // Weapon is forcibly deleted because we can't use a WHM weapon on a SGE sheet
            expect(newSet.equipment.Weapon).to.be.null;
            const hat = newSet.equipment.Head;
            expect(hat.gearItem.id).to.equal(HAT_ID);
            expect(hat.melds[0].equippedMateria.id).to.equal(MATERIA_ID);
        });
    });
}).timeout(30_000);
