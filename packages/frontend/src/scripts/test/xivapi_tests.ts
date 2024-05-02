import {xivApiIconUrl} from "../external/xivapi";
import assert from "assert";

describe('xivapi Icon URL formatter', () => {
    it('can do a low-res icon', () => {
        const url = xivApiIconUrl(19581);
        assert.equal(url, 'https://xivapi.com/i/019000/019581.png');
    });
    it('can do a high-res icon', () => {
        const url = xivApiIconUrl(19581, true);
        assert.equal(url, 'https://xivapi.com/i/019000/019581_hr1.png');
    });
});