import {MateriaMemory} from "../gear";
import {EquippedItem, GearItem, Materia, MateriaSlot, MeldableMateriaSlot, RawStats} from "@xivgear/xivmath/geartypes";
import {expect} from "chai";

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
            primaryStat: 'dhit',
            primaryStatValue: 10,
            stats: new RawStats({
                dhit: 10,
            }),
            ilvl: 690,
        };
        const slots1: MeldableMateriaSlot[] = [
            {
                materiaSlot: slot,
                equippedMateria: mat1,
            },
            {
                materiaSlot: slot,
                equippedMateria: mat2,
            },
        ];
        const slots2: MeldableMateriaSlot[] = [
            {
                materiaSlot: slot,
                equippedMateria: undefined,
            },
            {
                materiaSlot: slot,
                equippedMateria: mat1,
            },
        ];
        // Equip the same item in both slots
        const eq1: EquippedItem = new EquippedItem(gi1, slots1);
        const eq2: EquippedItem = new EquippedItem(gi1, slots2);
        mem.set("RingLeft", eq1);
        mem.set("RingRight", eq2);

        // Verify behavior
        expect(mem.get("RingLeft", eq1.gearItem)).to.deep.equal([mat1.id, mat2.id,]);
        expect(mem.get("RingRight", eq2.gearItem)).to.deep.equal([-1, mat1.id,]);

        const exported = mem.export();

        expect(exported.RingLeft).to.deep.equal([[1234, [mat1.id, mat2.id,],],]);
        expect(exported.RingRight).to.deep.equal([[1234, [-1, mat1.id,],],]);

        const imported = new MateriaMemory();
        // serialize and deserialize to check that it isn't dependent on anything else
        imported.import(JSON.parse(JSON.stringify(exported)));

        expect(imported.get("RingLeft", eq1.gearItem)).to.deep.equal([mat1.id, mat2.id,]);
        expect(imported.get("RingRight", eq2.gearItem)).to.deep.equal([-1, mat1.id,]);

    });
});
