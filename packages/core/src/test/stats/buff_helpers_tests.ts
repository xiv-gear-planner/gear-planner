import {Buff} from "../../sims/sim_types";
import {expect} from "chai";
import {buffRelevantAtSnapshot, buffRelevantAtStart, noStatusId} from "../../sims/buff_helpers";

describe("Buff Helpers", () => {
    describe('simple damage buff', () => {
        const buff: Buff = {
            duration: 15,
            selfOnly: true,
            name: "Test buff",
            effects: {
                dmgIncrease: 0.5,
            },
            statusId: noStatusId(),
        };

        it('is not relevant at start', () => {
            expect(buffRelevantAtStart(buff)).to.be.false;
        });

        it('is relevant at snapshot', () => {
            expect(buffRelevantAtSnapshot(buff)).to.be.true;
        });

    });

    describe('simple haste buff', () => {
        const buff: Buff = {
            duration: 15,
            selfOnly: true,
            name: "Test buff",
            effects: {
                haste: 10,
            },
            statusId: noStatusId(),
        };

        it('is relevant at start', () => {
            expect(buffRelevantAtStart(buff)).to.be.true;
        });

        it('is not relevant at snapshot', () => {
            expect(buffRelevantAtSnapshot(buff)).to.be.false;
        });

    });

    describe('no-op buff', () => {

        const buff: Buff = {
            duration: 15,
            selfOnly: true,
            name: "Test buff",
            effects: {},
            statusId: noStatusId(),
        };

        it('is not relevant at start', () => {
            expect(buffRelevantAtStart(buff)).to.be.false;
        });

        it('is relevant at snapshot', () => {
            expect(buffRelevantAtSnapshot(buff)).to.be.true;
        });
    });

    describe('damage + haste buff', () => {
        const buff: Buff = {
            duration: 15,
            selfOnly: true,
            name: "Test buff",
            effects: {
                haste: 10,
                dmgIncrease: 0.1,
            },
            statusId: noStatusId(),
        };

        it('is relevant at start', () => {
            expect(buffRelevantAtStart(buff)).to.be.true;
        });

        it('is relevant at snapshot', () => {
            expect(buffRelevantAtSnapshot(buff)).to.be.true;
        });
    });

    describe('buff with beforeAbility hook', () => {
        const buff: Buff = {
            duration: 15,
            selfOnly: true,
            name: "Test buff",
            beforeAbility() {
            },
            effects: {},
            statusId: noStatusId(),
        };

        it('is relevant at start', () => {
            expect(buffRelevantAtStart(buff)).to.be.true;
        });

        it('is not relevant at snapshot', () => {
            expect(buffRelevantAtSnapshot(buff)).to.be.false;
        });

    });

    describe('buff with beforeSnapshot hook', () => {
        const buff: Buff = {
            duration: 15,
            selfOnly: true,
            name: "Test buff",
            beforeSnapshot() {
            },
            effects: {},
            statusId: noStatusId(),
        };

        it('is not relevant at start', () => {
            expect(buffRelevantAtStart(buff)).to.be.false;
        });

        it('is relevant at snapshot', () => {
            expect(buffRelevantAtSnapshot(buff)).to.be.true;
        });

    });


    describe('buff with modifyDamage hook', () => {
        const buff: Buff = {
            duration: 15,
            selfOnly: true,
            name: "Test buff",
            modifyDamage() {
            },
            effects: {},
            statusId: noStatusId(),
        };

        it('is not relevant at start', () => {
            expect(buffRelevantAtStart(buff)).to.be.false;
        });

        it('is relevant at snapshot', () => {
            expect(buffRelevantAtSnapshot(buff)).to.be.true;
        });

    });

});
