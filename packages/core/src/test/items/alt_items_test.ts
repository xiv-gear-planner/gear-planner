import {GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../../sheet";
import {CharacterGearSet} from "../../gear";
import {expect} from "chai";
import {ALL_SUB_STATS, MAIN_STATS} from "@xivgear/xivmath/xivconstants";

const ALL_ITEM_BONUS_STATS = [...MAIN_STATS, ...ALL_SUB_STATS];

describe('alt items logic', () => {
    let sheet: GearPlanSheet;

    before(async () => {
        sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Alt Items Test", "SGE", 70, 290, true);
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
            const wepAlts = setA.getAltItemsFor(i300WEP);

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

            for (const wepAlt of wepAlts) {
                expect(wepAlt.usableByJob('SGE'), `Item ${wepAlt.id}: ${wepAlt.name}`).to.be.true;
            }
        });
    });

    describe('alt food', () => {

        it('should correctly filter alt food with hardcoded examples', () => {
            const set = new CharacterGearSet(sheet);

            // Base food: Baked Eggplant (i640)
            // Crit +10% (cap 62), Det +10% (cap 103), Vit +10% (cap 143)
            // i290 sync: 36 crit, 29 det, 29 Vit
            const baseFood = sheet.foodById(39872);

            // 1. Strictly better: Caramel Popcorn (i770)
            // Stats: Crit +10% (cap 91), Det +10% (cap 151), Vit +10% (cap 297)
            // Same stats, higher ilvl/magnitude.
            // i290 sync: 36 Crit, 29 Det, 29 Vit (Equivalent after sync)
            const betterFood = sheet.foodById(49240);

            // 2. Same stats, lower magnitude, but syncs same: Robe Lettuce Salad (i450)
            // Stats: Crit +10% (cap 37), Det +10% (cap 62), Vit +10% (cap 62)
            // i290 sync: 36 Crit, 29 Det, 29 Vit (Equivalent after sync)
            const syncedSameFood = sheet.foodById(27886);

            // 3. Different stats: Steamed Catfish (i290)
            // Stats: DH +10% (cap 54), Det +10% (cap 32), Vit +10% (cap 57)
            // Has DH instead of Crit, so not an alt.
            const differentStatsFood = sheet.foodById(19831);

            // 4. Same stats, lower magnitude, sync doesn't help: Popoto Salad (i290)
            // Stats: Crit +10% (cap 34), Det +10% (cap 20), Vit +10% (cap 36)
            // i290 sync: 34 Crit, 11 Det, 29 Vit
            // Lower than base, so not an alt
            const strictlyWorseFood = sheet.foodById(19830);

            const alts = set.getAltFoodFor(baseFood);

            // Strictly better (syncs the same) should be an alt
            expect(alts).to.contain(betterFood, 'Higher ilvl food with same stats should be an alt');
            // Lower ilvl but syncs the same
            expect(alts).to.contain(syncedSameFood, 'Lower ilvl food that syncs to same effective stats should be an alt');

            // Different stats, not alt
            expect(alts).to.not.contain(differentStatsFood, 'Food with different stats should not be an alt');
            // Lower effective values, not alt
            expect(alts).to.not.contain(strictlyWorseFood, 'Food with lower effective stats should not be an alt');

            // Same item is not an alt
            expect(alts).to.not.contain(baseFood, 'Should not contain itself');
        });

        it('should correctly identify alts in unsynced sheet', async () => {
            const sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Alt Items Test", "SGE", 100, undefined, false);
            await sheet.load();

            const set = new CharacterGearSet(sheet);
            // Base food: Baked Eggplant (i640)
            // Crit +10% (cap 62), Det +10% (cap 103), Vit +10% (cap 143)
            const baseFood = sheet.foodById(39872);
            // 1. Strictly better: Caramel Popcorn (i770)
            // Stats: Crit +10% (cap 91), Det +10% (cap 151), Vit +10% (cap 297)
            // Same stats, higher ilvl/magnitude.
            const betterFood = sheet.foodById(49240);

            // 2. Same stats, lower magnitude, this sheet is not synced, so not an alt
            // Stats: Crit +10% (cap 37), Det +10% (cap 62), Vit +10% (cap 62)
            const worseFood1 = sheet.foodById(27886);

            // 3. Different stats: Steamed Catfish (i290)
            // Stats: DH +10% (cap 54), Det +10% (cap 32), Vit +10% (cap 57)
            // Has DH instead of Crit, so not an alt.
            const differentStatsFood = sheet.foodById(19831);

            // 4. Same stats, lower magnitude, sync doesn't help: Popoto Salad (i290)
            // Stats: Crit +10% (cap 34), Det +10% (cap 20), Vit +10% (cap 36)
            // i290 sync: 34 Crit, 11 Det, 29 Vit
            // Lower than base, so not an alt
            const worseFood2 = sheet.foodById(19830);

            const alts = set.getAltFoodFor(baseFood);

            // Strictly better
            expect(alts).to.contain(betterFood, 'Higher ilvl food with same stats should be an alt');

            // Different stats or lower magnitude should not be alts
            expect(alts).to.not.contain(differentStatsFood, 'Food with different stats should not be an alt');

            // Lower stats, not an alt
            expect(alts).to.not.contain(worseFood1, 'Lower ilvl food that syncs to same effective stats should be an alt');
            expect(alts).to.not.contain(worseFood2, 'Food with lower effective stats should not be an alt');

            // Should not contain self
            expect(alts).to.not.contain(baseFood, 'Should not contain itself');
        });

        it('should correctly filter alt food using a hardcoded base and dynamic checks', () => {
            const set = new CharacterGearSet(sheet);

            // Base food: Baked Eggplant (i640)
            // i290 sync: 36 Crit, 29 Det, 29 Vit
            const baseFood = sheet.foodById(39872);
            const baseEffective = set.getEffectiveFoodBonuses(baseFood);

            const alts = set.getAltFoodFor(baseFood);

            // Self check
            expect(alts).to.not.contain(baseFood);

            alts.forEach(alt => {
                const altEffective = set.getEffectiveFoodBonuses(alt);

                // Speeds must match exactly
                expect(altEffective.skillspeed ?? 0).to.equal(baseEffective.skillspeed ?? 0, `Skill speed mismatch for ${alt.name}`);
                expect(altEffective.spellspeed ?? 0).to.equal(baseEffective.spellspeed ?? 0, `Spell speed mismatch for ${alt.name}`);

                // Other stats must be >= base
                for (const stat of ALL_ITEM_BONUS_STATS) {
                    if (stat === 'skillspeed' || stat === 'spellspeed') {
                        continue;
                    }
                    expect(altEffective[stat] ?? 0).to.be.at.least(baseEffective[stat] ?? 0, `Stat ${stat} for ${alt.name} should be at least ${baseEffective[stat] ?? 0}`);
                }
            });

            // Hardcoded check for known alt
            const betterFood = sheet.foodById(49240); // Caramel Popcorn i770
            expect(alts).to.contain(betterFood);

            // Hardcoded check for known non-alt
            const strictlyWorseFood = sheet.foodById(19830); // Popoto Salad i290
            expect(alts).to.not.contain(strictlyWorseFood);
        });
    });

    describe('alt medicine', () => {
        it('should return only relevant medicines with equivalent or better effective stats', () => {
            const set = new CharacterGearSet(sheet);
            const baseMedicine = sheet.allMedicineItems.find(medicine =>
                (medicine.primaryStat !== 'vitality' && set.isStatRelevant(medicine.primaryStat))
                || (medicine.secondaryStat !== 'vitality' && set.isStatRelevant(medicine.secondaryStat)));
            if (!baseMedicine) {
                throw new Error('Expected at least one relevant medicine');
            }

            const medicines = sheet.allMedicineItems;
            const originalLength = medicines.length;
            const equivalentMedicine = {
                ...baseMedicine,
                id: baseMedicine.id + 100000,
                ilvl: baseMedicine.ilvl + 1,
            };
            medicines.push(equivalentMedicine);

            const baseBonuses = set.getEffectiveMedicineBonuses(baseMedicine);
            const alts = set.getAltMedicineFor(baseMedicine);

            try {
                expect(alts).to.contain(equivalentMedicine, 'Equivalent medicine should be an alt');
                expect(alts).not.to.contain(baseMedicine, 'Should not contain itself');
                for (const alt of alts) {
                    expect(
                        (alt.primaryStat !== 'vitality' && set.isStatRelevant(alt.primaryStat))
                        || (alt.secondaryStat !== 'vitality' && set.isStatRelevant(alt.secondaryStat)),
                        `Medicine ${alt.id} should provide a relevant stat`
                    ).to.be.true;

                    const altBonuses = set.getEffectiveMedicineBonuses(alt);
                    for (const stat of ALL_ITEM_BONUS_STATS) {
                        if (stat === 'skillspeed' || stat === 'spellspeed') {
                            expect(altBonuses[stat]).to.equal(baseBonuses[stat], `${stat} should match for ${alt.name}`);
                        }
                        else {
                            expect(altBonuses[stat]).to.be.at.least(baseBonuses[stat], `${stat} should not be lower for ${alt.name}`);
                        }
                    }
                }

                const irrelevantMedicine = medicines.find(medicine =>
                    !(medicine.primaryStat !== 'vitality' && set.isStatRelevant(medicine.primaryStat))
                    && !(medicine.secondaryStat !== 'vitality' && set.isStatRelevant(medicine.secondaryStat)));
                if (irrelevantMedicine) {
                    expect(alts).not.to.contain(irrelevantMedicine, 'Medicine with no relevant stats should not be an alt');
                }
            }
            finally {
                medicines.splice(originalLength);
            }
        });
        it('should list a custom relic as an alt if it could make the same stats as another relic', () => {
            // Majestic Manderville Wings (i645) 39937
            const mmb = sheet.itemById(39937);
            // Should be equivalent to Mandervillious Wings (i665) 40949
            const mw = sheet.itemById(40949);
            // These are both synced down
            const set = new CharacterGearSet(sheet);
            const emmb = set.toEquippedItem(mmb);
            emmb.relicStats.crit = 293;
            emmb.relicStats.determination = 293;
            emmb.relicStats.piety = 72;
            const alts = set.getAltItemsFor(mmb);
            expect(alts).to.contain(mw);
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
