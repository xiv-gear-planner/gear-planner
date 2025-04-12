import {MateriaMemory} from "../gear";
import {
    EquippedItem,
    GearItem,
    Materia,
    MateriaSlot,
    MeldableMateriaSlot,
    RawStats, SlotMateriaMemoryExport
} from "@xivgear/xivmath/geartypes";
import {expect} from "chai";
import {toTranslatable} from "@xivgear/i18n/translation";

describe("Materia Memory", () => {
    it("can save and restore", () => {
        const mem = new MateriaMemory();
        const gi1: GearItem = {
            id: 1234,
        } as GearItem;
        const slot: MateriaSlot = {
            allowsHighGrade: true,
            maxGrade: 12,
            ilvl: 999,
        };
        const mat1: Materia = {
            iconUrl: undefined,
            id: 1001,
            isHighGrade: true,
            materiaGrade: 12,
            name: "Test Materia",
            nameTranslation: toTranslatable("Test Materia"),
            primaryStat: 'determination',
            primaryStatValue: 50,
            stats: new RawStats({
                determination: 50,
            }),
            ilvl: 690,
        };
        const mat2: Materia = {
            iconUrl: undefined,
            id: 1002,
            isHighGrade: true,
            materiaGrade: 11,
            name: "Test Materia",
            nameTranslation: toTranslatable("Test Materia"),
            primaryStat: 'dhit',
            primaryStatValue: 10,
            stats: new RawStats({
                dhit: 10,
            }),
            ilvl: 690,
        };
        // TODO: when 'locked' becomes part of the export, update this test
        const slots1: MeldableMateriaSlot[] = [
            {
                materiaSlot: slot,
                equippedMateria: mat1,
                locked: false,
            },
            {
                materiaSlot: slot,
                equippedMateria: mat2,
                locked: true,
            },
        ];
        const slots2: MeldableMateriaSlot[] = [
            {
                materiaSlot: slot,
                equippedMateria: undefined,
                locked: true,
            },
            {
                materiaSlot: slot,
                equippedMateria: mat1,
                locked: false,
            },
        ];
        // Equip the same item in both slots
        const eq1: EquippedItem = new EquippedItem(gi1, slots1);
        const eq2: EquippedItem = new EquippedItem(gi1, slots2);
        mem.set("RingLeft", eq1);
        mem.set("RingRight", eq2);

        // Verify behavior
        expect(mem.get("RingLeft", eq1.gearItem)).to.deep.equal([{
            id: mat1.id,
            locked: false,
        }, {
            id: mat2.id,
            locked: true,
        }]);
        expect(mem.get("RingRight", eq2.gearItem)).to.deep.equal([{
            id: -1,
            locked: true,
        }, {
            id: mat1.id,
            locked: false,
        }]);

        const exported = mem.export();

        expect(exported.RingLeft).to.deep.equal([[1234, [mat1.id, mat2.id], [false, true]]]);
        expect(exported.RingRight).to.deep.equal([[1234, [-1, mat1.id], [true, false]]]);

        const imported = new MateriaMemory();
        // serialize and deserialize to check that it isn't dependent on anything else
        imported.import(JSON.parse(JSON.stringify(exported)));

        // Verify behavior after reimporting
        expect(imported.get("RingLeft", eq1.gearItem)).to.deep.equal([{
            id: mat1.id,
            locked: false,
        }, {
            id: mat2.id,
            locked: true,
        }]);
        expect(imported.get("RingRight", eq2.gearItem)).to.deep.equal([{
            id: -1,
            locked: true,
        }, {
            id: mat1.id,
            locked: false,
        }]);

        // Verify that older exported sets can still be imported
        const legacyImported = new MateriaMemory();
        for (const slotKey in exported) {
            // @ts-expect-error indexing
            const exportedSlotMaterias: SlotMateriaMemoryExport[] = exported[slotKey];
            for (const exportedSlotMateria of exportedSlotMaterias) {
                exportedSlotMateria.splice(2, 1);
            }
        }
        legacyImported.import(JSON.parse(JSON.stringify(exported)));
        // Verify behavior after reimporting
        expect(legacyImported.get("RingLeft", eq1.gearItem)).to.deep.equal([{
            id: mat1.id,
            locked: false,
        }, {
            id: mat2.id,
            locked: false,
        }]);
        expect(legacyImported.get("RingRight", eq2.gearItem)).to.deep.equal([{
            id: -1,
            locked: false,
        }, {
            id: mat1.id,
            locked: false,
        }]);

    });
});
