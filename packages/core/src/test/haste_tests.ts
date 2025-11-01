import {PersonalBuff} from "../sims/sim_types";
import {combineBuffEffects} from "../sims/sim_utils";
import {expect} from "chai";
import {combineHasteTypes} from "@xivgear/xivmath/xivmath";

let curBuffId = 1;

function makeHasteBuff(haste: number): PersonalBuff {
    return {
        name: "test buff",
        maxStackingDuration: 0,
        statusId: curBuffId++,
        effects: {
            haste: haste,
        },
    };
}

// buff haste, gear haste, job haste
const buff1 = makeHasteBuff(20);
const buff2 = makeHasteBuff(20);
const buff3 = makeHasteBuff(25);
// Dynamis dice, Fuka, Honed Acuity
const dynDice = makeHasteBuff(5);
const fuka = makeHasteBuff(13);
const honed = makeHasteBuff(20);


describe('haste', () => {
    describe('combineBuffEffects haste', () => {
        it('combines simple buffs correctly, no roundoff', () => {
            // 20haste + 20haste + 25haste = (.8 * .8 * .75) = .48
            const combined = combineBuffEffects([buff1, buff2, buff3]);
            expect(combined.haste).to.equal(52);
        });
        describe('combines buffs correctly with roundoff', () => {
            it('permutation 1', () => {
                const combined = combineBuffEffects([dynDice, fuka, honed]);
                expect(combined.haste).to.equal(35);
            });
            it('permutation 2', () => {
                const combined = combineBuffEffects([honed, fuka, dynDice]);
                expect(combined.haste).to.equal(35);
            });
            it('permutation 3', () => {
                const combined = combineBuffEffects([dynDice, honed, fuka]);
                expect(combined.haste).to.equal(34);
            });
            it('permutation 4', () => {
                const combined = combineBuffEffects([honed, dynDice, fuka]);
                expect(combined.haste).to.equal(34);
            });
            it('permutation 5', () => {
                const combined = combineBuffEffects([fuka, dynDice, honed]);
                expect(combined.haste).to.equal(35);
            });
            it('permutation 2', () => {
                const combined = combineBuffEffects([fuka, honed, dynDice]);
                expect(combined.haste).to.equal(35);
            });
        });
    });
    describe('xivmath combineHaste function', () => {
        it('computes values correctly, no roundoff', () => {
            expect(combineHasteTypes(20, 20, 25)).to.equal(52);
        });
        describe('computes values with roundoff', () => {
            it('permutation 1', () => {
                expect(combineHasteTypes(5, 13, 20)).to.equal(35);
            });
            it('permutation 2', () => {
                expect(combineHasteTypes(20, 13, 5)).to.equal(35);
            });
            it('permutation 3', () => {
                expect(combineHasteTypes(5, 20, 13)).to.equal(34);
            });
            it('permutation 4', () => {
                expect(combineHasteTypes(20, 5, 13)).to.equal(34);
            });
            it('permutation 5', () => {
                expect(combineHasteTypes(13, 5, 20)).to.equal(35);
            });
            it('permutation 6', () => {
                expect(combineHasteTypes(13, 20, 5)).to.equal(35);
            });

        });
    });

});
