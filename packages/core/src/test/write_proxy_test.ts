import {writeProxy} from "../util/proxies";
import assert from "assert";

describe('write proxy', () => {
    it('triggers when written to', () => {
        const foo = {
            'bar': 10
        };
        const counter = {
            count: 0
        };
        const proxy = writeProxy(foo, () => counter.count++);
        proxy.bar++;
        assert.equal(counter.count, 1);
    });
    it('triggers when writing a new property', () => {
        const foo = {
        };
        const counter = {
            count: 0
        };
        const proxy = writeProxy(foo, () => counter.count++);
        proxy['bar'] = 5;
        assert.equal(counter.count, 1);
    });
    it('does not trigger when reading', () => {
        const foo = {
            'bar': 10
        };
        const counter = {
            count: 0
        };
        const proxy = writeProxy(foo, () => counter.count++);
        const newVal = proxy.bar + 1;
        assert.equal(newVal, 11);
        assert.equal(counter.count, 0);
    });
});
