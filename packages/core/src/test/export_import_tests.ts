import {CharacterGearSet} from "../gear";
import {ExportTypes, GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../sheet";
import {expect} from "chai";
import {potRatioSimSpec} from "../sims/common/potency_ratio";
import {registerDefaultSims} from "../sims/default_sims";


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
            registerDefaultSims();
            sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Foo", "WHM", 100, 735, false);
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
            // Start with no sims
            while (sheet.sims.length > 0) {
                sheet.delSim(sheet.sims[0]);
            }

            // Add two sims, one included in export by default, one not
            const sim1 = potRatioSimSpec.makeNewSimInstance();
            sim1.displayName = "Sim 1";
            sim1.settings.includeInExport = true;
            sheet.addSim(sim1);

            const sim2 = potRatioSimSpec.makeNewSimInstance();
            sim2.displayName = "Sim 2";
            sim2.settings.includeInExport = false;
            sheet.addSim(sim2);

        });
        it('can export set correctly', async () => {
            const setExport = sheet.exportGearSet(set, true);
            expect(setExport.race).to.eq('Wildwood');
            expect(setExport.partyBonus).to.eq(3);
            expect(setExport.ilvlSync).to.eq(735);
            expect(setExport.name).to.eq("Bar");
            expect(setExport.items.Weapon.id).to.eq(WEAPON_ID);
            expect(setExport.items.Weapon.materia[0].id).to.eq(MATERIA_ID);
            expect(setExport.items.Head.id).to.eq(HAT_ID);
            expect(setExport.items.Head.materia[0].id).to.eq(MATERIA_ID);

            expect(setExport.jobOverride).to.be.oneOf([undefined, null]);
            expect(setExport.job).to.equal('WHM');
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

            expect(newSheet.isMultiJob).to.be.false;
            expect(newSet.jobOverride).to.be.null;
            expect(newSet.job).to.equal('WHM');
        });
        it('can export sheet and import as a fresh sheet', async () => {
            const sheetExport = sheet.exportSheet(ExportTypes.ExternalExport);
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

            expect(newSheet.isMultiJob).to.be.false;
            expect(newSet.jobOverride).to.be.null;
            expect(newSet.job).to.equal('WHM');
        });
        it('can export set and import onto a sheet', async () => {
            const setExport = sheet.exportGearSet(set, true);
            // Note that we are doing a cross-job import
            const newSheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Foo2", 'SGE', 90, 665, false);
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

            expect(newSheet.isMultiJob).to.be.false;
            expect(newSet.jobOverride).to.be.null;
            expect(newSet.job).to.equal('SGE');
        });
        describe('handles sims correctly on export', () => {
            describe('correctly filters sims and other fields based on SheetExportOptions', () => {

                it('Case 1: InternalSave - Should include all sims and saveKey, no stats', async () => {
                    const exported = sheet.exportSheet(ExportTypes.InternalSave);
                    expect(exported.sims).to.have.length(2);
                    expect(exported.saveKey).to.equal(sheet.saveKey);
                    expect(exported.sets[0]).to.not.have.property("computedStats");

                    const newSheet = HEADLESS_SHEET_PROVIDER.fromExport(exported);
                    await newSheet.load();
                    expect(newSheet.sims.length).to.equal(2);
                    expect(newSheet.sims.map(s => s.displayName)).to.include("Sim 1");
                    expect(newSheet.sims.map(s => s.displayName)).to.include("Sim 2");
                });

                it('Case 2: ExternalExport - Should only include sims with includeInExport=true, no saveKey, no stats', async () => {
                    const exported = sheet.exportSheet(ExportTypes.ExternalExport);
                    expect(exported.sims).to.have.length(1);
                    expect(exported.saveKey).to.be.undefined;
                    expect(exported.sets[0]).to.not.have.property("computedStats");

                    const newSheet = HEADLESS_SHEET_PROVIDER.fromExport(exported);
                    await newSheet.load();
                    expect(newSheet.sims.length).to.equal(1);
                    expect(newSheet.sims[0].displayName).to.equal("Sim 1");
                });

                it('Case 3: SolverExport - Should include no sims, no saveKey, no stats', async () => {
                    const exported = sheet.exportSheet(ExportTypes.SolverExport);
                    expect(exported.sims).to.have.length(0);
                    expect(exported.saveKey).to.be.undefined;
                    expect(exported.sets[0]).to.not.have.property("computedStats");

                    const newSheet = HEADLESS_SHEET_PROVIDER.fromExport(exported);
                    await newSheet.load();
                    expect(newSheet.sims.length).to.equal(0);
                });

                it('Case 4: InternalSaveAs - Should include all sims, no saveKey, no stats', async () => {
                    const exported = sheet.exportSheet(ExportTypes.InternalSaveAs);
                    expect(exported.sims).to.have.length(2);
                    expect(exported.saveKey).to.be.undefined;
                    expect(exported.sets[0]).to.not.have.property("computedStats");

                    const newSheet = HEADLESS_SHEET_PROVIDER.fromExport(exported);
                    await newSheet.load();
                    expect(newSheet.sims.length).to.equal(2);
                    expect(newSheet.sims.map(s => s.displayName)).to.include("Sim 1");
                    expect(newSheet.sims.map(s => s.displayName)).to.include("Sim 2");
                });

                it('Case 5: FullStatsExport - Should include all sims, no saveKey, include stats', async () => {
                    const exported = sheet.exportSheet(ExportTypes.FullStatsExport);
                    expect(exported.sims).to.have.length(2);
                    expect(exported.saveKey).to.be.undefined;
                    expect(exported.sets[0].computedStats).to.not.be.undefined;
                    expect(exported.sets[0].computedStats.critMulti).to.be.a('number');

                    const newSheet = HEADLESS_SHEET_PROVIDER.fromExport(exported);
                    await newSheet.load();
                    expect(newSheet.sims.length).to.equal(2);
                    expect(newSheet.sims.map(s => s.displayName)).to.include("Sim 1");
                    expect(newSheet.sims.map(s => s.displayName)).to.include("Sim 2");
                });
            });
        });
    });
    describe('can export and import multi-job sheets', async () => {

        // Cane of Ascension (i665 WHM cane)
        const WEAPON_ID = 40173;
        const WEAPON_ID_SGE = 44739;
        // Credendum Circlet of Healing (i650)
        const HAT_ID = 40060;
        // Crit X materia
        const MATERIA_ID = 33932;

        let sheet: GearPlanSheet;
        let set: CharacterGearSet;
        // set with Job Override
        let setJO: CharacterGearSet;

        before(async () => {
            sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Foo", "WHM", 100, 735, true);
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

            setJO = new CharacterGearSet(sheet);
            setJO.earlySetJobOverride('SGE');
            setJO.name = 'Bar';
            setJO.setEquip("Weapon", sheet.itemById(WEAPON_ID_SGE));
            setJO.equipment.Weapon.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_ID);
            setJO.setEquip("Head", sheet.itemById(HAT_ID));
            setJO.equipment.Head.melds[0].equippedMateria = sheet.getMateriaById(MATERIA_ID);
            setJO.forceRecalc();
            sheet.addGearSet(setJO);
        });
        it('always sets jobOverride even for default job', async () => {
            expect(set.job).to.eq('WHM');
            expect(set.jobOverride).to.eq('WHM');
        });
        it('can export non-override set correctly', async () => {
            const setExport = sheet.exportGearSet(set, true);
            expect(setExport.race).to.eq('Wildwood');
            expect(setExport.partyBonus).to.eq(3);
            expect(setExport.ilvlSync).to.eq(735);
            expect(setExport.name).to.eq("Bar");
            expect(setExport.items.Weapon.id).to.eq(WEAPON_ID);
            expect(setExport.items.Weapon.materia[0].id).to.eq(MATERIA_ID);
            expect(setExport.items.Head.id).to.eq(HAT_ID);
            expect(setExport.items.Head.materia[0].id).to.eq(MATERIA_ID);

            expect(setExport.jobOverride).to.be.oneOf([undefined, null]);
            expect(setExport.job).to.eq('WHM');
        });
        it('can export job override set correctly', async () => {
            const setExport = sheet.exportGearSet(setJO, true);
            expect(setExport.race).to.eq('Wildwood');
            expect(setExport.partyBonus).to.eq(3);
            expect(setExport.ilvlSync).to.eq(735);
            expect(setExport.name).to.eq("Bar");
            expect(setExport.items.Weapon.id).to.eq(WEAPON_ID_SGE);
            expect(setExport.items.Weapon.materia[0].id).to.eq(MATERIA_ID);
            expect(setExport.items.Head.id).to.eq(HAT_ID);
            expect(setExport.items.Head.materia[0].id).to.eq(MATERIA_ID);

            expect(setExport.jobOverride).to.be.oneOf([undefined, null]);
            expect(setExport.job).to.eq('SGE');
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

            expect(newSheet.isMultiJob).to.be.false;
            expect(newSet.jobOverride).to.be.null;
            expect(newSet.job).to.equal('WHM');
        });
        it('can export sheet and import as a fresh sheet', async () => {
            const sheetExport = sheet.exportSheet(ExportTypes.ExternalExport);
            const newSheet = HEADLESS_SHEET_PROVIDER.fromExport(sheetExport);
            await newSheet.load();
            expect(newSheet.race).to.equal('Wildwood');
            expect(newSheet.partyBonus).to.equal(3);
            // Should come from set name
            expect(newSheet.sheetName).to.equal('Foo');

            expect(newSheet.sets).to.have.length(2);
            {
                const newSet = newSheet.sets[0];

                expect(newSet.name).to.equal('Bar');
                const weapon = newSet.equipment.Weapon;
                expect(weapon.gearItem.id).to.equal(WEAPON_ID);
                expect(weapon.melds[0].equippedMateria.id).to.equal(MATERIA_ID);

                expect(newSheet.isMultiJob).to.be.true;
                expect(newSet.jobOverride).to.eq('WHM');
                expect(newSet.job).to.equal('WHM');
            }

            {
                const newSet = newSheet.sets[1];

                expect(newSet.name).to.equal('Bar');
                const weapon = newSet.equipment.Weapon;
                expect(weapon.gearItem.id).to.equal(WEAPON_ID_SGE);
                expect(weapon.melds[0].equippedMateria.id).to.equal(MATERIA_ID);

                expect(newSheet.isMultiJob).to.be.true;
                expect(newSet.jobOverride).to.eq('SGE');
                expect(newSet.job).to.equal('SGE');
            }
        });
        it('can export set and import onto a non-multijob sheet', async () => {
            const setExport = sheet.exportGearSet(set, true);
            // Note that we are doing a cross-job import
            const newSheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Foo2", 'SGE', 90, 665, false);
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

            expect(newSheet.isMultiJob).to.be.false;
            expect(newSet.jobOverride).to.be.null;
            expect(newSet.job).to.equal('SGE');
        });
        it('can export set and import onto a multijob sheet', async () => {
            const setExport = sheet.exportGearSet(set, true);
            expect(setExport.job).to.equal('WHM');
            // Note that we are doing a cross-job import
            const newSheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Foo2", 'SGE', 90, 665, true);
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

            // Weapon is retained because this is a multi-job sheet
            expect(newSet.equipment.Weapon.gearItem.id).to.eq(WEAPON_ID);
            const hat = newSet.equipment.Head;
            expect(hat.gearItem.id).to.equal(HAT_ID);
            expect(hat.melds[0].equippedMateria.id).to.equal(MATERIA_ID);

            expect(newSheet.isMultiJob).to.be.true;
            expect(newSet.jobOverride).to.eq('WHM');
            expect(newSet.job).to.equal('WHM');
        });
    });
}).timeout(30_000);
