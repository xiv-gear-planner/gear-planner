import {xivApiIconUrl} from "@xivgear/core/external/xivapi";
import assert from "assert";

describe('xivapi Icon URL formatter', () => {
    it('can do a low-res icon', () => {
        const url = xivApiIconUrl(19581);
        assert.equal(url, 'https://beta.xivapi.com/api/1/asset/ui/icon/019000/019581.tex?format=png');
    });
    it('can do a high-res icon', () => {
        const url = xivApiIconUrl(19581, true);
        assert.equal(url, 'https://beta.xivapi.com/api/1/asset/ui/icon/019000/019581_hr1.tex?format=png');
    });
});
