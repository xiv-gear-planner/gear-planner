import {xivApiIconUrl} from "@xivgear/core/external/xivapi";
import assert from "assert";

describe('xivapi Icon URL formatter', () => {
    it('can do a low-res icon', () => {
        const url = xivApiIconUrl(19581);
        assert.equal(url, 'https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F019000%2F019581.tex&format=webp');
    });
    it('can do a high-res icon', () => {
        const url = xivApiIconUrl(19581, true);
        assert.equal(url, 'https://v2.xivapi.com/api/asset?path=ui%2Ficon%2F019000%2F019581_hr1.tex&format=webp');
    });
});
