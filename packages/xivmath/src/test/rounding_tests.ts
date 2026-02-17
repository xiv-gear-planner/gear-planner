import {cl, clp, fl, flp} from "../xivmath";
import {expect} from "chai";

describe('enhanced rounding funcs', () => {
    describe('fl', () => {
        it('basic functionality', () => {
            expect(fl(5.5)).to.eq(5);
        });
        it('problem case', () => {
            expect(2.3 * 100).to.eq(229.99999999999997);
            expect(Math.floor(2.3 * 100)).to.eq(229);
            expect(fl(2.3 * 100)).to.eq(230);
        });
    });
    describe('flp', () => {
        it('basic functionality', () => {
            expect(flp(3, 5.56789)).to.eq(5.567);
        });
        it('problem case', () => {
            expect(2.3 * 100).to.eq(229.99999999999997);
            expect(Math.floor(2.3 * 100)).to.eq(229);
            expect(flp(3, 2.3 * 100)).to.eq(230);
        });
    });
    describe('cl', () => {
        it('basic functionality', () => {
            expect(cl(5.5)).to.eq(6);
        });
        it('problem case', () => {
            expect(1.1 * 100).to.eq(110.00000000000001);
            expect(Math.ceil(1.1 * 100)).to.eq(111);
            expect(cl(1.1 * 100)).to.eq(110);
        });
    });
    describe('clp', () => {
        it('basic functionality', () => {
            expect(clp(3, 5.56789)).to.eq(5.568);
        });
        it('problem case', () => {
            expect(1.1 * 100).to.eq(110.00000000000001);
            expect(Math.ceil(1.1 * 100)).to.eq(111);
            expect(clp(3, 1.1 * 100)).to.eq(110);
        });
    });
});
