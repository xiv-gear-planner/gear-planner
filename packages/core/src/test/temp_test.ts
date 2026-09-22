import {RawStats} from "@xivgear/xivmath/geartypes";
import {EMPTY_STATS} from "@xivgear/xivmath/xivconstants";
import * as assert from "assert";

describe('foo', () => {
    it('bar', () => {
        const f1 = new RawStats();
        const f2 = EMPTY_STATS;
        assert.deepEqual(f1, f2);
    });
});
