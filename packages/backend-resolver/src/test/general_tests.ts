import '../polyfills';
import {expect} from "chai";
import {getJobIcons} from "../preload_helpers";
import {ALL_COMBAT_JOBS, JOB_DATA} from "@xivgear/xivmath/xivconstants";

describe('misc helpers', () => {
    describe("getJobIcons", () => {
        it("no condition returns everything", () => {
            const icons = getJobIcons('framed');
            expect(icons).to.have.length(ALL_COMBAT_JOBS.length);
        });

        it("filter works", () => {
            const icons = getJobIcons('frameless', job => JOB_DATA[job].role === 'Healer');
            expect(icons).to.have.length(4);
        });
    });
});
